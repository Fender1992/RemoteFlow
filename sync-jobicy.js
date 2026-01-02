// Sync jobs from Jobicy API
const postgres = require('postgres');

const PROJECT_REF = 'tzwvagdjmtxsxkyceqoj';
const DB_PASSWORD = 'Dashofjuice!992';
const REGION = 'us-west-2';

async function fetchJobicyJobs() {
  console.log('Fetching jobs from Jobicy API...');
  const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=100');
  const data = await res.json();
  console.log(`Fetched ${data.jobCount || data.jobs?.length || 0} jobs from Jobicy`);
  return data.jobs || [];
}

function normalizeJob(job) {
  // Map job type
  const jobTypes = job.jobType || [];
  let jobType = 'full_time';
  if (jobTypes.some(t => t.toLowerCase().includes('part'))) {
    jobType = 'part_time';
  } else if (jobTypes.some(t => t.toLowerCase().includes('contract'))) {
    jobType = 'contract';
  } else if (jobTypes.some(t => t.toLowerCase().includes('freelance'))) {
    jobType = 'freelance';
  }

  // Map experience level
  const levelMap = {
    'entry': 'entry',
    'junior': 'junior',
    'midweight': 'mid',
    'senior': 'senior',
    'executive': 'senior',
    'lead': 'senior',
  };
  const expLevel = levelMap[(job.jobLevel || '').toLowerCase()] || 'any';

  // Extract tech from industry
  const techStack = (job.jobIndustry || []).slice(0, 10);

  return {
    title: job.jobTitle,
    company: job.companyName,
    description: job.jobDescription || job.jobExcerpt,
    salary_min: job.salaryMin || null,
    salary_max: job.salaryMax || null,
    currency: job.salaryCurrency || 'USD',
    job_type: jobType,
    timezone: 'global',
    tech_stack: techStack,
    experience_level: expLevel,
    url: job.url,
    source: 'jobicy',
    company_logo: job.companyLogo || null,
    posted_date: job.pubDate ? new Date(job.pubDate).toISOString() : null,
    is_active: true,
  };
}

async function main() {
  console.log('Connecting to database...');

  const sql = postgres({
    host: `aws-0-${REGION}.pooler.supabase.com`,
    port: 5432,
    database: 'postgres',
    username: `postgres.${PROJECT_REF}`,
    password: DB_PASSWORD,
    ssl: 'require',
    connect_timeout: 30,
  });

  try {
    // Test connection
    await sql`SELECT 1`;
    console.log('Connected to database!');

    // Add jobicy as a source if not exists
    await sql`
      INSERT INTO job_sources (name, api_endpoint, is_active)
      VALUES ('jobicy', 'https://jobicy.com/api/v2/remote-jobs', true)
      ON CONFLICT (name) DO NOTHING
    `;

    // Fetch jobs
    const jobicyJobs = await fetchJobicyJobs();

    // Normalize
    const normalizedJobs = jobicyJobs.map(normalizeJob);
    console.log(`Normalized ${normalizedJobs.length} jobs`);

    // Upsert
    let inserted = 0;
    let errors = 0;

    for (const job of normalizedJobs) {
      try {
        // Validate salary range before insert
        if (job.salary_min && job.salary_max && job.salary_min > job.salary_max) {
          // Swap if reversed
          [job.salary_min, job.salary_max] = [job.salary_max, job.salary_min];
        }

        await sql`
          INSERT INTO jobs (
            title, company, description, salary_min, salary_max, currency,
            job_type, timezone, tech_stack, experience_level, url, source,
            company_logo, posted_date, is_active, fetched_at
          ) VALUES (
            ${job.title}, ${job.company}, ${job.description}, ${job.salary_min},
            ${job.salary_max}, ${job.currency}, ${job.job_type}, ${job.timezone},
            ${job.tech_stack}, ${job.experience_level}, ${job.url}, ${job.source},
            ${job.company_logo}, ${job.posted_date}, ${job.is_active}, NOW()
          )
          ON CONFLICT (url) DO UPDATE SET
            title = EXCLUDED.title,
            company = EXCLUDED.company,
            description = EXCLUDED.description,
            salary_min = EXCLUDED.salary_min,
            salary_max = EXCLUDED.salary_max,
            job_type = EXCLUDED.job_type,
            tech_stack = EXCLUDED.tech_stack,
            experience_level = EXCLUDED.experience_level,
            company_logo = EXCLUDED.company_logo,
            posted_date = EXCLUDED.posted_date,
            is_active = true,
            fetched_at = NOW()
        `;
        inserted++;
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`Error inserting ${job.title}:`, err.message.substring(0, 80));
        }
      }
    }

    // Update job_sources last_synced
    await sql`
      UPDATE job_sources SET last_synced = NOW() WHERE name = 'jobicy'
    `;

    // Get final count
    const [{ count }] = await sql`SELECT COUNT(*) as count FROM jobs WHERE is_active = true`;

    console.log('\n✅ Jobicy sync complete!');
    console.log(`   Processed: ${inserted}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total active jobs in DB: ${count}`);

    await sql.end();
  } catch (error) {
    console.error('Error:', error.message);
    await sql.end();
    process.exit(1);
  }
}

main();
