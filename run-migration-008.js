const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'tzwvagdjmtxsxkyceqoj';
const DB_PASSWORD = 'Dashofjuice!992';

const REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-southeast-1',
];

async function tryRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;

  try {
    console.log(`Trying ${region}...`);

    const sql = postgres({
      host: host,
      port: 5432,
      database: 'postgres',
      username: `postgres.${PROJECT_REF}`,
      password: DB_PASSWORD,
      ssl: 'require',
      connect_timeout: 10,
      idle_timeout: 5,
    });

    await sql`SELECT 1`;
    console.log(`✓ Connected via ${region}!`);
    return sql;
  } catch (err) {
    const shortErr = err.message.substring(0, 50);
    console.log(`  ✗ ${shortErr}`);
    return null;
  }
}

async function runMigration() {
  console.log('Finding working Supabase region...\n');

  let sql = null;

  for (const region of REGIONS) {
    sql = await tryRegion(region);
    if (sql) break;
  }

  if (!sql) {
    console.error('\n❌ Could not connect to any region');
    process.exit(1);
  }

  try {
    console.log('\n--- Running Migration 008: Application Tracking ---');
    const migration = fs.readFileSync(
      path.join(__dirname, 'supabase/migrations/008_application_tracking.sql'),
      'utf8'
    );
    await sql.unsafe(migration);
    console.log('✓ Migration 008 complete');

    // Verify tables exist
    console.log('\n--- Verifying Tables ---');
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('application_tracking_events', 'job_url_lookup')
    `;
    console.log('Tables created:', tables.map(t => t.table_name).join(', '));

    // Verify columns on saved_jobs
    console.log('\n--- Verifying saved_jobs Columns ---');
    const savedJobsCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'saved_jobs'
        AND column_name IN ('applied_via', 'tracking_started_at')
    `;
    console.log('New saved_jobs columns:', savedJobsCols.map(c => c.column_name).join(', '));

    // Verify columns on jobs
    console.log('\n--- Verifying jobs Columns ---');
    const jobsCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'jobs'
        AND column_name IN ('application_count', 'avg_time_to_apply_seconds', 'application_stats_updated_at')
    `;
    console.log('New jobs columns:', jobsCols.map(c => c.column_name).join(', '));

    // Check URL lookup count
    console.log('\n--- Checking URL Lookup Backfill ---');
    const urlCount = await sql`SELECT COUNT(*) as count FROM public.job_url_lookup`;
    console.log('job_url_lookup entries:', urlCount[0].count);

    console.log('\n✅ Migration 008 completed successfully!');
    await sql.end();
  } catch (error) {
    console.error('\nMigration error:', error.message);
    if (error.message.includes('already exists')) {
      console.log('(This may be expected if migration was partially run before)');
    }
    await sql.end();
    process.exit(1);
  }
}

runMigration();
