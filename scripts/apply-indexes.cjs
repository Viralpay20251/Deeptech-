const { Client } = require('pg');
const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!url) {
  console.error('DATABASE_URL or SUPABASE_DB_URL environment variable is required.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const sql = `
    -- 1. Performance Indexes for High-Velocity Querying
    CREATE INDEX IF NOT EXISTS idx_push_subs_active ON public.push_subscriptions (brand_cluster, is_active);
    CREATE INDEX IF NOT EXISTS idx_push_subs_hostname ON public.push_subscriptions (hostname, is_active);
    CREATE INDEX IF NOT EXISTS idx_discover_pulse_pub ON public.discover_pulse_reports (hostname, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_funnel_events_lookup ON public.session_funnel_events (hostname, tool_type, step_number);
    CREATE INDEX IF NOT EXISTS idx_funnel_events_session ON public.session_funnel_events (session_id);

    -- 2. Daily Reset RPC Function (Zero-Cost Maintenance)
    CREATE OR REPLACE FUNCTION public.reset_daily_domain_velocity()
    RETURNS VOID AS $$
    BEGIN
        UPDATE public.domain_pageview_velocity
        SET daily_sessions = 0,
            daily_pageviews = 0,
            avg_session_depth = 1.00,
            updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    GRANT EXECUTE ON FUNCTION public.reset_daily_domain_velocity() TO authenticated, service_role;
  `;

  console.log('Applying performance indexes & daily reset RPC to live Supabase...');
  await client.query(sql);
  console.log('SUCCESS: Performance indexes and daily reset RPC are active in live Supabase!');

  await client.end();
}

main().catch((err) => {
  console.error('Error applying indexes:', err);
  process.exit(1);
});
