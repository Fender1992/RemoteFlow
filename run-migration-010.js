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
    console.log('\n--- Running Migration 010: Per-Job Chat Limits ---');
    const migration = fs.readFileSync(
      path.join(__dirname, 'supabase/migrations/010_per_job_chat_limits.sql'),
      'utf8'
    );
    await sql.unsafe(migration);
    console.log('✓ Migration 010 complete');

    // Verify job_chat_usage table structure
    console.log('\n--- Verifying job_chat_usage Table ---');
    const columns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'job_chat_usage'
      ORDER BY ordinal_position
    `;
    console.log('Columns:', columns.map(c => c.column_name).join(', '));

    // Verify unique constraint
    console.log('\n--- Verifying Constraints ---');
    const constraints = await sql`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'job_chat_usage'
        AND constraint_type = 'UNIQUE'
    `;
    console.log('Unique constraints:', constraints.map(c => c.constraint_name).join(', ') || 'None');

    // Verify updated functions
    console.log('\n--- Verifying Functions ---');
    const checkFn = await sql`
      SELECT pg_get_function_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'check_job_chat_limit'
    `;
    console.log('check_job_chat_limit args:', checkFn[0]?.args || 'Not found');

    const incrFn = await sql`
      SELECT pg_get_function_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'increment_job_chat_usage'
    `;
    console.log('increment_job_chat_usage args:', incrFn[0]?.args || 'Not found');

    // Check if backup table exists
    console.log('\n--- Checking Backup ---');
    const backup = await sql`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'job_chat_usage_backup'
    `;
    if (backup[0].count > 0) {
      const backupCount = await sql`SELECT COUNT(*) as count FROM public.job_chat_usage_backup`;
      console.log('Backup table exists with', backupCount[0].count, 'rows');
    } else {
      console.log('No backup table (this is fine for fresh installs)');
    }

    console.log('\n✅ Migration 010 completed successfully!');
    console.log('Note: Rate limiting is now per-job instead of per-day.');
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
