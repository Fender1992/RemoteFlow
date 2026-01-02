/**
 * Worker trigger for external compute (Modal.com or similar)
 *
 * This module handles triggering the external worker that runs Claude Computer Use.
 * The worker runs outside of Vercel to avoid the 60-second timeout limit.
 */

export interface WorkerTriggerResult {
  success: boolean
  message: string
  workerId?: string
}

/**
 * Trigger the external worker to process an import session
 *
 * In production, this would call Modal.com or Railway webhook
 * For now, it's a stub that can be connected later
 */
export async function triggerWorker(sessionId: string): Promise<WorkerTriggerResult> {
  const webhookUrl = process.env.IMPORT_WORKER_WEBHOOK_URL

  if (!webhookUrl) {
    // Development mode: log and return success
    // The import will stay in "pending" status until worker is configured
    console.log(`[Import Worker] Would trigger worker for session: ${sessionId}`)
    console.log('[Import Worker] Set IMPORT_WORKER_WEBHOOK_URL to enable external worker')

    return {
      success: true,
      message: 'Worker trigger skipped (no webhook URL configured)',
    }
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.IMPORT_WORKER_API_KEY || ''}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Worker webhook returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    return {
      success: true,
      message: 'Worker triggered successfully',
      workerId: data.worker_id || data.id,
    }
  } catch (error) {
    console.error('[Import Worker] Failed to trigger worker:', error)

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error triggering worker',
    }
  }
}

/**
 * Check if a worker is currently processing a session
 */
export async function checkWorkerStatus(
  sessionId: string
): Promise<{ running: boolean; progress?: number }> {
  const statusUrl = process.env.IMPORT_WORKER_STATUS_URL

  if (!statusUrl) {
    return { running: false }
  }

  try {
    const response = await fetch(`${statusUrl}?session_id=${sessionId}`, {
      headers: {
        Authorization: `Bearer ${process.env.IMPORT_WORKER_API_KEY || ''}`,
      },
    })

    if (!response.ok) {
      return { running: false }
    }

    const data = await response.json()
    return {
      running: data.status === 'running',
      progress: data.progress,
    }
  } catch {
    return { running: false }
  }
}

/**
 * Cancel a running worker
 */
export async function cancelWorker(sessionId: string): Promise<boolean> {
  const cancelUrl = process.env.IMPORT_WORKER_CANCEL_URL

  if (!cancelUrl) {
    return false
  }

  try {
    const response = await fetch(cancelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.IMPORT_WORKER_API_KEY || ''}`,
      },
      body: JSON.stringify({ session_id: sessionId }),
    })

    return response.ok
  } catch {
    return false
  }
}
