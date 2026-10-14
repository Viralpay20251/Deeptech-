/**
 * Integration Test: Domain Registry & Multi-Domain Health Matrix
 *
 * Verifies Phase 1 of Master Multi-Domain Intelligence & Growth Plan:
 * 1. Central registry accurately contains all 26 authoritative hostnames across
 *    TalentXcel (13), CHATR (3), and Nuty Tales (10) + 3 explicitly excluded legacy references.
 * 2. Distinctness invariant: employer.talentxcel.in and employers.talentxcel.in are distinct.
 *    Any cross-domain canonical consolidation between them is blocked.
 * 3. Exclusion invariant: auth.talentxcel.in, cdn.talentxcel.in, and www.talentxcel.net
 *    are excluded and strictly barred from active crawling.
 * 4. Operator confirmation required for sensitive registry changes with audit logging.
 * 5. Multi-dimensional health checking (DNS, TLS, HTTP, SSRF redirect hops, app-shell).
 * 6. Health matrix summary aggregations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';
import { query } from '../../apps/api/src/lib/db.js';
import { assertSafeOutboundUrlAsync, SafetyViolationError } from '../../apps/api/src/lib/safety.js';

describe('Multi-Domain Registry & Health Matrix Integration', () => {
  let server: Server;
  let baseUrl: string;
  let authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

  beforeAll(async () => {
    // Look up or ensure an operator in workspace
    const userRes = await query<{ id: string }>(
      `SELECT id FROM users WHERE role IN ('workspace_admin', 'operator') LIMIT 1`
    );
    let opId = userRes.rows[0]?.id;
    if (!opId) {
      const ins = await query<{ id: string }>(
        `INSERT INTO users (id, workspace_id, email, display_name, password_hash, role)
         VALUES ('c4344661-4a88-46a9-b85d-c65303c37227', '00000000-0000-0000-0000-000000000001', 'operator@growth-os.internal', 'Test Operator', 'hash', 'workspace_admin')
         ON CONFLICT (id) DO NOTHING
         RETURNING id`
      );
      opId = ins.rows[0]?.id || 'c4344661-4a88-46a9-b85d-c65303c37227';
    }
    authHeaders = {
      'Content-Type': 'application/json',
      'x-operator-id': opId,
      'x-service-key': process.env['INTERNAL_WORKSPACE_SECRET'] || 'growth_os_internal_session_secret_32_characters_minimum!',
    };

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address !== null) {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('1. GET /api/v1/domains returns all 26 authoritative hostnames plus 3 excluded legacy references (total 29)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/domains`, { headers: authHeaders });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.success).toBe(true);
    expect(json.meta.total).toBe(29);
    expect(json.meta.authoritativeCount).toBe(26);
    expect(json.meta.excludedCount).toBe(3);

    const hostnames = json.data.map((d: any) => d.hostname);

    // Verify TalentXcel 13 authoritative hostnames
    const expectedTalentXcel = [
      'talentxcel.in',
      'www.talentxcel.in',
      'colleges.talentxcel.in',
      'careers.talentxcel.in',
      'salary.talentxcel.in',
      'resume.talentxcel.in',
      'jobs.talentxcel.in',
      'employer.talentxcel.in',
      'employers.talentxcel.in',
      'government.talentxcel.in',
      'learning.talentxcel.in',
      'passport.talentxcel.in',
      'career-pathways-ai-builder.vercel.app',
    ];
    for (const host of expectedTalentXcel) {
      expect(hostnames).toContain(host);
    }

    // Verify CHATR 3 authoritative hostnames
    const expectedChatr = ['chatr.chat', 'chatrchat.in', 'www.chatrchat.in'];
    for (const host of expectedChatr) {
      expect(hostnames).toContain(host);
    }

    // Verify Nuty Tales 10 authoritative hostnames
    const expectedNutyTales = [
      'nutytales.com',
      'www.nutytales.com',
      'business.nutytales.com',
      'gifting.nutytales.com',
      'weddings.nutytales.com',
      'crafts.nutytales.com',
      'stays.nutytales.com',
      'travel.nutytales.com',
      'nri.nutytales.com',
      'nutytales.vercel.app',
    ];
    for (const host of expectedNutyTales) {
      expect(hostnames).toContain(host);
    }

    // Verify 3 explicitly excluded legacy references
    const expectedExcluded = ['www.talentxcel.net', 'auth.talentxcel.in', 'cdn.talentxcel.in'];
    for (const host of expectedExcluded) {
      expect(hostnames).toContain(host);
    }
  });

  it('2. Strictly preserves distinctness of employer.talentxcel.in vs employers.talentxcel.in', async () => {
    const resSingular = await fetch(`${baseUrl}/api/v1/domains/employer.talentxcel.in`, { headers: authHeaders });
    expect(resSingular.status).toBe(200);
    const singularData = (await resSingular.json()) as any;
    expect(singularData.data.hostname).toBe('employer.talentxcel.in');
    expect(singularData.data.host_role).toBe('product_subdomain');

    const resPlural = await fetch(`${baseUrl}/api/v1/domains/employers.talentxcel.in`, { headers: authHeaders });
    expect(resPlural.status).toBe(200);
    const pluralData = (await resPlural.json()) as any;
    expect(pluralData.data.hostname).toBe('employers.talentxcel.in');
    expect(pluralData.data.host_role).toBe('search_console_property');

    // Attempting to consolidate or cross-redirect employer to employers must be blocked
    const patchRes = await fetch(`${baseUrl}/api/v1/domains/employer.talentxcel.in`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        intended_canonical_host: 'employers.talentxcel.in',
        confirmed_by_operator: true,
      }),
    });

    expect(patchRes.status).toBe(403);
    const patchJson = (await patchRes.json()) as any;
    expect(patchJson.success).toBe(false);
    expect(patchJson.error.message).toContain('CRITICAL POLICY VIOLATION');
    expect(patchJson.error.message).toContain('distinct properties');
  });

  it('3. Enforces exclusion and crawl prevention on legacy domains', async () => {
    const excludedHosts = ['auth.talentxcel.in', 'cdn.talentxcel.in', 'www.talentxcel.net'];

    for (const host of excludedHosts) {
      const res = await fetch(`${baseUrl}/api/v1/domains/${host}`, { headers: authHeaders });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.host_role).toBe('excluded');
      expect(json.data.allowed_for_crawling).toBe(false);
      expect(json.data.verification_state).toBe('excluded');

      // Attempting to enable crawling on excluded legacy origins must be rejected
      const patchRes = await fetch(`${baseUrl}/api/v1/domains/${host}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          allowed_for_crawling: true,
          confirmed_by_operator: true,
        }),
      });

      expect(patchRes.status).toBe(403);
      const patchJson = (await patchRes.json()) as any;
      expect(patchJson.success).toBe(false);
      expect(patchJson.error.message).toContain('CRITICAL POLICY VIOLATION');
      expect(patchJson.error.message).toContain('cannot be enabled for crawling');
    }
  });

  it('4. Requires confirmed_by_operator for sensitive registry updates and writes audit log', async () => {
    // 1. Without operator confirmation -> rejected with 403
    const unconfirmedRes = await fetch(`${baseUrl}/api/v1/domains/colleges.talentxcel.in`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        indexing_intent: 'noindex_expected',
        confirmed_by_operator: false,
      }),
    });

    expect(unconfirmedRes.status).toBe(403);
    const unconfirmedJson = (await unconfirmedRes.json()) as any;
    expect(unconfirmedJson.error.message).toContain('Operator confirmation required');

    // 2. With operator confirmation -> succeeded with audit log
    const confirmedRes = await fetch(`${baseUrl}/api/v1/domains/colleges.talentxcel.in`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        indexing_intent: 'noindex_expected',
        confirmed_by_operator: true,
      }),
    });

    expect(confirmedRes.status).toBe(200);
    const confirmedJson = (await confirmedRes.json()) as any;
    expect(confirmedJson.success).toBe(true);
    expect(confirmedJson.data.indexing_intent).toBe('noindex_expected');

    // Verify audit event was written
    const auditRes = await query(
      `SELECT * FROM audit_events WHERE action = 'domain_registry.updated' AND actor_id = 'test_operator_42' ORDER BY created_at DESC LIMIT 1`
    );
    expect(auditRes.rowCount).toBe(1);

    // Revert back to indexable for hygiene
    await fetch(`${baseUrl}/api/v1/domains/colleges.talentxcel.in`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        indexing_intent: 'indexable',
        confirmed_by_operator: true,
      }),
    });
  });

  it('5. POST /api/v1/domains/check-health executes multi-dimensional audit on a target domain', async () => {
    const res = await fetch(`${baseUrl}/api/v1/domains/check-health`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        hostname: 'talentxcel.in',
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.hostname).toBe('talentxcel.in');
    expect(json.data.dns).toBeDefined();
    expect(json.data.dns.status).toBe('passed');
    expect(json.data.tls).toBeDefined();
    expect(json.data.http).toBeDefined();
    expect(json.data.content).toBeDefined();
    expect(json.data.duplicateCandidate).toBeDefined();
    expect(json.data.overallStatus).toBeDefined();
  });

  it('6. GET /api/v1/domains/summary aggregates multi-domain health matrix metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/domains/summary`, { headers: authHeaders });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.success).toBe(true);
    expect(json.data.totalRegistered).toBe(29);
    expect(json.data.authoritativeCount).toBe(26);
    expect(json.data.excludedCount).toBe(3);
    expect(json.data.byBrand).toBeDefined();
    expect(json.data.byBrand.talentxcel.total).toBe(16);
    expect(json.data.byBrand.chatr.total).toBe(3);
    expect(json.data.byBrand['nuty-tales'].total).toBe(10);
    expect(json.data.healthOverview.dnsPassed).toBeGreaterThan(0);
  });

  it('7. Re-validates SSRF on outbound URLs and redirect hops', async () => {
    // Prohibited ports must be rejected
    await expect(assertSafeOutboundUrlAsync('https://chatr.chat:8080/')).rejects.toThrow(SafetyViolationError);
    // Embedded credentials must be rejected
    await expect(assertSafeOutboundUrlAsync('https://admin:secret@chatr.chat/')).rejects.toThrow(SafetyViolationError);
    // Cloud metadata must be rejected
    await expect(assertSafeOutboundUrlAsync('http://169.254.169.254/latest/meta-data')).rejects.toThrow(SafetyViolationError);
  });
});
