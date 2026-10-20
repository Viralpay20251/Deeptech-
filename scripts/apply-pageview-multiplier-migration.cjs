const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('DATABASE_URL or SUPABASE_DB_URL environment variable is required.');
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Connecting to Live Supabase (mlttxyeeogffguhiucs)...');
  await client.connect();

  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '0005_pageview_multiplier_and_webpush.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Prefix with DROP to guarantee clean replacement of legacy shape
  const fullSql = `
    DROP TABLE IF EXISTS public.session_funnel_events CASCADE;
    DROP TABLE IF EXISTS public.discover_pulse_reports CASCADE;
    DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
    DROP TABLE IF EXISTS public.domain_pageview_velocity CASCADE;

    ${sql}
  `;

  console.log('Executing 0005_pageview_multiplier_and_webpush.sql...');
  await client.query(fullSql);
  console.log('✅ Migration applied successfully to live Supabase!');

  const check = await client.query(`
    SELECT hostname, brand_cluster, max_image_preview_large, avg_session_depth, active_multiplier_tool 
    FROM public.domain_pageview_velocity 
    ORDER BY brand_cluster, hostname;
  `);

  console.log(`\n🎉 Seeded ${check.rows.length} Canonical Production Domains in public.domain_pageview_velocity:`);
  check.rows.forEach((r) => {
    console.log(`  [${r.brand_cluster.toUpperCase()}] ${r.hostname} (max-image-preview:large: ${r.max_image_preview_large}) -> ${r.active_multiplier_tool || 'Interactive Tool'}`);
  });

  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
