# JobIQ Import Worker v2.0

Modal.com serverless worker that uses **Claude Computer Use** to browse job boards and extract listings.

## Features

- Uses Claude Computer Use API for real browser automation
- Playwright headless Chromium for rendering
- Supports: LinkedIn, Indeed, Glassdoor, Dice, Wellfound
- Real-time progress updates to Supabase
- Automatic job deduplication
- Fallback to vision-based extraction if Computer Use fails

## Setup

### 1. Install Modal CLI

```bash
pip install modal
modal setup  # Login to Modal
```

### 2. Create Secrets in Modal Dashboard

Go to [modal.com/secrets](https://modal.com/secrets) and create a secret named `jobiq-secrets`:

```
SUPABASE_URL=https://tzwvagdjmtxsxkyceqoj.supabase.co
SUPABASE_SERVICE_KEY=<your service role key>
ANTHROPIC_API_KEY=<your Anthropic API key>
```

### 3. Deploy

```bash
cd worker
modal deploy modal_import_worker.py
```

### 4. Get Webhook URL

After deployment, Modal will show the webhook URL:

```
https://your-username--jobiq-import-worker-webhook.modal.run
```

### 5. Configure Vercel

Add to Vercel environment variables:

```
IMPORT_WORKER_WEBHOOK_URL=https://your-username--jobiq-import-worker-webhook.modal.run
```

## Endpoints

- `POST /webhook` - Trigger a new import (called by Next.js)
- `GET /health` - Health check

## How It Works

1. User clicks "Find Jobs For Me" in JobIQ UI
2. Next.js API creates import session in Supabase
3. Next.js calls this worker's webhook with `session_id`
4. Worker spawns async job processing
5. For each enabled site (LinkedIn, Indeed, Glassdoor, Dice, Wellfound):
   - Opens headless Chromium browser via Playwright
   - Takes screenshot and sends to Claude Computer Use
   - Claude analyzes page and requests actions (scroll, click, etc.)
   - Worker executes actions and sends new screenshots
   - Claude extracts job listings when done
   - Jobs saved to Supabase with deduplication
6. Frontend polls for progress updates

## Testing Locally

```bash
# Run test
modal run modal_import_worker.py

# View logs
modal logs jobiq-import-worker
```

## Architecture

```
Next.js API  →  Modal Webhook  →  process_import()
                                        │
                                        ↓
                              ┌─────────────────┐
                              │  For each site  │
                              └────────┬────────┘
                                       │
                              ┌────────↓────────┐
                              │ Playwright      │
                              │ Opens browser   │
                              └────────┬────────┘
                                       │
                              ┌────────↓────────┐
                              │ Screenshot →    │
                              │ Claude Computer │
                              │ Use API         │
                              └────────┬────────┘
                                       │
                              ┌────────↓────────┐
                              │ Execute action  │
                              │ (scroll/click)  │
                              └────────┬────────┘
                                       │
                              ┌────────↓────────┐
                              │ Extract jobs    │
                              │ Save to DB      │
                              └─────────────────┘
```

## Resource Requirements

- CPU: 2.0 cores
- Memory: 4GB
- Timeout: 15 minutes
- Concurrent: 1 per site (sequential processing)
