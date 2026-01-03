# JobIQ Import Worker

Modal.com serverless worker that uses Claude Computer Use to browse job boards and extract listings.

## Setup

### 1. Install Modal CLI

```bash
pip install modal
modal setup
```

### 2. Create Secrets in Modal Dashboard

Go to [modal.com/secrets](https://modal.com/secrets) and create a secret named `jobiq-secrets`:

```
SUPABASE_URL=https://tzwvagdjmtxsxkyceqoj.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # Your service role key
ANTHROPIC_API_KEY=sk-ant-...  # Your Anthropic API key
```

### 3. Deploy

```bash
cd worker
modal deploy modal_import_worker.py
```

### 4. Get Webhook URL

After deployment, Modal will show the webhook URL. It will look like:

```
https://your-username--jobiq-import-worker-webhook.modal.run
```

### 5. Configure Next.js

Add to `.env.local`:

```
IMPORT_WORKER_WEBHOOK_URL=https://your-username--jobiq-import-worker-webhook.modal.run
```

## Endpoints

- `POST /webhook` - Trigger a new import (called by Next.js)
- `GET /health` - Health check

## How It Works

1. User clicks "Find Jobs" in JobIQ UI
2. Next.js API creates import session in Supabase
3. Next.js calls this worker's webhook with `session_id`
4. Worker spawns async job processing
5. For each enabled site (LinkedIn, Indeed, Glassdoor, Dice, Wellfound):
   - Uses Claude Computer Use to browse the site
   - Extracts job listings
   - Saves to Supabase with deduplication
   - Updates progress in real-time
6. Frontend polls for progress updates

## Testing Locally

```bash
modal run modal_import_worker.py
```

## Logs

View logs in Modal dashboard or:

```bash
modal logs jobiq-import-worker
```
