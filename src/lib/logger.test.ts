import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from './logger'

describe('logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>
    warn: ReturnType<typeof vi.spyOn>
    error: ReturnType<typeof vi.spyOn>
    debug: ReturnType<typeof vi.spyOn>
  }

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs info messages as JSON', () => {
    logger.info('test message')
    expect(consoleSpy.log).toHaveBeenCalledOnce()
    const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
    expect(output.level).toBe('info')
    expect(output.message).toBe('test message')
    expect(output.timestamp).toBeDefined()
  })

  it('logs warn messages', () => {
    logger.warn('warning message')
    expect(consoleSpy.warn).toHaveBeenCalledOnce()
    const output = JSON.parse(consoleSpy.warn.mock.calls[0][0])
    expect(output.level).toBe('warn')
    expect(output.message).toBe('warning message')
  })

  it('logs error messages with Error object details', () => {
    const err = new Error('test error')
    logger.error('something failed', err)
    expect(consoleSpy.error).toHaveBeenCalledOnce()
    const output = JSON.parse(consoleSpy.error.mock.calls[0][0])
    expect(output.level).toBe('error')
    expect(output.error_name).toBe('Error')
    expect(output.error_message).toBe('test error')
    expect(output.stack).toBeDefined()
  })

  it('logs error messages with non-Error objects', () => {
    logger.error('something failed', 'string error')
    const output = JSON.parse(consoleSpy.error.mock.calls[0][0])
    expect(output.error).toBe('string error')
  })

  it('includes context in output', () => {
    logger.info('user action', { userId: '123', action: 'login' })
    const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
    expect(output.userId).toBe('123')
    expect(output.action).toBe('login')
  })

  it('debug only logs in development', () => {
    const env = process.env as Record<string, string | undefined>
    const originalEnv = env.NODE_ENV

    env.NODE_ENV = 'development'
    logger.debug('debug msg')
    expect(consoleSpy.debug).toHaveBeenCalledOnce()

    consoleSpy.debug.mockClear()
    env.NODE_ENV = 'production'
    logger.debug('debug msg')
    expect(consoleSpy.debug).not.toHaveBeenCalled()

    env.NODE_ENV = originalEnv
  })
})
