const postgres = require('postgres');

const PROJECT_REF = 'tzwvagdjmtxsxkyceqoj';
const DB_PASSWORD = 'Dashofjuice!992';

async function checkTables() {
  console.log('Connecting to database...\n');

  const sql = postgres({
    host: 'aws-0-us-west-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    username: `postgres.${PROJECT_REF}`,
    password: DB_PASSWORD,
    ssl: 'require',
    connect_timeout: 10,
  });

  try {
    // Check import tables
    console.log('--- Checking Import Tables ---');
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('import_sessions', 'import_site_results', 'import_rate_limits')
      ORDER BY table_name
    `;
    console.log('Import tables found:', tables.map(t => t.table_name).join(', ') || 'NONE');

    // Check for increment function
    console.log('\n--- Checking Functions ---');
    const functions = await sql`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name = 'increment_import_rate_limits'
    `;
    console.log('increment_import_rate_limits function exists:', functions.length > 0);

    // Check recent import sessions
    console.log('\n--- Recent Import Sessions ---');
    const sessions = await sql`
      SELECT id, status, error_message, created_at
      FROM import_sessions
      ORDER BY created_at DESC
      LIMIT 5
    `;
    if (sessions.length > 0) {
      sessions.forEach(s => {
        console.log(`  ${s.id.slice(0,8)}... - ${s.status} - ${s.error_message || 'no error'} - ${s.created_at}`);
      });
    } else {
      console.log('  No sessions found');
    }

    // Check users_profile table structure
    console.log('\n--- User Profile Columns ---');
    const columns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users_profile'
        AND column_name IN ('anthropic_api_key', 'cachegpt_api_key', 'subscription_tier')
    `;
    console.log('Columns found:', columns.map(c => c.column_name).join(', '));

    await sql.end();
    console.log('\n✅ Check complete');
  } catch (error) {
    console.error('Error:', error.message);
    await sql.end();
    process.exit(1);
  }
}

checkTables();
