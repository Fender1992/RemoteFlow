"""
JobIQ Job Import Worker

A Modal.com serverless worker that uses Claude Computer Use to browse job boards
and extract job listings. Triggered by webhook from Next.js API.

Deploy: modal deploy worker/modal_import_worker.py
"""

import modal
import os
import json
import re
import base64
import asyncio
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode

# Modal app configuration
app = modal.App("jobiq-import-worker")

# Build image with browser automation dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "wget",
        "gnupg",
        "libglib2.0-0",
        "libnss3",
        "libnspr4",
        "libdbus-1-3",
        "libatk1.0-0",
        "libatk-bridge2.0-0",
        "libcups2",
        "libdrm2",
        "libxkbcommon0",
        "libxcomposite1",
        "libxdamage1",
        "libxfixes3",
        "libxrandr2",
        "libgbm1",
        "libasound2",
        "libpango-1.0-0",
        "libcairo2",
    )
    .pip_install(
        "anthropic>=0.40.0",
        "supabase>=2.0.0",
        "httpx>=0.25.0",
        "fastapi",
        "playwright",
        "Pillow",
    )
    .run_commands(
        "playwright install chromium",
        "playwright install-deps chromium",
    )
)


# =============================================================================
# Site Configurations
# =============================================================================

SITE_CONFIGS = {
    "linkedin": {
        "name": "LinkedIn",
        "max_jobs": 25,
        "system_prompt": """You are a job search assistant browsing LinkedIn Jobs. Extract job listing data from what you see.

Key behaviors:
- If you see a login/signup modal, look for an X or Close button to dismiss it
- Job cards appear on the left panel - each shows title, company, location
- Scroll down to see more job listings
- Extract data directly from visible job cards without clicking into each one""",
    },
    "indeed": {
        "name": "Indeed",
        "max_jobs": 25,
        "system_prompt": """You are a job search assistant browsing Indeed job listings. Extract job data from visible listings.

Key behaviors:
- Jobs are listed in cards with title, company, location, salary visible
- Note if salary is "Estimated" or "Employer provided"
- Look for badges like "Urgently hiring", "Responsive employer"
- Scroll to see more listings""",
    },
    "glassdoor": {
        "name": "Glassdoor",
        "max_jobs": 20,
        "system_prompt": """You are a job search assistant browsing Glassdoor job listings. Extract job data from visible listings.

Key behaviors:
- May show signup/login modal - dismiss by clicking X or Close
- Company ratings (stars) are valuable - extract if visible
- Salary ranges are often shown as estimates
- Scroll to load more jobs""",
    },
    "dice": {
        "name": "Dice",
        "max_jobs": 25,
        "system_prompt": """You are a job search assistant browsing Dice, a tech-focused job board. Extract job data from visible listings.

Key behaviors:
- Dice is tech-focused - most jobs have detailed skill requirements
- Jobs are listed in cards with key details visible
- The site is generally clean with minimal pop-ups""",
    },
    "wellfound": {
        "name": "Wellfound",
        "max_jobs": 20,
        "system_prompt": """You are a job search assistant browsing Wellfound (formerly AngelList Talent). Extract job data from visible listings.

Key behaviors:
- Startup-focused - jobs often include equity information
- Company cards show funding stage and size
- Salary ranges are usually displayed
- The site uses infinite scroll""",
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
    keywords = " ".join(roles)
    params = {
        "q": keywords,
        "l": "Remote" if remote else location,
        "fromage": "7",  # Last 7 days
    }
    if remote:
        params["sc"] = "0kf:attr(DSQF7);"
    return f"https://www.indeed.com/jobs?{urlencode(params)}"


def build_glassdoor_url(roles: list[str], remote: bool = True) -> str:
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
    keywords = " ".join(roles)
    params = {
        "q": keywords,
        "location": "Remote" if remote else location,
    }
    if remote:
        params["filters.isRemote"] = "true"
    return f"https://www.dice.com/jobs?{urlencode(params)}"


def build_wellfound_url(roles: list[str], remote: bool = True) -> str:
    keywords_lower = " ".join(roles).lower()
    role_slug = "developer"

    for keyword, slug in WELLFOUND_ROLE_SLUGS.items():
        if keyword in keywords_lower:
            role_slug = slug
            break

    url = f"https://wellfound.com/role/{role_slug}"
    if remote:
        url += "?remote=true"
    return url


def build_search_url(site_id: str, search_params: dict) -> str:
    roles = search_params.get("roles", [])
    location = search_params.get("location", "Remote")
    remote = search_params.get("location", "remote").lower() == "remote"

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


async def execute_computer_action(page, action: dict) -> str:
    """Execute a computer use action on the browser page."""
    action_type = action.get("action")

    try:
        if action_type == "screenshot":
            # Just return - we'll take a screenshot after
            return "Screenshot taken"

        elif action_type == "mouse_move":
            x = action.get("coordinate", [0, 0])[0]
            y = action.get("coordinate", [0, 0])[1]
            await page.mouse.move(x, y)
            return f"Moved mouse to ({x}, {y})"

        elif action_type == "left_click":
            x = action.get("coordinate", [0, 0])[0]
            y = action.get("coordinate", [0, 0])[1]
            await page.mouse.click(x, y)
            await asyncio.sleep(0.5)  # Wait for any navigation/loading
            return f"Clicked at ({x}, {y})"

        elif action_type == "left_click_drag":
            start = action.get("start_coordinate", [0, 0])
            end = action.get("coordinate", [0, 0])
            await page.mouse.move(start[0], start[1])
            await page.mouse.down()
            await page.mouse.move(end[0], end[1])
            await page.mouse.up()
            return f"Dragged from {start} to {end}"

        elif action_type == "right_click":
            x = action.get("coordinate", [0, 0])[0]
            y = action.get("coordinate", [0, 0])[1]
            await page.mouse.click(x, y, button="right")
            return f"Right-clicked at ({x}, {y})"

        elif action_type == "double_click":
            x = action.get("coordinate", [0, 0])[0]
            y = action.get("coordinate", [0, 0])[1]
            await page.mouse.dblclick(x, y)
            return f"Double-clicked at ({x}, {y})"

        elif action_type == "scroll":
            x = action.get("coordinate", [640, 400])[0]
            y = action.get("coordinate", [640, 400])[1]
            direction = action.get("direction", "down")
            amount = action.get("amount", 3)
            scroll_amount = amount * 100  # Convert to pixels

            if direction == "down":
                await page.mouse.move(x, y)
                await page.mouse.wheel(0, scroll_amount)
            elif direction == "up":
                await page.mouse.move(x, y)
                await page.mouse.wheel(0, -scroll_amount)

            await asyncio.sleep(0.5)  # Wait for scroll to complete
            return f"Scrolled {direction} by {amount} units"

        elif action_type == "type":
            text = action.get("text", "")
            await page.keyboard.type(text)
            return f"Typed: {text[:50]}..."

        elif action_type == "key":
            key = action.get("key", "")
            # Map common key names
            key_map = {
                "Return": "Enter",
                "space": "Space",
                "BackSpace": "Backspace",
            }
            mapped_key = key_map.get(key, key)
            await page.keyboard.press(mapped_key)
            return f"Pressed key: {key}"

        else:
            return f"Unknown action type: {action_type}"

    except Exception as e:
        return f"Error executing {action_type}: {str(e)}"


async def search_site_with_computer_use(
    anthropic_client,
    site_id: str,
    search_params: dict,
    max_jobs: int = 25,
) -> dict:
    """Use Claude Computer Use to browse job site and extract listings."""
    from playwright.async_api import async_playwright

    search_url = build_search_url(site_id, search_params)
    if not search_url:
        return {"jobs": [], "error": f"Unknown site: {site_id}"}

    config = SITE_CONFIGS.get(site_id, {})
    roles = search_params.get("roles", ["software engineer"])

    print(f"[{site_id}] Navigating to: {search_url}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ],
        )

        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )

        page = await context.new_page()

        try:
            # Navigate to search URL
            await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)  # Wait for dynamic content

            # Take initial screenshot
            screenshot = await page.screenshot()
            screenshot_b64 = base64.b64encode(screenshot).decode()

            # Build extraction prompt
            extraction_prompt = f"""You are browsing {config.get('name', site_id)} to find job listings.

Current search: {', '.join(roles)}
URL: {search_url}

{config.get('system_prompt', '')}

TASK: Extract job listings visible on this page. For each job, extract:
- title: Job title
- company: Company name
- location: Location (e.g., "Remote", "San Francisco, CA")
- salary: Salary if shown (e.g., "$120,000 - $150,000/year")
- url: The job URL if visible, otherwise use a placeholder

Look at the screenshot and:
1. If there are modals/popups blocking the view, use computer actions to dismiss them (click X or Close)
2. If you need to scroll to see more jobs, scroll down
3. Extract all visible job listings
4. Stop when you have extracted {max_jobs} jobs or no more are visible

When you have finished extracting jobs OR after 3 scroll attempts with no new jobs, respond with the final JSON output:

```json
{{
  "jobs": [
    {{"title": "...", "company": "...", "location": "...", "salary": "...", "url": "..."}}
  ],
  "metadata": {{
    "site": "{site_id}",
    "total_found": <number>
  }}
}}
```"""

            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": screenshot_b64,
                            },
                        },
                        {"type": "text", "text": extraction_prompt},
                    ],
                }
            ]

            # Computer Use loop
            max_iterations = 10
            iteration = 0
            final_result = None

            while iteration < max_iterations:
                iteration += 1
                print(f"[{site_id}] Computer Use iteration {iteration}")

                try:
                    response = anthropic_client.messages.create(
                        model="claude-sonnet-4-20250514",
                        max_tokens=4096,
                        tools=[
                            {
                                "type": "computer_20241022",
                                "name": "computer",
                                "display_width_px": 1280,
                                "display_height_px": 800,
                            }
                        ],
                        messages=messages,
                    )
                except Exception as api_error:
                    print(f"[{site_id}] API error: {api_error}")
                    # If Computer Use fails, try simple extraction
                    return await fallback_extraction(page, site_id, roles)

                # Check if Claude wants to use a tool or has finished
                has_tool_use = False
                text_response = ""

                for block in response.content:
                    if block.type == "tool_use":
                        has_tool_use = True
                        tool_input = block.input

                        # Execute the action
                        action_result = await execute_computer_action(page, tool_input)
                        print(f"[{site_id}] Action: {tool_input.get('action')} -> {action_result}")

                        # Take new screenshot
                        await asyncio.sleep(0.5)
                        screenshot = await page.screenshot()
                        screenshot_b64 = base64.b64encode(screenshot).decode()

                        # Add tool result to messages
                        messages.append({"role": "assistant", "content": response.content})
                        messages.append(
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "tool_result",
                                        "tool_use_id": block.id,
                                        "content": [
                                            {
                                                "type": "image",
                                                "source": {
                                                    "type": "base64",
                                                    "media_type": "image/png",
                                                    "data": screenshot_b64,
                                                },
                                            },
                                            {"type": "text", "text": action_result},
                                        ],
                                    }
                                ],
                            }
                        )
                        break

                    elif block.type == "text":
                        text_response += block.text

                # If no tool use, Claude has finished - parse the response
                if not has_tool_use:
                    final_result = parse_claude_response(text_response)
                    break

                # Stop condition
                if response.stop_reason == "end_turn" and not has_tool_use:
                    final_result = parse_claude_response(text_response)
                    break

            await browser.close()

            if final_result:
                final_result["search_url"] = search_url
                return final_result

            return {"jobs": [], "error": "Max iterations reached", "search_url": search_url}

        except Exception as e:
            await browser.close()
            print(f"[{site_id}] Error: {str(e)}")
            return {"jobs": [], "error": str(e), "search_url": search_url}


async def fallback_extraction(page, site_id: str, roles: list[str]) -> dict:
    """Fallback: Use Claude vision to extract jobs from current page state."""
    from anthropic import Anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"jobs": [], "error": "No API key for fallback"}

    client = Anthropic(api_key=api_key)

    screenshot = await page.screenshot()
    screenshot_b64 = base64.b64encode(screenshot).decode()

    prompt = f"""Look at this job board screenshot and extract all visible job listings.

For each job, extract:
- title: Job title
- company: Company name
- location: Location
- salary: Salary if visible
- url: Placeholder URL

Return as JSON:
{{"jobs": [{{"title": "...", "company": "...", "location": "...", "salary": "...", "url": "https://{site_id}.com/job/..."}}]}}"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": screenshot_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )

        text = ""
        for block in response.content:
            if hasattr(block, "text"):
                text += block.text

        return parse_claude_response(text)
    except Exception as e:
        return {"jobs": [], "error": f"Fallback failed: {str(e)}"}


def parse_claude_response(response_text: str) -> dict:
    """Parse Claude's response to extract job data."""
    # Try to find JSON in the response
    json_match = re.search(r"```json\s*([\s\S]*?)\s*```", response_text)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try raw JSON
    json_match = re.search(r"\{[\s\S]*\}", response_text)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    return {"jobs": [], "error": "Failed to parse response"}


# =============================================================================
# Job Processing and Saving
# =============================================================================


def normalize_job(job: dict, source: str, session_id: str) -> dict:
    """Normalize extracted job data for database insertion."""
    salary_min, salary_max = parse_salary(job.get("salary", ""))

    job_type_map = {
        "full_time": "full_time",
        "full-time": "full_time",
        "part_time": "part_time",
        "part-time": "part_time",
        "contract": "contract",
        "freelance": "freelance",
    }
    emp_type = job.get("employment_type", "full_time").lower().replace(" ", "_")
    job_type = job_type_map.get(emp_type, "full_time")

    location = job.get("location", "Remote")
    tz_value = "global" if "remote" in location.lower() else None

    return {
        "title": job.get("title", "")[:500],
        "company": job.get("company", "")[:255],
        "description": job.get("description_preview", job.get("description", "")),
        "salary_min": salary_min,
        "salary_max": salary_max,
        "currency": "USD",
        "job_type": job_type,
        "timezone": tz_value,
        "tech_stack": [],
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

    salary_str = salary_str.replace("$", "").replace(",", "").replace("/year", "").replace("/yr", "")
    salary_str = salary_str.replace("k", "000").replace("K", "000")

    numbers = re.findall(r"(\d+(?:\.\d+)?)", salary_str)
    if len(numbers) >= 2:
        try:
            min_val = int(float(numbers[0]))
            max_val = int(float(numbers[1]))
            if min_val < 500:
                min_val *= 2080
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

    if "today" in date_str or "just posted" in date_str:
        return now.isoformat()
    if "yesterday" in date_str:
        from datetime import timedelta

        return (now - timedelta(days=1)).isoformat()

    return None


def save_jobs_to_database(supabase, jobs: list[dict], session_id: str, source: str) -> tuple[int, int]:
    """Save jobs to database with deduplication."""
    imported = 0
    duplicates = 0

    for job in jobs:
        normalized = normalize_job(job, source, session_id)

        if not normalized.get("url") or not normalized.get("title"):
            continue

        # Check for existing job by URL
        existing = supabase.table("jobs").select("id").eq("url", normalized["url"]).execute()

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
    secrets=[modal.Secret.from_name("jobiq-secrets")],
    cpu=2.0,
    memory=4096,
)
async def process_import(session_id: str, user_api_key: Optional[str] = None):
    """Main worker function: process an import session using Claude Computer Use."""
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
    api_key = user_api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: No Anthropic API key available")
        supabase.table("import_sessions").update(
            {
                "status": "failed",
                "error_message": "No API key configured. Please add your Anthropic API key in Preferences.",
            }
        ).eq("id", session_id).execute()
        return {"error": "No API key available"}

    anthropic_client = Anthropic(api_key=api_key)
    print(f"Using {'user-provided' if user_api_key else 'platform'} API key")

    # Fetch session details
    session_result = supabase.table("import_sessions").select("*").eq("id", session_id).single().execute()

    if not session_result.data:
        print(f"ERROR: Session not found: {session_id}")
        return {"error": "Session not found"}

    session = session_result.data
    search_params = session.get("search_params", {})
    if isinstance(search_params, str):
        search_params = json.loads(search_params)

    # Fetch site results
    sites_result = supabase.table("import_site_results").select("*").eq("session_id", session_id).execute()
    sites = sites_result.data or []

    # Update session to running
    supabase.table("import_sessions").update(
        {
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", session_id).execute()

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
        supabase.table("import_site_results").update(
            {
                "status": "running",
                "started_at": datetime.now(timezone.utc).isoformat(),
                "search_url": build_search_url(site_id, search_params),
            }
        ).eq("id", site_result_id).execute()

        try:
            # Search site with Claude Computer Use
            result = await search_site_with_computer_use(
                anthropic_client,
                site_id,
                search_params,
                max_jobs,
            )

            jobs = result.get("jobs", [])
            error = result.get("error")

            if error:
                print(f"Error from {site_id}: {error}")
                errors.append(f"{site_id}: {error}")

            # Save jobs to database
            imported, duplicates = save_jobs_to_database(supabase, jobs, session_id, site_id)

            # Update site result
            supabase.table("import_site_results").update(
                {
                    "status": "completed" if not error else "failed",
                    "jobs_found": len(jobs),
                    "jobs_imported": imported,
                    "duplicates_skipped": duplicates,
                    "error_message": error,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", site_result_id).execute()

            total_found += len(jobs)
            total_imported += imported
            total_duplicates += duplicates

            print(f"Site {site_id}: found={len(jobs)}, imported={imported}, duplicates={duplicates}")

        except Exception as e:
            error_msg = str(e)
            print(f"Exception processing {site_id}: {error_msg}")
            errors.append(f"{site_id}: {error_msg}")

            supabase.table("import_site_results").update(
                {
                    "status": "failed",
                    "error_message": error_msg,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", site_result_id).execute()

    # Mark session complete
    final_status = "completed"
    supabase.table("import_sessions").update(
        {
            "status": final_status,
            "total_jobs_found": total_found,
            "total_jobs_imported": total_imported,
            "total_duplicates_skipped": total_duplicates,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "error_message": "; ".join(errors) if errors else None,
        }
    ).eq("id", session_id).execute()

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


@app.function(image=image, secrets=[modal.Secret.from_name("jobiq-secrets")])
@modal.fastapi_endpoint(method="POST")
async def webhook(request: dict):
    """Webhook endpoint called by Next.js to start an import."""
    session_id = request.get("session_id")
    user_api_key = request.get("anthropic_api_key")

    if not session_id:
        return {"error": "session_id is required"}, 400

    # Spawn the worker asynchronously
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
    return {"status": "ok", "service": "jobiq-import-worker", "version": "2.0"}


# =============================================================================
# Local Testing
# =============================================================================


@app.local_entrypoint()
def main():
    """Local testing entrypoint."""
    print("JobIQ Import Worker v2.0 (Claude Computer Use)")
    print("Deploy with: modal deploy worker/modal_import_worker.py")
    print("Test webhook at: https://your-username--jobiq-import-worker-webhook.modal.run")
