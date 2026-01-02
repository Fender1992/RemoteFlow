// Run migration 003_job_quality.sql
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
  'ap-northeast-1',
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
    console.log('\n--- Running Migration 3: Job Quality System ---');
    const migration3 = fs.readFileSync(
      path.join(__dirname, 'supabase/migrations/003_job_quality.sql'),
      'utf8'
    );
    await sql.unsafe(migration3);
    console.log('✓ Migration 3 complete');

    // Verify new tables
    console.log('\n--- Verifying New Tables ---');
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    console.log('Tables:', tables.map(t => t.table_name).join(', '));

    // Verify new columns on jobs
    const jobCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'jobs' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    console.log('Jobs columns:', jobCols.map(c => c.column_name).join(', '));

    console.log('\n✅ Migration 003 completed successfully!');
    await sql.end();
  } catch (error) {
    console.error('\nMigration error:', error.message);
    await sql.end();
    process.exit(1);
  }
}

runMigration();
