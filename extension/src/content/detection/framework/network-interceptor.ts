type RequestCallback = (url: string, method: string) => void
type ResponseCallback = (url: string, status: number, ok: boolean) => void

/**
 * Intercept network requests to detect AJAX form submissions
 */
export class NetworkInterceptor {
  private onRequest: RequestCallback
  private onResponse: ResponseCallback
  private originalFetch: typeof fetch
  private originalXHROpen: typeof XMLHttpRequest.prototype.open
  private originalXHRSend: typeof XMLHttpRequest.prototype.send
  private installed = false

  constructor(onRequest: RequestCallback, onResponse: ResponseCallback) {
    this.onRequest = onRequest
    this.onResponse = onResponse
    this.originalFetch = window.fetch.bind(window)
    this.originalXHROpen = XMLHttpRequest.prototype.open
    this.originalXHRSend = XMLHttpRequest.prototype.send
  }

  /**
   * Install the interceptors
   */
  install(): void {
    if (this.installed) return
    this.installed = true

    this.interceptFetch()
    this.interceptXHR()
  }

  /**
   * Uninstall the interceptors
   */
  uninstall(): void {
    if (!this.installed) return

    window.fetch = this.originalFetch
    XMLHttpRequest.prototype.open = this.originalXHROpen
    XMLHttpRequest.prototype.send = this.originalXHRSend
    this.installed = false
  }

  /**
   * Intercept fetch requests
   */
  private interceptFetch(): void {
    const self = this

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = init?.method || 'GET'

      // Notify request
      self.onRequest(url, method.toUpperCase())

      try {
        const response = await self.originalFetch(input, init)

        // Notify response
        self.onResponse(url, response.status, response.ok)

        return response
      } catch (error) {
        throw error
      }
    }
  }

  /**
   * Intercept XMLHttpRequest
   */
  private interceptXHR(): void {
    const self = this

    // Store URL and method on the XHR instance
    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      (this as any).__rf_url = url.toString()
      ;(this as any).__rf_method = method.toUpperCase()

      return self.originalXHROpen.call(
        this,
        method,
        url,
        async ?? true,
        username ?? null,
        password ?? null
      )
    }

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const url = (this as any).__rf_url as string
      const method = (this as any).__rf_method as string

      // Notify request
      self.onRequest(url, method)

      // Listen for response
      this.addEventListener('load', function () {
        self.onResponse(url, this.status, this.status >= 200 && this.status < 300)
      })

      return self.originalXHRSend.call(this, body)
    }
  }
}
