import { createClient } from '@supabase/supabase-js';
import { CloudflareProvisioner } from './provisioners/cloudflare.js';
import { GoogleSiteVerifier } from './provisioners/google-verify.js';
import { GSCSitemapSubmitter } from './provisioners/gsc-sitemap.js';
import { SupabaseWebhookReceiver } from './webhookServer.js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PORT = Number(process.env.PORT) || 3002;
const INTERNAL_WORKSPACE_SECRET =
  process.env.INTERNAL_WORKSPACE_SECRET || '';

console.log('============================================================');
console.log('🌐 OmniPulse Engine — Autonomous Tenant Provisioner Service');
console.log('============================================================');
console.log(`[Config] Supabase URL: ${SUPABASE_URL}`);
console.log(`[Config] Listening Port: ${PORT}`);
console.log(`[Config] Cloudflare Zone ID: ${process.env.CLOUDFLARE_ZONE_ID || '(pending config / mock mode)'}`);
console.log(`[Config] Google Auth: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'Key File Set' : 'JWT/Mock'}`);

// Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Initialize Provisioners
const cfProvisioner = new CloudflareProvisioner(supabase);
const gSiteVerifier = new GoogleSiteVerifier(supabase);
const gscSitemap = new GSCSitemapSubmitter(supabase);

// Initialize Webhook Server
const webhookServer = new SupabaseWebhookReceiver(
  supabase,
  cfProvisioner,
  gSiteVerifier,
  gscSitemap,
  {
    port: PORT,
    internalSecret: INTERNAL_WORKSPACE_SECRET,
  }
);

async function main() {
  await webhookServer.start();
  console.log('✅ Tenant Provisioner is ready to process incoming domain registrations.');
}

// Graceful shutdown
const shutdown = async () => {
  console.log('\n[TenantProvisioner] Shutting down service gracefully...');
  await webhookServer.stop();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((err) => {
  console.error('[TenantProvisioner] Fatal startup error:', err);
  process.exit(1);
});
