/**
 * Autonomous Growth OS — Shared Type Definitions
 *
 * These types are shared between the API, workers and frontend.
 * They define the core domain model and agent contracts.
 *
 * SAFETY NOTE: These types enforce tenant/workspace scoping at the
 * type level. Every entity with cross-tenant risk must carry a
 * workspace_id field. Types must not mix tenant contexts.
 */

// ─── Identity & Tenant ───────────────────────────────────────────────────────

export type UUID = string; // 36-char UUID v4
export type ISOTimestamp = string; // ISO 8601 UTC

export interface Workspace {
  id: UUID;
  slug: string;
  display_name: string;
  is_internal: boolean;        // true = the proof-phase internal workspace
  is_commercial: boolean;      // false until proof gates pass + owner approves
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface User {
  id: UUID;
  workspace_id: UUID;
  email: string;
  display_name: string;
  role: UserRole;
  mfa_enabled: boolean;
  created_at: ISOTimestamp;
}

export type UserRole =
  | 'workspace_admin'
  | 'operator'        // can start/stop workflows, manage connectors
  | 'reviewer'        // can approve/reject content and publishing
  | 'publisher'       // can trigger approved publishing jobs
  | 'read_only';

// ─── Brand / Project ─────────────────────────────────────────────────────────

export interface Brand {
  id: UUID;
  workspace_id: UUID;
  slug: 'chatr' | 'talentxcel' | 'nuty-tales' | string; // extensible for future tenants
  display_name: string;
  base_url: string;
  is_protected_production: boolean; // NEVER write to protected brands without explicit approval
  config: BrandConfig;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface BrandConfig {
  voice_guidelines: string;
  approved_claim_categories: string[];
  prohibited_topics: string[];
  allowed_countries: string[];
  allowed_channels: string[];
  cta_urls: Record<string, string>; // key = intent, value = approved destination URL
  active_user_event_definition: string;
  max_posts_per_day_per_channel: Record<string, number>;
  requires_human_approval_before_publish: boolean;
  legal_review_required_categories: string[];
  escalation_contact: string;
}

// ─── Connector Framework ──────────────────────────────────────────────────────

export type ConnectorType =
  | 'sitemap_rss_inspector'
  | 'google_search_console'
  | 'bing_webmaster'
  | 'google_analytics_4'
  | 'linkedin'
  | 'meta'
  | 'youtube'
  | 'tiktok'
  | 'reddit'
  | 'x_twitter'
  | 'pinterest'
  | 'threads'
  | 'discord'
  | 'telegram'
  | 'whatsapp_business'
  | 'email_smtp'
  | 'rss_feed'
  | 'sitemap'
  | 'openai'
  | 'anthropic'
  | 'google_ai'
  | 'storage_s3';

export type ConnectorStatus =
  | 'not_configured'          // no credentials provided
  | 'awaiting_credentials'    // connector built, credentials not yet supplied
  | 'awaiting_oauth'          // OAuth flow not completed
  | 'awaiting_approval'       // platform app review pending
  | 'connected'               // active and healthy
  | 'degraded'                // partial functionality
  | 'error'                   // last check failed
  | 'revoked'                 // credentials revoked or expired
  | 'disabled';               // explicitly disabled by operator

export type ConnectorCapability =
  | 'read_public'
  | 'read_analytics'
  | 'publish_post'
  | 'schedule_post'
  | 'upload_media'
  | 'reply_comment'
  | 'read_comments'
  | 'read_dm'
  | 'send_dm'
  | 'read_insights'
  | 'manage_account'
  | 'run_inference'
  | 'generate_image'
  | 'generate_embedding'
  | 'read_storage'
  | 'write_storage';

export interface ConnectorDefinition {
  type: ConnectorType;
  version: string;
  display_name: string;
  category: 'search_web' | 'analytics' | 'social_media' | 'messaging' | 'publishing' | 'paid_media' | 'ai_model' | 'storage' | 'notifications';
  official_api_docs_url: string;
  capabilities: ConnectorCapability[];
  auth_method: 'oauth2' | 'api_key' | 'service_account' | 'smtp' | 'none';
  required_scopes: string[];
  rate_limit_notes: string;
  known_limitations: string[];
}

export interface ConnectorInstance {
  id: UUID;
  workspace_id: UUID;
  brand_id: UUID | null;       // null = workspace-level connector
  connector_type: ConnectorType;
  status: ConnectorStatus;
  credential_reference: string | null; // reference to secrets manager — NEVER the raw secret
  granted_capabilities: ConnectorCapability[];
  last_health_check_at: ISOTimestamp | null;
  health_check_message: string | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

// ─── Demand Intelligence ──────────────────────────────────────────────────────

export type IntentType =
  | 'informational'
  | 'navigational'
  | 'transactional'
  | 'commercial_investigation'
  | 'career_job_search'
  | 'community';

export type TrendType = 'evergreen' | 'seasonal' | 'emerging' | 'time_sensitive' | 'declining';

export interface DemandSignal {
  id: UUID;
  workspace_id: UUID;
  source_connector_id: UUID;
  source_type: ConnectorType;
  source_url: string | null;
  raw_signal: Record<string, unknown>;  // sanitised, untrusted — never executed
  topic_cluster_id: UUID | null;
  intent_type: IntentType;
  trend_type: TrendType;
  confidence: number;           // 0–1
  observed_at: ISOTimestamp;
  ingested_at: ISOTimestamp;
  locale: string;               // BCP-47 e.g. en-GB
  country_code: string | null;  // ISO 3166-1 alpha-2
  permitted_use_notes: string;
  is_demo_data: boolean;        // MUST be true for any seed/demo record
}

export interface TopicCluster {
  id: UUID;
  workspace_id: UUID;
  label: string;
  intent_type: IntentType;
  trend_type: TrendType;
  signal_count: number;
  first_observed_at: ISOTimestamp;
  last_observed_at: ISOTimestamp;
  is_demo_data: boolean;
}

// ─── Opportunity Scoring ──────────────────────────────────────────────────────

export interface OpportunityScore {
  demand_evidence: number;        // 0–10
  brand_relevance: number;        // 0–10
  intent_strength: number;        // 0–10
  content_gap: number;            // 0–10
  potential_value: number;        // 0–10
  freshness: number;              // 0–10
  fulfilment_capability: number;  // 0–10
  expected_effort: number;        // 0–10 (lower = less effort = higher score contribution)
  cost: number;                   // 0–10 (lower cost = higher score contribution)
  uncertainty: number;            // 0–10 (lower = more certain)
  policy_risk: number;            // 0–10 (lower risk = higher contribution)
  weighted_total: number;         // computed, 0–100
  score_model_version: string;
  rationale: string;
  evidence_refs: string[];
  calculated_at: ISOTimestamp;
}

export type OpportunityStatus =
  | 'discovered'
  | 'scored'
  | 'selected'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'expired'
  | 'blocked';

export interface Opportunity {
  id: UUID;
  workspace_id: UUID;
  brand_id: UUID;
  topic_cluster_id: UUID | null;
  title: string;
  description: string;
  status: OpportunityStatus;
  rejection_reason: string | null;
  score: OpportunityScore | null;
  proposed_asset_type: ContentAssetType | null;
  target_locale: string;
  target_country: string | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
  is_demo_data: boolean;
}

// ─── Content & Experience ─────────────────────────────────────────────────────

export type ContentAssetType =
  | 'search_landing_page'
  | 'topic_hub'
  | 'article'
  | 'faq_page'
  | 'interactive_tool'
  | 'buying_guide'
  | 'career_guide'
  | 'gift_guide'
  | 'social_post'
  | 'video_script'
  | 'newsletter'
  | 'partner_pitch'
  | 'outreach_draft';

export type ContentLifecycleStatus =
  | 'discovered'
  | 'researching'
  | 'draft'
  | 'quality_review'
  | 'approval_required'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'monitoring'
  | 'refresh_needed'
  | 'consolidation_candidate'
  | 'retired'
  | 'blocked';

export interface ContentAsset {
  id: UUID;
  workspace_id: UUID;
  brand_id: UUID;
  opportunity_id: UUID;
  asset_type: ContentAssetType;
  lifecycle_status: ContentLifecycleStatus;
  title: string;
  body_markdown: string;
  audience_description: string;
  intent_type: IntentType;
  locale: string;
  country_code: string | null;
  version: number;
  authoring_agent: string;        // agent type slug
  source_evidence_ids: UUID[];
  claim_ids: UUID[];
  citation_urls: string[];
  quality_check_results: QualityCheckResult[];
  approval_event_id: UUID | null;
  published_url: string | null;
  campaign_id: UUID | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
  is_demo_data: boolean;
}

export interface QualityCheckResult {
  check_id: string;
  check_name: string;
  passed: boolean;
  score: number | null;
  message: string;
  checked_at: ISOTimestamp;
}

// ─── Agent & Workflow ─────────────────────────────────────────────────────────

export type AgentType =
  | 'market_scout'
  | 'search_intelligence'
  | 'social_listening'
  | 'source_researcher'
  | 'audience_classifier'
  | 'opportunity_scorer'
  | 'experience_planner'
  | 'content_builder'
  | 'localisation'
  | 'fact_quality_auditor'
  | 'distribution_planner'
  | 'publisher'
  | 'partnership_research'
  | 'traffic_analyst'
  | 'experiment'
  | 'growth_strategist'
  | 'policy_safety'
  | 'reliability_cost';

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4;

export type WorkflowStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export interface WorkflowRun {
  id: UUID;
  workspace_id: UUID;
  brand_id: UUID;
  workflow_definition_id: string;
  idempotency_key: string;
  status: WorkflowStatus;
  autonomy_level: AutonomyLevel;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  started_at: ISOTimestamp | null;
  completed_at: ISOTimestamp | null;
  model_cost_usd: number;
  api_call_count: number;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface Task {
  id: UUID;
  workflow_run_id: UUID;
  workspace_id: UUID;
  brand_id: UUID;
  agent_type: AgentType;
  status: WorkflowStatus;
  idempotency_key: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: ISOTimestamp | null;
  started_at: ISOTimestamp | null;
  completed_at: ISOTimestamp | null;
  model_cost_usd: number;
  created_at: ISOTimestamp;
}

// ─── Approval & Audit ─────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ApprovalEvent {
  id: UUID;
  workspace_id: UUID;
  resource_type: string;    // e.g. 'content_asset', 'publishing_job'
  resource_id: UUID;
  requested_by_agent: AgentType;
  reviewed_by_user_id: UUID | null;
  status: ApprovalStatus;
  notes: string | null;
  created_at: ISOTimestamp;
  decided_at: ISOTimestamp | null;
}

export interface AuditEvent {
  id: UUID;
  workspace_id: UUID;
  actor_type: 'user' | 'agent' | 'system';
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;  // minimised — store only when needed for security
  created_at: ISOTimestamp;
}

// ─── Kill Switch ──────────────────────────────────────────────────────────────

export type KillSwitchScope = 'global' | 'workspace' | 'brand' | 'channel' | 'campaign';

export interface KillSwitchEvent {
  id: UUID;
  workspace_id: UUID;
  scope: KillSwitchScope;
  scope_id: string | null;  // brand_id | channel_id | campaign_id
  activated_by_user_id: UUID;
  reason: string;
  activated_at: ISOTimestamp;
  deactivated_at: ISOTimestamp | null;
}

// ─── Metrics & Attribution ────────────────────────────────────────────────────

export type TrafficSource =
  | 'organic_search'
  | 'social'
  | 'referral'
  | 'email'
  | 'paid'
  | 'direct'
  | 'unknown';

export type SessionQuality = 'likely_human' | 'uncertain' | 'likely_bot' | 'known_crawler';

export interface TrafficObservation {
  id: UUID;
  workspace_id: UUID;
  brand_id: UUID;
  import_job_id: UUID;
  source_connector_type: ConnectorType;
  observed_date: string;           // YYYY-MM-DD
  traffic_source: TrafficSource;
  campaign_id: UUID | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_page_path: string | null;
  country_code: string | null;
  sessions: number | null;
  engaged_sessions: number | null;
  session_quality: SessionQuality;
  quality_confidence: number;      // 0–1
  new_users: number | null;
  conversions: number | null;
  conversion_event: string | null;
  raw_data_snapshot_ref: string | null;  // reference to immutable storage object
  ingested_at: ISOTimestamp;
  data_freshness_at: ISOTimestamp;
  is_demo_data: boolean;
  caveats: string[];
}

// ─── Experiment ───────────────────────────────────────────────────────────────

export type ExperimentStatus = 'proposed' | 'awaiting_approval' | 'running' | 'paused' | 'completed' | 'abandoned';

export interface Experiment {
  id: UUID;
  workspace_id: UUID;
  brand_id: UUID;
  hypothesis: string;
  rationale: string;
  channel: string;
  primary_metric: string;
  guardrail_metrics: string[];
  baseline_value: number | null;
  expected_lift_pct: number | null;
  variants: ExperimentVariant[];
  status: ExperimentStatus;
  start_date: string | null;
  end_date: string | null;
  budget_cap_usd: number | null;
  stopping_rules: string;
  confounders_noted: string;
  result_summary: string | null;
  confidence_pct: number | null;
  decision: string | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface ExperimentVariant {
  id: UUID;
  experiment_id: UUID;
  label: string;
  description: string;
  allocation_pct: number;
}

// ─── Campaign & Distribution ──────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'awaiting_approval' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface Campaign {
  id: UUID;
  workspace_id: UUID;
  brand_id: UUID;
  name: string;
  objective: string;
  status: CampaignStatus;
  channels: string[];
  target_locale: string;
  target_country: string | null;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  start_date: string | null;
  end_date: string | null;
  budget_cap_usd: number | null;
  autonomy_level: AutonomyLevel;
  approval_event_id: UUID | null;
  experiment_id: UUID | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

// ─── Health / Observability ───────────────────────────────────────────────────

export interface SystemHealthReport {
  status: 'healthy' | 'degraded' | 'down';
  checked_at: ISOTimestamp;
  components: ComponentHealth[];
}

export interface ComponentHealth {
  name: string;
  status: 'ok' | 'degraded' | 'error' | 'unknown';
  message: string | null;
  latency_ms: number | null;
}

// ─── API Response Envelopes ───────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
    freshness_at?: ISOTimestamp;
    caveats?: string[];
    is_demo_data?: boolean;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
