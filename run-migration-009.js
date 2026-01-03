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
    console.log('\n--- Running Migration 009: User Profiles & Job Views ---');
    const migration = fs.readFileSync(
      path.join(__dirname, 'supabase/migrations/009_user_profiles.sql'),
      'utf8'
    );
    await sql.unsafe(migration);
    console.log('✓ Migration 009 complete');

    // Verify new columns on users_profile
    console.log('\n--- Verifying users_profile Columns ---');
    const profileCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users_profile'
        AND column_name IN ('resume_text', 'skills', 'job_titles', 'years_experience', 'education_level', 'completeness_score')
    `;
    console.log('New profile columns:', profileCols.map(c => c.column_name).join(', '));

    // Verify new tables
    console.log('\n--- Verifying New Tables ---');
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('job_match_scores', 'job_views')
    `;
    console.log('Tables created:', tables.map(t => t.table_name).join(', '));

    // Verify functions
    console.log('\n--- Verifying Functions ---');
    const functions = await sql`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN ('calculate_profile_completeness', 'upsert_job_view')
    `;
    console.log('Functions created:', functions.map(f => f.routine_name).join(', '));

    console.log('\n✅ Migration 009 completed successfully!');
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
