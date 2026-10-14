/**
 * Multi-Domain Health Audit Runner
 *
 * Runs comprehensive multi-dimensional health check across all 26 authoritative hostnames
 * (+ 3 excluded legacy references) and records live matrix state into PostgreSQL.
 */

import { DomainRegistryService } from '../services/domain-registry-service.js';
import { pool } from '../lib/db.js';
import { logger } from '../lib/logger.js';

async function runAudit() {
  logger.info('Starting Multi-Domain Health Audit across registered domains...');

  const domains = await DomainRegistryService.listDomains();
  logger.info({ count: domains.length }, 'Loaded registered domains from database');

  const authoritative = domains.filter((d) => d.host_role !== 'excluded');
  const excluded = domains.filter((d) => d.host_role === 'excluded');

  console.log(`\n================================================================================`);
  console.log(` AUTONOMOUS GROWTH OS — MULTI-DOMAIN AUDIT RUNNER`);
  console.log(` Authoritative Hostnames: ${authoritative.length} | Excluded Legacy Origins: ${excluded.length}`);
  console.log(`================================================================================\n`);

  const results: Array<{
    hostname: string;
    brand: string;
    role: string;
    dns: string;
    tls: string;
    http: number | null;
    canonicalMatch: boolean;
    appShell: boolean;
    overall: string;
  }> = [];

  for (const d of domains) {
    const start = Date.now();
    try {
      const res = await DomainRegistryService.checkDomainHealth(d.hostname);
      const elapsed = Date.now() - start;

      results.push({
        hostname: d.hostname,
        brand: d.brand_slug || 'unknown',
        role: d.host_role,
        dns: res.dns.status,
        tls: res.tls.status,
        http: res.http.status,
        canonicalMatch: res.content.canonicalMatchesIntended,
        appShell: res.content.isAppShell,
        overall: res.overallStatus,
      });

      console.log(
        `[${res.overallStatus.toUpperCase().padEnd(12)}] ${d.hostname.padEnd(38)} ` +
        `DNS:${res.dns.status.padEnd(7)} TLS:${res.tls.status.padEnd(7)} HTTP:${String(res.http.status || 'N/A').padEnd(4)} ` +
        `AppShell:${res.content.isAppShell ? 'YES' : 'NO '} (${elapsed}ms)`
      );
    } catch (err) {
      console.log(`[ERROR       ] ${d.hostname.padEnd(38)} ${(err as Error).message}`);
    }

    // Pacing delay between probes
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n================================================================================`);
  console.log(` AUDIT SUMMARY`);
  console.log(`================================================================================`);
  const passed = results.filter((r) => r.overall === 'passed').length;
  const failed = results.filter((r) => r.overall === 'failed').length;
  const inconclusive = results.filter((r) => r.overall === 'inconclusive').length;
  const appShells = results.filter((r) => r.appShell).length;

  console.log(`Total Inspected:       ${results.length}`);
  console.log(`Passed (Live & OK):    ${passed}`);
  console.log(`Failed (DNS/Network):  ${failed}`);
  console.log(`Inconclusive/Timeout:  ${inconclusive}`);
  console.log(`App Shells Flagged:    ${appShells}`);
  console.log(`================================================================================\n`);

  await pool.end();
  process.exit(0);
}

runAudit().catch(async (err) => {
  logger.error({ err }, 'Audit script failed');
  await pool.end().catch(() => {});
  process.exit(1);
});
