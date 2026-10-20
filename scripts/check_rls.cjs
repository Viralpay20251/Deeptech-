const { Client } = require('pg');
const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('DATABASE_URL or SUPABASE_DB_URL environment variable is required.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const rls = await client.query(`
    SELECT relname, relrowsecurity 
    FROM pg_class 
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
    WHERE nspname = 'public' 
      AND relname IN ('domain_pageview_velocity', 'push_subscriptions', 'discover_pulse_reports', 'session_funnel_events');
  `);
  console.log('RLS Status:');
  rls.rows.forEach(r => console.log(`  ${r.relname}: RLS ${r.relrowsecurity ? 'ENABLED' : 'DISABLED'}`));

  const grants = await client.query(`
    SELECT routine_name, grantee, privilege_type 
    FROM information_schema.routine_privileges 
    WHERE routine_schema = 'public' AND routine_name = 'record_session_funnel_event';
  `);
  console.log('\nFunction Grants on record_session_funnel_event:');
  grants.rows.forEach(r => console.log(`  ${r.grantee}: ${r.privilege_type}`));

  const realtime = await client.query(`
    SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
  `);
  console.log('\nSupabase Realtime Tables:');
  realtime.rows.forEach(r => console.log(`  ${r.tablename}`));

  const idxs = await client.query(`
    SELECT tablename, indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename IN ('domain_pageview_velocity', 'push_subscriptions', 'discover_pulse_reports', 'session_funnel_events')
    ORDER BY tablename, indexname;
  `);
  console.log('\nPerformance Indexes:');
  idxs.rows.forEach(r => console.log(`  ${r.tablename} -> ${r.indexname}`));

  await client.end();
}

main().catch(console.error);
