export interface RegisteredDomainRecord {
  id?: string;
  hostname: string;
  workspace_id?: string;
  brand_id?: string;
  host_role?: string;
  intended_canonical_host?: string | null;
  verification_state?: string;
  indexing_intent?: string;
  cloudflare_hostname_id?: string | null;
  gsc_verified?: boolean;
  sitemap_status?: string;
  dns_status?: string;
  tls_status?: string;
  http_status?: number | null;
  search_console_property_uri?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface WebhookDomainAddedPayload {
  type?: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  table?: string;
  schema?: string;
  record?: RegisteredDomainRecord;
  old_record?: RegisteredDomainRecord | null;
  // Fallbacks for direct invocations:
  hostname?: string;
  id?: string;
  brand_id?: string;
}

export interface CloudflareCustomHostnameSSL {
  id?: string;
  type: string;
  method: string;
  status: 'initializing' | 'pending_validation' | 'pending_issuance' | 'pending_deployment' | 'active' | string;
  validation_records?: Array<{
    txt_name?: string;
    txt_value?: string;
    http_url?: string;
    http_body?: string;
    cname?: string;
    cname_target?: string;
  }>;
}

export interface CloudflareCustomHostnameItem {
  id: string;
  hostname: string;
  ssl: CloudflareCustomHostnameSSL;
  status: string;
  created_at?: string;
}

export interface CloudflareApiResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: T;
}

export interface ProvisioningStatus {
  hostname: string;
  table: string;
  id?: string;
  cloudflareHostnameId?: string;
  sslStatus?: string;
  googleToken?: string;
  gscVerified: boolean;
  sitemapSubmitted: boolean;
  completedAt?: string;
  errors: string[];
}
