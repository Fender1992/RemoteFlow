// Sync jobs from Jobicy API - multiple industries
const postgres = require('postgres');

const PROJECT_REF = 'tzwvagdjmtxsxkyceqoj';
const DB_PASSWORD = 'Dashofjuice!992';
const REGION = 'us-west-2';

const INDUSTRIES = [
  'engineering', 'marketing', 'design', 'sales', 'customer-success',
  'product', 'hr', 'finance', 'it', 'operations', 'writing',
  'data-science', 'legal'
];

async function fetchJobicyJobs(industry = null) {
  const url = industry
    ? `https://jobicy.com/api/v2/remote-jobs?industry=${industry}&count=100`
    : 'https://jobicy.com/api/v2/remote-jobs?count=100';

  const res = await fetch(url);
  const data = await res.json();
  return data.jobs || [];
}

function normalizeJob(job) {
  const jobTypes = job.jobType || [];
  let jobType = 'full_time';
  if (jobTypes.some(t => t.toLowerCase().includes('part'))) {
    jobType = 'part_time';
  } else if (jobTypes.some(t => t.toLowerCase().includes('contract'))) {
    jobType = 'contract';
  }

  const levelMap = {
    'entry': 'entry', 'junior': 'junior', 'midweight': 'mid',
    'senior': 'senior', 'executive': 'senior', 'lead': 'senior',
  };
  const expLevel = levelMap[(job.jobLevel || '').toLowerCase()] || 'any';
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
    await sql`SELECT 1`;
    console.log('Connected to database!');

    const allJobs = new Map();

    // Fetch from each industry
    for (const industry of INDUSTRIES) {
      console.log(`Fetching ${industry}...`);
      try {
        const jobs = await fetchJobicyJobs(industry);
        jobs.forEach(job => {
          if (!allJobs.has(job.id)) {
            allJobs.set(job.id, job);
          }
        });
        console.log(`  Got ${jobs.length} jobs (total unique: ${allJobs.size})`);
        await new Promise(r => setTimeout(r, 500)); // Rate limit
      } catch (e) {
        console.log(`  Error: ${e.message}`);
      }
    }

    const normalizedJobs = Array.from(allJobs.values()).map(normalizeJob);
    console.log(`\nNormalized ${normalizedJobs.length} unique jobs`);

    let inserted = 0;
    let errors = 0;

    for (const job of normalizedJobs) {
      try {
        if (job.salary_min && job.salary_max && job.salary_min > job.salary_max) {
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
            fetched_at = NOW()
        `;
        inserted++;
      } catch (err) {
        errors++;
      }
    }

    await sql`UPDATE job_sources SET last_synced = NOW() WHERE name = 'jobicy'`;

    const [{ count }] = await sql`SELECT COUNT(*) as count FROM jobs WHERE is_active = true`;

    console.log('\n✅ Complete!');
    console.log(`   Processed: ${inserted}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total active jobs: ${count}`);

    await sql.end();
  } catch (error) {
    console.error('Error:', error.message);
    await sql.end();
    process.exit(1);
  }
}

main();
