const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tzwvagdjmtxsxkyceqoj.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('Running migration 012 via individual operations...\n');

  // 1. Add columns to jobs table
  console.log('Step 1: Checking jobs table columns...');
  const { data: jobs } = await supabase.from('jobs').select('id').limit(1);
  console.log('  Jobs table accessible:', !!jobs);

  // 2. Create job_snapshots table by inserting and checking
  console.log('\nStep 2: Testing job_snapshots table...');
  const { error: snapshotError } = await supabase
    .from('job_snapshots')
    .select('id')
    .limit(1);

  if (snapshotError && snapshotError.code === '42P01') {
    console.log('  job_snapshots table does not exist - needs to be created via Supabase Dashboard SQL Editor');
  } else if (snapshotError) {
    console.log('  Error:', snapshotError.message);
  } else {
    console.log('  job_snapshots table exists!');
  }

  // 3. Check application_outcomes table
  console.log('\nStep 3: Testing application_outcomes table...');
  const { error: outcomesError } = await supabase
    .from('application_outcomes')
    .select('id')
    .limit(1);

  if (outcomesError && outcomesError.code === '42P01') {
    console.log('  application_outcomes table does not exist - needs to be created via Supabase Dashboard SQL Editor');
  } else if (outcomesError) {
    console.log('  Error:', outcomesError.message);
  } else {
    console.log('  application_outcomes table exists!');
  }

  // 4. Check feedback_prompts table
  console.log('\nStep 4: Testing feedback_prompts table...');
  const { error: promptsError } = await supabase
    .from('feedback_prompts')
    .select('id')
    .limit(1);

  if (promptsError && promptsError.code === '42P01') {
    console.log('  feedback_prompts table does not exist - needs to be created via Supabase Dashboard SQL Editor');
  } else if (promptsError) {
    console.log('  Error:', promptsError.message);
  } else {
    console.log('  feedback_prompts table exists!');
  }

  // 5. Check company_reputation columns
  console.log('\nStep 5: Testing company_reputation columns...');
  const { data: repData, error: repError } = await supabase
    .from('company_reputation')
    .select('credibility_score, credibility_grade, avg_time_to_fill_days')
    .limit(1);

  if (repError) {
    if (repError.message.includes('credibility_score')) {
      console.log('  New columns not yet added to company_reputation');
    } else {
      console.log('  Error:', repError.message);
    }
  } else {
    console.log('  company_reputation has new columns!');
  }

  console.log('\n========================================');
  console.log('MIGRATION STATUS SUMMARY');
  console.log('========================================');
  console.log('\nTo complete this migration, go to:');
  console.log('https://supabase.com/dashboard/project/tzwvagdjmtxsxkyceqoj/sql/new');
  console.log('\nAnd paste the contents of:');
  console.log('supabase/migrations/012_company_credibility.sql');
  console.log('\nOr run: npx supabase db push (if linked to project)');
}

runMigration().catch(console.error);
