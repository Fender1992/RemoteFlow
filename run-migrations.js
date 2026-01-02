const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'tzwvagdjmtxsxkyceqoj';
const DB_PASSWORD = 'Dashofjuice!992';

// All Supabase pooler regions
const REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1',
  'sa-east-1',
  'ca-central-1',
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

    // Test connection
    await sql`SELECT 1`;
    console.log(`✓ Connected via ${region}!`);
    return sql;
  } catch (err) {
    const shortErr = err.message.substring(0, 50);
    console.log(`  ✗ ${shortErr}`);
    return null;
  }
}

async function runMigrations() {
  console.log('Finding working Supabase region...\n');

  let sql = null;

  for (const region of REGIONS) {
    sql = await tryRegion(region);
    if (sql) break;
  }

  if (!sql) {
    console.error('\n❌ Could not connect to any region');
    console.log('\nPlease check:');
    console.log('1. Your database password is correct');
    console.log('2. Your project reference is: ' + PROJECT_REF);
    process.exit(1);
  }

  try {
    // Read and run migration 1
    console.log('\n--- Running Migration 1: Initial Schema ---');
    const migration1 = fs.readFileSync(
      path.join(__dirname, 'supabase/migrations/001_initial_schema.sql'),
      'utf8'
    );
    await sql.unsafe(migration1);
    console.log('✓ Migration 1 complete');

    // Read and run migration 2
    console.log('\n--- Running Migration 2: RLS Policies ---');
    const migration2 = fs.readFileSync(
      path.join(__dirname, 'supabase/migrations/002_rls_policies.sql'),
      'utf8'
    );
    await sql.unsafe(migration2);
    console.log('✓ Migration 2 complete');

    // Verify tables
    console.log('\n--- Verifying Tables ---');
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    console.log('Tables:', tables.map(t => t.table_name).join(', '));

    const sources = await sql`SELECT name, is_active FROM job_sources`;
    console.log('Job sources:', sources);

    console.log('\n✅ All migrations completed successfully!');
    await sql.end();
  } catch (error) {
    console.error('\nMigration error:', error.message);
    await sql.end();
    process.exit(1);
  }
}

runMigrations();
