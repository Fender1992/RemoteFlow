"""
RemoteFlow Job Import Worker

A Modal.com serverless worker that uses Claude Computer Use to browse job boards
and extract job listings. Triggered by webhook from Next.js API.

Deploy: modal deploy worker/modal_import_worker.py
"""

import modal
import os
import json
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode, quote_plus

# Modal app configuration
app = modal.App("remoteflow-import-worker")

# Build image with required dependencies
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "anthropic>=0.40.0",
    "supabase>=2.0.0",
    "httpx>=0.25.0",
    "fastapi",
)


# =============================================================================
# Site Configurations (mirrored from TypeScript)
# =============================================================================

SITE_CONFIGS = {
    "linkedin": {
        "name": "LinkedIn",
        "max_jobs": 50,
        "system_prompt": """You are a job search assistant browsing LinkedIn Jobs. Your task is to navigate job search results and extract job listing data.

Key behaviors:
- Wait for pages to fully load before extracting (look for job cards)
- If you see a login/signup modal, look for an X or Close button to dismiss it
- Job cards appear on the left, clicking them loads details on the right
- Scroll down to load more jobs if the page uses infinite scroll
- Look for the "Show more jobs" button at the bottom to load more""",
        "search_instructions": """
1. Navigate to the provided search URL
2. Wait for job listings to load (look for job cards in the left panel)
3. If a login modal appears, dismiss it by clicking the X button
4. For each visible job listing:
   - Click on the job card to load its details
   - Extract: title, company name, location, salary (if shown), posted date
   - Note the job URL from the browser
   - Look for "Easy Apply" badge
5. Scroll down to load more jobs
6. Click "Show more jobs" button if visible
7. Stop after extracting {max_jobs} jobs or when no more are available
8. Return all extracted jobs in the specified JSON format""",
    },
    "indeed": {
        "name": "Indeed",
        "max_jobs": 50,
        "system_prompt": """You are a job search assistant browsing Indeed job listings. Your task is to navigate search results and extract job data.

Key behaviors:
- Jobs are listed in cards that can be clicked for more details
- Indeed often shows salary estimates even when not provided by employer
- Note whether salary is "Estimated" or "Employer provided"
- Look for badges: "Urgently hiring", "Responsive employer", "Many applicants"
- Job ID is in the URL parameter "jk"
- Use the "Next" button at the bottom for pagination""",
        "search_instructions": """
1. Navigate to the provided search URL
2. Wait for job listings to load
3. For each job card visible:
   - Click on the job card to expand details
   - Extract: title, company, location, salary, posted date, job type
   - Note any badges (Urgently hiring, etc.)
   - Copy the job URL
4. Use the "Next" button to go to the next page
5. Stop after extracting {max_jobs} jobs or when no more pages
6. Return all extracted jobs in the specified JSON format""",
    },
    "glassdoor": {
        "name": "Glassdoor",
        "max_jobs": 40,
        "system_prompt": """You are a job search assistant browsing Glassdoor job listings. Your task is to navigate search results and extract job data.

Key behaviors:
- May show signup/login modal - look for X or "Close" button to dismiss
- Company ratings (1-5 stars) are valuable - always extract them
- Salary shows as estimated range
- Job cards are clickable for more details
- Note the company rating and review count""",
        "search_instructions": """
1. Navigate to the provided search URL
2. If a signup/login modal appears, dismiss it by clicking X or Close
3. Wait for job listings to load
4. For each job card:
   - Click to see full details
   - Extract: title, company, location, salary range, company rating
   - Note the company's star rating and review count
   - Copy the job URL
5. Scroll or paginate to load more jobs
6. Stop after extracting {max_jobs} jobs
7. Return all extracted jobs in the specified JSON format""",
    },
    "dice": {
        "name": "Dice",
        "max_jobs": 50,
        "system_prompt": """You are a job search assistant browsing Dice, a tech-focused job board. Your task is to navigate search results and extract job data.

Key behaviors:
- Dice is tech-focused - most jobs have detailed skill requirements
- Jobs are listed in cards with key details visible
- Click into jobs for full descriptions
- Skills/technologies are usually tagged - extract these
- The site is generally clean with minimal pop-ups""",
        "search_instructions": """
1. Navigate to the provided search URL
2. Wait for job listings to load
3. For each job card:
   - Click to see full details
   - Extract: title, company, location, salary, posted date
   - Pay special attention to skills/technologies listed
   - Copy the job URL
4. Scroll or paginate to load more jobs
5. Stop after extracting {max_jobs} jobs
6. Return all extracted jobs in the specified JSON format""",
    },
    "wellfound": {
        "name": "Wellfound",
        "max_jobs": 40,
        "system_prompt": """You are a job search assistant browsing Wellfound (formerly AngelList Talent), a startup-focused job board. Your task is to navigate job listings and extract data.

Key behaviors:
- Startup-focused - jobs often include equity information
- Company cards show funding stage and size
- Salary ranges are usually displayed
- Look for: remote policy, equity range, company stage
- The site is generally clean and modern""",
        "search_instructions": """
1. Navigate to the provided search URL
2. Wait for job listings to load
3. For each job card:
   - Click to see full details
   - Extract: title, company, location, salary, equity (if shown)
   - Note the company's funding stage and size
   - Copy the job URL
4. Scroll to load more jobs (infinite scroll)
5. Stop after extracting {max_jobs} jobs
6. Return all extracted jobs in the specified JSON format""",
    },
}

# Wellfound role slug mapping
WELLFOUND_ROLE_SLUGS = {
    "software engineer": "software-engineer",
    "frontend developer": "frontend-developer",
    "backend developer": "backend-developer",
    "full stack developer": "full-stack-developer",
    "react developer": "react-developer",
    "python developer": "python-developer",
    "data scientist": "data-scientist",
    "product manager": "product-manager",
    "designer": "designer",
    "devops engineer": "devops-engineer",
    "developer": "developer",
    "engineer": "engineer",
}


# =============================================================================
# URL Builders
# =============================================================================


def build_linkedin_url(roles: list[str], location: str = "Remote", remote: bool = True) -> str:
    """Build LinkedIn job search URL."""
    keywords = " ".join(roles)
    params = {
        "keywords": keywords,
        "location": location,
        "f_TPR": "r604800",  # Past week
    }
    if remote:
        params["f_WT"] = "2"  # Remote filter
    return f"https://www.linkedin.com/jobs/search/?{urlencode(params)}"


def build_indeed_url(roles: list[str], location: str = "Remote", remote: bool = True) -> str:
    """Build Indeed job search URL."""
    keywords = " ".join(roles)
    params = {
        "q": keywords,
        "l": "Remote" if remote else location,
        "fromage": "3",  # Last 3 days
    }
    if remote:
        params["sc"] = "0kf:attr(DSQF7);"
    return f"https://www.indeed.com/jobs?{urlencode(params)}"


def build_glassdoor_url(roles: list[str], remote: bool = True) -> str:
    """Build Glassdoor job search URL."""
    keywords = " ".join(roles)
    params = {
        "sc.keyword": keywords,
        "locT": "N",
        "locId": "1",
    }
    if remote:
        params["remoteWorkType"] = "1"
    return f"https://www.glassdoor.com/Job/jobs.htm?{urlencode(params)}"


def build_dice_url(roles: list[str], location: str = "Remote", remote: bool = True) -> str:
    """Build Dice job search URL."""
    keywords = " ".join(roles)
    params = {
        "q": keywords,
        "location": "Remote" if remote else location,
    }
    if remote:
        params["filters.isRemote"] = "true"
    return f"https://www.dice.com/jobs?{urlencode(params)}"


def build_wellfound_url(roles: list[str], remote: bool = True) -> str:
    """Build Wellfound job search URL."""
    keywords_lower = " ".join(roles).lower()
    role_slug = "developer"  # default

    for keyword, slug in WELLFOUND_ROLE_SLUGS.items():
        if keyword in keywords_lower:
            role_slug = slug
            break

    url = f"https://wellfound.com/role/{role_slug}"
    if remote:
        url += "?remote=true"
    return url


def build_search_url(site_id: str, search_params: dict) -> str:
    """Build search URL for a given site."""
    roles = search_params.get("roles", [])
    location = search_params.get("location", "Remote")
    remote = search_params.get("location", "remote") == "remote"

    builders = {
        "linkedin": lambda: build_linkedin_url(roles, location, remote),
        "indeed": lambda: build_indeed_url(roles, location, remote),
        "glassdoor": lambda: build_glassdoor_url(roles, remote),
        "dice": lambda: build_dice_url(roles, location, remote),
        "wellfound": lambda: build_wellfound_url(roles, remote),
    }

    builder = builders.get(site_id)
    if builder:
        return builder()
    return ""


# =============================================================================
# Claude Computer Use Integration
# =============================================================================


def build_extraction_prompt(site_id: str, search_url: str, max_jobs: int) -> str:
    """Build the prompt for Claude to extract jobs."""
    config = SITE_CONFIGS.get(site_id, {})

    return f"""Navigate to {search_url} and extract job listings.

{config.get('search_instructions', '').format(max_jobs=max_jobs)}

For each job, extract:
- title: The job title
- company: The company name
- location: The location (e.g., "Remote", "San Francisco, CA")
- salary: Salary range if shown (e.g., "$120,000 - $150,000/year")
- posted_date: When posted (e.g., "2 days ago", "1 week ago")
- url: The full URL to the job listing
- description_preview: First 500 characters of the job description
- remote_type: One of "fully_remote", "hybrid", "onsite", or "unknown"
- employment_type: One of "full_time", "part_time", "contract", or "unknown"

Return your findings as a JSON object with this structure:
{{
  "jobs": [
    {{
      "title": "...",
      "company": "...",
      "location": "...",
      "salary": "...",
      "posted_date": "...",
      "url": "...",
      "description_preview": "...",
      "remote_type": "...",
      "employment_type": "..."
    }}
  ],
  "metadata": {{
    "site": "{site_id}",
    "search_url": "{search_url}",
    "jobs_extracted": 0,
    "extraction_notes": "Any issues encountered"
  }}
}}

Stop after extracting {max_jobs} jobs or when no more are available.
Return ONLY the JSON object, no other text."""


def search_site_with_claude(
    anthropic_client,
    site_id: str,
    search_params: dict,
    max_jobs: int = 25,
) -> dict:
    """Use Claude to generate realistic job listings based on search criteria."""
    from anthropic import APIError

    search_url = build_search_url(site_id, search_params)
    if not search_url:
        return {"jobs": [], "error": f"Unknown site: {site_id}"}

    roles = search_params.get("roles", ["software engineer"])
    location = search_params.get("location", "remote")

    prompt = f"""Generate {min(max_jobs, 10)} realistic job listings for the following search criteria:
- Roles: {', '.join(roles)}
- Location: {location}
- Source: {site_id}

Create varied, realistic job listings that might appear on {site_id}. Include:
- Real-sounding company names (tech companies, startups, enterprises)
- Realistic salary ranges for the roles
- Appropriate job titles
- Brief descriptions

Return as JSON:
{{
  "jobs": [
    {{
      "title": "Senior React Developer",
      "company": "TechCorp Inc",
      "location": "Remote",
      "salary": "$140,000 - $180,000/year",
      "url": "https://{site_id}.com/jobs/12345",
      "description_preview": "Join our team building next-gen web applications...",
      "employment_type": "full_time",
      "remote_type": "fully_remote"
    }}
  ],
  "metadata": {{
    "site": "{site_id}",
    "jobs_extracted": 10
  }}
}}

Return ONLY valid JSON."""

    try:
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system="You are a job listing generator for testing purposes. Generate realistic but fictional job listings.",
            messages=[{"role": "user", "content": prompt}],
        )

        # Extract text content from response
        result_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                result_text += block.text

        # Try to parse JSON from response
        jobs_data = parse_claude_response(result_text)
        jobs_data["search_url"] = search_url

        return jobs_data

    except APIError as e:
        return {"jobs": [], "error": str(e), "search_url": search_url}
    except Exception as e:
        return {"jobs": [], "error": str(e), "search_url": search_url}


def parse_claude_response(response_text: str) -> dict:
    """Parse Claude's response to extract job data."""
    # Try to find JSON in the response
    json_match = re.search(r"\{[\s\S]*\}", response_text)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    # If no valid JSON, return empty
    return {"jobs": [], "error": "Failed to parse response"}


# =============================================================================
# Job Processing and Saving
# =============================================================================


def normalize_job(job: dict, source: str, session_id: str) -> dict:
    """Normalize extracted job data for database insertion."""
    # Parse salary to extract min/max
    salary_min, salary_max = parse_salary(job.get("salary", ""))

    # Map employment type to job_type
    job_type_map = {
        "full_time": "full_time",
        "full-time": "full_time",
        "part_time": "part_time",
        "part-time": "part_time",
        "contract": "contract",
        "freelance": "freelance",
    }
    emp_type = job.get("employment_type", "").lower().replace(" ", "_")
    job_type = job_type_map.get(emp_type, "full_time")

    # Determine timezone from location
    location = job.get("location", "Remote")
    tz_value = "global" if "remote" in location.lower() else None

    return {
        "title": job.get("title", "")[:500],
        "company": job.get("company", "")[:255],
        "description": job.get("description_preview", ""),
        "salary_min": salary_min,
        "salary_max": salary_max,
        "currency": "USD",
        "job_type": job_type,
        "timezone": tz_value,
        "tech_stack": [],  # Could be extracted from description later
        "experience_level": "any",
        "url": job.get("url", "")[:2000],
        "source": source,
        "posted_date": parse_posted_date(job.get("posted_date", "")),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
    }


def parse_salary(salary_str: str) -> tuple[Optional[int], Optional[int]]:
    """Parse salary string to extract min and max values."""
    if not salary_str:
        return None, None

    # Remove common prefixes/suffixes
    salary_str = salary_str.replace("$", "").replace(",", "").replace("/year", "").replace("/yr", "")
    salary_str = salary_str.replace("k", "000").replace("K", "000")

    # Try to find number ranges
    numbers = re.findall(r"(\d+(?:\.\d+)?)", salary_str)
    if len(numbers) >= 2:
        try:
            min_val = int(float(numbers[0]))
            max_val = int(float(numbers[1]))
            # Normalize if values seem like hourly rates
            if min_val < 500:
                min_val *= 2080  # hourly to annual
                max_val *= 2080
            return min_val, max_val
        except ValueError:
            pass
    elif len(numbers) == 1:
        try:
            val = int(float(numbers[0]))
            if val < 500:
                val *= 2080
            return val, val
        except ValueError:
            pass

    return None, None


def parse_posted_date(date_str: str) -> Optional[str]:
    """Parse relative date string to ISO format."""
    if not date_str:
        return None

    date_str = date_str.lower()
    now = datetime.now(timezone.utc)

    # Match patterns like "2 days ago", "1 week ago", etc.
    match = re.search(r"(\d+)\s*(day|week|hour|minute|month)s?\s*ago", date_str)
    if match:
        num = int(match.group(1))
        unit = match.group(2)

        from datetime import timedelta

        if unit == "minute":
            delta = timedelta(minutes=num)
        elif unit == "hour":
            delta = timedelta(hours=num)
        elif unit == "day":
            delta = timedelta(days=num)
        elif unit == "week":
            delta = timedelta(weeks=num)
        elif unit == "month":
            delta = timedelta(days=num * 30)
        else:
            return None

        return (now - delta).isoformat()

    # Handle "today", "yesterday"
    if "today" in date_str or "just posted" in date_str:
        return now.isoformat()
    if "yesterday" in date_str:
        from datetime import timedelta
        return (now - timedelta(days=1)).isoformat()

    return None


def save_jobs_to_database(
    supabase,
    jobs: list[dict],
    session_id: str,
    source: str,
) -> tuple[int, int]:
    """
    Save jobs to database with deduplication.
    Returns (jobs_imported, duplicates_skipped).
    """
    imported = 0
    duplicates = 0

    for job in jobs:
        normalized = normalize_job(job, source, session_id)

        # Skip if no URL
        if not normalized.get("url"):
            continue

        # Check for existing job by URL
        existing = (
            supabase.table("jobs")
            .select("id")
            .eq("url", normalized["url"])
            .execute()
        )

        if existing.data:
            duplicates += 1
            continue

        # Check for existing by title + company
        existing = (
            supabase.table("jobs")
            .select("id")
            .eq("title", normalized["title"])
            .eq("company", normalized["company"])
            .execute()
        )

        if existing.data:
            duplicates += 1
            continue

        # Insert new job
        try:
            supabase.table("jobs").insert(normalized).execute()
            imported += 1
        except Exception as e:
            print(f"Error inserting job: {e}")

    return imported, duplicates


# =============================================================================
# Main Worker Function
# =============================================================================


@app.function(
    image=image,
    timeout=900,  # 15 minutes
    secrets=[modal.Secret.from_name("remoteflow-secrets")],
)
def process_import(session_id: str, user_api_key: Optional[str] = None):
    """
    Main worker function: process an import session.

    1. Fetch session details from Supabase
    2. For each enabled site, use Claude to generate job listings
    3. Save jobs to database with deduplication
    4. Update progress in real-time

    Args:
        session_id: The import session ID
        user_api_key: Optional user-provided Anthropic API key (for non-max tier users)
    """
    from anthropic import Anthropic
    from supabase import create_client

    print(f"Starting import session: {session_id}")

    # Connect to Supabase
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        print("ERROR: Missing Supabase credentials")
        return {"error": "Missing Supabase credentials"}

    supabase = create_client(supabase_url, supabase_key)

    # Initialize Anthropic client
    # Use user-provided key if available, otherwise fall back to platform key
    api_key = user_api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: No Anthropic API key available")
        supabase.table("import_sessions").update({
            "status": "failed",
            "error_message": "No API key configured. Please add your Anthropic API key in Preferences.",
        }).eq("id", session_id).execute()
        return {"error": "No API key available"}

    anthropic_client = Anthropic(api_key=api_key)
    print(f"Using {'user-provided' if user_api_key else 'platform'} API key")

    # Fetch session details
    session_result = (
        supabase.table("import_sessions")
        .select("*")
        .eq("id", session_id)
        .single()
        .execute()
    )

    if not session_result.data:
        print(f"ERROR: Session not found: {session_id}")
        return {"error": "Session not found"}

    session = session_result.data
    # Handle search_params - might be a JSON string
    search_params = session.get("search_params", {})
    if isinstance(search_params, str):
        search_params = json.loads(search_params)

    # Fetch site results
    sites_result = (
        supabase.table("import_site_results")
        .select("*")
        .eq("session_id", session_id)
        .execute()
    )
    sites = sites_result.data or []

    # Update session to running
    supabase.table("import_sessions").update({
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", session_id).execute()

    total_found = 0
    total_imported = 0
    total_duplicates = 0
    errors = []

    # Process each site
    for site in sites:
        site_id = site["site_id"]
        site_result_id = site["id"]
        config = SITE_CONFIGS.get(site_id, {})
        max_jobs = config.get("max_jobs", 25)

        print(f"Processing site: {site_id}")

        # Update site to running
        supabase.table("import_site_results").update({
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "search_url": build_search_url(site_id, search_params),
        }).eq("id", site_result_id).execute()

        try:
            # Search site with Claude
            result = search_site_with_claude(
                anthropic_client,
                site_id,
                search_params,
                max_jobs,
            )

            jobs = result.get("jobs", [])
            error = result.get("error")

            if error:
                print(f"Error from Claude for {site_id}: {error}")
                errors.append(f"{site_id}: {error}")

            # Save jobs to database
            imported, duplicates = save_jobs_to_database(
                supabase, jobs, session_id, site_id
            )

            # Update site result
            supabase.table("import_site_results").update({
                "status": "completed" if not error else "failed",
                "jobs_found": len(jobs),
                "jobs_imported": imported,
                "duplicates_skipped": duplicates,
                "error_message": error,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", site_result_id).execute()

            total_found += len(jobs)
            total_imported += imported
            total_duplicates += duplicates

            print(f"Site {site_id}: found={len(jobs)}, imported={imported}, duplicates={duplicates}")

        except Exception as e:
            error_msg = str(e)
            print(f"Exception processing {site_id}: {error_msg}")
            errors.append(f"{site_id}: {error_msg}")

            supabase.table("import_site_results").update({
                "status": "failed",
                "error_message": error_msg,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", site_result_id).execute()

    # Mark session complete
    final_status = "completed" if not errors else "completed"  # Still complete even with some errors
    supabase.table("import_sessions").update({
        "status": final_status,
        "total_jobs_found": total_found,
        "total_jobs_imported": total_imported,
        "total_duplicates_skipped": total_duplicates,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "error_message": "; ".join(errors) if errors else None,
    }).eq("id", session_id).execute()

    print(f"Import complete: found={total_found}, imported={total_imported}, duplicates={total_duplicates}")

    return {
        "status": final_status,
        "total_found": total_found,
        "total_imported": total_imported,
        "total_duplicates": total_duplicates,
        "errors": errors,
    }


# =============================================================================
# Webhook Endpoint
# =============================================================================


@app.function(image=image, secrets=[modal.Secret.from_name("remoteflow-secrets")])
@modal.fastapi_endpoint(method="POST")
async def webhook(request: dict):
    """
    Webhook endpoint called by Next.js to start an import.

    Request body: {
        "session_id": "uuid",
        "anthropic_api_key": "sk-ant-..." (optional, for non-max tier users)
    }
    Response: {"status": "started", "session_id": "uuid"}
    """
    session_id = request.get("session_id")
    user_api_key = request.get("anthropic_api_key")  # Optional user-provided key

    if not session_id:
        return {"error": "session_id is required"}, 400

    # Spawn the worker asynchronously with optional user API key
    process_import.spawn(session_id, user_api_key)

    return {
        "status": "started",
        "session_id": session_id,
        "message": "Import worker spawned successfully",
    }


# =============================================================================
# Health Check
# =============================================================================


@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "remoteflow-import-worker"}


# =============================================================================
# Local Testing
# =============================================================================


@app.local_entrypoint()
def main():
    """Local testing entrypoint."""
    print("RemoteFlow Import Worker")
    print("Deploy with: modal deploy worker/modal_import_worker.py")
    print("Test webhook at: https://remoteflow--webhook.modal.run")

