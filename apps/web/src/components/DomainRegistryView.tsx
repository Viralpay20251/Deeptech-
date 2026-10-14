/**
 * Domain Registry & Multi-Domain Health Matrix View
 *
 * Implements Phase 1 of Master Multi-Domain Intelligence & Growth Plan:
 * - Complete inventory of all 26 authoritative hostnames across TalentXcel, CHATR, and Nuty Tales
 * - Live multi-dimensional health indicators: DNS (A/AAAA/CNAME), TLS cert validity,
 *   HTTP status, redirect hops, canonical alignment, app-shell detection, robots.txt, sitemap.xml.
 * - Enforces boundary invariants:
 *   - Visual separation of employer vs employers
 *   - Legacy excluded references tagged and barred from active crawl
 *   - One-click live audit trigger per host or batch.
 */

import { useState, useEffect } from 'react';

export interface RegisteredDomainItem {
  id: string;
  hostname: string;
  host_role: string;
  brand_id: string;
  brand_name?: string;
  brand_slug?: string;
  intended_canonical_host: string | null;
  canonical_policy_source: string | null;
  expected_redirect_target: string | null;
  expects_redirect: boolean;
  verification_state: string;
  indexing_intent: string;
  allowed_for_crawling: boolean;
  dns_status: string;
  tls_status: string;
  http_status: number | null;
  robots_policy_status: string;
  sitemap_status: string;
  canonical_tag: string | null;
  is_app_shell: boolean | null;
  duplicate_of_hostname: string | null;
  last_checked_at: string | null;
  health_matrix: any;
  notes: string | null;
}

export function DomainRegistryView() {
  const [domains, setDomains] = useState<RegisteredDomainItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [auditingHost, setAuditingHost] = useState<string | null>(null);
  const [batchAuditing, setBatchAuditing] = useState<boolean>(false);
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDomain, setSelectedDomain] = useState<RegisteredDomainItem | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    fetchDomains();
    fetchSummary();
  }, []);

  const fetchDomains = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/domains');
      const json = await res.json();
      if (json.success) {
        setDomains(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch domains', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/v1/domains/summary');
      const json = await res.json();
      if (json.success) {
        setSummary(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch summary', err);
    }
  };

  const runSingleAudit = async (hostname: string) => {
    try {
      setAuditingHost(hostname);
      const res = await fetch('/api/v1/domains/check-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname }),
      });
      const json = await res.json();
      if (json.success) {
        setNotification(`✅ Health audit completed for ${hostname}`);
        fetchDomains();
        fetchSummary();
      } else {
        setNotification(`❌ Audit failed: ${json.error?.message}`);
      }
    } catch (err) {
      setNotification(`❌ Error auditing ${hostname}: ${(err as Error).message}`);
    } finally {
      setAuditingHost(null);
    }
  };

  const runBatchAudit = async () => {
    try {
      setBatchAuditing(true);
      const res = await fetch('/api/v1/domains/check-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const json = await res.json();
      if (json.success) {
        setNotification(`✅ Batch audit completed across ${json.meta?.totalChecked} domains.`);
        fetchDomains();
        fetchSummary();
      } else {
        setNotification(`❌ Batch audit failed: ${json.error?.message}`);
      }
    } catch (err) {
      setNotification(`❌ Batch audit error: ${(err as Error).message}`);
    } finally {
      setBatchAuditing(false);
    }
  };

  const filteredDomains = domains.filter((d) => {
    const matchesBrand = brandFilter === 'all' || d.brand_slug === brandFilter;
    const matchesRole = roleFilter === 'all' || d.host_role === roleFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      d.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.notes && d.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesBrand && matchesRole && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ─── Header & Notice Banner ────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700 }}>
            🌐 Multi-Domain Registry & Health Matrix
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Domain-aware intelligence, DNS/TLS verification, redirect chain tracing, app-shell detection, and canonical governance across 26 authoritative hostnames.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={runBatchAudit}
            disabled={batchAuditing}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: batchAuditing ? 'not-allowed' : 'pointer',
              opacity: batchAuditing ? 0.7 : 1,
            }}
          >
            {batchAuditing ? 'Auditing 26 Domains...' : '⚡ Run Full Multi-Domain Audit'}
          </button>
        </div>
      </div>

      {notification && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: notification.startsWith('✅') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${notification.startsWith('✅') ? '#10b981' : '#ef4444'}`,
            borderRadius: '6px',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{notification}</span>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── KPI Cards ─────────────────────────────────────────────────────── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Hostnames</div>
            <div style={{ fontSize: '24px', fontWeight: 700, margin: '6px 0 2px 0' }}>{summary.totalRegistered}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {summary.authoritativeCount} authoritative · {summary.excludedCount} excluded legacy
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>DNS Verified (A/AAAA)</div>
            <div style={{ fontSize: '24px', fontWeight: 700, margin: '6px 0 2px 0', color: '#10b981' }}>
              {summary.healthOverview?.dnsPassed ?? 0} <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>/ {summary.totalRegistered}</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Resolved via public DNS/getaddrinfo
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>TLS / HTTPS Active</div>
            <div style={{ fontSize: '24px', fontWeight: 700, margin: '6px 0 2px 0', color: '#10b981' }}>
              {summary.healthOverview?.tlsPassed ?? 0} <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>/ {summary.totalRegistered}</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Valid certs with non-expired TTL
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>App Shells Detected</div>
            <div style={{ fontSize: '24px', fontWeight: 700, margin: '6px 0 2px 0', color: '#f59e0b' }}>
              {summary.appShellsDetected?.length ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Visible text &lt; 200 chars (SPA client hydration)
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Duplicate / Deployment</div>
            <div style={{ fontSize: '24px', fontWeight: 700, margin: '6px 0 2px 0', color: '#6366f1' }}>
              {summary.duplicatesDetected?.length ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Vercel app previews & WWW aliases
            </div>
          </div>
        </div>
      )}

      {/* ─── Non-Negotiable Boundary Callout ─────────────────────────────────── */}
      <div
        style={{
          padding: '14px 18px',
          backgroundColor: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '8px',
          fontSize: '12px',
          lineHeight: 1.6,
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🛡️ Boundary & Policy Invariants Enforced in Code
        </div>
        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          <li>
            <strong>Distinct Origins Preserved:</strong> <code>employer.talentxcel.in</code> (singular hiring portal) and <code>employers.talentxcel.in</code> (plural GSC property) are strictly preserved as distinct. Automatic consolidation is barred.
          </li>
          <li>
            <strong>Excluded Origins Barred from Crawl:</strong> <code>www.talentxcel.net</code>, <code>auth.talentxcel.in</code>, and <code>cdn.talentxcel.in</code> are explicitly marked excluded and cannot be scheduled for active crawling or link discovery.
          </li>
          <li>
            <strong>SSRF Protection:</strong> Every outbound probe URL and every redirect hop is independently validated against private IP ranges, cloud metadata addresses, and prohibited ports.
          </li>
        </ul>
      </div>

      {/* ─── Filter Bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '12px 16px',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Brand:</span>
          {[
            { key: 'all', label: `All (${domains.length})` },
            { key: 'talentxcel', label: 'TalentXcel (16)' },
            { key: 'chatr', label: 'CHATR (3)' },
            { key: 'nuty-tales', label: 'Nuty Tales (10)' },
          ].map((b) => (
            <button
              key={b.key}
              onClick={() => setBrandFilter(b.key)}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: brandFilter === b.key ? 'var(--accent-blue)' : 'var(--bg-primary)',
                color: brandFilter === b.key ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Role:</span>
          {[
            { key: 'all', label: 'All Roles' },
            { key: 'primary', label: 'Primary' },
            { key: 'product_subdomain', label: 'Subdomains' },
            { key: 'deployment_host', label: 'Deployment' },
            { key: 'excluded', label: 'Excluded' },
          ].map((r) => (
            <button
              key={r.key}
              onClick={() => setRoleFilter(r.key)}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: roleFilter === r.key ? 'var(--accent-blue)' : 'var(--bg-primary)',
                color: roleFilter === r.key ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter hostname..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '6px 12px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '12px',
            width: '180px',
          }}
        />
      </div>

      {/* ─── Domain Table ───────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Hostname</th>
              <th style={{ padding: '12px 16px' }}>Brand & Role</th>
              <th style={{ padding: '12px 16px' }}>DNS</th>
              <th style={{ padding: '12px 16px' }}>TLS</th>
              <th style={{ padding: '12px 16px' }}>HTTP Status</th>
              <th style={{ padding: '12px 16px' }}>Content / App Shell</th>
              <th style={{ padding: '12px 16px' }}>Canonical Policy</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Loading domain registry...
                </td>
              </tr>
            ) : filteredDomains.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No domains match the selected filters.
                </td>
              </tr>
            ) : (
              filteredDomains.map((d) => (
                <tr
                  key={d.id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: d.host_role === 'excluded' ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.hostname}</div>
                    {d.duplicate_of_hostname && (
                      <div style={{ fontSize: '11px', color: '#6366f1', marginTop: '2px' }}>
                        ↳ Alias/Duplicate of {d.duplicate_of_hostname}
                      </div>
                    )}
                    {d.notes && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '280px' }}>
                        {d.notes}
                      </div>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor:
                          d.brand_slug === 'talentxcel' ? 'rgba(59, 130, 246, 0.1)' :
                          d.brand_slug === 'chatr' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color:
                          d.brand_slug === 'talentxcel' ? '#3b82f6' :
                          d.brand_slug === 'chatr' ? '#10b981' : '#f59e0b',
                        display: 'inline-block',
                        marginBottom: '4px',
                      }}
                    >
                      {d.brand_name || d.brand_slug}
                    </span>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {d.host_role.replace('_', ' ')}
                    </div>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor:
                          d.dns_status === 'passed' ? 'rgba(16, 185, 129, 0.1)' :
                          d.dns_status === 'failed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                        color:
                          d.dns_status === 'passed' ? '#10b981' :
                          d.dns_status === 'failed' ? '#ef4444' : '#9ca3af',
                      }}
                    >
                      {d.dns_status}
                    </span>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor:
                          d.tls_status === 'passed' ? 'rgba(16, 185, 129, 0.1)' :
                          d.tls_status === 'failed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                        color:
                          d.tls_status === 'passed' ? '#10b981' :
                          d.tls_status === 'failed' ? '#ef4444' : '#9ca3af',
                      }}
                    >
                      {d.tls_status}
                    </span>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    {d.http_status ? (
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor:
                            d.http_status >= 200 && d.http_status < 300 ? 'rgba(16, 185, 129, 0.1)' :
                            d.http_status >= 300 && d.http_status < 400 ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color:
                            d.http_status >= 200 && d.http_status < 300 ? '#10b981' :
                            d.http_status >= 300 && d.http_status < 400 ? '#6366f1' : '#ef4444',
                        }}
                      >
                        {d.http_status} {d.expects_redirect ? ' (Redirect)' : ''}
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>N/A</span>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    {d.is_app_shell ? (
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          color: '#f59e0b',
                        }}
                      >
                        ⚡ App Shell (&lt;200c)
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Static / Server HTML
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 500 }}>
                      {d.intended_canonical_host || '—'}
                    </div>
                    {d.canonical_tag && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Observed: {d.canonical_tag}
                      </div>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => runSingleAudit(d.hostname)}
                      disabled={auditingHost === d.hostname}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        cursor: auditingHost === d.hostname ? 'not-allowed' : 'pointer',
                        marginRight: '6px',
                      }}
                    >
                      {auditingHost === d.hostname ? 'Auditing...' : '🔍 Probe'}
                    </button>
                    <button
                      onClick={() => setSelectedDomain(d)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Detail Modal ───────────────────────────────────────────────────── */}
      {selectedDomain && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '24px',
              width: '640px',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                Inspection Details: {selectedDomain.hostname}
              </h3>
              <button
                onClick={() => setSelectedDomain(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>Brand & Role:</strong>
                <div>{selectedDomain.brand_name} · Role: {selectedDomain.host_role} · Indexing: {selectedDomain.indexing_intent}</div>
              </div>

              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>Crawling Permission:</strong>
                <div>
                  Allowed for Crawling: <strong>{selectedDomain.allowed_for_crawling ? 'YES' : 'NO (Excluded Origin)'}</strong>
                </div>
              </div>

              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>Intended Canonical & Redirect Policy:</strong>
                <div>Intended Host: {selectedDomain.intended_canonical_host || 'None'}</div>
                <div>Expected Redirect Target: {selectedDomain.expected_redirect_target || 'None (Direct Response)'}</div>
              </div>

              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>Raw Health Matrix Payload:</strong>
                <pre
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    overflowX: 'auto',
                    maxHeight: '260px',
                  }}
                >
                  {JSON.stringify(selectedDomain.health_matrix, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
