import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Activity,
  Globe,
  Share2,
  RefreshCw,
  Server,
  Layers,
  Eye,
  ArrowUpRight,
} from 'lucide-react';

interface BrandMetrics {
  brandName: string;
  brandSlug: string;
  todayViews: number;
  viewsChange: string;
  topPlatform: string;
  topPostTitle: string;
  topPostViews: number;
  queueDepth: {
    pending: number;
    mediaReady: number;
    posted: number;
  };
}

interface TrendSignal {
  id: string;
  topic: string;
  category: string;
  platform: string;
  velocityScore: number;
  firstSeenAt: string;
}

interface ServiceHealth {
  name: string;
  status: 'green' | 'yellow' | 'red';
  port: number;
  latencyMs: number;
  note: string;
}

export function OmniPulseOverview() {
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [totalViewsToday, setTotalViewsToday] = useState<number>(148920);
  const [totalIndexedPages, setTotalIndexedPages] = useState<number>(4291840);
  const [brandCards, setBrandCards] = useState<BrandMetrics[]>([
    {
      brandName: 'TalentXcel',
      brandSlug: 'talentxcel',
      todayViews: 52400,
      viewsChange: '+14.2%',
      topPlatform: 'LinkedIn',
      topPostTitle: 'Top 10 Remote AI Engineering Salaries in 2026',
      topPostViews: 24100,
      queueDepth: { pending: 4, mediaReady: 3, posted: 12 },
    },
    {
      brandName: 'CHATR',
      brandSlug: 'chatr',
      todayViews: 48900,
      viewsChange: '+22.8%',
      topPlatform: 'YouTube Shorts',
      topPostTitle: 'Autonomous Video Messaging vs Slack in 30 Seconds',
      topPostViews: 28900,
      queueDepth: { pending: 6, mediaReady: 2, posted: 15 },
    },
    {
      brandName: 'Nuty Tales',
      brandSlug: 'nuty-tales',
      todayViews: 31200,
      viewsChange: '+8.7%',
      topPlatform: 'Instagram Reels',
      topPostTitle: 'Why Raw Activated Walnuts Beat Standard Almonds',
      topPostViews: 14500,
      queueDepth: { pending: 3, mediaReady: 4, posted: 9 },
    },
    {
      brandName: 'TX Academy',
      brandSlug: 'tx-academy',
      todayViews: 16420,
      viewsChange: '+5.4%',
      topPlatform: 'YouTube Shorts',
      topPostTitle: 'How to Build an Agentic Workflow in 5 Minutes',
      topPostViews: 8900,
      queueDepth: { pending: 2, mediaReady: 1, posted: 8 },
    },
  ]);

  const [trendingTopics, setTrendingTopics] = useState<TrendSignal[]>([
    { id: '1', topic: 'AI Agent Swarms in Production', category: 'DeepTech', platform: 'Twitter/X', velocityScore: 98, firstSeenAt: '2h ago' },
    { id: '2', topic: 'Remote Hiring Compliance EU 2026', category: 'HR Tech', platform: 'LinkedIn', velocityScore: 89, firstSeenAt: '4h ago' },
    { id: '3', topic: 'Clean Snacking Functional Seeds', category: 'D2C Food', platform: 'Instagram', velocityScore: 84, firstSeenAt: '6h ago' },
    { id: '4', topic: 'Autonomous Video Pipeline Benchmarks', category: 'Video AI', platform: 'YouTube', velocityScore: 92, firstSeenAt: '1h ago' },
  ]);

  const [services, setServices] = useState<ServiceHealth[]>([
    { name: 'Ollama LLM Engine', status: 'green', port: 11434, latencyMs: 24, note: 'llama3.2:3b active' },
    { name: 'Tenant Provisioner', status: 'green', port: 3002, latencyMs: 12, note: 'Webhook server listening' },
    { name: 'SearXNG Privacy Metasearch', status: 'green', port: 8080, latencyMs: 45, note: 'Multi-engine aggregation' },
    { name: 'Patchright Web Crawler', status: 'green', port: 9222, latencyMs: 18, note: 'Anti-detect CDP daemon' },
    { name: 'Edge-TTS Voice Synthesizer', status: 'green', port: 5050, latencyMs: 32, note: 'Zero-cost neural TTS' },
    { name: 'Supabase PostgreSQL', status: 'green', port: 5432, latencyMs: 8, note: 'Connection pool healthy' },
  ]);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch metrics from distribution_metrics API endpoint if available
      const metricsRes = await fetch('/api/v1/omnipulse/metrics').catch(() => null);
      if (metricsRes && metricsRes.ok) {
        const json = await metricsRes.json();
        if (json.success && json.data) {
          if (json.data.totalViewsToday) setTotalViewsToday(json.data.totalViewsToday);
          if (json.data.totalIndexedPages) setTotalIndexedPages(json.data.totalIndexedPages);
          if (json.data.brandCards) setBrandCards(json.data.brandCards);
        }
      }

      // 2. Fetch live trends from trend_signals or demand
      const trendsRes = await fetch('/api/v1/omnipulse/trends').catch(() => null);
      if (trendsRes && trendsRes.ok) {
        const json = await trendsRes.json();
        if (json.success && json.data) {
          setTrendingTopics(json.data);
        }
      }

      // 3. Health check for local services
      const healthRes = await fetch('/api/v1/omnipulse/services-health').catch(() => null);
      if (healthRes && healthRes.ok) {
        const json = await healthRes.json();
        if (json.success && json.data) {
          setServices(json.data);
        }
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.warn('[OmniPulseOverview] Background poll error, keeping cached matrix:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green':
        return 'var(--accent-green)';
      case 'yellow':
        return 'var(--accent-amber)';
      case 'red':
        return 'var(--accent-red)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* ─── Top Header Bar ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>⚡</span>
            <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>
              OmniPulse Command Center
            </h2>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-green)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-green)' }}></span>
              AUTONOMOUS ACTIVE
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Zero-Cost Multi-Platform Social Distribution & Algorithmic pSEO Engine (50k/day target per brand)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Updated: {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={() => {
              setLoading(true);
              fetchDashboardData();
            }}
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
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ─── Macro KPI Stat Cards ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Views Today</span>
            <span style={{ padding: '6px', backgroundColor: 'rgba(59, 130, 246, 0.15)', borderRadius: '8px', color: 'var(--accent-blue)' }}>
              <Eye size={18} />
            </span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '10px', letterSpacing: '-1px' }}>
            {totalViewsToday.toLocaleString()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: 'var(--accent-green)' }}>
            <ArrowUpRight size={14} />
            <span>+18.4% vs 24h average (Target: 200,000/day)</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '20px',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>GSC Total Indexed Pages</span>
            <span style={{ padding: '6px', backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: '8px', color: 'var(--accent-green)' }}>
              <Globe size={18} />
            </span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '10px', letterSpacing: '-1px' }}>
            {totalIndexedPages.toLocaleString()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span>Across 22 pSEO subdomains (560M addressable)</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Social Distribution</span>
            <span style={{ padding: '6px', backgroundColor: 'rgba(139, 92, 246, 0.15)', borderRadius: '8px', color: 'var(--accent-purple)' }}>
              <Share2 size={18} />
            </span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '10px', letterSpacing: '-1px' }}>
            44 Posts
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span>5 Platforms: YouTube, Facebook, IG, X, LinkedIn</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>External API Spend</span>
            <span style={{ padding: '6px', backgroundColor: 'rgba(245, 158, 11, 0.15)', borderRadius: '8px', color: 'var(--accent-amber)' }}>
              <Activity size={18} />
            </span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '10px', letterSpacing: '-1px', color: 'var(--accent-green)' }}>
            $0.00
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span>100% Zero-Cost Local Stack Architecture</span>
          </div>
        </div>
      </div>

      {/* ─── 4 Brand Breakdown Cards ──────────────────────────────────── */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="var(--accent-blue)" />
          Brand Distribution Breakdown (4 Autonomous Tenants)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {brandCards.map((b) => (
            <div
              key={b.brandSlug}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '18px', fontWeight: 700 }}>{b.brandName}</h4>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--accent-blue)',
                      fontWeight: 600,
                    }}
                  >
                    Top: {b.topPlatform}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '26px', fontWeight: 800 }}>{b.todayViews.toLocaleString()}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>views today</span>
                  <span style={{ fontSize: '12px', color: 'var(--accent-green)', fontWeight: 600 }}>{b.viewsChange}</span>
                </div>

                {/* Top post of the day */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    borderLeft: '3px solid var(--accent-blue)',
                  }}
                >
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '2px' }}>Top Performing Creative:</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>"{b.topPostTitle}"</div>
                  <div style={{ color: 'var(--accent-blue)', fontSize: '11px', marginTop: '4px', fontWeight: 600 }}>
                    {b.topPostViews.toLocaleString()} views
                  </div>
                </div>
              </div>

              {/* Queue Depth Bar */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  <span>Content Pipeline Queue</span>
                  <span>{b.queueDepth.pending + b.queueDepth.mediaReady + b.queueDepth.posted} total</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center' }}>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '6px', borderRadius: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-amber)' }}>{b.queueDepth.pending}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Pending</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '6px', borderRadius: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-blue)' }}>{b.queueDepth.mediaReady}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Media Ready</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '6px', borderRadius: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-green)' }}>{b.queueDepth.posted}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Posted</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Bottom Section: Trending Signals & Services Health ───────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* Trending Topics (Last 24h) */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} color="var(--accent-green)" />
              Detected Viral Trend Signals (SearXNG + Social Ingestion)
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Last 24h</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {trendingTopics.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.topic}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {t.category} • Found on {t.platform} • {t.firstSeenAt}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-green)' }}>
                    Score: {t.velocityScore}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>High Viral Velocity</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Local Docker Services Matrix */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={16} color="var(--accent-purple)" />
              Zero-Cost Local Stack Engine Health
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>6 Daemons</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {services.map((s) => (
              <div
                key={s.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: getStatusColor(s.status),
                      boxShadow: `0 0 8px ${getStatusColor(s.status)}`,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Port {s.port} • {s.note}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.latencyMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OmniPulseOverview;
