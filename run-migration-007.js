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
    console.log('\n--- Running Migration 007: CacheGPT Auth ---');
    const migration = fs.readFileSync(
      path.join(__dirname, 'supabase/migrations/007_cachegpt_auth.sql'),
      'utf8'
    );
    await sql.unsafe(migration);
    console.log('✓ Migration 007 complete');

    // Verify column exists
    console.log('\n--- Verifying Column ---');
    const columns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users_profile'
        AND column_name = 'cachegpt_user_id'
    `;
    console.log('cachegpt_user_id column exists:', columns.length > 0);

    console.log('\n✅ Migration 007 completed successfully!');
    await sql.end();
  } catch (error) {
    console.error('\nMigration error:', error.message);
    await sql.end();
    process.exit(1);
  }
}

runMigration();
