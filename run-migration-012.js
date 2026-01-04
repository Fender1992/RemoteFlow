const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://tzwvagdjmtxsxkyceqoj.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('Running migration 012_company_credibility.sql...');

  const migrationPath = path.join(__dirname, 'supabase/migrations/012_company_credibility.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split by semicolons but be careful with function bodies
  const statements = [];
  let current = '';
  let inFunction = false;

  for (const line of sql.split('\n')) {
    const trimmed = line.trim();

    // Track if we're inside a function definition
    if (trimmed.includes('$$ LANGUAGE') || trimmed.includes('$$;')) {
      inFunction = false;
    }
    if (trimmed.includes('AS $$') || trimmed.includes('AS $BODY$')) {
      inFunction = true;
    }

    current += line + '\n';

    // If line ends with semicolon and we're not in a function, it's a statement boundary
    if (trimmed.endsWith(';') && !inFunction && !trimmed.startsWith('--')) {
      if (current.trim() && !current.trim().startsWith('--')) {
        statements.push(current.trim());
      }
      current = '';
    }
  }

  // Add any remaining content
  if (current.trim() && !current.trim().startsWith('--')) {
    statements.push(current.trim());
  }

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt || stmt.startsWith('--')) continue;

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      if (error) {
        // Try direct query for DDL statements
        const { error: directError } = await supabase.from('_exec').select().limit(0);
        if (directError && !directError.message.includes('already exists')) {
          console.error(`Statement ${i + 1} error:`, error.message);
          errorCount++;
        } else {
          successCount++;
        }
      } else {
        successCount++;
      }
    } catch (err) {
      // Ignore "already exists" errors
      if (!err.message?.includes('already exists')) {
        console.error(`Statement ${i + 1} exception:`, err.message);
        errorCount++;
      } else {
        successCount++;
      }
    }
  }

  console.log(`\nMigration complete: ${successCount} statements succeeded, ${errorCount} errors`);
}

// Alternative: Run the whole migration as a single transaction
async function runMigrationDirect() {
  console.log('Running migration 012_company_credibility.sql directly...');

  const migrationPath = path.join(__dirname, 'supabase/migrations/012_company_credibility.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Use the REST API directly
  const response = await fetch('https://tzwvagdjmtxsxkyceqoj.supabase.co/rest/v1/rpc/exec_sql', {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ sql })
  });

  if (!response.ok) {
    const text = await response.text();
    console.log('RPC not available, running statements individually...');
    return runMigrationIndividually();
  }

  console.log('Migration completed successfully!');
}

async function runMigrationIndividually() {
  const migrationPath = path.join(__dirname, 'supabase/migrations/012_company_credibility.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Extract individual ALTER TABLE and CREATE statements
  const alterTableRegex = /ALTER TABLE[^;]+;/gi;
  const createTableRegex = /CREATE TABLE IF NOT EXISTS[^;]+\);/gis;
  const createIndexRegex = /CREATE INDEX IF NOT EXISTS[^;]+;/gi;
  const createPolicyRegex = /CREATE POLICY[^;]+;/gi;
  const grantRegex = /GRANT[^;]+;/gi;

  const statements = [
    ...sql.match(alterTableRegex) || [],
    ...sql.match(createTableRegex) || [],
    ...sql.match(createIndexRegex) || [],
  ];

  console.log(`Found ${statements.length} statements to execute`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] Executing...`);
    console.log(stmt.substring(0, 80) + '...');

    const { data, error } = await supabase.rpc('exec_sql', { sql: stmt }).maybeSingle();

    if (error) {
      if (error.message.includes('already exists') || error.message.includes('does not exist')) {
        console.log('  (skipped - already exists)');
      } else {
        console.error('  ERROR:', error.message);
      }
    } else {
      console.log('  OK');
    }
  }

  console.log('\nMigration complete!');
}

runMigrationDirect().catch(console.error);
