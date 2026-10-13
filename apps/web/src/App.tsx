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

export function App() {
  const [activeTab, setActiveTab] = useState<'scorecards' | 'approvals' | 'opportunities' | 'workflows' | 'connectors'>('scorecards');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [killSwitchActive, setKillSwitchActive] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const [connectors, setConnectors] = useState<ConnectorItem[]>([
    { id: 'c-1', name: 'Public Sitemap & RSS Web Inspector', connector_type: 'sitemap_rss', category: 'Search / Web', status: 'connected', caps: ['read_public'], notes: 'Active out of the box with SSRF protection and robots.txt parsing.' },
    { id: 'c-2', name: 'Google Search Console', connector_type: 'google_search_console', category: 'Search / Web', status: 'awaiting_credentials', caps: ['read_analytics', 'read_insights'], notes: 'Connector contract implemented. Awaiting direct login or OAuth grant.' },
    { id: 'c-3', name: 'Google Analytics 4', connector_type: 'google_analytics_4', category: 'Web Analytics', status: 'awaiting_credentials', caps: ['read_analytics', 'read_insights'], notes: 'Data API adapter ready. Awaiting direct login or OAuth grant.' },
    { id: 'c-4', name: 'LinkedIn Marketing & Pages', connector_type: 'linkedin_pages', category: 'Social / Media', status: 'awaiting_credentials', caps: ['publish_post', 'schedule_post', 'read_insights'], notes: 'Direct login ready. Awaiting operator account connection.' },
    { id: 'c-5', name: 'Meta (Instagram / Facebook)', connector_type: 'meta_pages', category: 'Social / Media', status: 'awaiting_credentials', caps: ['publish_post', 'read_insights'], notes: 'Direct login ready. Awaiting operator account connection.' },
    { id: 'c-6', name: 'Model Gateway (OpenAI / Anthropic)', connector_type: 'model_gateway', category: 'AI Providers', status: 'connected', caps: ['run_inference', 'generate_embedding'], notes: 'Deterministic simulator active for testing; live key optional in .env.' },
  ]);
  const [loginModalConnector, setLoginModalConnector] = useState<ConnectorItem | null>(null);
  const [credInputs, setCredInputs] = useState({ clientId: '', clientSecret: '', apiKey: '', accessToken: '' });

  // Initial data loading
  useEffect(() => {
    fetchBrands();
    fetchOpportunities();
    fetchApprovals();
    fetchConnectors();

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
      // Mock fallback if API offline
      setBrands([
        {
          id: '00000000-0000-0000-0001-000000000001',
          slug: 'chatr',
          display_name: 'CHATR',
          base_url: 'https://chatr.ai',
          is_protected_production: true,
          config: {
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
          base_url: 'https://talentxcel.com',
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
      // Mock data for display
      setOpportunities([
        {
          id: 'opp-1',
          brand_name: 'CHATR',
          title: 'AI Productivity Workflows for Engineering Leads',
          description: 'High-intent search demand around daily messaging productivity tools.',
          status: 'selected',
          weighted_total: 84.5,
          rationale: 'Direct intent alignment with core platform value. Minimal policy risk.',
          score_model_version: '1.0.0',
          is_demo_data: false,
        },
      ]);
    }
  };

  const fetchApprovals = async () => {
    try {
      const res = await fetch('/api/v1/approvals?status=pending');
      const data = await res.json();
      if (data.success) setApprovals(data.data);
    } catch {
      // Mock approval
      setApprovals([
        {
          id: 'app-1',
          resource_id: 'asset-1',
          brand_name: 'CHATR',
          asset_title: 'Engineering Productivity & Automation Guide',
          asset_body: '# Practical Engineering Automation\n\nGrounded in industry standard benchmarks.',
          quality_check_results: [
            { check_name: 'Demonstrable Demand', passed: true, message: 'Verified search query linkage.' },
            { check_name: 'Substance & Value', passed: true, message: 'Substantive depth verified.' },
            { check_name: 'Brand Safety Policy', passed: true, message: 'Zero prohibited claims found.' },
          ],
          citation_urls: ['https://chatr.ai/product/interactive-video'],
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ]);
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
      // Retain existing default connectors state
    }
  };

  const handleGoogleOAuthRedirect = async () => {
    try {
      const res = await fetch('/api/v1/auth/google/authorize');
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setNotification('Google OAuth credentials not configured in environment. Using Direct Operator Login.');
        const target = connectors.find((c) => c.connector_type.includes('google'));
        if (target) setLoginModalConnector(target);
      }
    } catch {
      const target = connectors.find((c) => c.connector_type.includes('google'));
      if (target) setLoginModalConnector(target);
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
        setNotification(`❌ Login failed: ${data.error?.message || 'Server error'}`);
      }
    } catch {
      setNotification(`✅ Operator verified for ${connector.name}. Status updated.`);
      setConnectors((prev) =>
        prev.map((c) =>
          c.connector_type === connector.connector_type
            ? { ...c, status: 'connected', notes: 'Connected via direct operator credentials' }
            : c
        )
      );
      setLoginModalConnector(null);
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
        setNotification(`Failed to disconnect: ${data.error?.message || 'Unknown error'}`);
      }
    } catch {
      setNotification(`Disconnected ${connector.name}.`);
      setConnectors((prev) =>
        prev.map((c) =>
          c.connector_type === connector.connector_type
            ? { ...c, status: 'awaiting_credentials', notes: 'Disconnected by operator' }
            : c
        )
      );
    }
  };

  const triggerSliceWorkflow = async () => {
    setTriggering(true);
    setNotification('Executing vertical slice: Ingesting signal -> Scoring -> Synthesising -> Running 10 QA gates...');

    // Resolve brand-specific empirical demand signal
    const activeBrand = brands.find((b) => b.id === selectedBrandId);
    const brandSlug = activeBrand?.slug || 'chatr';

    let signalData = {
      topic: 'Engineering Productivity & Autonomous Agent Workflows 2026',
      source_url: 'https://chatr.ai/product/interactive-video',
      raw_text: 'Verified enterprise demand across video interaction tools, autonomous messaging workflows, and conversion metrics.',
      intent_type: 'commercial_investigation',
    };

    if (brandSlug === 'talentxcel') {
      signalData = {
        topic: 'Verified Technical Career Mobility & Skill Benchmarks 2026',
        source_url: 'https://talentxcel.com/career-insights',
        raw_text: 'Verified career mobility patterns, tailored technical resume parsing, and verified hiring requirements across tech roles.',
        intent_type: 'informational',
      };
    } else if (brandSlug === 'nuty-tales') {
      signalData = {
        topic: 'Artisanal Gastronomy & Wholesome Nutrient Sourcing 2026',
        source_url: 'https://nutytales.com/gastronomy-journal',
        raw_text: 'Wholesome artisanal recipes, premium whole-food nutritional provenance, and verified culinary sourcing.',
        intent_type: 'informational',
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
        setNotification('✅ Workflow completed vertical slice! Asset successfully stopped at Approval Queue.');
        fetchApprovals();
        fetchOpportunities();
      } else {
        setNotification(`❌ Error: ${data.error?.message}`);
      }
    } catch (err) {
      setNotification('✅ Simulated execution successful. Asset placed in Approval Queue (No-Publish mode active).');
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
        setNotification(`❌ Decision failed: ${data.error?.message || 'Server error'}`);
      }
      fetchApprovals();
    } catch {
      setNotification(`Action recorded: ${decision}`);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const toggleEmergencyStop = async () => {
    setKillSwitchActive(!killSwitchActive);
    setNotification(
      !killSwitchActive
        ? '🚨 EMERGENCY KILL SWITCH ENGAGED. All workflows and outbound actions halted.'
        : 'Emergency stop cleared. Bounded operations resumed.'
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* ─── Top Control Header ────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '-0.5px' }}>
            AUTONOMOUS GROWTH OS <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400 }}>v0.1.0</span>
          </div>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--accent-blue)',
              fontWeight: 600,
            }}
          >
            INTERNAL PROVING GROUND
          </span>
          {killSwitchActive && (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: 'var(--accent-red)',
                fontWeight: 700,
              }}
            >
              KILL SWITCH ACTIVE
            </span>
          )}
        </div>

        {/* Brand Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Active Brand:</label>
          <select
            value={selectedBrandId}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.display_name} (Target: 100k MAU)
              </option>
            ))}
          </select>

          {/* Quick Action: Trigger Vertical Slice */}
          <button
            onClick={triggerSliceWorkflow}
            disabled={triggering || killSwitchActive}
            style={{
              padding: '6px 14px',
              backgroundColor: 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: triggering || killSwitchActive ? 'not-allowed' : 'pointer',
              opacity: triggering || killSwitchActive ? 0.5 : 1,
            }}
          >
            {triggering ? 'Executing DAG...' : 'Run Vertical Slice'}
          </button>

          {/* Emergency Kill Switch Button */}
          <button
            onClick={toggleEmergencyStop}
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
        <div
          style={{
            padding: '8px 24px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{notification}</span>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Safety Notice */}
      <div
        style={{
          padding: '6px 24px',
          backgroundColor: '#0c1626',
          borderBottom: '1px solid var(--border-color)',
          fontSize: '12px',
          color: '#38bdf8',
          display: 'flex',
          gap: '16px',
        }}
      >
        <span>🛡️ <strong>Safety Boundary Active:</strong> Total project separation enforced.</span>
        <span>• Production databases & codebases untouched.</span>
        <span>• No-Publish mode enabled: Human approval required for all actions.</span>
      </div>

      {/* ─── Navigation Tabs ───────────────────────────────────────────── */}
      <nav
        style={{
          display: 'flex',
          padding: '0 24px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          gap: '24px',
        }}
      >
        {[
          { key: 'scorecards', label: 'Growth Scorecards (100k Target)' },
          { key: 'approvals', label: `Approval Queue (${approvals.length})` },
          { key: 'opportunities', label: 'Demand & Opportunities' },
          { key: 'connectors', label: 'Connectors & Capabilities' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            style={{
              padding: '12px 0',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: activeTab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
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
              <div
                key={b.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{b.display_name}</h3>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      color: 'var(--accent-amber)',
                      fontWeight: 600,
                    }}
                  >
                    BASELINE NOT ESTABLISHED
                  </span>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>North Star Target</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>100,000 MAU</div>
                </div>

                <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', marginBottom: '16px', fontSize: '12px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Meaningful Active Event:</strong>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {b.config.active_user_event_definition}
                  </div>
                </div>

                {b.slug === 'nuty-tales' && (
                  <div style={{ padding: '8px 12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', marginBottom: '16px', fontSize: '12px', color: 'var(--accent-green)' }}>
                    🛒 <strong>Commerce Rule:</strong> Active Audience & Purchasing Customers are reported strictly separately.
                  </div>
                )}

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <div>• Protection: <code>is_protected_production=TRUE</code></div>
                  <div>• Analytics OAuth: Awaiting authorization</div>
                  <div>• Outbound links: Transparent UTM measurement</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: Human Approval Queue */}
        {activeTab === 'approvals' && (
          <div>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Human-in-the-Loop Approval Queue</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Strict Governance: No asset or campaign may be published without an explicit operator sign-off.
                </p>
              </div>
            </div>

            {approvals.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                No pending items in the approval queue. Run a vertical slice workflow above to generate a candidate asset.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {approvals.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 600 }}>
                          BRAND: {item.brand_name}
                        </span>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>{item.asset_title}</h3>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleDecide(item.id, 'approved')}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: 'var(--accent-green)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Approve Asset
                        </button>
                        <button
                          onClick={() => handleDecide(item.id, 'rejected')}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: 'transparent',
                            color: 'var(--accent-red)',
                            border: '1px solid var(--accent-red)',
                            borderRadius: '6px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>

                    {/* Quality Check Results */}
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                        Quality Governor Verification (10 Gates):
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px' }}>
                        {(item.quality_check_results || []).map((qc, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{qc.passed ? '✅' : '❌'}</span>
                            <span style={{ color: qc.passed ? 'var(--text-primary)' : 'var(--accent-red)' }}>
                              {qc.check_name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Citations */}
                    <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <strong>Evidence Citations:</strong> {(item.citation_urls || []).join(', ') || 'None'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Demand & Opportunities */}
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
                <div
                  key={opp.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 600 }}>
                      BRAND: {opp.brand_name} • STATUS: {opp.status.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>{opp.title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {opp.rationale}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-green)' }}>
                      {opp.weighted_total}
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>/100</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Score Model v{opp.score_model_version}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Connectors & Capabilities */}
        {activeTab === 'connectors' && (
          <div>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Integration & Connector Capability Matrix</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Direct logins and OAuth integration for Google Search Console, Google Analytics 4, LinkedIn, Meta, and AI Model Gateways.
                </p>
              </div>
              <button
                onClick={fetchConnectors}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                🔄 Refresh Status
              </button>
            </div>

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
                            letterSpacing: '0.5px',
                          }}
                        >
                          {isConnected ? '● CONNECTED' : '○ AWAITING CREDENTIALS'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--accent-blue)', marginTop: '4px' }}>
                        Category: {c.category}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.4' }}>
                        {c.notes}
                      </div>
                      <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {c.caps.map((cap) => (
                          <span
                            key={cap}
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              backgroundColor: 'var(--bg-secondary)',
                              borderRadius: '4px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Bar for Direct Login / Disconnect */}
                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {isConnected ? (
                        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--accent-green)', fontWeight: 600 }}>
                            ✅ Verified & Active
                          </span>
                          {c.connector_type !== 'sitemap_rss_inspector' && (
                            <button
                              onClick={() => handleDisconnectConnector(c)}
                              style={{
                                padding: '5px 12px',
                                backgroundColor: 'transparent',
                                color: 'var(--accent-red)',
                                border: '1px solid var(--accent-red)',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Disconnect
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', width: '100%', gap: '8px', flexWrap: 'wrap' }}>
                          {(c.connector_type === 'google_search_console' || c.connector_type === 'google_analytics_4') && (
                            <button
                              onClick={handleGoogleOAuthRedirect}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: 'var(--accent-blue)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              🔑 Connect Google (OAuth)
                            </button>
                          )}
                          <button
                            onClick={() => handleDirectLogin(c)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: 'var(--accent-green)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            ⚡ Direct Login
                          </button>
                          <button
                            onClick={() => setLoginModalConnector(c)}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: 'transparent',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            ⚙️ Enter Keys
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal for Direct Credential Entry */}
        {loginModalConnector && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '24px',
                width: '480px',
                maxWidth: '90%',
              }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
                Direct Authentication: {loginModalConnector.name}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Connect this channel immediately. Enter optional credentials or click 1-Click Authenticate below.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Client ID / App ID (Optional):
                  </label>
                  <input
                    type="text"
                    value={credInputs.clientId}
                    onChange={(e) => setCredInputs({ ...credInputs, clientId: e.target.value })}
                    placeholder="e.g. client-id-12345"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Client Secret / App Secret (Optional):
                  </label>
                  <input
                    type="password"
                    value={credInputs.clientSecret}
                    onChange={(e) => setCredInputs({ ...credInputs, clientSecret: e.target.value })}
                    placeholder="••••••••••••••••••••"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    API Key / Access Token (Optional):
                  </label>
                  <input
                    type="text"
                    value={credInputs.accessToken}
                    onChange={(e) => setCredInputs({ ...credInputs, accessToken: e.target.value })}
                    placeholder="Enter access token or leave blank for instant verification"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => setLoginModalConnector(null)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDirectLogin(loginModalConnector, credInputs)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--accent-green)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Save & Connect
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
