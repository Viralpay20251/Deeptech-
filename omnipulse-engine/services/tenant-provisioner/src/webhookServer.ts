import http, { IncomingMessage, ServerResponse } from 'node:http';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CloudflareProvisioner } from './provisioners/cloudflare.js';
import { GoogleSiteVerifier } from './provisioners/google-verify.js';
import { GSCSitemapSubmitter } from './provisioners/gsc-sitemap.js';
import type { ProvisioningStatus, WebhookDomainAddedPayload } from './types.js';

export interface WebhookServerOptions {
  port?: number;
  internalSecret?: string;
}

export class SupabaseWebhookReceiver {
  private server: http.Server | null = null;
  private port: number;
  private internalSecret: string;
  private activeJobs: Map<string, ProvisioningStatus> = new Map();

  constructor(
    private supabase: SupabaseClient,
    private cfProvisioner: CloudflareProvisioner,
    private gSiteVerifier: GoogleSiteVerifier,
    private gscSitemap: GSCSitemapSubmitter,
    options?: WebhookServerOptions
  ) {
    this.port = options?.port || Number(process.env.PORT) || 3002;
    this.internalSecret =
      options?.internalSecret ||
      process.env.INTERNAL_WORKSPACE_SECRET ||
      process.env.WEBHOOK_SECRET ||
      'growth_os_internal_session_secret_32_characters_minimum!';
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res);
        } catch (err: any) {
          console.error('[SupabaseWebhookReceiver] Request handler error:', err);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
          }
        }
      });

      this.server.listen(this.port, () => {
        console.log(`[SupabaseWebhookReceiver] Tenant Provisioner HTTP service listening on port ${this.port}`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[SupabaseWebhookReceiver] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method?.toUpperCase();

    // CORS headers for admin/dashboard invocation
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health endpoint
    if (pathname === '/health' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          service: 'tenant-provisioner',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          activeJobsCount: this.activeJobs.size,
        })
      );
      return;
    }

    // Provisioning status check
    if (pathname === '/provision/status' && method === 'GET') {
      const hostname = parsedUrl.searchParams.get('hostname');
      if (hostname && this.activeJobs.has(hostname)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, status: this.activeJobs.get(hostname) }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, all: Array.from(this.activeJobs.values()) }));
      return;
    }

    // Webhook endpoint: POST /webhook/domain-added
    if (pathname === '/webhook/domain-added' && method === 'POST') {
      // 1. Authorize via Bearer {INTERNAL_WORKSPACE_SECRET}
      const authHeader = req.headers['authorization'];
      if (!this.isValidAuth(authHeader)) {
        console.warn('[SupabaseWebhookReceiver] Unauthorized webhook invocation rejected');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized', message: 'Invalid or missing Bearer token' }));
        return;
      }

      // 2. Parse body
      const rawBody = await this.readRequestBody(req);
      let payload: WebhookDomainAddedPayload;
      try {
        payload = JSON.parse(rawBody);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Request', message: 'Invalid JSON payload' }));
        return;
      }

      const { hostname, table, id } = this.extractDomainDetails(payload);

      if (!hostname) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Unprocessable Entity',
            message: 'No hostname found in webhook payload',
            payload,
          })
        );
        return;
      }

      // 3. Respond 202 Accepted immediately
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: 'Domain provisioning initiated asynchronously',
          hostname,
          table,
          id,
        })
      );

      // 4. Trigger 3-step provisioning sequence asynchronously
      this.runAsyncProvisioning(hostname, table, id).catch((err) => {
        console.error(`[SupabaseWebhookReceiver] Async provisioning failed for ${hostname}:`, err);
      });
      return;
    }

    // Manual provisioning endpoint (for operators or CLI triggers)
    if (pathname === '/provision/manual' && method === 'POST') {
      const authHeader = req.headers['authorization'];
      if (!this.isValidAuth(authHeader)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const rawBody = await this.readRequestBody(req);
      const { hostname, table = 'registered_domains', id } = JSON.parse(rawBody || '{}');

      if (!hostname) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'hostname required' }));
        return;
      }

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: `Provisioning queued for ${hostname}` }));

      this.runAsyncProvisioning(hostname, table, id).catch((err) => {
        console.error(`[SupabaseWebhookReceiver] Manual provisioning failed for ${hostname}:`, err);
      });
      return;
    }

    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', path: pathname }));
  }

  /**
   * Run the 3-step provisioning sequence:
   * 1. Cloudflare Custom Hostname + SSL
   * 2. Google Site Verification (DNS TXT + webResource)
   * 3. Google Search Console Sitemap Submission
   */
  public async runAsyncProvisioning(hostname: string, table: string, recordId?: string): Promise<ProvisioningStatus> {
    const jobStatus: ProvisioningStatus = {
      hostname,
      table,
      id: recordId,
      gscVerified: false,
      sitemapSubmitted: false,
      errors: [],
    };
    this.activeJobs.set(hostname, jobStatus);

    console.log(`\n============================================================`);
    console.log(`🚀 [TenantProvisioner] STARTING PROVISIONING PIPELINE`);
    console.log(`🎯 Target Hostname: ${hostname} | Table: ${table} | ID: ${recordId || 'N/A'}`);
    console.log(`============================================================\n`);

    try {
      // Step 1: Cloudflare Custom Hostname & SSL
      console.log(`[Step 1/3] Adding Cloudflare Custom Hostname for: ${hostname}`);
      try {
        const cfResult = await this.cfProvisioner.provisionHostname(hostname, table, recordId);
        jobStatus.cloudflareHostnameId = cfResult.hostnameId;
        jobStatus.sslStatus = cfResult.status;
        console.log(`✅ [Step 1/3] Cloudflare Provisioned: ID=${cfResult.hostnameId}, SSL=${cfResult.status}`);
      } catch (cfErr: any) {
        console.error(`❌ [Step 1/3] Cloudflare Provisioning Error:`, cfErr.message);
        jobStatus.errors.push(`Cloudflare: ${cfErr.message}`);
      }

      // Step 2: Google Site Verification (DNS TXT token + verify)
      console.log(`\n[Step 2/3] Initiating Google Site Verification for: ${hostname}`);
      try {
        const token = await this.gSiteVerifier.getVerificationToken(hostname);
        jobStatus.googleToken = token;
        const verifyResult = await this.gSiteVerifier.verifyDomain(hostname, token, table, recordId);
        jobStatus.gscVerified = verifyResult.verified;
        console.log(`✅ [Step 2/3] Google Site Verification: Verified=${verifyResult.verified}`);
      } catch (gErr: any) {
        console.error(`❌ [Step 2/3] Google Site Verification Error:`, gErr.message);
        jobStatus.errors.push(`GoogleVerify: ${gErr.message}`);
      }

      // Step 3: GSC Sitemap Submission
      console.log(`\n[Step 3/3] Submitting sitemap_index.xml to GSC for: ${hostname}`);
      try {
        const sitemapResult = await this.gscSitemap.submitSitemap(hostname, table, recordId);
        jobStatus.sitemapSubmitted = sitemapResult.success;
        console.log(`✅ [Step 3/3] GSC Sitemap Submission: Success=${sitemapResult.success}`);
      } catch (sitemapErr: any) {
        console.error(`❌ [Step 3/3] GSC Sitemap Submission Error:`, sitemapErr.message);
        jobStatus.errors.push(`GSCSitemap: ${sitemapErr.message}`);
      }

      jobStatus.completedAt = new Date().toISOString();
      console.log(`\n🏁 [TenantProvisioner] COMPLETED PROVISIONING PIPELINE for ${hostname}\n`);
    } catch (pipelineErr: any) {
      jobStatus.errors.push(`Pipeline: ${pipelineErr.message}`);
      console.error(`❌ [TenantProvisioner] Pipeline failure:`, pipelineErr);
    } finally {
      this.activeJobs.set(hostname, jobStatus);
    }

    return jobStatus;
  }

  private isValidAuth(authHeader?: string): boolean {
    if (!authHeader) return false;
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    return token === this.internalSecret;
  }

  private readRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  private extractDomainDetails(payload: WebhookDomainAddedPayload): {
    hostname?: string;
    table: string;
    id?: string;
  } {
    // 1. Supabase Webhook payload format
    if (payload.record && typeof payload.record === 'object') {
      const rec = payload.record;
      const hostname = rec.hostname || rec.domain || rec.subdomain;
      const table = payload.table || (rec.dimension_name ? 'pseo_dimension_catalog' : 'registered_domains');
      return { hostname, table, id: rec.id };
    }

    // 2. Direct format
    if (payload.hostname) {
      return {
        hostname: payload.hostname,
        table: payload.table || 'registered_domains',
        id: payload.id,
      };
    }

    return { table: 'registered_domains' };
  }
}
