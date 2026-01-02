// Run migration 004_import_system.sql
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
    console.log('\n--- Running Migration 4: Import System ---');
    const migration4 = fs.readFileSync(
      path.join(__dirname, 'supabase/migrations/004_import_system.sql'),
      'utf8'
    );
    await sql.unsafe(migration4);
    console.log('✓ Migration 4 complete');

    // Verify new tables
    console.log('\n--- Verifying New Tables ---');
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    console.log('Tables:', tables.map(t => t.table_name).join(', '));

    // Verify import_sessions columns
    console.log('\n--- Import Sessions Columns ---');
    const sessionCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'import_sessions' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    console.log('import_sessions:', sessionCols.map(c => c.column_name).join(', '));

    // Verify import_site_results columns
    console.log('\n--- Import Site Results Columns ---');
    const siteCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'import_site_results' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    console.log('import_site_results:', siteCols.map(c => c.column_name).join(', '));

    // Verify import_rate_limits columns
    console.log('\n--- Import Rate Limits Columns ---');
    const rateCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'import_rate_limits' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    console.log('import_rate_limits:', rateCols.map(c => c.column_name).join(', '));

    console.log('\n✅ Migration 004 completed successfully!');
    await sql.end();
  } catch (error) {
    console.error('\nMigration error:', error.message);
    await sql.end();
    process.exit(1);
  }
}

runMigration();
