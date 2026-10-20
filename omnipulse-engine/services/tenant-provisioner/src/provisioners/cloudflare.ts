import { request } from 'undici';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CloudflareApiResponse,
  CloudflareCustomHostnameItem,
  ProvisioningStatus,
} from '../types.js';

export interface CloudflareProvisionerOptions {
  apiToken?: string;
  zoneId?: string;
  apiBaseUrl?: string;
  pollTimeoutMs?: number;
  pollIntervalMs?: number;
}

export class CloudflareProvisioner {
  private apiToken: string;
  private zoneId: string;
  private apiBaseUrl: string;
  private pollTimeoutMs: number;
  private pollIntervalMs: number;

  constructor(
    private supabase: SupabaseClient,
    options?: CloudflareProvisionerOptions
  ) {
    this.apiToken =
      options?.apiToken ||
      process.env.CLOUDFLARE_API_TOKEN ||
      process.env.CF_API_TOKEN ||
      '';
    this.zoneId =
      options?.zoneId ||
      process.env.CLOUDFLARE_ZONE_ID ||
      process.env.CF_ZONE_ID ||
      '';
    this.apiBaseUrl =
      options?.apiBaseUrl ||
      process.env.CLOUDFLARE_API_BASE ||
      'https://api.cloudflare.com/client/v4';
    this.pollTimeoutMs =
      options?.pollTimeoutMs ||
      Number(process.env.CLOUDFLARE_POLL_TIMEOUT_MS) ||
      15 * 60 * 1000; // 15 minutes max
    this.pollIntervalMs =
      options?.pollIntervalMs ||
      Number(process.env.CLOUDFLARE_POLL_INTERVAL_MS) ||
      15 * 1000; // 15 seconds
  }

  /**
   * Provision a custom hostname on Cloudflare and monitor SSL certificate issuance.
   */
  public async provisionHostname(
    hostname: string,
    targetTable: string = 'registered_domains',
    recordId?: string
  ): Promise<{ hostnameId: string; sslActive: boolean; status: string }> {
    console.log(`[CloudflareProvisioner] Starting provisioning for hostname: ${hostname}`);

    if (!this.apiToken || !this.zoneId) {
      console.warn(
        `[CloudflareProvisioner] CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID not configured. Simulating provision in mock mode for: ${hostname}`
      );
      const mockId = `cf_mock_${Buffer.from(hostname).toString('hex').slice(0, 16)}`;
      await this.saveHostnameIdToDb(targetTable, hostname, mockId, 'active', recordId);
      return { hostnameId: mockId, sslActive: true, status: 'active (simulated)' };
    }

    const cleanHostname = hostname.trim().toLowerCase();
    let hostnameId = '';
    let initialStatus = 'initializing';

    // 1. Create Custom Hostname (or fetch if already exists on 409)
    try {
      const endpoint = `${this.apiBaseUrl}/zones/${this.zoneId}/custom_hostnames`;
      const response = await request(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hostname: cleanHostname,
          ssl: {
            method: 'http',
            type: 'dv',
            wildcard: false,
          },
        }),
      });

      const statusCode = response.statusCode;
      const responseBody = (await response.body.json()) as CloudflareApiResponse<CloudflareCustomHostnameItem>;

      if (statusCode === 201 || (statusCode === 200 && responseBody.success)) {
        hostnameId = responseBody.result.id;
        initialStatus = responseBody.result.ssl?.status || responseBody.result.status;
        console.log(`[CloudflareProvisioner] Created custom hostname ID: ${hostnameId} (status: ${initialStatus})`);
      } else if (statusCode === 409) {
        // 409 Conflict: Hostname already exists under zone. Fetch existing ID.
        console.log(`[CloudflareProvisioner] Hostname ${cleanHostname} already exists (409 Conflict). Querying existing record.`);
        const existing = await this.getExistingCustomHostname(cleanHostname);
        if (!existing) {
          throw new Error(`Cloudflare 409 Conflict received, but unable to locate existing hostname for ${cleanHostname}`);
        }
        hostnameId = existing.id;
        initialStatus = existing.ssl?.status || existing.status;
        console.log(`[CloudflareProvisioner] Found existing custom hostname ID: ${hostnameId} (status: ${initialStatus})`);
      } else {
        const errMsg = responseBody.errors?.map((e) => e.message).join(', ') || `HTTP ${statusCode}`;
        throw new Error(`Cloudflare API error provisioning ${cleanHostname}: ${errMsg}`);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('409')) {
        const existing = await this.getExistingCustomHostname(cleanHostname);
        if (existing) {
          hostnameId = existing.id;
          initialStatus = existing.ssl?.status || existing.status;
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    // 2. Save hostnameId to database immediately
    await this.saveHostnameIdToDb(targetTable, cleanHostname, hostnameId, initialStatus, recordId);

    // 3. If already active, return immediately
    if (initialStatus === 'active') {
      return { hostnameId, sslActive: true, status: 'active' };
    }

    // 4. Poll SSL status until active or timeout (max 15 min)
    const sslActive = await this.pollSslStatus(hostnameId, cleanHostname, targetTable, recordId);

    return {
      hostnameId,
      sslActive,
      status: sslActive ? 'active' : 'pending_validation',
    };
  }

  /**
   * Look up an existing custom hostname by its FQDN
   */
  public async getExistingCustomHostname(hostname: string): Promise<CloudflareCustomHostnameItem | null> {
    const endpoint = `${this.apiBaseUrl}/zones/${this.zoneId}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`;
    const response = await request(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.statusCode !== 200) {
      return null;
    }

    const data = (await response.body.json()) as CloudflareApiResponse<CloudflareCustomHostnameItem[]>;
    if (data.success && Array.isArray(data.result) && data.result.length > 0) {
      return data.result[0];
    }
    return null;
  }

  /**
   * Poll Cloudflare for SSL status until 'active' or timeout
   */
  private async pollSslStatus(
    hostnameId: string,
    hostname: string,
    targetTable: string,
    recordId?: string
  ): Promise<boolean> {
    const startTime = Date.now();
    console.log(`[CloudflareProvisioner] Polling SSL status for ${hostname} (ID: ${hostnameId}). Timeout: ${this.pollTimeoutMs}ms`);

    while (Date.now() - startTime < this.pollTimeoutMs) {
      try {
        const endpoint = `${this.apiBaseUrl}/zones/${this.zoneId}/custom_hostnames/${hostnameId}`;
        const response = await request(endpoint, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.statusCode === 200) {
          const data = (await response.body.json()) as CloudflareApiResponse<CloudflareCustomHostnameItem>;
          const sslStatus = data.result?.ssl?.status;
          console.log(`[CloudflareProvisioner] Hostname ${hostname} current SSL status: ${sslStatus}`);

          if (sslStatus === 'active') {
            await this.updateSslStatusInDb(targetTable, hostname, 'passed', 'active', recordId);
            return true;
          }
        }
      } catch (err: any) {
        console.warn(`[CloudflareProvisioner] Transient poll error for ${hostname}:`, err.message);
      }

      // Wait before next poll attempt
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }

    console.warn(`[CloudflareProvisioner] SSL polling timed out for ${hostname} after ${this.pollTimeoutMs / 1000}s`);
    await this.updateSslStatusInDb(targetTable, hostname, 'inconclusive', 'pending_validation', recordId);
    return false;
  }

  /**
   * Persist returned cloudflare_hostname_id to Supabase
   */
  private async saveHostnameIdToDb(
    targetTable: string,
    hostname: string,
    hostnameId: string,
    sslStatus: string,
    recordId?: string
  ): Promise<void> {
    try {
      const updateData: Record<string, any> = {
        cloudflare_hostname_id: hostnameId,
        tls_status: sslStatus === 'active' ? 'passed' : 'pending',
        updated_at: new Date().toISOString(),
      };

      let query = this.supabase.from(targetTable).update(updateData);
      if (recordId) {
        query = query.eq('id', recordId);
      } else {
        query = query.eq('hostname', hostname);
      }

      const { error } = await query;
      if (error) {
        console.error(`[CloudflareProvisioner] Failed to update ${targetTable} with hostname ID:`, error);
      } else {
        console.log(`[CloudflareProvisioner] Successfully saved cloudflare_hostname_id to ${targetTable} for ${hostname}`);
      }
    } catch (err) {
      console.error(`[CloudflareProvisioner] Error updating database:`, err);
    }
  }

  /**
   * Update SSL / TLS status in Supabase
   */
  private async updateSslStatusInDb(
    targetTable: string,
    hostname: string,
    tlsStatus: 'passed' | 'failed' | 'inconclusive',
    sslStatus: string,
    recordId?: string
  ): Promise<void> {
    try {
      const updateData: Record<string, any> = {
        tls_status: tlsStatus,
        updated_at: new Date().toISOString(),
      };

      let query = this.supabase.from(targetTable).update(updateData);
      if (recordId) {
        query = query.eq('id', recordId);
      } else {
        query = query.eq('hostname', hostname);
      }

      await query;
    } catch (err) {
      console.error(`[CloudflareProvisioner] Error updating TLS status:`, err);
    }
  }
}
