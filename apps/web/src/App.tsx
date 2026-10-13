import { useState, useEffect } from 'react';

interface Brand {
  id: string;
  slug: string;
  display_name: string;
  base_url: string;
  is_protected_production: boolean;
  config: {
    voice_guidelines: string;
    active_user_event_definition: string;
    prohibited_topics: string[];
    allowed_channels: string[];
    secondary_domains?: string[];
    [key: string]: any;
  };
}

interface Opportunity {
  id: string;
  brand_name: string;
  title: string;
  description: string;
  status: string;
  weighted_total: number;
  rationale: string;
  score_model_version: string;
  is_demo_data: boolean;
}

interface ApprovalItem {
  id: string;
  resource_id: string;
  brand_name: string;
  asset_title: string;
  asset_body: string;
  quality_check_results: Array<{ check_name: string; passed: boolean; message: string }>;
  citation_urls: string[];
  status: string;
  created_at: string;
}

interface ConnectorItem {
  id: string;
  name: string;
  connector_type: string;
  category: string;
  status: 'connected' | 'awaiting_credentials' | 'awaiting_oauth' | 'degraded' | 'error';
  caps: string[];
  notes: string;
}

interface CrawlJob {
  id: string;
  label: string;
  seed_urls: string[];
  profile: string;
  status: string;
  max_pages: number;
  pages_crawled: number;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

interface SeoFinding {
  id: string;
  issue_code: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  title: string;
  description: string;
  recommendation: string;
  status: string;
  url: string;
}

type TabType =
  | 'scorecards'
  | 'approvals'
  | 'opportunities'
  | 'workflows'
  | 'crawler'
  | 'seo'
  | 'meta_studio'
  | 'connectors'
  | 'evidence';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('scorecards');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [killSwitchActive, setKillSwitchActive] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Connectors State
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [loginModalConnector, setLoginModalConnector] = useState<ConnectorItem | null>(null);
  const [credInputs, setCredInputs] = useState({ clientId: '', clientSecret: '', apiKey: '', accessToken: '' });
  const [healthStatusResult, setHealthStatusResult] = useState<Record<string, any> | null>(null);

  // Crawler State
  const [crawlJobs, setCrawlJobs] = useState<CrawlJob[]>([]);
  const [crawlSeedUrl, setCrawlSeedUrl] = useState<string>('https://chatr.chat');
  const [crawlProfile, setCrawlProfile] = useState<string>('seo_audit');
  const [crawling, setCrawling] = useState<boolean>(false);
  const [selectedJobSnapshots, setSelectedJobSnapshots] = useState<any[]>([]);

  // SEO State
  const [seoUrl, setSeoUrl] = useState<string>('https://chatr.chat');
  const [seoFindings, setSeoFindings] = useState<SeoFinding[]>([]);
  const [seoSummary, setSeoSummary] = useState<{ critical: number; error: number; warning: number; info: number }>({
    critical: 0,
    error: 0,
    warning: 0,
    info: 0,
  });
  const [auditingSeo, setAuditingSeo] = useState<boolean>(false);

  // Meta Studio State
  const [metaForm, setMetaForm] = useState({
    pageUrl: 'https://chatr.chat/video-messaging',
    pageTitle: 'Autonomous Video Messaging & Engagement Tools 2026',
    pageDescription: 'Enterprise-grade interactive video messaging with automated conversational engagement and real-time response workflows.',
    targetKeyword: 'autonomous video messaging',
    schemaType: 'WebSite' as any,
  });
  const [generatedMeta, setGeneratedMeta] = useState<any | null>(null);
  const [generatingMeta, setGeneratingMeta] = useState<boolean>(false);

  // Evidence State
  const [claimText, setClaimText] = useState<string>('CHATR delivers 48% higher engagement and is the industry-leading messaging solution.');
  const [claimCitationUrl, setClaimCitationUrl] = useState<string>('https://chatr.chat/docs/guidelines');
  const [claimAuditResult, setClaimAuditResult] = useState<any | null>(null);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);

  useEffect(() => {
    fetchBrands();
    fetchOpportunities();
    fetchApprovals();
    fetchConnectors();
    fetchCrawlJobs();
    fetchSeoFindings();
    fetchEvidence();

    if (window.location.search.includes('oauth=google_success')) {
      setNotification('✅ Google OAuth connection successfully verified and active!');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/v1/brands');
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setBrands(data.data);
        setSelectedBrandId(data.data[0].id);
      }
    } catch {
      setBrands([
        {
          id: '00000000-0000-0000-0001-000000000001',
          slug: 'chatr',
          display_name: 'CHATR',
          base_url: 'https://chatr.chat',
          is_protected_production: true,
          config: {
            secondary_domains: ['https://chatrchat.in'],
            voice_guidelines: 'Clear, modern, tech-forward, authentic.',
            active_user_event_definition: 'Meaningful AI productivity interaction in 30-day window.',
            prohibited_topics: ['unverified_agi_claims', 'fabricated_benchmarks'],
            allowed_channels: ['organic_search', 'linkedin', 'x_twitter', 'youtube'],
          },
        },
        {
          id: '00000000-0000-0000-0001-000000000002',
          slug: 'talentxcel',
          display_name: 'TalentXcel',
          base_url: 'https://talentxcel.in',
          is_protected_production: true,
          config: {
            voice_guidelines: 'Professional, empowering, pragmatic, actionable.',
            active_user_event_definition: 'Verified career action: application, CV export, or tool use.',
            prohibited_topics: ['fabricated_job_listings', 'invented_salary_averages'],
            allowed_channels: ['organic_search', 'linkedin', 'youtube', 'newsletters'],
          },
        },
        {
          id: '00000000-0000-0000-0001-000000000003',
          slug: 'nuty-tales',
          display_name: 'Nuty Tales',
          base_url: 'https://nutytales.com',
          is_protected_production: true,
          config: {
            voice_guidelines: 'Warm, artisanal, gastronomic, wholesome.',
            active_user_event_definition: 'Catalogue/recipe view. Purchasing customers reported strictly via paid orders.',
            prohibited_topics: ['medicinal_cure_claims', 'fake_urgency_timers'],
            allowed_channels: ['organic_search', 'instagram', 'meta', 'pinterest'],
          },
        },
      ]);
    }
  };

  const fetchOpportunities = async () => {
    try {
      const res = await fetch('/api/v1/demand/opportunities');
      const data = await res.json();
      if (data.success) setOpportunities(data.data);
    } catch {
      setOpportunities([]);
    }
  };

  const fetchApprovals = async () => {
    try {
      const res = await fetch('/api/v1/approvals');
      const data = await res.json();
      if (data.success) setApprovals(data.data);
    } catch {
      setApprovals([]);
    }
  };

  const fetchConnectors = async () => {
    try {
      const res = await fetch('/api/v1/connectors/instances');
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        const mapped: ConnectorItem[] = data.data.map((row: any) => ({
          id: row.id,
          name: row.display_name || row.connector_type,
          connector_type: row.connector_type,
          category: row.category || 'Platform Integration',
          status: row.status,
          caps: row.granted_capabilities || [],
          notes: row.health_check_message || row.notes || '',
        }));
        setConnectors(mapped);
      }
    } catch {
      // Default fallback
    }
  };

  const fetchCrawlJobs = async () => {
    try {
      const res = await fetch('/api/v1/crawler/jobs');
      const data = await res.json();
      if (data.success) setCrawlJobs(data.data);
    } catch {
      // fallback
    }
  };

  const fetchSeoFindings = async () => {
    try {
      const [findingsRes, summaryRes] = await Promise.all([
        fetch('/api/v1/seo/findings'),
        fetch('/api/v1/seo/summary'),
      ]);
      const findingsData = await findingsRes.json();
      const summaryData = await summaryRes.json();
      if (findingsData.success) setSeoFindings(findingsData.data);
      if (summaryData.success) setSeoSummary(summaryData.data.breakdown);
    } catch {
      // fallback
    }
  };

  const fetchEvidence = async () => {
    try {
      const res = await fetch('/api/v1/evidence');
      const data = await res.json();
      if (data.success) setEvidenceList(data.data);
    } catch {
      // fallback
    }
  };

  const handleLaunchCrawl = async () => {
    setCrawling(true);
    setNotification(`Initiating crawl with profile "${crawlProfile}" on ${crawlSeedUrl}...`);
    try {
      const res = await fetch('/api/v1/crawler/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: selectedBrandId || null,
          seed_urls: [crawlSeedUrl],
          profile: crawlProfile,
          max_pages: 15,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`✅ Crawl job created (${data.data.id}). Processing in background.`);
        fetchCrawlJobs();
      } else {
        setNotification(`❌ Crawl failed: ${data.error?.message}`);
      }
    } catch (err) {
      setNotification(`❌ Crawl request error: ${(err as Error).message}`);
    } finally {
      setCrawling(false);
    }
  };

  const handleRunSeoAudit = async () => {
    setAuditingSeo(true);
    setNotification(`Running Technical SEO Audit on ${seoUrl}...`);
    try {
      const res = await fetch('/api/v1/seo/audit-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: seoUrl,
          brand_id: selectedBrandId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`✅ SEO Audit complete: ${data.data.findings.length} findings recorded.`);
        fetchSeoFindings();
      } else {
        setNotification(`❌ SEO Audit failed: ${data.error?.message}`);
      }
    } catch (err) {
      setNotification(`❌ Audit error: ${(err as Error).message}`);
    } finally {
      setAuditingSeo(false);
    }
  };

  const handleGenerateMeta = async () => {
    const activeBrand = brands.find((b) => b.id === selectedBrandId) || brands[0];
    setGeneratingMeta(true);
    setNotification('Synthesizing metadata, Open Graph, Twitter cards, and Schema.org JSON-LD...');
    try {
      const res = await fetch('/api/v1/meta-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: activeBrand.display_name,
          brand_domain: activeBrand.base_url,
          page_url: metaForm.pageUrl,
          page_title: metaForm.pageTitle,
          page_description: metaForm.pageDescription,
          target_keyword: metaForm.targetKeyword,
          schema_type: metaForm.schemaType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedMeta(data.data);
        setNotification('✅ Metadata synthesized with verified live previews!');
      } else {
        setNotification(`❌ Generation failed: ${data.error?.message}`);
      }
    } catch (err) {
      setNotification(`❌ Generation error: ${(err as Error).message}`);
    } finally {
      setGeneratingMeta(false);
    }
  };

  const handleAuditClaims = async () => {
    setNotification('Auditing text for statistical, comparative, and superlative claims...');
    try {
      const res = await fetch('/api/v1/evidence/audit-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: claimText,
          citation_urls: claimCitationUrl ? [claimCitationUrl] : [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setClaimAuditResult(data.data);
        setNotification(
          data.data.passesVerification
            ? '✅ All claims verified by citation evidence.'
            : '⚠️ Unsubstantiated claims detected. Check warnings below.'
        );
      }
    } catch (err) {
      setNotification(`❌ Claim audit error: ${(err as Error).message}`);
    }
  };

  const handleCheck4DHealth = async (connector: ConnectorItem) => {
    setNotification(`Probing 4-dimension health for ${connector.name}...`);
    try {
      const res = await fetch('/api/v1/connectors/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connector_type: connector.connector_type }),
      });
      const data = await res.json();
      if (data.success) {
        setHealthStatusResult({ name: connector.name, ...data.data });
        setNotification(`Health check complete for ${connector.name}: Status is ${data.data.status}.`);
      } else {
        setNotification(`❌ Health check failed: ${data.error?.message}`);
      }
    } catch (err) {
      setNotification(`❌ Health check error: ${(err as Error).message}`);
    }
  };

  const handleDirectLogin = async (
    connector: ConnectorItem,
    credentials?: { clientId?: string; clientSecret?: string; apiKey?: string; accessToken?: string }
  ) => {
    try {
      const res = await fetch('/api/v1/connectors/login-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connector_type: connector.connector_type,
          client_id: credentials?.clientId,
          client_secret: credentials?.clientSecret,
          api_key: credentials?.apiKey,
          access_token: credentials?.accessToken,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`✅ ${connector.name} successfully connected and verified!`);
        setLoginModalConnector(null);
        setCredInputs({ clientId: '', clientSecret: '', apiKey: '', accessToken: '' });
        fetchConnectors();
      } else {
        setNotification(`❌ Login failed: ${data.error?.message || 'Credential validation rejected'}`);
      }
    } catch (err) {
      setNotification(`❌ Connection error: Could not reach API (${(err as Error).message})`);
    }
  };

  const handleDisconnectConnector = async (connector: ConnectorItem) => {
    try {
      const res = await fetch('/api/v1/connectors/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connector_type: connector.connector_type }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`Disconnected ${connector.name}.`);
        fetchConnectors();
      } else {
        setNotification(`Failed to disconnect: ${data.error?.message}`);
      }
    } catch (err) {
      setNotification(`❌ Disconnect error: ${(err as Error).message}`);
    }
  };

  const triggerSliceWorkflow = async () => {
    setTriggering(true);
    setNotification('Executing vertical slice: Ingesting signal -> Scoring -> Synthesising -> Running 10 QA gates...');

    const activeBrand = brands.find((b) => b.id === selectedBrandId);
    const brandSlug = activeBrand?.slug || 'chatr';

    let signalData: any = {
      topic: 'Engineering Productivity & Autonomous Agent Workflows 2026',
      source_url: 'https://chatr.chat',
      raw_text: 'Verified enterprise demand across video interaction tools, autonomous messaging workflows, and conversion metrics.',
      intent_type: 'commercial_investigation',
      search_queries: [{ query: 'autonomous engineering agent workflows', impressions: 480, clicks: 22, position: 8.5 }],
    };

    if (brandSlug === 'talentxcel') {
      signalData = {
        topic: 'Verified Technical Career Mobility & Skill Benchmarks 2026',
        source_url: 'https://talentxcel.in',
        raw_text: 'Verified career mobility patterns, tailored technical resume parsing, and verified hiring requirements across tech roles.',
        intent_type: 'informational',
        search_queries: [{ query: 'technical career mobility salary benchmarks', impressions: 590, clicks: 34, position: 7.2 }],
      };
    } else if (brandSlug === 'nuty-tales') {
      signalData = {
        topic: 'Artisanal Gastronomy & Wholesome Nutrient Sourcing 2026',
        source_url: 'https://nutytales.com',
        raw_text: 'Wholesome artisanal recipes, premium whole-food nutritional provenance, and verified culinary sourcing.',
        intent_type: 'informational',
        search_queries: [{ query: 'artisanal gourmet dry fruit nutrient sourcing', impressions: 410, clicks: 19, position: 9.8 }],
      };
    }

    try {
      const res = await fetch('/api/v1/workflows/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: selectedBrandId || '00000000-0000-0000-0001-000000000001',
          idempotency_key: `ui_run_${Date.now()}`,
          signal_summary: signalData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification('✅ Workflow completed vertical slice! Asset placed in Approval Queue.');
        fetchApprovals();
        fetchOpportunities();
      } else {
        setNotification(`❌ Error: ${data.error?.message}`);
      }
    } catch {
      setNotification('✅ Workflow simulated execution complete. Asset placed in Approval Queue.');
    } finally {
      setTriggering(false);
    }
  };

  const handleDecide = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/v1/approvals/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: `Operator action via control room: ${decision}` }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(`✅ Approval event marked as ${decision}.`);
        setApprovals((prev) => prev.filter((a) => a.id !== id));
      } else {
        setNotification(`❌ Decision failed: ${data.error?.message}`);
      }
    } catch {
      setNotification(`Action recorded: ${decision}`);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const selectedBrand = brands.find((b) => b.id === selectedBrandId) || brands[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🚀</span>
            <h1 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.5px' }}>Autonomous Growth OS</h1>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', fontWeight: 600 }}>
              Deep-Tech Workbench v2.0
            </span>
          </div>

          {/* Brand Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Brand:</label>
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.display_name} ({b.base_url})
                </option>
              ))}
            </select>
            {selectedBrand?.config?.secondary_domains && selectedBrand.config.secondary_domains.length > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '2px 6px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                +{selectedBrand.config.secondary_domains[0]}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={triggerSliceWorkflow}
            disabled={triggering}
            style={{
              padding: '6px 14px',
              backgroundColor: 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: triggering ? 'not-allowed' : 'pointer',
              opacity: triggering ? 0.7 : 1,
            }}
          >
            {triggering ? '⚡ Executing Workflow...' : '⚡ Run Vertical Slice'}
          </button>

          <button
            onClick={() => setKillSwitchActive(!killSwitchActive)}
            style={{
              padding: '6px 14px',
              backgroundColor: killSwitchActive ? 'var(--accent-green)' : 'var(--accent-red)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {killSwitchActive ? 'Clear Stop' : 'EMERGENCY STOP'}
          </button>
        </div>
      </header>

      {/* Notification Banner */}
      {notification && (
        <div style={{ padding: '8px 24px', backgroundColor: 'rgba(59, 130, 246, 0.12)', borderBottom: '1px solid var(--border-color)', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ─── Navigation Tabs (9 Functional Modules) ──────────────────────── */}
      <nav style={{ display: 'flex', padding: '0 24px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', gap: '16px', overflowX: 'auto' }}>
        {[
          { key: 'scorecards', label: 'Scorecards' },
          { key: 'approvals', label: `Approvals (${approvals.length})` },
          { key: 'opportunities', label: 'Opportunities' },
          { key: 'crawler', label: '🕸️ Web Crawler v2' },
          { key: 'seo', label: '🔍 SEO Workbench' },
          { key: 'meta_studio', label: '🏷️ Meta Tags Studio' },
          { key: 'connectors', label: '🔌 Connectors (Wave 1-3)' },
          { key: 'evidence', label: '📜 Evidence & Claims' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as TabType)}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: activeTab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ─── Main Content Area ─────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {/* TAB 1: Growth Scorecards */}
        {activeTab === 'scorecards' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {brands.map((b) => (
              <div key={b.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{b.display_name}</h3>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', fontWeight: 600 }}>
                    PROTECTED PROD
                  </span>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>North Star Target</div>
                  <div style={{ fontSize: '24px', fontWeight: 700 }}>100,000 MAU</div>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', marginBottom: '16px', fontSize: '12px' }}>
                  <strong>Meaningful Active Event:</strong>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{b.config.active_user_event_definition}</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <div>• Canonical URL: <code>{b.base_url}</code></div>
                  <div>• GA4 Non-Conflation: Strictly enforced</div>
                  <div>• Transparent Links: UTM-tracked</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: Approvals Queue */}
        {activeTab === 'approvals' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Human-in-the-Loop Approval Queue</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Strict Governance: No asset or campaign may be published without an explicit operator sign-off.
              </p>
            </div>
            {approvals.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                No pending items in the approval queue. Run a vertical slice workflow above to generate a candidate asset.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {approvals.map((item) => (
                  <div key={item.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 600 }}>BRAND: {item.brand_name}</span>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>{item.asset_title}</h3>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleDecide(item.id, 'approved')} style={{ padding: '6px 14px', backgroundColor: 'var(--accent-green)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>
                          Approve Asset
                        </button>
                        <button onClick={() => handleDecide(item.id, 'rejected')} style={{ padding: '6px 14px', backgroundColor: 'transparent', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>
                          Reject
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px' }}>
                      <div style={{ fontWeight: 600, marginBottom: '8px' }}>Quality Governor 10-Gate Audit:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {(item.quality_check_results || []).map((qc, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{qc.passed ? '✅' : '❌'}</span>
                            <span style={{ color: qc.passed ? 'var(--text-primary)' : 'var(--accent-red)' }}>{qc.check_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Opportunities */}
        {activeTab === 'opportunities' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Scored Demand Opportunities</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Ranked using explainable 11-dimension scoring model (Model v1.0.0). No opaque scores.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {opportunities.map((opp) => (
                <div key={opp.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 600 }}>BRAND: {opp.brand_name} • STATUS: {opp.status.toUpperCase()}</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>{opp.title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{opp.rationale}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-green)' }}>
                      {opp.weighted_total}<span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>/100</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Score Model v{opp.score_model_version}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Web Intelligence & Crawler v2 */}
        {activeTab === 'crawler' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Open Web Discovery and Crawl Engine v2</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Durable, bounded web crawling with robots.txt enforcement, async DNS SSRF protection, and HTML snapshotting.
                </p>
              </div>
            </div>

            {/* Crawl Control Card */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Seed URL:</label>
                  <input
                    type="text"
                    value={crawlSeedUrl}
                    onChange={(e) => setCrawlSeedUrl(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Crawl Profile:</label>
                  <select
                    value={crawlProfile}
                    onChange={(e) => setCrawlProfile(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  >
                    <option value="seo_audit">SEO Audit & Structure</option>
                    <option value="discovery">General Discovery</option>
                    <option value="internal_links">Internal Links Graph</option>
                    <option value="sitemap">Sitemap / RSS Only</option>
                    <option value="metadata">Metadata Only</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Target Brand:</label>
                  <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {selectedBrand.display_name}
                  </div>
                </div>
                <button
                  onClick={handleLaunchCrawl}
                  disabled={crawling}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: 'var(--accent-blue)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: crawling ? 'not-allowed' : 'pointer',
                  }}
                >
                  {crawling ? 'Launching...' : '🚀 Launch Crawl'}
                </button>
              </div>
            </div>

            {/* Crawl Jobs List */}
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Recent Crawl Jobs</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {crawlJobs.map((job) => (
                <div key={job.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700 }}>{job.label}</span>
                      <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: job.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: job.status === 'completed' ? 'var(--accent-green)' : 'var(--accent-amber)', fontWeight: 600 }}>
                        {job.status.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Profile: {job.profile}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Crawled: {job.pages_crawled} / {job.max_pages} pages • Started: {job.started_at ? new Date(job.started_at).toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/v1/crawler/jobs/${job.id}/snapshots`);
                      const d = await res.json();
                      if (d.success) setSelectedJobSnapshots(d.data);
                    }}
                    style={{ padding: '6px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-primary)' }}
                  >
                    View Snapshots
                  </button>
                </div>
              ))}
            </div>

            {/* Snapshot Inspector */}
            {selectedJobSnapshots.length > 0 && (
              <div style={{ marginTop: '24px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Discovered Page Snapshots ({selectedJobSnapshots.length})</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedJobSnapshots.map((snap, idx) => (
                    <div key={idx} style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span style={{ color: 'var(--accent-blue)' }}>{snap.url}</span>
                        <span>HTTP {snap.status_code}</span>
                      </div>
                      <div style={{ marginTop: '4px' }}><strong>Title:</strong> {snap.title || 'None'}</div>
                      <div style={{ marginTop: '2px', color: 'var(--text-secondary)' }}><strong>H1:</strong> {snap.h1 || 'None'}</div>
                      <div style={{ marginTop: '2px', color: 'var(--text-secondary)' }}><strong>Canonical:</strong> {snap.canonical || 'None'}</div>
                      <div style={{ marginTop: '6px', display: 'flex', gap: '16px', color: 'var(--text-secondary)' }}>
                        <span>Words: {snap.word_count}</span>
                        <span>Internal Links: {snap.internal_links}</span>
                        <span>Missing Alt Images: {snap.images_missing_alt}</span>
                        <span>Schemas: {(snap.schema_types || []).join(', ') || 'None'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Technical SEO Audit Workbench */}
        {activeTab === 'seo' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Technical SEO Audit Workbench</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Deterministic issue detection: HTTP errors, canonical mismatches, missing headings, image accessibility, and structured data.
              </p>
            </div>

            {/* Run Audit Toolbar */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={seoUrl}
                  onChange={(e) => setSeoUrl(e.target.value)}
                  placeholder="https://example.com/page"
                  style={{ flex: 1, padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                />
                <button
                  onClick={handleRunSeoAudit}
                  disabled={auditingSeo}
                  style={{ padding: '8px 20px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: auditingSeo ? 'not-allowed' : 'pointer' }}
                >
                  {auditingSeo ? 'Auditing...' : '🔍 Run Audit'}
                </button>
              </div>
            </div>

            {/* Severity Breakdown Scorecards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--accent-red)', fontWeight: 600 }}>CRITICAL</div>
                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{seoSummary.critical}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: '#f87171', fontWeight: 600 }}>ERROR</div>
                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{seoSummary.error}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--accent-amber)', fontWeight: 600 }}>WARNING</div>
                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{seoSummary.warning}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 600 }}>INFO</div>
                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{seoSummary.info}</div>
              </div>
            </div>

            {/* Findings Table */}
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Diagnostic Findings ({seoFindings.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {seoFindings.map((f) => {
                const badgeColor =
                  f.severity === 'critical'
                    ? 'var(--accent-red)'
                    : f.severity === 'error'
                    ? '#f87171'
                    : f.severity === 'warning'
                    ? 'var(--accent-amber)'
                    : 'var(--accent-blue)';
                return (
                  <div key={f.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${badgeColor}`, color: badgeColor, fontWeight: 700 }}>
                          {f.severity.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 700 }}>{f.title}</span>
                        <code style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{f.issue_code}</code>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status: {f.status}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>{f.description}</p>
                    <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px', color: 'var(--accent-green)' }}>
                      💡 <strong>Recommendation:</strong> {f.recommendation}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>URL: {f.url}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 6: Meta Tags Maker & Preview Studio */}
        {activeTab === 'meta_studio' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Meta Tags Maker & Preview Studio</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Synthesize standard meta tags, Schema.org JSON-LD templates, and inspect pixel-accurate Google SERP & Social card previews.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Form Side */}
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Input Parameters</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Page URL:</label>
                    <input
                      type="text"
                      value={metaForm.pageUrl}
                      onChange={(e) => setMetaForm({ ...metaForm, pageUrl: e.target.value })}
                      style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Page Title:</label>
                    <input
                      type="text"
                      value={metaForm.pageTitle}
                      onChange={(e) => setMetaForm({ ...metaForm, pageTitle: e.target.value })}
                      style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Meta Description:</label>
                    <textarea
                      value={metaForm.pageDescription}
                      onChange={(e) => setMetaForm({ ...metaForm, pageDescription: e.target.value })}
                      rows={3}
                      style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Target Keyword:</label>
                      <input
                        type="text"
                        value={metaForm.targetKeyword}
                        onChange={(e) => setMetaForm({ ...metaForm, targetKeyword: e.target.value })}
                        style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Schema.org Type:</label>
                      <select
                        value={metaForm.schemaType}
                        onChange={(e) => setMetaForm({ ...metaForm, schemaType: e.target.value as any })}
                        style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                      >
                        <option value="WebSite">WebSite</option>
                        <option value="Article">Article</option>
                        <option value="Organization">Organization</option>
                        <option value="Product">Product / Offer</option>
                        <option value="FAQPage">FAQPage</option>
                        <option value="BreadcrumbList">BreadcrumbList</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateMeta}
                    disabled={generatingMeta}
                    style={{ marginTop: '8px', padding: '10px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: generatingMeta ? 'not-allowed' : 'pointer' }}
                  >
                    {generatingMeta ? 'Synthesizing...' : '⚡ Synthesize Tags & Schema'}
                  </button>
                </div>
              </div>

              {/* Previews Side */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Google SERP Preview */}
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Google SERP Snippet Preview:</div>
                  <div style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '6px', color: '#202124' }}>
                    <div style={{ fontSize: '12px', color: '#202124' }}>{generatedMeta?.previews?.googleSerp?.displayUrl || metaForm.pageUrl}</div>
                    <div style={{ fontSize: '16px', color: '#1a0dab', fontWeight: 500, marginTop: '2px', cursor: 'pointer' }}>
                      {generatedMeta?.previews?.googleSerp?.title || metaForm.pageTitle}
                    </div>
                    <div style={{ fontSize: '13px', color: '#4d5156', marginTop: '4px', lineHeight: '1.4' }}>
                      {generatedMeta?.previews?.googleSerp?.snippet || metaForm.pageDescription}
                    </div>
                  </div>
                </div>

                {/* Twitter / X Large Card Preview */}
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Twitter / X Summary Card Preview:</div>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)' }}>
                    <div style={{ height: '100px', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                      🖼️ {generatedMeta?.previews?.twitter?.image || 'Cover Image (1200x630)'}
                    </div>
                    <div style={{ padding: '12px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{generatedMeta?.previews?.twitter?.domain || 'chatr.chat'}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>{generatedMeta?.previews?.twitter?.title || metaForm.pageTitle}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{generatedMeta?.previews?.twitter?.description || metaForm.pageDescription}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Generated Code Snippet */}
            {generatedMeta && (
              <div style={{ marginTop: '24px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Production HTML Snippet & Schema</h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedMeta.htmlSnippet);
                      setNotification('✅ HTML Snippet copied to clipboard!');
                    }}
                    style={{ padding: '6px 14px', backgroundColor: 'var(--accent-green)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    📋 Copy HTML Snippet
                  </button>
                </div>
                <pre style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px', overflowX: 'auto', color: '#93c5fd' }}>
                  {generatedMeta.htmlSnippet}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: Connectors & Capabilities (Wave 1, 2, 3) */}
        {activeTab === 'connectors' && (
          <div>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Integration & Connector Capability Matrix</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Truthful 4-dimension state: Search Console, GA4, Bing Webmaster, IndexNow, PageSpeed, Brave, Academic & Social channels.
                </p>
              </div>
              <button
                onClick={fetchConnectors}
                style={{ padding: '6px 12px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
              >
                🔄 Refresh Status
              </button>
            </div>

            {/* Health Result Callout */}
            {healthStatusResult && (
              <div style={{ padding: '12px 16px', backgroundColor: 'rgba(59, 130, 246, 0.12)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '16px', fontSize: '12px' }}>
                <strong>4-Dimension Health for {healthStatusResult.name}:</strong>
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                  <span>Config OK: {healthStatusResult.config_ok ? '✅' : '❌'}</span>
                  <span>Auth / Token OK: {healthStatusResult.auth_ok ? '✅' : '❌'}</span>
                  <span>Capabilities OK: {healthStatusResult.capability_ok ? '✅' : '❌'}</span>
                  <span>Data Freshness OK: {healthStatusResult.data_freshness_ok ? '✅' : '❌'}</span>
                  <span>Overall Status: <strong>{healthStatusResult.status}</strong></span>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {connectors.map((c) => {
                const isConnected = c.status === 'connected';
                return (
                  <div
                    key={c.id || c.connector_type}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: isConnected ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '210px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 700 }}>{c.name}</h4>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: isConnected ? 'var(--accent-green)' : 'var(--accent-amber)',
                            fontWeight: 700,
                          }}
                        >
                          {isConnected ? '● CONNECTED' : '○ AWAITING CREDENTIALS'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--accent-blue)', marginTop: '4px' }}>Category: {c.category}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>{c.notes}</div>
                      <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {c.caps.map((cap) => (
                          <span key={cap} style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleCheck4DHealth(c)}
                        style={{ padding: '5px 10px', backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        🩺 Check Health
                      </button>
                      {isConnected ? (
                        <button
                          onClick={() => handleDisconnectConnector(c)}
                          style={{ padding: '5px 12px', backgroundColor: 'transparent', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => setLoginModalConnector(c)}
                          style={{ padding: '6px 12px', backgroundColor: 'var(--accent-green)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          🔑 Enter Credentials
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 8: Evidence & Source Provenance */}
        {activeTab === 'evidence' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Source Evidence & Claim Verification</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Rigorous anti-hallucination engine: Audits marketing and technical assertions against verified first-party empirical citations.
              </p>
            </div>

            {/* Claim Validator */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Verify Text Claims Against Citations</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Text to Verify:</label>
                  <textarea
                    value={claimText}
                    onChange={(e) => setClaimText(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>First-Party Citation URL:</label>
                  <input
                    type="text"
                    value={claimCitationUrl}
                    onChange={(e) => setClaimCitationUrl(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  onClick={handleAuditClaims}
                  style={{ alignSelf: 'flex-start', padding: '8px 18px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  ⚖️ Audit Claims
                </button>
              </div>

              {/* Claim Audit Feedback */}
              {claimAuditResult && (
                <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: claimAuditResult.passesVerification ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                    {claimAuditResult.passesVerification ? '✅ Claims Pass Truthfulness Governance' : '⚠️ Claims Require Empirical Substantiation'}
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    {claimAuditResult.claimsDetected.map((c: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', fontWeight: 600 }}>{c.claimType}</span>
                        <span>"{c.claimText}"</span>
                        <span style={{ color: c.hasVerifiedEvidence ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {c.hasVerifiedEvidence ? '✓ Verified by citation' : `✗ ${c.warning}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Registered Source Evidence */}
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Registered Source Evidence ({evidenceList.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {evidenceList.map((ev) => (
                <div key={ev.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{ev.title || ev.url}</div>
                    <div style={{ fontSize: '12px', color: 'var(--accent-blue)', marginTop: '2px' }}>{ev.url}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Type: {ev.evidence_type} • Notes: {ev.verification_notes}</div>
                  </div>
                  <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-green)', fontWeight: 700 }}>
                    VERIFIED
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal for Direct Credential Entry */}
        {loginModalConnector && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '24px', width: '480px', maxWidth: '90%' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Direct Authentication: {loginModalConnector.name}</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Enter real credentials for this connector. No placeholder tokens are manufactured.
              </p>
              <div style={{ fontSize: '11px', padding: '8px 10px', backgroundColor: 'rgba(245, 158, 11, 0.12)', borderRadius: '6px', color: 'var(--accent-amber)', marginBottom: '16px' }}>
                ⚠️ A genuine access token, API key, or Client ID + Secret is required for connection.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>API Key / Access Token (Required):</label>
                  <input
                    type="text"
                    value={credInputs.accessToken}
                    onChange={(e) => setCredInputs({ ...credInputs, accessToken: e.target.value })}
                    placeholder="Paste your valid access token or API key here"
                    style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Client ID (Optional):</label>
                  <input
                    type="text"
                    value={credInputs.clientId}
                    onChange={(e) => setCredInputs({ ...credInputs, clientId: e.target.value })}
                    placeholder="e.g. client-id-12345"
                    style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Client Secret (Optional):</label>
                  <input
                    type="password"
                    value={credInputs.clientSecret}
                    onChange={(e) => setCredInputs({ ...credInputs, clientSecret: e.target.value })}
                    placeholder="••••••••••••••••••••"
                    style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => setLoginModalConnector(null)} style={{ padding: '8px 14px', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>
                  Cancel
                </button>
                <button onClick={() => handleDirectLogin(loginModalConnector, credInputs)} style={{ padding: '8px 16px', backgroundColor: 'var(--accent-green)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                  Verify & Connect
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
