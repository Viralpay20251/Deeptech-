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
    -- 1. Enable Supabase Realtime for live WebSocket streaming to dashboard
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'domain_pageview_velocity'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.domain_pageview_velocity;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'discover_pulse_reports'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.discover_pulse_reports;
      END IF;
    END $$;

    -- 2. Enable Row Level Security (RLS) across all 4 multiplier tables
    ALTER TABLE public.domain_pageview_velocity ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.discover_pulse_reports ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.session_funnel_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

    -- 3. Public Read Policies for Dashboard & Edge Consumers
    DROP POLICY IF EXISTS "Allow public read on domain_pageview_velocity" ON public.domain_pageview_velocity;
    CREATE POLICY "Allow public read on domain_pageview_velocity"
    ON public.domain_pageview_velocity FOR SELECT
    TO anon, authenticated
    USING (true);

    DROP POLICY IF EXISTS "Allow public read on discover_pulse_reports" ON public.discover_pulse_reports;
    CREATE POLICY "Allow public read on discover_pulse_reports"
    ON public.discover_pulse_reports FOR SELECT
    TO anon, authenticated
    USING (true);

    -- 4. Public Insert Policies for Funnel Beacons & Push Subscriptions
    DROP POLICY IF EXISTS "Allow public insert on session_funnel_events" ON public.session_funnel_events;
    CREATE POLICY "Allow public insert on session_funnel_events"
    ON public.session_funnel_events FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow public insert on push_subscriptions" ON public.push_subscriptions;
    CREATE POLICY "Allow public insert on push_subscriptions"
    ON public.push_subscriptions FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

    -- 5. Service Role Full Access (Backend Workers & Cron Dispatchers)
    DROP POLICY IF EXISTS "Service role full access on velocity" ON public.domain_pageview_velocity;
    CREATE POLICY "Service role full access on velocity"
    ON public.domain_pageview_velocity FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Service role full access on push_subs" ON public.push_subscriptions;
    CREATE POLICY "Service role full access on push_subs"
    ON public.push_subscriptions FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Service role full access on pulse_reports" ON public.discover_pulse_reports;
    CREATE POLICY "Service role full access on pulse_reports"
    ON public.discover_pulse_reports FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Service role full access on funnel_events" ON public.session_funnel_events;
    CREATE POLICY "Service role full access on funnel_events"
    ON public.session_funnel_events FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);
  `;

  console.log('Applying Realtime publication and RLS security policies...');
  await client.query(sql);
  console.log('SUCCESS: Realtime & RLS policies active in live Supabase!');

  await client.end();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
