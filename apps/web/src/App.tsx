import { useState, useEffect } from 'react';
import { DomainRegistryView } from './components/DomainRegistryView';
import { DurableQueueView } from './components/DurableQueueView';
import { OmniPulseOverview } from './pages/OmniPulseOverview';
import { SocialAccountsHealth } from './pages/SocialAccountsHealth';
import { ContentQueueMonitor } from './pages/ContentQueueMonitor';
import { PseoIntelligence } from './pages/PseoIntelligence';
import { BacklinksCommander } from './pages/BacklinksCommander';
import { PageviewVelocityMonitor } from './components/dashboard/PageviewVelocityMonitor';
import { authFetch, getStoredUser, ensureOperatorSession, type OperatorUser } from './lib/apiClient';
import { AuthenticationHubModal } from './components/AuthenticationHubModal';
import { SidebarNav } from './components/SidebarNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PanelLeft, PanelLeftClose } from 'lucide-react';

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

export type TabType =
  | 'scorecards'
  | 'domains'
  | 'queue'
  | 'approvals'
  | 'opportunities'
  | 'workflows'
  | 'crawler'
  | 'seo'
  | 'meta_studio'
  | 'connectors'
  | 'evidence'
  | 'omnipulse'
  | 'omnipulse_velocity'
  | 'omnipulse_accounts'
  | 'omnipulse_queue'
  | 'omnipulse_pseo'
  | 'omnipulse_backlinks';

function getTabFromPath(path: string): TabType {
  const clean = path.replace(/\/$/, '') || '/';
  if (clean === '/omnipulse') return 'omnipulse';
  if (clean === '/omnipulse/velocity') return 'omnipulse_velocity';
  if (clean === '/omnipulse/accounts') return 'omnipulse_accounts';
  if (clean === '/omnipulse/queue') return 'omnipulse_queue';
  if (clean === '/omnipulse/pseo') return 'omnipulse_pseo';
  if (clean === '/omnipulse/backlinks') return 'omnipulse_backlinks';
  return 'scorecards';
}

function getPathFromTab(tab: TabType): string {
  switch (tab) {
    case 'omnipulse':
      return '/omnipulse';
    case 'omnipulse_velocity':
      return '/omnipulse/velocity';
    case 'omnipulse_accounts':
      return '/omnipulse/accounts';
    case 'omnipulse_queue':
      return '/omnipulse/queue';
    case 'omnipulse_pseo':
      return '/omnipulse/pseo';
    case 'omnipulse_backlinks':
      return '/omnipulse/backlinks';
    default:
      return '/';
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>(() => getTabFromPath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabSelect = (tabKey: TabType) => {
    setActiveTab(tabKey);
    const targetPath = getPathFromTab(tabKey);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [killSwitchActive, setKillSwitchActive] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Operator & GSC Authentication State
  const [operatorUser, setOperatorUser] = useState<OperatorUser | null>(() => getStoredUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

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

  // Meta Studio State (V3 Workbench)
  const [metaForm, setMetaForm] = useState({
    pageUrl: 'https://chatr.chat/video-messaging',
    pageTitle: 'Autonomous Video Messaging & Engagement Tools 2026',
    pageDescription: 'Enterprise-grade interactive video messaging with automated conversational engagement and real-time response workflows.',
    targetKeyword: 'autonomous video messaging',
    canonicalUrl: 'https://chatr.chat/video-messaging',
    imageUrl: '',
    imageAlt: 'CHATR video messaging platform interface',
    authorName: '',
    datePublished: '',
    dateModified: '',
    schemaType: 'WebSite' as any,
  });
  const [generatedMeta, setGeneratedMeta] = useState<any | null>(null);
  const [generatingMeta, setGeneratingMeta] = useState<boolean>(false);
  const [inspectedData, setInspectedData] = useState<any | null>(null);
  const [inspectingUrl, setInspectingUrl] = useState<boolean>(false);
  const [imageProbeResult, setImageProbeResult] = useState<any | null>(null);
  const [probingImage, setProbingImage] = useState<boolean>(false);
  const [metaValidationReport, setMetaValidationReport] = useState<any | null>(null);
  const [validatingReport, setValidatingReport] = useState<boolean>(false);
  const [previewPlatform, setPreviewPlatform] = useState<
    'google_desktop' | 'google_mobile' | 'facebook' | 'linkedin' | 'twitter_large' | 'twitter_small'
  >('google_desktop');
  const [activeCodeTab, setActiveCodeTab] = useState<'head' | 'meta' | 'og' | 'twitter' | 'schema'>('head');
  const [metaProposals, setMetaProposals] = useState<any[]>([]);
  const [proposalNotes, setProposalNotes] = useState<string>('');
  const [submittingProposal, setSubmittingProposal] = useState<boolean>(false);
  const [selectedBatchCrawlId, setSelectedBatchCrawlId] = useState<string>('');
  const [batchAuditReport, setBatchAuditReport] = useState<any | null>(null);
  const [auditingBatch, setAuditingBatch] = useState<boolean>(false);

  // Meta Studio Subview & Intelligence Graph State
  const [metaStudioSubView, setMetaStudioSubView] = useState<'graph' | 'workbench' | 'cross_page'>('graph');
  const [intelligenceGraph, setIntelligenceGraph] = useState<{
    nodes: any[];
    summary: {
      totalUrls: number;
      stageBreakdown: Record<string, number>;
      criticalIssuesCount: number;
      totalClicksDelta: number;
      totalImpressionsDelta: number;
    };
  } | null>(null);
  const [loadingGraph, setLoadingGraph] = useState<boolean>(false);
  const [graphStageFilter, setGraphStageFilter] = useState<string>('all');
  const [graphSearchQuery, setGraphSearchQuery] = useState<string>('');

  // Cross-Page Intelligence State
  const [crossPageIntelligence, setCrossPageIntelligence] = useState<any | null>(null);
  const [loadingCrossPage, setLoadingCrossPage] = useState<boolean>(false);
  const [activeCrossPageTab, setActiveCrossPageTab] = useState<
    'duplicate_titles' | 'duplicate_descriptions' | 'canonical_conflicts' | 'missing_tags' | 'missing_images'
  >('duplicate_titles');

  // Outcome Measurement Modal State
  const [outcomeModalProposal, setOutcomeModalProposal] = useState<any | null>(null);
  const [outcomeForm, setOutcomeForm] = useState({
    baselineClicks: 25,
    baselineImpressions: 500,
    baselinePosition: 12.4,
    currentClicks: 48,
    currentImpressions: 890,
    currentPosition: 7.8,
  });
  const [savingOutcome, setSavingOutcome] = useState<boolean>(false);

  // Evidence State
  const [claimText, setClaimText] = useState<string>('CHATR delivers 48% higher engagement and is the industry-leading messaging solution.');
  const [claimCitationUrl, setClaimCitationUrl] = useState<string>('https://chatr.chat/docs/guidelines');
  const [claimAuditResult, setClaimAuditResult] = useState<any | null>(null);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);

  useEffect(() => {
    ensureOperatorSession().then((session) => {
      setOperatorUser(session.user);
      fetchBrands();
      fetchOpportunities();
      fetchApprovals();
      fetchConnectors();
      fetchCrawlJobs();
      fetchSeoFindings();
      fetchEvidence();
      fetchProposals();
    });

    if (window.location.search.includes('oauth=google_success')) {
      setNotification('✅ Google Search Console & GA4 connection successfully verified and active!');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (selectedBrandId) {
      fetchIntelligenceGraph(selectedBrandId);
      fetchCrossPageIntelligence(selectedBrandId);
    }
  }, [selectedBrandId]);

  const fetchBrands = async () => {
    try {
      const res = await authFetch('/api/v1/brands');
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setBrands(data.data);
        setSelectedBrandId(data.data[0].id);
      }
    } catch (err) {
      setBrands([]);
      console.error('[fetchBrands] API unavailable:', err);
    }
  };

  const fetchOpportunities = async () => {
    try {
      const res = await authFetch('/api/v1/demand/opportunities');
      const data = await res.json();
      if (data.success) setOpportunities(data.data);
    } catch {
      setOpportunities([]);
    }
  };

  const fetchApprovals = async () => {
    try {
      const res = await authFetch('/api/v1/approvals');
      const data = await res.json();
      if (data.success) setApprovals(data.data);
    } catch {
      setApprovals([]);
    }
  };

  const fetchConnectors = async () => {
    try {
      const res = await authFetch('/api/v1/connectors/instances');
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
      const res = await authFetch('/api/v1/crawler/jobs');
      const data = await res.json();
      if (data.success) setCrawlJobs(data.data);
    } catch {
      // fallback
    }
  };

  const fetchSeoFindings = async () => {
    try {
      const [findingsRes, summaryRes] = await Promise.all([
        authFetch('/api/v1/seo/findings'),
        authFetch('/api/v1/seo/summary'),
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
      const res = await authFetch('/api/v1/evidence');
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

  const estimatePixelWidth = (text: string, type: 'title' | 'description' = 'title'): number => {
    if (!text) return 0;
    const factor = type === 'title' ? 10.4 : 6.8;
    return Math.round(text.length * factor);
  };

  const handleInspectUrl = async (overrideUrl?: string | unknown) => {
    const targetUrl = typeof overrideUrl === 'string' ? overrideUrl : metaForm.pageUrl;
    if (!targetUrl) {
      setNotification('❌ Please enter a page URL to inspect.');
      return;
    }
    const activeBrand = brands.find((b) => b.id === selectedBrandId) || brands[0];
    setInspectingUrl(true);
    setNotification('Inspecting page with SSRF-safe HTML parser...');
    try {
      const res = await fetch('/api/v1/meta-studio/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          brand_id: activeBrand?.id,
          allowed_domains: activeBrand ? [activeBrand.base_url, ...(activeBrand.config?.secondary_domains || [])] : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInspectedData(data.data);
        setMetaForm((prev) => ({
          ...prev,
          pageUrl: targetUrl,
          pageTitle: data.data.title || prev.pageTitle,
          pageDescription: data.data.metaDescription || prev.pageDescription,
          canonicalUrl: data.data.canonicalUrl || targetUrl,
          imageUrl: data.data.openGraph?.image || prev.imageUrl,
        }));
        handleRunDiagnostics(data.data);
        setNotification(`✅ Page inspected: HTTP ${data.data.statusCode} in ${data.data.fetchDurationMs}ms (${(data.data.htmlBytes / 1024).toFixed(1)} KB)`);
      } else {
        setNotification(`❌ Inspection failed: ${data.error?.message || data.error}`);
      }
    } catch (err) {
      setNotification(`❌ Inspection error: ${(err as Error).message}`);
    } finally {
      setInspectingUrl(false);
    }
  };

  const handleVerifyImage = async (overrideUrl?: string) => {
    const targetUrl = overrideUrl || metaForm.imageUrl;
    if (!targetUrl) {
      setNotification('❌ Please provide an image URL to verify.');
      return;
    }
    setProbingImage(true);
    setNotification('Probing social image (SSRF check, status, content-type, size)...');
    try {
      const res = await fetch('/api/v1/meta-studio/image-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: targetUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setImageProbeResult(data.data);
        if (data.data.isValid) {
          setNotification(`✅ Image verified: HTTP ${data.data.httpStatus}, ${data.data.contentType}, ${data.data.contentLength ? (data.data.contentLength / 1024).toFixed(0) + ' KB' : 'valid'}`);
        } else {
          setNotification(`⚠️ Image probe issue: ${data.data.errorMessage}`);
        }
      } else {
        setNotification(`❌ Image probe failed: ${data.error?.message || data.error}`);
      }
    } catch (err) {
      setNotification(`❌ Image probe error: ${(err as Error).message}`);
    } finally {
      setProbingImage(false);
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
          brand_name: activeBrand?.display_name || 'CHATR',
          brand_domain: activeBrand?.base_url || 'https://chatr.chat',
          page_url: metaForm.pageUrl,
          page_title: metaForm.pageTitle,
          page_description: metaForm.pageDescription,
          target_keyword: metaForm.targetKeyword,
          schema_type: metaForm.schemaType,
          image_url: metaForm.imageUrl || undefined,
          image_alt: metaForm.imageAlt || undefined,
          author_name: metaForm.authorName || undefined,
          date_published: metaForm.datePublished || undefined,
          date_modified: metaForm.dateModified || undefined,
          observed_data: inspectedData || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedMeta(data.data);
        handleRunDiagnostics();
        setNotification('✅ Generated 3 title & description variants with pixel-width meters. Simulated previews updated.');
      } else {
        setNotification(`❌ Generation failed: ${data.error?.message}`);
      }
    } catch (err) {
      setNotification(`❌ Generation error: ${(err as Error).message}`);
    } finally {
      setGeneratingMeta(false);
    }
  };

  const handleRunDiagnostics = async (observedOverride?: any) => {
    setValidatingReport(true);
    try {
      const obs = observedOverride || inspectedData;
      const res = await fetch('/api/v1/meta-studio/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_url: metaForm.pageUrl,
          title: metaForm.pageTitle || obs?.title,
          meta_description: metaForm.pageDescription || obs?.metaDescription,
          canonical_url: metaForm.canonicalUrl || obs?.canonicalUrl || metaForm.pageUrl,
          h1: obs?.h1,
          image_url: metaForm.imageUrl || obs?.openGraph?.image,
          schema_types: obs?.schemaTypes || (metaForm.schemaType ? [metaForm.schemaType] : []),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMetaValidationReport(data.data);
      }
    } catch {}
    finally {
      setValidatingReport(false);
    }
  };

  const fetchProposals = async () => {
    try {
      const res = await fetch('/api/v1/meta-studio/proposals');
      const data = await res.json();
      if (data.success) {
        setMetaProposals(data.data);
      }
    } catch {}
  };

  const handleSubmitProposal = async () => {
    if (!metaForm.pageUrl || !metaForm.pageTitle) {
      setNotification('❌ Target URL and Title are required to submit a proposal.');
      return;
    }
    const activeBrand = brands.find((b) => b.id === selectedBrandId) || brands[0];
    setSubmittingProposal(true);
    setNotification('Submitting metadata proposal to human governance queue...');
    try {
      const res = await fetch('/api/v1/meta-studio/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: '00000000-0000-0000-0000-000000000001',
          brand_id: activeBrand?.id,
          url: metaForm.pageUrl,
          proposal_type: 'meta_tags',
          payload: {
            title: metaForm.pageTitle,
            description: metaForm.pageDescription,
            canonical: metaForm.canonicalUrl || metaForm.pageUrl,
            imageUrl: metaForm.imageUrl,
            schemaType: metaForm.schemaType,
          },
          observed_payload: inspectedData ? {
            title: inspectedData.title,
            description: inspectedData.metaDescription,
            canonical: inspectedData.canonicalUrl,
            imageUrl: inspectedData.openGraph?.image,
          } : undefined,
          notes: proposalNotes || 'Operator generated metadata proposal via Studio V3.',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification('✅ Proposal submitted for human review & governance!');
        setProposalNotes('');
        fetchProposals();
        fetchIntelligenceGraph(selectedBrandId);
      } else {
        setNotification(`❌ Proposal submission failed: ${data.error?.message}`);
      }
    } catch (err) {
      setNotification(`❌ Submission error: ${(err as Error).message}`);
    } finally {
      setSubmittingProposal(false);
    }
  };

  const handleDecideProposal = async (
    id: string,
    decision: 'approved' | 'rejected',
    overrideGroundingWarnings: boolean = false
  ) => {
    try {
      const res = await fetch(`/api/v1/meta-studio/proposals/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: '00000000-0000-0000-0000-000000000001',
          decision,
          override_grounding_warnings: overrideGroundingWarnings,
          notes: `Reviewed and ${decision} in Control Room workbench.`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`✅ Proposal marked as ${decision}.`);
        fetchProposals();
        fetchIntelligenceGraph(selectedBrandId);
      } else if (data.error?.code === 'UNGROUNDED_SCHEMA_VIOLATION') {
        const force = window.confirm(
          `⚠️ Grounding Violation: ${data.error?.message}\n\nDo you want to override grounding warnings and approve anyway?`
        );
        if (force) {
          await handleDecideProposal(id, 'approved', true);
        }
      } else {
        setNotification(`❌ Decision failed: ${data.error?.message}`);
      }
    } catch (err) {
      setNotification(`❌ Decision error: ${(err as Error).message}`);
    }
  };

  const fetchIntelligenceGraph = async (brandId?: string) => {
    const targetBrand = brandId || selectedBrandId || brands[0]?.id;
    if (!targetBrand) return;
    setLoadingGraph(true);
    try {
      const res = await fetch(`/api/v1/meta-studio/intelligence-graph?brand_id=${targetBrand}&workspace_id=00000000-0000-0000-0000-000000000001`);
      const data = await res.json();
      if (data.success) {
        setIntelligenceGraph(data.data);
      }
    } catch {
      // gracefully handle offline/fallback
    } finally {
      setLoadingGraph(false);
    }
  };

  const fetchCrossPageIntelligence = async (brandId?: string) => {
    const targetBrand = brandId || selectedBrandId || brands[0]?.id;
    setLoadingCrossPage(true);
    try {
      const url = targetBrand
        ? `/api/v1/meta-studio/cross-page-intelligence?brand_id=${targetBrand}&workspace_id=00000000-0000-0000-0000-000000000001`
        : `/api/v1/meta-studio/cross-page-intelligence?workspace_id=00000000-0000-0000-0000-000000000001`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setCrossPageIntelligence(data.data);
      }
    } catch {
      // gracefully handle offline/fallback
    } finally {
      setLoadingCrossPage(false);
    }
  };

  const handleInspectAndFixUrl = async (url: string) => {
    setMetaStudioSubView('workbench');
    setMetaForm((prev) => ({
      ...prev,
      pageUrl: url,
      canonicalUrl: url,
    }));
    await handleInspectUrl(url);
  };

  const handleSaveOutcomeMeasurement = async () => {
    if (!outcomeModalProposal) return;
    setSavingOutcome(true);
    try {
      const res = await fetch('/api/v1/meta-studio/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: '00000000-0000-0000-0000-000000000001',
          proposal_id: outcomeModalProposal.id,
          baseline_metrics: {
            clicks: Number(outcomeForm.baselineClicks),
            impressions: Number(outcomeForm.baselineImpressions),
            position: Number(outcomeForm.baselinePosition),
          },
          current_metrics: {
            clicks: Number(outcomeForm.currentClicks),
            impressions: Number(outcomeForm.currentImpressions),
            position: Number(outcomeForm.currentPosition),
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`✅ Measured outcome recorded for ${outcomeModalProposal.url}!`);
        setOutcomeModalProposal(null);
        fetchIntelligenceGraph(selectedBrandId);
        fetchProposals();
      } else {
        setNotification(`❌ Failed to record outcome: ${data.error?.message}`);
      }
    } catch (err) {
      setNotification(`❌ Error recording outcome: ${(err as Error).message}`);
    } finally {
      setSavingOutcome(false);
    }
  };

  const handleAuditBatch = async () => {
    const jobId = selectedBatchCrawlId || crawlJobs[0]?.id;
    if (!jobId) {
      setNotification('❌ Please select or enter a crawl job ID.');
      return;
    }
    setAuditingBatch(true);
    setNotification(`Auditing crawl job ${jobId} for metadata issues...`);
    try {
      const res = await fetch(`/api/v1/meta-studio/batch/${jobId}`);
      const data = await res.json();
      if (data.success) {
        setBatchAuditReport(data.data);
        setNotification(`✅ Batch audit complete: ${data.data.totalPagesAudited} pages analyzed.`);
      } else {
        setNotification(`❌ Batch audit failed: ${data.error?.message}`);
      }
    } catch (err) {
      setNotification(`❌ Audit error: ${(err as Error).message}`);
    } finally {
      setAuditingBatch(false);
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
      const res = await authFetch('/api/v1/connectors/health-check', {
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
      const res = await authFetch('/api/v1/connectors/login-direct', {
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
      const res = await authFetch('/api/v1/connectors/disconnect', {
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
      const res = await authFetch('/api/v1/workflows/trigger', {
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
    } catch (err) {
      setNotification(`❌ Workflow execution error: ${(err as Error).message}`);
    } finally {
      setTriggering(false);
    }
  };

  const handleDecide = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      const res = await authFetch(`/api/v1/approvals/${id}/decide`, {
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
    } catch (err) {
      setNotification(`❌ Decision error: ${(err as Error).message}`);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
            style={{
              background: 'none',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {sidebarCollapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
          </button>

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🔐</span>
            <span>{operatorUser ? `${operatorUser.display_name || operatorUser.email} (${operatorUser.role})` : 'Connect GSC & Auth'}</span>
          </button>

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

      {/* ─── Main Workspace Area with Left Sidebar Navigation ──────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <SidebarNav
          activeTab={activeTab}
          onSelectTab={handleTabSelect}
          approvalsCount={approvals.length}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* ─── Main Content Area ─────────────────────────────────────────── */}
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: 'var(--bg-primary)' }}>
        <ErrorBoundary>
        {/* OmniPulse Autonomous Growth Pages */}
        {activeTab === 'omnipulse' && <OmniPulseOverview />}
        {activeTab === 'omnipulse_velocity' && <PageviewVelocityMonitor />}
        {activeTab === 'omnipulse_accounts' && <SocialAccountsHealth />}
        {activeTab === 'omnipulse_queue' && <ContentQueueMonitor />}
        {activeTab === 'omnipulse_pseo' && <PseoIntelligence />}
        {activeTab === 'omnipulse_backlinks' && <BacklinksCommander />}

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

        {/* TAB: Multi-Domain Registry & Health Matrix */}
        {activeTab === 'domains' && <DomainRegistryView />}

        {/* TAB: Durable Job Queue & Worker Health */}
        {activeTab === 'queue' && <DurableQueueView />}

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
                    {selectedBrand?.display_name || 'No brand selected'}
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

        {/* TAB 6: Meta Tags Studio V3 — Inspection, Generation, Validation, Previews & Governance */}
        {activeTab === 'meta_studio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header & Truthfulness Architecture Legend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Meta Tags Studio V3</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Live page inspection, pixel-accurate multi-candidate generation, real image probing, simulated previews, and review-gated governance.
                </p>
              </div>

              {/* 4-State Architecture Badges */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#93c5fd', fontWeight: 600 }}>
                  🔵 OBSERVED STATE: Real HTML Facts
                </span>
                <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#d8b4fe', fontWeight: 600 }}>
                  🟣 SUGGESTED: Draft Optimization
                </span>
                <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fde68a', fontWeight: 600 }}>
                  🟠 SIMULATED: Local Preview
                </span>
                <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#6ee7b7', fontWeight: 600 }}>
                  🟢 VERIFIED: Live Probe Evidence
                </span>
              </div>
            </div>

            {/* Studio Sub-Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <button
                onClick={() => setMetaStudioSubView('graph')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: metaStudioSubView === 'graph' ? 'var(--accent-blue)' : 'var(--bg-card)',
                  color: metaStudioSubView === 'graph' ? '#fff' : 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                📊 Metadata Intelligence Graph
                {intelligenceGraph?.summary && (
                  <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    {intelligenceGraph.summary.totalUrls}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMetaStudioSubView('workbench')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: metaStudioSubView === 'workbench' ? 'var(--accent-blue)' : 'var(--bg-card)',
                  color: metaStudioSubView === 'workbench' ? '#fff' : 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                🛠️ Studio Workbench & Inspector
              </button>
              <button
                onClick={() => setMetaStudioSubView('cross_page')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: metaStudioSubView === 'cross_page' ? 'var(--accent-blue)' : 'var(--bg-card)',
                  color: metaStudioSubView === 'cross_page' ? '#fff' : 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                🌐 Cross-Page Intelligence & Audits
                {crossPageIntelligence?.duplicateTitles?.length > 0 && (
                  <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}>
                    {crossPageIntelligence.duplicateTitles.length} dupes
                  </span>
                )}
              </button>
            </div>

            {/* SUB-VIEW 1: Metadata Intelligence Graph */}
            {metaStudioSubView === 'graph' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Graph Controls & Review-Gate Notice */}
                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Brand:</span>
                      <select
                        value={selectedBrandId}
                        onChange={(e) => {
                          setSelectedBrandId(e.target.value);
                          fetchIntelligenceGraph(e.target.value);
                          fetchCrossPageIntelligence(e.target.value);
                        }}
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '13px',
                          fontWeight: 600,
                        }}
                      >
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>{b.display_name} ({b.base_url})</option>
                        ))}
                      </select>
                    </div>

                    <span style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      color: '#fde68a',
                      fontWeight: 600
                    }}>
                      🔒 PROTECTED PROD: Review-Gated Changes Only
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Filter URLs or paths..."
                      value={graphSearchQuery}
                      onChange={(e) => setGraphSearchQuery(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        width: '200px',
                      }}
                    />
                    <button
                      onClick={() => fetchIntelligenceGraph(selectedBrandId)}
                      disabled={loadingGraph}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        cursor: loadingGraph ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {loadingGraph ? 'Refreshing...' : '🔄 Refresh Graph'}
                    </button>
                  </div>
                </div>

                {/* 6-Stage Intelligence Lifecycle Pipeline Visualization */}
                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '20px',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Unified Metadata Intelligence Pipeline</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400 }}>
                      Shared intelligence layer linking crawls, diagnostics, evidence, proposals, and verified outcomes
                    </span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '10px',
                  }}>
                    {[
                      { stage: 'crawled', step: '1', title: 'Crawled URL', desc: 'Fetched HTML & status', color: '#94a3b8' },
                      { stage: 'diagnosed', step: '2', title: 'Observed HTML', desc: 'Extracted facts & tags', color: '#f87171' },
                      { stage: 'evidence_linked', step: '3', title: 'SEO Findings', desc: 'Diagnosed issues & gaps', color: '#fbbf24' },
                      { stage: 'evidence_linked', step: '4', title: 'Source Evidence', desc: 'Substantiated facts', color: '#60a5fa' },
                      { stage: 'proposal_drafted', step: '5', title: 'Proposal Draft', desc: 'Grounded tag synthesis', color: '#c084fc' },
                      { stage: 'approved', step: '6', title: 'Human Approval', desc: 'Operator reviewed', color: '#a78bfa' },
                      { stage: 'outcomes_measured', step: '7', title: 'Measured Impact', desc: 'Verified clicks & CTR', color: '#34d399' },
                    ].map((st, i) => (
                      <div
                        key={i}
                        onClick={() => setGraphStageFilter(graphStageFilter === st.stage ? 'all' : st.stage)}
                        style={{
                          padding: '12px',
                          backgroundColor: graphStageFilter === st.stage ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)',
                          border: `1px solid ${graphStageFilter === st.stage ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease-in-out',
                        }}
                      >
                        <div style={{ fontSize: '10px', fontWeight: 800, color: st.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Stage {st.step}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>
                          {st.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {st.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary Metrics & Impact Cards */}
                {intelligenceGraph?.summary && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                  }}>
                    <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total URLs in Graph</div>
                      <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
                        {intelligenceGraph.summary.totalUrls}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Across active crawl snapshots
                      </div>
                    </div>

                    <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Critical / Error Issues</div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 800,
                        marginTop: '4px',
                        color: intelligenceGraph.summary.criticalIssuesCount > 0 ? '#f87171' : '#34d399',
                      }}>
                        {intelligenceGraph.summary.criticalIssuesCount}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Missing titles, canonical mismatches
                      </div>
                    </div>

                    <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Measured Clicks Delta</div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 800,
                        marginTop: '4px',
                        color: intelligenceGraph.summary.totalClicksDelta >= 0 ? '#34d399' : '#f87171',
                      }}>
                        {intelligenceGraph.summary.totalClicksDelta >= 0 ? `+${intelligenceGraph.summary.totalClicksDelta}` : intelligenceGraph.summary.totalClicksDelta}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Post-approval search performance
                      </div>
                    </div>

                    <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Measured Impressions Delta</div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 800,
                        marginTop: '4px',
                        color: intelligenceGraph.summary.totalImpressionsDelta >= 0 ? '#60a5fa' : '#f87171',
                      }}>
                        {intelligenceGraph.summary.totalImpressionsDelta >= 0 ? `+${intelligenceGraph.summary.totalImpressionsDelta}` : intelligenceGraph.summary.totalImpressionsDelta}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Organic visibility expansion
                      </div>
                    </div>
                  </div>
                )}

                {/* Filter Stage Pills */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Filter Stage:</span>
                  {[
                    { id: 'all', label: 'All Pages' },
                    { id: 'crawled', label: 'Crawled' },
                    { id: 'diagnosed', label: 'Diagnosed' },
                    { id: 'evidence_linked', label: 'Evidence Linked' },
                    { id: 'proposal_drafted', label: 'Proposal Drafted' },
                    { id: 'approved', label: 'Approved' },
                    { id: 'outcomes_measured', label: 'Outcomes Measured' },
                  ].map((f) => {
                    const count = f.id === 'all'
                      ? (intelligenceGraph?.nodes?.length || 0)
                      : (intelligenceGraph?.summary?.stageBreakdown?.[f.id] || 0);
                    const active = graphStageFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setGraphStageFilter(f.id)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: active ? 700 : 500,
                          borderRadius: '20px',
                          backgroundColor: active ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                          color: active ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer',
                        }}
                      >
                        {f.label} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Intelligence Graph Nodes List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(() => {
                    const filteredNodes = (intelligenceGraph?.nodes || [])
                      .filter((n) => graphStageFilter === 'all' || n.pipelineStage === graphStageFilter)
                      .filter((n) => !graphSearchQuery || n.url.toLowerCase().includes(graphSearchQuery.toLowerCase()));

                    if (filteredNodes.length === 0) {
                      return (
                        <div style={{ padding: '32px', textAlign: 'center', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                          {loadingGraph ? 'Loading Metadata Intelligence Graph...' : 'No URLs matched the selected stage and search filters.'}
                        </div>
                      );
                    }

                    return filteredNodes.map((node, idx) => {
                      const stageColors: Record<string, { bg: string; text: string; label: string }> = {
                        crawled: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', label: 'Stage 1: Crawled' },
                        diagnosed: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', label: 'Stage 2: Diagnosed Issues' },
                        evidence_linked: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', label: 'Stage 3: Evidence Linked' },
                        proposal_drafted: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', label: 'Stage 4: Proposal Drafted' },
                        approved: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', label: 'Stage 5: Approved by Operator' },
                        outcomes_measured: { bg: 'rgba(52, 211, 153, 0.2)', text: '#10b981', label: 'Stage 6: Outcomes Measured' },
                      };
                      const st = stageColors[node.pipelineStage] || stageColors['crawled'];

                      return (
                        <div
                          key={node.url || idx}
                          style={{
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                          }}
                        >
                          {/* Node Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: st.bg,
                                color: st.text,
                                border: `1px solid ${st.text}`,
                              }}>
                                {st.label}
                              </span>
                              <a
                                href={node.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}
                              >
                                {node.pathname || node.url} ↗
                              </a>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                ({node.url})
                              </span>
                            </div>

                            <button
                              onClick={() => handleInspectAndFixUrl(node.url)}
                              style={{
                                padding: '5px 12px',
                                backgroundColor: 'var(--accent-blue)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              ⚡ Inspect & Fix in Studio
                            </button>
                          </div>

                          {/* Node Details Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', fontSize: '12px' }}>
                            {/* Observed HTML Facts */}
                            <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                              <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: '4px' }}>
                                🔵 Observed Page State:
                              </div>
                              <div><strong>Title:</strong> {node.snapshot?.title || '<Missing Title>'}</div>
                              <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                                <strong>Description:</strong> {node.snapshot?.metaDesc || '<Missing Description>'}
                              </div>
                              <div style={{ marginTop: '2px', fontSize: '11px' }}>
                                <strong>Canonical:</strong> <code>{node.snapshot?.canonical || '<None>'}</code>
                              </div>
                            </div>

                            {/* SEO Findings & Diagnostics */}
                            <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                              <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '4px' }}>
                                🔴 Diagnosed Findings ({node.findings?.length || 0}):
                              </div>
                              {node.findings && node.findings.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {node.findings.slice(0, 3).map((f: any, fIdx: number) => (
                                    <div key={fIdx} style={{ fontSize: '11px' }}>
                                      <span style={{
                                        color: f.severity === 'critical' || f.severity === 'error' ? '#f87171' : '#fde68a',
                                        fontWeight: 700,
                                        marginRight: '4px'
                                      }}>
                                        [{f.severity?.toUpperCase()}]:
                                      </span>
                                      {f.title}
                                    </div>
                                  ))}
                                  {node.findings.length > 3 && (
                                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                      +{node.findings.length - 3} more issues
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ color: '#34d399', fontSize: '11px' }}>
                                  ✓ No active diagnostic violations
                                </div>
                              )}
                            </div>

                            {/* Proposal & Human Governance */}
                            <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                              <div style={{ fontWeight: 700, color: '#d8b4fe', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>🟣 Metadata Proposal:</span>
                                {node.proposal && (
                                  <span style={{
                                    fontSize: '10px',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    backgroundColor: node.proposal.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : node.proposal.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                    color: node.proposal.status === 'approved' ? '#34d399' : node.proposal.status === 'rejected' ? '#f87171' : '#fde68a',
                                  }}>
                                    {node.proposal.status.toUpperCase()}
                                  </span>
                                )}
                              </div>
                              {node.proposal ? (
                                <div>
                                  <div style={{ fontWeight: 600 }}>{node.proposal.payload?.title}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    {node.proposal.payload?.description}
                                  </div>

                                  {/* Grounding Status */}
                                  <div style={{ marginTop: '4px', fontSize: '11px' }}>
                                    Grounding: {node.proposal.grounding_status === 'grounded' ? (
                                      <span style={{ color: '#34d399' }}>✓ Grounded to facts</span>
                                    ) : (
                                      <span style={{ color: '#f87171' }}>⚠️ Grounding warning</span>
                                    )}
                                  </div>

                                  {/* Governance Actions */}
                                  {node.proposal.status === 'draft' && (
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                      <button
                                        onClick={() => handleDecideProposal(node.proposal.id, 'approved')}
                                        style={{ padding: '3px 8px', backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid #34d399', color: '#34d399', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                                      >
                                        ✓ Approve
                                      </button>
                                      <button
                                        onClick={() => handleDecideProposal(node.proposal.id, 'rejected')}
                                        style={{ padding: '3px 8px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #f87171', color: '#f87171', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                                      >
                                        ✗ Reject
                                      </button>
                                    </div>
                                  )}

                                  {node.proposal.status === 'approved' && !node.outcome && (
                                    <div style={{ marginTop: '6px' }}>
                                      <button
                                        onClick={() => setOutcomeModalProposal(node.proposal)}
                                        style={{ padding: '3px 8px', backgroundColor: 'rgba(52, 211, 153, 0.2)', border: '1px solid #34d399', color: '#34d399', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                                      >
                                        📈 Record Measured Outcome
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                                  No draft proposal submitted. Click "Inspect & Fix in Studio" to generate optimizations.
                                </div>
                              )}
                            </div>

                            {/* Measured Outcome Impact */}
                            {node.outcome && (
                              <div style={{ padding: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px' }}>
                                <div style={{ fontWeight: 700, color: '#34d399', marginBottom: '4px' }}>
                                  🟢 Verified Outcome Impact:
                                </div>
                                <div style={{ fontSize: '11px' }}>
                                  Clicks: <strong>{node.outcome.baseline_metrics?.clicks || 0} ➔ {node.outcome.current_metrics?.clicks || 0}</strong> ({node.outcome.metrics_delta?.clicksDelta >= 0 ? `+${node.outcome.metrics_delta.clicksDelta}` : node.outcome.metrics_delta?.clicksDelta})
                                </div>
                                <div style={{ fontSize: '11px', marginTop: '2px' }}>
                                  Impressions: <strong>{node.outcome.baseline_metrics?.impressions || 0} ➔ {node.outcome.current_metrics?.impressions || 0}</strong> ({node.outcome.metrics_delta?.impressionsDelta >= 0 ? `+${node.outcome.metrics_delta.impressionsDelta}` : node.outcome.metrics_delta?.impressionsDelta})
                                </div>
                                {node.outcome.metrics_delta?.ctrDelta !== undefined && (
                                  <div style={{ fontSize: '11px', marginTop: '2px', color: '#6ee7b7' }}>
                                    CTR Delta: <strong>{node.outcome.metrics_delta.ctrDelta >= 0 ? `+${node.outcome.metrics_delta.ctrDelta}%` : `${node.outcome.metrics_delta.ctrDelta}%`}</strong>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* SUB-VIEW 2: Cross-Page Intelligence & Audits */}
            {metaStudioSubView === 'cross_page' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Header & Refresh */}
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Cross-Page Metadata Intelligence & Conflict Audits</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Identifies duplicate titles, duplicate descriptions, canonical conflicts, and missing core tags across crawl snapshots.
                    </p>
                  </div>
                  <button
                    onClick={() => fetchCrossPageIntelligence(selectedBrandId)}
                    disabled={loadingCrossPage}
                    style={{ padding: '6px 14px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', cursor: loadingCrossPage ? 'not-allowed' : 'pointer' }}
                  >
                    {loadingCrossPage ? 'Auditing...' : '🔄 Refresh Audit'}
                  </button>
                </div>

                {/* Health Distribution & KPI Counters */}
                {crossPageIntelligence && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Pages Analyzed</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px' }}>{crossPageIntelligence.totalPages}</div>
                    </div>
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Duplicate Titles</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: crossPageIntelligence.duplicateTitles?.length > 0 ? '#f87171' : '#34d399' }}>
                        {crossPageIntelligence.duplicateTitles?.length || 0}
                      </div>
                    </div>
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Duplicate Descriptions</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: crossPageIntelligence.duplicateDescriptions?.length > 0 ? '#fde68a' : '#34d399' }}>
                        {crossPageIntelligence.duplicateDescriptions?.length || 0}
                      </div>
                    </div>
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Canonical Conflicts</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: crossPageIntelligence.canonicalConflicts?.length > 0 ? '#f87171' : '#34d399' }}>
                        {crossPageIntelligence.canonicalConflicts?.length || 0}
                      </div>
                    </div>
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Missing Core Tags</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: crossPageIntelligence.missingCoreTags?.length > 0 ? '#f87171' : '#34d399' }}>
                        {crossPageIntelligence.missingCoreTags?.length || 0}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-Tabs for Categories */}
                <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  {[
                    { id: 'duplicate_titles', label: `Duplicate Titles (${crossPageIntelligence?.duplicateTitles?.length || 0})` },
                    { id: 'duplicate_descriptions', label: `Duplicate Descriptions (${crossPageIntelligence?.duplicateDescriptions?.length || 0})` },
                    { id: 'canonical_conflicts', label: `Canonical Conflicts (${crossPageIntelligence?.canonicalConflicts?.length || 0})` },
                    { id: 'missing_tags', label: `Missing Core Tags (${crossPageIntelligence?.missingCoreTags?.length || 0})` },
                    { id: 'missing_images', label: `Missing Images (${crossPageIntelligence?.missingSocialImages?.length || 0})` },
                  ].map((tb) => (
                    <button
                      key={tb.id}
                      onClick={() => setActiveCrossPageTab(tb.id as any)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: activeCrossPageTab === tb.id ? 700 : 500,
                        backgroundColor: activeCrossPageTab === tb.id ? 'var(--bg-card)' : 'transparent',
                        color: activeCrossPageTab === tb.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                        border: 'none',
                        borderBottom: activeCrossPageTab === tb.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {tb.label}
                    </button>
                  ))}
                </div>

                {/* Category Details Card */}
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                  {activeCrossPageTab === 'duplicate_titles' && (
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Duplicate Title Clusters</h4>
                      {crossPageIntelligence?.duplicateTitles?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {crossPageIntelligence.duplicateTitles.map((item: any, idx: number) => (
                            <div key={idx} style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ color: '#f87171' }}>"{item.title}"</strong>
                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontWeight: 700 }}>
                                  Shared by {item.count} URLs
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                                {item.urls.map((u: string, uIdx: number) => (
                                  <div key={uIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>• {u}</span>
                                    <button
                                      onClick={() => handleInspectAndFixUrl(u)}
                                      style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                      ⚡ Fix in Studio
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: '#34d399', fontSize: '12px' }}>✓ No duplicate titles detected across crawled pages.</div>
                      )}
                    </div>
                  )}

                  {activeCrossPageTab === 'duplicate_descriptions' && (
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Duplicate Meta Description Clusters</h4>
                      {crossPageIntelligence?.duplicateDescriptions?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {crossPageIntelligence.duplicateDescriptions.map((item: any, idx: number) => (
                            <div key={idx} style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ color: '#fde68a' }}>"{item.description}"</strong>
                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fde68a', fontWeight: 700 }}>
                                  Shared by {item.count} URLs
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                                {item.urls.map((u: string, uIdx: number) => (
                                  <div key={uIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>• {u}</span>
                                    <button
                                      onClick={() => handleInspectAndFixUrl(u)}
                                      style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                      ⚡ Fix in Studio
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: '#34d399', fontSize: '12px' }}>✓ No duplicate descriptions detected across crawled pages.</div>
                      )}
                    </div>
                  )}

                  {activeCrossPageTab === 'canonical_conflicts' && (
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Canonical URL Conflicts</h4>
                      {crossPageIntelligence?.canonicalConflicts?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {crossPageIntelligence.canonicalConflicts.map((c: any, idx: number) => (
                            <div key={idx} style={{ padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div><strong>Page:</strong> {c.url}</div>
                                <div style={{ color: '#f87171', marginTop: '2px', fontSize: '11px' }}>
                                  Points to: <code>{c.declaredCanonical}</code> ({c.issue})
                                </div>
                              </div>
                              <button
                                onClick={() => handleInspectAndFixUrl(c.url)}
                                style={{ padding: '3px 8px', fontSize: '10px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                ⚡ Fix in Studio
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: '#34d399', fontSize: '12px' }}>✓ No canonical conflicts detected.</div>
                      )}
                    </div>
                  )}

                  {activeCrossPageTab === 'missing_tags' && (
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Pages Missing Core Metadata Tags</h4>
                      {crossPageIntelligence?.missingCoreTags?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {crossPageIntelligence.missingCoreTags.map((m: any, idx: number) => (
                            <div key={idx} style={{ padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div><strong>URL:</strong> {m.url}</div>
                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                  {m.missing.map((tag: string) => (
                                    <span key={tag} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontWeight: 600 }}>
                                      Missing &lt;{tag}&gt;
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={() => handleInspectAndFixUrl(m.url)}
                                style={{ padding: '3px 8px', fontSize: '10px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                ⚡ Fix in Studio
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: '#34d399', fontSize: '12px' }}>✓ All crawled pages possess core title, description, h1, and canonical tags.</div>
                      )}
                    </div>
                  )}

                  {activeCrossPageTab === 'missing_images' && (
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Pages Missing Social Images (og:image)</h4>
                      {crossPageIntelligence?.missingSocialImages?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {crossPageIntelligence.missingSocialImages.map((u: string, idx: number) => (
                            <div key={idx} style={{ padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>• {u}</span>
                              <button
                                onClick={() => handleInspectAndFixUrl(u)}
                                style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                ⚡ Fix in Studio
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: '#34d399', fontSize: '12px' }}>✓ All crawled pages specify an Open Graph social image.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-VIEW 3: Studio Workbench & Inspector */}
            {metaStudioSubView === 'workbench' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* SECTION 1: Safe Target URL Inspector & Ingest */}
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>1. Target URL & Live Inspection (SSRF-Protected)</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={metaForm.pageUrl}
                  onChange={(e) => setMetaForm({ ...metaForm, pageUrl: e.target.value })}
                  placeholder="https://chatr.chat/video-tools"
                  style={{ flex: 1, minWidth: '280px', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                />
                <button
                  onClick={() => handleInspectUrl()}
                  disabled={inspectingUrl}
                  style={{ padding: '8px 16px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: inspectingUrl ? 'not-allowed' : 'pointer' }}
                >
                  {inspectingUrl ? 'Inspecting Live Page...' : '🔍 Inspect Live Page'}
                </button>
              </div>

              {/* Observed Page Facts Card */}
              {inspectedData && (
                <div style={{ marginTop: '16px', padding: '14px', backgroundColor: 'var(--bg-secondary)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#93c5fd' }}>🔵 Observed Page Facts:</span>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 700 }}>
                        HTTP {inspectedData.statusCode}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {(inspectedData.htmlBytes / 1024).toFixed(1)} KB in {inspectedData.fetchDurationMs}ms
                      </span>
                    </div>
                    {/* Quick Apply Buttons */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {inspectedData.title && (
                        <button
                          onClick={() => setMetaForm({ ...metaForm, pageTitle: inspectedData.title })}
                          style={{ padding: '3px 8px', fontSize: '11px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}
                        >
                          Use Fetched Title
                        </button>
                      )}
                      {inspectedData.metaDescription && (
                        <button
                          onClick={() => setMetaForm({ ...metaForm, pageDescription: inspectedData.metaDescription })}
                          style={{ padding: '3px 8px', fontSize: '11px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}
                        >
                          Use Fetched Description
                        </button>
                      )}
                      {inspectedData.canonicalUrl && (
                        <button
                          onClick={() => setMetaForm({ ...metaForm, canonicalUrl: inspectedData.canonicalUrl })}
                          style={{ padding: '3px 8px', fontSize: '11px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}
                        >
                          Use Fetched Canonical
                        </button>
                      )}
                      {inspectedData.openGraph?.image && (
                        <button
                          onClick={() => {
                            setMetaForm({ ...metaForm, imageUrl: inspectedData.openGraph.image });
                            handleVerifyImage(inspectedData.openGraph.image);
                          }}
                          style={{ padding: '3px 8px', fontSize: '11px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}
                        >
                          Use Detected Image
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    <div><strong>Title:</strong> {inspectedData.title || '<Missing>'}</div>
                    <div><strong>H1 Tag:</strong> {inspectedData.h1 || '<Missing>'}</div>
                    <div><strong>Canonical:</strong> {inspectedData.canonicalUrl || '<None>'}</div>
                    <div><strong>Robots:</strong> {inspectedData.robots || 'index, follow (default)'}</div>
                    <div><strong>Language:</strong> {inspectedData.language || 'Unspecified'}</div>
                    <div><strong>Links:</strong> {inspectedData.internalLinksCount} internal / {inspectedData.externalLinksCount} external</div>
                    <div><strong>OG Image:</strong> {inspectedData.openGraph?.image || '<None>'}</div>
                    <div><strong>Schemas:</strong> {inspectedData.schemaTypes?.join(', ') || '<None>'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* MAIN 2-COLUMN WORKBENCH */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '20px' }}>
              {/* LEFT COLUMN: Metadata Editor & Variant Generator */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700 }}>2. SEO & Open Graph Editor</h3>
                    <button
                      onClick={handleGenerateMeta}
                      disabled={generatingMeta}
                      style={{ padding: '6px 14px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: generatingMeta ? 'not-allowed' : 'pointer' }}
                    >
                      {generatingMeta ? 'Synthesizing...' : '⚡ Synthesize 3 Variants'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Title Input + Pixel Width Meter */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600 }}>Page Title:</label>
                        <span style={{ fontSize: '11px', color: estimatePixelWidth(metaForm.pageTitle, 'title') > 580 ? '#f87171' : 'var(--text-secondary)' }}>
                          {metaForm.pageTitle.length} chars | ~{estimatePixelWidth(metaForm.pageTitle, 'title')}px / 580px limit
                          {estimatePixelWidth(metaForm.pageTitle, 'title') > 580 && ' ⚠️ Truncation risk'}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={metaForm.pageTitle}
                        onChange={(e) => setMetaForm({ ...metaForm, pageTitle: e.target.value })}
                        style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-secondary)', border: `1px solid ${estimatePixelWidth(metaForm.pageTitle, 'title') > 580 ? '#f87171' : 'var(--border-color)'}`, borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Multi-Candidate Title Variant Selector */}
                    {generatedMeta?.titleCandidates && (
                      <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11px' }}>
                        <strong style={{ color: '#d8b4fe' }}>Title Candidates Generated:</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                          {generatedMeta.titleCandidates.map((c: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              <span style={{ flex: 1 }}>
                                <strong>[{c.variant}]:</strong> {c.text} <span style={{ color: 'var(--text-secondary)' }}>({c.estimatedPixelWidth}px)</span>
                              </span>
                              <button
                                onClick={() => setMetaForm({ ...metaForm, pageTitle: c.text })}
                                style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}
                              >
                                Apply
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Meta Description + Pixel Width Meter */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600 }}>Meta Description:</label>
                        <span style={{ fontSize: '11px', color: estimatePixelWidth(metaForm.pageDescription, 'description') > 960 ? '#f87171' : 'var(--text-secondary)' }}>
                          {metaForm.pageDescription.length} chars | ~{estimatePixelWidth(metaForm.pageDescription, 'description')}px / 960px limit
                          {estimatePixelWidth(metaForm.pageDescription, 'description') > 960 && ' ⚠️ Snippet truncation risk'}
                        </span>
                      </div>
                      <textarea
                        value={metaForm.pageDescription}
                        onChange={(e) => setMetaForm({ ...metaForm, pageDescription: e.target.value })}
                        rows={3}
                        style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-secondary)', border: `1px solid ${estimatePixelWidth(metaForm.pageDescription, 'description') > 960 ? '#f87171' : 'var(--border-color)'}`, borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Multi-Candidate Description Variant Selector */}
                    {generatedMeta?.descriptionCandidates && (
                      <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11px' }}>
                        <strong style={{ color: '#d8b4fe' }}>Description Candidates Generated:</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                          {generatedMeta.descriptionCandidates.map((c: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              <span style={{ flex: 1 }}>
                                <strong>[{c.variant}]:</strong> {c.text} <span style={{ color: 'var(--text-secondary)' }}>({c.estimatedPixelWidth}px)</span>
                              </span>
                              <button
                                onClick={() => setMetaForm({ ...metaForm, pageDescription: c.text })}
                                style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}
                              >
                                Apply
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Target Keyword & Canonical URL */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                          Target Keyword:
                          {metaForm.targetKeyword && (
                            <span style={{ marginLeft: '6px', fontSize: '10px', color: metaForm.pageTitle.toLowerCase().includes(metaForm.targetKeyword.toLowerCase()) ? '#34d399' : '#f87171' }}>
                              {metaForm.pageTitle.toLowerCase().includes(metaForm.targetKeyword.toLowerCase()) ? '✓ in title' : '✗ missing in title'}
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={metaForm.targetKeyword}
                          onChange={(e) => setMetaForm({ ...metaForm, targetKeyword: e.target.value })}
                          style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Canonical URL:</label>
                        <input
                          type="text"
                          value={metaForm.canonicalUrl}
                          onChange={(e) => setMetaForm({ ...metaForm, canonicalUrl: e.target.value })}
                          style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    {/* Social Image & Live Verification Probe */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600 }}>Social Image URL (og:image & twitter:image):</label>
                        <button
                          onClick={() => handleVerifyImage()}
                          disabled={probingImage || !metaForm.imageUrl}
                          style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: probingImage ? 'not-allowed' : 'pointer' }}
                        >
                          {probingImage ? 'Probing...' : '🔍 Probe Image URL'}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={metaForm.imageUrl}
                        onChange={(e) => setMetaForm({ ...metaForm, imageUrl: e.target.value })}
                        placeholder="https://chatr.chat/assets/og-cover.png (leave blank if no image)"
                        style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                      />
                      {/* Image Probe Result Callout */}
                      {imageProbeResult && (
                        <div style={{ marginTop: '6px', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', backgroundColor: imageProbeResult.isValid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${imageProbeResult.isValid ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`, color: imageProbeResult.isValid ? '#6ee7b7' : '#fca5a5' }}>
                          {imageProbeResult.isValid ? (
                            <span>🟢 <strong>Image Verified:</strong> HTTP {imageProbeResult.httpStatus} | {imageProbeResult.contentType} | {imageProbeResult.contentLength ? (imageProbeResult.contentLength / 1024).toFixed(0) + ' KB' : 'Size unstated'} | Aspect Ratio: {imageProbeResult.dimensions?.aspectRatio || '1.91:1 recommended'}</span>
                          ) : (
                            <span>⚠️ <strong>Image Probe Warning:</strong> {imageProbeResult.errorMessage}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Schema.org Dropdown & Zero-Invention Rule */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                          <option value="SoftwareApplication">SoftwareApplication</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Author Name (Optional):</label>
                        <input
                          type="text"
                          value={metaForm.authorName}
                          onChange={(e) => setMetaForm({ ...metaForm, authorName: e.target.value })}
                          placeholder="Leave empty to use Brand"
                          style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    <div style={{ padding: '8px 12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', fontSize: '11px', color: '#fde68a' }}>
                      ⚠️ <strong>Zero-Invention Safeguard:</strong> Dates (<code>datePublished</code>) and prices are never synthetically invented. They are only included if verified from page HTML or explicitly provided.
                    </div>
                  </div>
                </div>

                {/* Metadata Health & Explainable Diagnostic Report */}
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Diagnostic Health Report</h3>
                      {metaValidationReport && (
                        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, backgroundColor: metaValidationReport.overallScore >= 80 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: metaValidationReport.overallScore >= 80 ? '#34d399' : '#f87171' }}>
                          {metaValidationReport.overallScore}/100 ({metaValidationReport.status.toUpperCase()})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRunDiagnostics()}
                      disabled={validatingReport}
                      style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: validatingReport ? 'not-allowed' : 'pointer' }}
                    >
                      {validatingReport ? 'Checking...' : '🔄 Run Diagnostics'}
                    </button>
                  </div>

                  {metaValidationReport ? (
                    <div>
                      {/* Category Breakdown */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                        {Object.entries(metaValidationReport.categoryScores || {}).map(([cat, score]: [string, any]) => (
                          <div key={cat} style={{ padding: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{cat.replace(/_/g, ' ')}</div>
                            <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px', color: score >= 80 ? '#34d399' : score >= 60 ? '#fde68a' : '#f87171' }}>{score}%</div>
                          </div>
                        ))}
                      </div>

                      {/* Findings List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                        {metaValidationReport.findings.map((f: any, idx: number) => (
                          <div key={idx} style={{ padding: '6px 10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '11px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: f.severity === 'error' ? '#f87171' : f.severity === 'warning' ? '#fde68a' : '#93c5fd' }}>
                              [{f.severity.toUpperCase()}]
                            </span>
                            <span style={{ flex: 1 }}>{f.message}</span>
                            <code style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{f.ruleId}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Click "Run Diagnostics" or synthesize metadata to evaluate SEO health, social tags, and schema.org completeness.
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Cross-Platform Simulated Previews & Image Renderer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                  {/* Platform Selector Tabs */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>3. Simulated Previews</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[
                        { key: 'google_desktop', label: 'Google SERP' },
                        { key: 'facebook', label: 'Facebook / LinkedIn' },
                        { key: 'twitter_large', label: 'X (Large Card)' },
                        { key: 'twitter_small', label: 'X (Summary)' },
                      ].map((p) => (
                        <button
                          key={p.key}
                          onClick={() => setPreviewPlatform(p.key as any)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: previewPlatform === p.key ? 700 : 500,
                            backgroundColor: previewPlatform === p.key ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                            color: previewPlatform === p.key ? '#fff' : 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prominent Truthfulness Notice Banner */}
                  <div style={{ padding: '6px 10px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '4px', fontSize: '11px', color: '#fde68a', marginBottom: '12px' }}>
                    🟠 <strong>SIMULATED PREVIEW — NOT EXTERNALLY VERIFIED:</strong> Rendered locally from current inputs. Platform crawlers cache and format snippets independently.
                  </div>

                  {/* PREVIEW CONTAINER */}
                  <div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {/* Google Desktop SERP */}
                    {previewPlatform === 'google_desktop' && (
                      <div style={{ padding: '16px', backgroundColor: '#fff', borderRadius: '8px', color: '#202124', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#202124' }}>
                          <span style={{ fontSize: '14px' }}>🌐</span>
                          <span>{new URL(metaForm.canonicalUrl || metaForm.pageUrl || 'https://chatr.chat').hostname}</span>
                          <span style={{ color: '#5f6368' }}>› {new URL(metaForm.canonicalUrl || metaForm.pageUrl || 'https://chatr.chat').pathname.replace(/^\//, '')}</span>
                        </div>
                        <div style={{ fontSize: '18px', color: '#1a0dab', fontWeight: 500, marginTop: '4px', lineHeight: '1.3', cursor: 'pointer' }}>
                          {metaForm.pageTitle || 'Page Title Placeholder'}
                        </div>
                        <div style={{ fontSize: '13px', color: '#4d5156', marginTop: '6px', lineHeight: '1.4' }}>
                          {metaForm.pageDescription || 'Meta description text snippet will be displayed here in search engine result pages.'}
                        </div>
                      </div>
                    )}

                    {/* Facebook / LinkedIn Open Graph Card */}
                    {previewPlatform === 'facebook' && (
                      <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
                        {metaForm.imageUrl ? (
                          <div style={{ width: '100%', height: '180px', backgroundColor: '#0f172a', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img
                              src={metaForm.imageUrl}
                              alt={metaForm.imageAlt || 'Social Card Image'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div style={{ height: '120px', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            🖼️ No Share Image Specified (Using Text-Only Card)
                          </div>
                        )}
                        <div style={{ padding: '12px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            {new URL(metaForm.canonicalUrl || metaForm.pageUrl || 'https://chatr.chat').hostname}
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                            {metaForm.pageTitle || 'Page Title'}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                            {metaForm.pageDescription || 'Meta description'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Twitter / X Large Summary Card */}
                    {previewPlatform === 'twitter_large' && (
                      <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
                        {metaForm.imageUrl ? (
                          <div style={{ width: '100%', height: '180px', backgroundColor: '#0f172a', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img
                              src={metaForm.imageUrl}
                              alt={metaForm.imageAlt || 'Twitter Large Image'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div style={{ height: '120px', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            🖼️ No Share Image Specified (summary_large_image requires image)
                          </div>
                        )}
                        <div style={{ padding: '12px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {new URL(metaForm.canonicalUrl || metaForm.pageUrl || 'https://chatr.chat').hostname}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px', color: 'var(--text-primary)' }}>
                            {metaForm.pageTitle}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {metaForm.pageDescription}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Twitter / X Small Summary Card */}
                    {previewPlatform === 'twitter_small' && (
                      <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-card)', display: 'flex' }}>
                        {metaForm.imageUrl ? (
                          <div style={{ width: '120px', height: '120px', backgroundColor: '#0f172a', flexShrink: 0 }}>
                            <img
                              src={metaForm.imageUrl}
                              alt={metaForm.imageAlt || 'Twitter Thumbnail'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div style={{ width: '100px', height: '100px', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '10px', flexShrink: 0 }}>
                            No Image
                          </div>
                        )}
                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {new URL(metaForm.canonicalUrl || metaForm.pageUrl || 'https://chatr.chat').hostname}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: 'var(--text-primary)' }}>
                            {metaForm.pageTitle}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', maxHeight: '40px', overflow: 'hidden' }}>
                            {metaForm.pageDescription}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Production Code & Export */}
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700 }}>4. Code & Export Snippets</h3>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {generatedMeta?.htmlSnippet && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedMeta.htmlSnippet);
                            setNotification('✅ Production HTML snippet copied to clipboard!');
                          }}
                          style={{ padding: '4px 10px', backgroundColor: 'var(--accent-green)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          📋 Copy HTML Snippet
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Code sub-tabs */}
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                    {[
                      { key: 'head', label: 'Full <head>' },
                      { key: 'meta', label: 'Meta & Canonical' },
                      { key: 'og', label: 'Open Graph' },
                      { key: 'twitter', label: 'Twitter Card' },
                      { key: 'schema', label: 'JSON-LD Schema' },
                    ].map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setActiveCodeTab(t.key as any)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: activeCodeTab === t.key ? 700 : 500,
                          backgroundColor: activeCodeTab === t.key ? 'var(--bg-secondary)' : 'transparent',
                          color: activeCodeTab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                          border: 'none',
                          borderBottom: activeCodeTab === t.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
                          cursor: 'pointer',
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <pre style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '11px', overflowX: 'auto', color: '#93c5fd', maxHeight: '180px', margin: 0 }}>
                    {activeCodeTab === 'schema' && generatedMeta?.jsonLd
                      ? JSON.stringify(generatedMeta.jsonLd, null, 2)
                      : activeCodeTab === 'og' && generatedMeta?.openGraph
                      ? Object.entries(generatedMeta.openGraph).map(([k, v]) => `<meta property="${k}" content="${v}" />`).join('\n')
                      : activeCodeTab === 'twitter' && generatedMeta?.twitterCard
                      ? Object.entries(generatedMeta.twitterCard).map(([k, v]) => `<meta name="${k}" content="${v}" />`).join('\n')
                      : activeCodeTab === 'meta'
                      ? `<title>${metaForm.pageTitle}</title>\n<meta name="description" content="${metaForm.pageDescription}" />\n<link rel="canonical" href="${metaForm.canonicalUrl || metaForm.pageUrl}" />\n<meta name="robots" content="index, follow" />`
                      : generatedMeta?.htmlSnippet || '<!-- Click "Synthesize 3 Variants" to generate complete production head snippet -->'}
                  </pre>
                </div>
              </div>
            </div>

            {/* SECTION 5: Human Governance & Proposal Queue */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700 }}>5. Governance & Review-Gated Metadata Proposals</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Changes must be submitted to the human review queue before production publishing.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={proposalNotes}
                    onChange={(e) => setProposalNotes(e.target.value)}
                    placeholder="Operator review rationale..."
                    style={{ padding: '6px 10px', fontSize: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', width: '220px' }}
                  />
                  <button
                    onClick={handleSubmitProposal}
                    disabled={submittingProposal}
                    style={{ padding: '6px 14px', backgroundColor: 'var(--accent-purple)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: submittingProposal ? 'not-allowed' : 'pointer' }}
                  >
                    {submittingProposal ? 'Submitting...' : '📥 Submit Proposal for Review'}
                  </button>
                </div>
              </div>

              {/* Proposals Table */}
              {metaProposals.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {metaProposals.map((p) => {
                    const statusColor = p.status === 'approved' ? '#34d399' : p.status === 'rejected' ? '#f87171' : '#fde68a';
                    return (
                      <div key={p.id} style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.08)', color: statusColor, border: `1px solid ${statusColor}` }}>
                              {p.status.toUpperCase()}
                            </span>
                            <span style={{ fontWeight: 700 }}>{p.payload?.title || p.url}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>({p.url})</span>
                          </div>
                          <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '11px' }}>
                            {p.payload?.description}
                          </div>
                          {p.notes && <div style={{ marginTop: '4px', fontSize: '11px', color: '#93c5fd' }}>Notes: {p.notes}</div>}
                        </div>

                        {p.status === 'draft' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => handleDecideProposal(p.id, 'approved')}
                              style={{ padding: '4px 10px', backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid #34d399', color: '#34d399', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => handleDecideProposal(p.id, 'rejected')}
                              style={{ padding: '4px 10px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #f87171', color: '#f87171', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              ✗ Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  No pending proposals. Use "Submit Proposal for Review" to queue title and meta description updates.
                </div>
              )}
            </div>

            {/* SECTION 6: Batch Crawl Job Metadata Intelligence */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700 }}>6. Batch Metadata Intelligence from Crawl Jobs</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Audit an entire crawled domain for missing tags, duplicate titles, and missing social images in one pass.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={selectedBatchCrawlId}
                    onChange={(e) => setSelectedBatchCrawlId(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                  >
                    <option value="">-- Select Completed Crawl Job --</option>
                    {crawlJobs.map((j) => (
                      <option key={j.id} value={j.id}>{j.seed_urls?.[0] || j.label || j.id} ({j.pages_crawled} pages)</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAuditBatch}
                    disabled={auditingBatch}
                    style={{ padding: '6px 14px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: auditingBatch ? 'not-allowed' : 'pointer' }}
                  >
                    {auditingBatch ? 'Auditing Batch...' : '📊 Audit Batch'}
                  </button>
                </div>
              </div>

              {batchAuditReport && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Pages Audited</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>{batchAuditReport.totalPagesAudited}</div>
                    </div>
                    <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Missing Titles</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px', color: batchAuditReport.summary.missingTitles > 0 ? '#f87171' : '#34d399' }}>
                        {batchAuditReport.summary.missingTitles}
                      </div>
                    </div>
                    <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Missing Descriptions</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px', color: batchAuditReport.summary.missingDescriptions > 0 ? '#fde68a' : '#34d399' }}>
                        {batchAuditReport.summary.missingDescriptions}
                      </div>
                    </div>
                    <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Missing Canonicals</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px', color: batchAuditReport.summary.missingCanonicals > 0 ? '#f87171' : '#34d399' }}>
                        {batchAuditReport.summary.missingCanonicals}
                      </div>
                    </div>
                    <div style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Missing Social Images</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px', color: batchAuditReport.summary.missingSocialImages > 0 ? '#fde68a' : '#34d399' }}>
                        {batchAuditReport.summary.missingSocialImages}
                      </div>
                    </div>
                  </div>

                  {batchAuditReport.anomalies?.missingTitles?.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#f87171', marginTop: '6px' }}>
                      <strong>Pages missing title tags:</strong> {batchAuditReport.anomalies.missingTitles.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

            {/* Outcome Measurement Modal */}
            {outcomeModalProposal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px',
              }}>
                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  width: '100%',
                  maxWidth: '560px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>📈 Record Measured Metadata Outcome</h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Quantify impact of approved metadata changes against subsequent search performance.
                      </div>
                    </div>
                    <button
                      onClick={() => setOutcomeModalProposal(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px' }}>
                    <div><strong>Page URL:</strong> {outcomeModalProposal.url}</div>
                    <div style={{ marginTop: '4px', color: '#93c5fd' }}>
                      <strong>Approved Title:</strong> {outcomeModalProposal.payload?.title || outcomeModalProposal.url}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Baseline Metrics */}
                    <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        1. Baseline (Pre-Change)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Impressions:</label>
                          <input
                            type="number"
                            value={outcomeForm.baselineImpressions}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, baselineImpressions: Number(e.target.value) })}
                            style={{ width: '100%', padding: '6px 8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Clicks:</label>
                          <input
                            type="number"
                            value={outcomeForm.baselineClicks}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, baselineClicks: Number(e.target.value) })}
                            style={{ width: '100%', padding: '6px 8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Avg Position (Rank):</label>
                          <input
                            type="number"
                            step="0.1"
                            value={outcomeForm.baselinePosition}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, baselinePosition: Number(e.target.value) })}
                            style={{ width: '100%', padding: '6px 8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Current Metrics */}
                    <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#34d399', marginBottom: '8px' }}>
                        2. Current (Measured)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Impressions:</label>
                          <input
                            type="number"
                            value={outcomeForm.currentImpressions}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, currentImpressions: Number(e.target.value) })}
                            style={{ width: '100%', padding: '6px 8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Clicks:</label>
                          <input
                            type="number"
                            value={outcomeForm.currentClicks}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, currentClicks: Number(e.target.value) })}
                            style={{ width: '100%', padding: '6px 8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Avg Position (Rank):</label>
                          <input
                            type="number"
                            step="0.1"
                            value={outcomeForm.currentPosition}
                            onChange={(e) => setOutcomeForm({ ...outcomeForm, currentPosition: Number(e.target.value) })}
                            style={{ width: '100%', padding: '6px 8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Calculated Deltas Callout */}
                  <div style={{ padding: '10px 14px', backgroundColor: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#34d399', marginBottom: '4px' }}>Calculated Delta:</div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span>Clicks Delta: <strong>{outcomeForm.currentClicks - outcomeForm.baselineClicks >= 0 ? `+${outcomeForm.currentClicks - outcomeForm.baselineClicks}` : outcomeForm.currentClicks - outcomeForm.baselineClicks}</strong></span>
                      <span>Impressions Delta: <strong>{outcomeForm.currentImpressions - outcomeForm.baselineImpressions >= 0 ? `+${outcomeForm.currentImpressions - outcomeForm.baselineImpressions}` : outcomeForm.currentImpressions - outcomeForm.baselineImpressions}</strong></span>
                      <span>CTR Delta: <strong>{(
                        (outcomeForm.currentImpressions > 0 ? (outcomeForm.currentClicks / outcomeForm.currentImpressions) * 100 : 0) -
                        (outcomeForm.baselineImpressions > 0 ? (outcomeForm.baselineClicks / outcomeForm.baselineImpressions) * 100 : 0)
                      ).toFixed(2)}%</strong></span>
                      <span>Position Delta: <strong>{(outcomeForm.baselinePosition - outcomeForm.currentPosition) >= 0 ? `+${(outcomeForm.baselinePosition - outcomeForm.currentPosition).toFixed(1)} ranks` : `${(outcomeForm.baselinePosition - outcomeForm.currentPosition).toFixed(1)} ranks`}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      onClick={() => setOutcomeModalProposal(null)}
                      style={{ padding: '8px 16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveOutcomeMeasurement}
                      disabled={savingOutcome}
                      style={{ padding: '8px 18px', backgroundColor: 'var(--accent-green)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: savingOutcome ? 'not-allowed' : 'pointer' }}
                    >
                      {savingOutcome ? 'Saving Outcome...' : '💾 Save Outcome Measurement'}
                    </button>
                  </div>
                </div>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🔐</span>
                  <span>Authenticate GSC & Other Connectors</span>
                </button>
                <button
                  onClick={fetchConnectors}
                  style={{ padding: '6px 12px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                >
                  🔄 Refresh Status
                </button>
              </div>
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
                          onClick={() => {
                            if (c.connector_type === 'google_search_console' || c.connector_type === 'google_analytics_4') {
                              setIsAuthModalOpen(true);
                            } else {
                              setLoginModalConnector(c);
                            }
                          }}
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
        </ErrorBoundary>

        {/* Unified Authentication Hub & GSC Connector Modal */}
        <AuthenticationHubModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSessionUpdated={() => setOperatorUser(getStoredUser())}
        />
      </main>
    </div>
  </div>
);
}
