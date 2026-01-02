import type { DetectionMethod } from '../../../types'

type FormSubmitCallback = (data: {
  method: DetectionMethod
  formId?: string
  formAction?: string
}) => void

/**
 * Observe form submissions on the page
 */
export class FormObserver {
  private callback: FormSubmitCallback
  private observedForms: Set<HTMLFormElement> = new Set()
  private mutationObserver: MutationObserver | null = null

  constructor(callback: FormSubmitCallback) {
    this.callback = callback
  }

  /**
   * Start observing forms matching the given selectors
   */
  observe(selectors: string[]): void {
    // Observe existing forms
    selectors.forEach((selector) => {
      const forms = document.querySelectorAll<HTMLFormElement>(selector)
      forms.forEach((form) => this.attachToForm(form))
    })

    // Observe dynamically added forms
    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element

            selectors.forEach((selector) => {
              // Check if the added node matches
              if (element.matches?.(selector)) {
                this.attachToForm(element as HTMLFormElement)
              }

              // Check descendants
              const forms = element.querySelectorAll?.<HTMLFormElement>(selector)
              forms?.forEach((form) => this.attachToForm(form))
            })
          }
        }
      }
    })

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  /**
   * Attach submit listener to a form
   */
  private attachToForm(form: HTMLFormElement): void {
    if (this.observedForms.has(form)) return

    this.observedForms.add(form)

    form.addEventListener('submit', (event) => {
      this.callback({
        method: 'form_submit',
        formId: form.id || undefined,
        formAction: form.action || undefined,
      })
    })
  }

  /**
   * Stop observing
   */
  disconnect(): void {
    this.mutationObserver?.disconnect()
    this.observedForms.clear()
  }
}

/**
 * Observe submit button clicks
 */
export class SubmitButtonObserver {
  private callback: FormSubmitCallback
  private clickHandler: (event: MouseEvent) => void

  constructor(callback: FormSubmitCallback) {
    this.callback = callback

    this.clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (this.isSubmitButton(target)) {
        this.callback({
          method: 'button_click',
        })
      }
    }
  }

  /**
   * Start observing button clicks
   */
  observe(): void {
    document.addEventListener('click', this.clickHandler, true)
  }

  /**
   * Check if element is a submit button
   */
  private isSubmitButton(element: HTMLElement): boolean {
    // Check button type
    if (element.tagName === 'BUTTON' || element.tagName === 'INPUT') {
      const type = element.getAttribute('type')
      if (type === 'submit') return true
    }

    // Check text content
    const text = element.textContent?.toLowerCase() || ''
    const submitKeywords = ['submit', 'apply', 'send application', 'complete application']

    return submitKeywords.some((keyword) => text.includes(keyword))
  }

  /**
   * Stop observing
   */
  disconnect(): void {
    document.removeEventListener('click', this.clickHandler, true)
  }
}
