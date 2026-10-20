import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Youtube,
  Instagram,
  Linkedin,
  Twitter,
  Video,
} from 'lucide-react';

export interface SocialAccountItem {
  id: string;
  brand: 'TalentXcel' | 'CHATR' | 'Nuty Tales' | 'TX Academy';
  brandSlug: string;
  platform: 'youtube' | 'tiktok' | 'instagram' | 'twitter' | 'linkedin';
  handle: string;
  profileUrl: string;
  healthStatus: 'healthy' | 'shadowbanned' | 'restricted' | 'warning';
  lastPostedAt: string;
  dailyPostsUsed: number;
  dailyPostLimit: number;
  cookieStatus: 'valid' | 'expiring_soon' | 'expired';
  notes?: string;
}

export function SocialAccountsHealth() {
  const [accounts, setAccounts] = useState<SocialAccountItem[]>([
    {
      id: 'acc-1',
      brand: 'TalentXcel',
      brandSlug: 'talentxcel',
      platform: 'linkedin',
      handle: 'talentxcel-official',
      profileUrl: 'https://linkedin.com/company/talentxcel-official',
      healthStatus: 'healthy',
      lastPostedAt: '45m ago',
      dailyPostsUsed: 3,
      dailyPostLimit: 5,
      cookieStatus: 'valid',
    },
    {
      id: 'acc-2',
      brand: 'TalentXcel',
      brandSlug: 'talentxcel',
      platform: 'youtube',
      handle: '@TalentXcelJobs',
      profileUrl: 'https://youtube.com/@TalentXcelJobs',
      healthStatus: 'healthy',
      lastPostedAt: '2h ago',
      dailyPostsUsed: 2,
      dailyPostLimit: 4,
      cookieStatus: 'valid',
    },
    {
      id: 'acc-3',
      brand: 'TalentXcel',
      brandSlug: 'talentxcel',
      platform: 'twitter',
      handle: '@TalentXcel',
      profileUrl: 'https://x.com/TalentXcel',
      healthStatus: 'warning',
      lastPostedAt: '5h ago',
      dailyPostsUsed: 4,
      dailyPostLimit: 6,
      cookieStatus: 'valid',
      notes: 'Rate limit proximity reached on read-side',
    },
    {
      id: 'acc-4',
      brand: 'CHATR',
      brandSlug: 'chatr',
      platform: 'youtube',
      handle: '@CHATRapp',
      profileUrl: 'https://youtube.com/@CHATRapp',
      healthStatus: 'healthy',
      lastPostedAt: '1h ago',
      dailyPostsUsed: 4,
      dailyPostLimit: 5,
      cookieStatus: 'valid',
    },
    {
      id: 'acc-5',
      brand: 'CHATR',
      brandSlug: 'chatr',
      platform: 'tiktok',
      handle: '@chatr.video',
      profileUrl: 'https://tiktok.com/@chatr.video',
      healthStatus: 'healthy',
      lastPostedAt: '3h ago',
      dailyPostsUsed: 3,
      dailyPostLimit: 5,
      cookieStatus: 'valid',
    },
    {
      id: 'acc-6',
      brand: 'CHATR',
      brandSlug: 'chatr',
      platform: 'instagram',
      handle: '@chatr_global',
      profileUrl: 'https://instagram.com/chatr_global',
      healthStatus: 'shadowbanned',
      lastPostedAt: '18h ago',
      dailyPostsUsed: 1,
      dailyPostLimit: 3,
      cookieStatus: 'valid',
      notes: 'Hashtag reach suppressed by algorithm. Pausing automated hashtags for 48h.',
    },
    {
      id: 'acc-7',
      brand: 'Nuty Tales',
      brandSlug: 'nuty-tales',
      platform: 'instagram',
      handle: '@nutytales',
      profileUrl: 'https://instagram.com/nutytales',
      healthStatus: 'healthy',
      lastPostedAt: '2h ago',
      dailyPostsUsed: 2,
      dailyPostLimit: 4,
      cookieStatus: 'valid',
    },
    {
      id: 'acc-8',
      brand: 'Nuty Tales',
      brandSlug: 'nuty-tales',
      platform: 'youtube',
      handle: '@NutyTalesBites',
      profileUrl: 'https://youtube.com/@NutyTalesBites',
      healthStatus: 'healthy',
      lastPostedAt: '6h ago',
      dailyPostsUsed: 1,
      dailyPostLimit: 3,
      cookieStatus: 'valid',
    },
    {
      id: 'acc-9',
      brand: 'TX Academy',
      brandSlug: 'tx-academy',
      platform: 'tiktok',
      handle: '@txacademy.ai',
      profileUrl: 'https://tiktok.com/@txacademy.ai',
      healthStatus: 'healthy',
      lastPostedAt: '1h ago',
      dailyPostsUsed: 3,
      dailyPostLimit: 4,
      cookieStatus: 'valid',
    },
    {
      id: 'acc-10',
      brand: 'TX Academy',
      brandSlug: 'tx-academy',
      platform: 'youtube',
      handle: '@TXAcademyEngineering',
      profileUrl: 'https://youtube.com/@TXAcademyEngineering',
      healthStatus: 'restricted',
      lastPostedAt: '1d ago',
      dailyPostsUsed: 0,
      dailyPostLimit: 3,
      cookieStatus: 'expiring_soon',
      notes: 'Session refresh needed via Patchright cookie collector.',
    },
  ]);

  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/v1/omnipulse/accounts');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setAccounts(json.data);
        }
      }
    } catch {
      // Keep state
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: 'healthy' | 'shadowbanned' | 'restricted') => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, healthStatus: newStatus } : acc))
    );

    try {
      await fetch(`/api/v1/omnipulse/accounts/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setNotification(`Account status updated to ${newStatus.toUpperCase()}`);
    } catch {
      setNotification(`Updated locally to ${newStatus.toUpperCase()}`);
    }
  };

  // Stats calculation
  const totalAccounts = accounts.length;
  const healthyCount = accounts.filter((a) => a.healthStatus === 'healthy').length;
  const shadowbannedCount = accounts.filter((a) => a.healthStatus === 'shadowbanned').length;
  const restrictedCount = accounts.filter((a) => a.healthStatus === 'restricted' || a.healthStatus === 'warning').length;

  const filteredAccounts = accounts.filter((a) => {
    if (brandFilter !== 'all' && a.brandSlug !== brandFilter) return false;
    if (platformFilter !== 'all' && a.platform !== platformFilter) return false;
    if (statusFilter !== 'all' && a.healthStatus !== statusFilter) return false;
    if (
      searchQuery &&
      !a.handle.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !a.brand.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const renderPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return <Youtube size={16} color="#ef4444" />;
      case 'instagram':
        return <Instagram size={16} color="#ec4899" />;
      case 'linkedin':
        return <Linkedin size={16} color="#3b82f6" />;
      case 'twitter':
        return <Twitter size={16} color="#60a5fa" />;
      case 'tiktok':
        return <Video size={16} color="#06b6d4" />;
      default:
        return <Video size={16} />;
    }
  };

  const renderHealthBadge = (status: 'healthy' | 'shadowbanned' | 'restricted' | 'warning') => {
    switch (status) {
      case 'healthy':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--accent-green)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <CheckCircle2 size={12} />
            Healthy
          </span>
        );
      case 'shadowbanned':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--accent-red)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <XCircle size={12} />
            Shadowbanned
          </span>
        );
      case 'restricted':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--accent-amber)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <AlertTriangle size={12} />
            Restricted
          </span>
        );
      case 'warning':
        return (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--accent-amber)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <AlertTriangle size={12} />
            Rate Throttled
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* ─── Top Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>📱</span>
            <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>
              Social Accounts Health Matrix
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Real-time status, cookie validity, posting quotas, and algorithmic shadowban telemetry across all 5 distribution networks
          </p>
        </div>

        <button
          onClick={fetchAccounts}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          <RefreshCw size={14} />
          Sync Account States
        </button>
      </div>

      {notification && (
        <div
          style={{
            padding: '8px 14px',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid var(--accent-blue)',
            borderRadius: '6px',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}

      {/* ─── Summary Stats ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Connected Accounts</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px' }}>{totalAccounts}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Across 4 Brands</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Healthy Accounts</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--accent-green)' }}>
            {healthyCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--accent-green)', marginTop: '4px' }}>
            {Math.round((healthyCount / (totalAccounts || 1)) * 100)}% operational
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Shadowbanned</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--accent-red)' }}>
            {shadowbannedCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Autonomous cooldown active
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Restricted / Throttled</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: 'var(--accent-amber)' }}>
            {restrictedCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Requires session refresh</div>
        </div>
      </div>

      {/* ─── Search & Filters Bar ───────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          backgroundColor: 'var(--bg-card)',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
          <Search size={16} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Search accounts by handle or brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '13px',
              width: '100%',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
            }}
          >
            <option value="all">All Brands</option>
            <option value="talentxcel">TalentXcel</option>
            <option value="chatr">CHATR</option>
            <option value="nuty-tales">Nuty Tales</option>
            <option value="tx-academy">TX Academy</option>
          </select>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
            }}
          >
            <option value="all">All Platforms</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="twitter">Twitter / X</option>
            <option value="linkedin">LinkedIn</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="healthy">Healthy</option>
            <option value="shadowbanned">Shadowbanned</option>
            <option value="restricted">Restricted</option>
            <option value="warning">Rate Throttled</option>
          </select>
        </div>
      </div>

      {/* ─── Accounts Table ─────────────────────────────────────────── */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Platform</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Account Handle</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Brand</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Health Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Last Posted</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Daily Posts Used</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map((account) => (
              <tr
                key={account.id}
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                }}
              >
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {renderPlatformIcon(account.platform)}
                    <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{account.platform}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <a
                    href={account.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {account.handle}
                    <ExternalLink size={12} color="var(--text-secondary)" />
                  </a>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {account.brand}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>{renderHealthBadge(account.healthStatus)}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{account.lastPostedAt}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '60px', height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(account.dailyPostsUsed / account.dailyPostLimit) * 100}%`,
                          height: '100%',
                          backgroundColor:
                            account.dailyPostsUsed >= account.dailyPostLimit
                              ? 'var(--accent-red)'
                              : 'var(--accent-blue)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {account.dailyPostsUsed}/{account.dailyPostLimit}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    {account.healthStatus !== 'healthy' ? (
                      <button
                        onClick={() => handleUpdateStatus(account.id, 'healthy')}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: 'var(--accent-green)',
                          border: '1px solid var(--accent-green)',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Mark Healthy
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(account.id, 'shadowbanned')}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: 'var(--accent-red)',
                          border: '1px solid var(--accent-red)',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Mark Shadowbanned
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SocialAccountsHealth;
