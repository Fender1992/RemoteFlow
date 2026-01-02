// Local job sync script
const postgres = require('postgres');

const PROJECT_REF = 'tzwvagdjmtxsxkyceqoj';
const DB_PASSWORD = 'Dashofjuice!992';
const REGION = 'us-west-2';

async function fetchRemotiveJobs() {
  console.log('Fetching jobs from Remotive API...');
  const res = await fetch('https://remotive.com/api/remote-jobs');
  const data = await res.json();
  console.log(`Fetched ${data.jobs.length} jobs from Remotive`);
  return data.jobs;
}

function normalizeJob(job) {
  // Parse salary
  let salaryMin = null;
  let salaryMax = null;
  if (job.salary) {
    const nums = job.salary.match(/\d+/g);
    if (nums && nums.length >= 1) {
      salaryMin = parseInt(nums[0]) * (job.salary.toLowerCase().includes('k') ? 1000 : 1);
      if (nums.length >= 2) {
        salaryMax = parseInt(nums[1]) * (job.salary.toLowerCase().includes('k') ? 1000 : 1);
      }
    }
  }

  // Map job type
  const jobTypeMap = {
    'full_time': 'full_time',
    'full-time': 'full_time',
    'part_time': 'part_time',
    'part-time': 'part_time',
    'contract': 'contract',
    'freelance': 'freelance',
    'internship': 'internship',
  };

  // Infer experience level
  let expLevel = 'any';
  const title = (job.title || '').toLowerCase();
  if (title.includes('senior') || title.includes('sr.') || title.includes('lead')) {
    expLevel = 'senior';
  } else if (title.includes('junior') || title.includes('jr.')) {
    expLevel = 'junior';
  } else if (title.includes('mid') || title.includes('middle')) {
    expLevel = 'mid';
  } else if (title.includes('intern')) {
    expLevel = 'entry';
  }

  // Extract tech stack from tags
  const techStack = (job.tags || []).slice(0, 10);

  return {
    title: job.title,
    company: job.company_name,
    description: job.description,
    salary_min: salaryMin,
    salary_max: salaryMax,
    currency: 'USD',
    job_type: jobTypeMap[(job.job_type || '').toLowerCase()] || 'full_time',
    timezone: 'global',
    tech_stack: techStack,
    experience_level: expLevel,
    url: job.url,
    source: 'remotive',
    company_logo: job.company_logo_url || null,
    posted_date: job.publication_date ? new Date(job.publication_date).toISOString() : null,
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

    // Fetch jobs
    const remotiveJobs = await fetchRemotiveJobs();

    // Normalize
    const normalizedJobs = remotiveJobs.map(normalizeJob);
    console.log(`Normalized ${normalizedJobs.length} jobs`);

    // Upsert in batches of 50
    let inserted = 0;
    let errors = 0;
    const batchSize = 50;

    for (let i = 0; i < normalizedJobs.length; i += batchSize) {
      const batch = normalizedJobs.slice(i, i + batchSize);

      for (const job of batch) {
        try {
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
          if (errors <= 3) {
            console.error(`Error inserting ${job.title}:`, err.message);
          }
        }
      }

      console.log(`Processed ${Math.min(i + batchSize, normalizedJobs.length)}/${normalizedJobs.length}...`);
    }

    // Update job_sources last_synced
    await sql`
      UPDATE job_sources SET last_synced = NOW() WHERE name = 'remotive'
    `;

    // Get final count
    const [{ count }] = await sql`SELECT COUNT(*) as count FROM jobs WHERE is_active = true`;

    console.log('\n✅ Sync complete!');
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
