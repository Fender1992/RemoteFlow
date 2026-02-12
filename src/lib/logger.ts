type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }
  return JSON.stringify(entry)
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatLog('debug', message, context))
    }
  },

  info(message: string, context?: LogContext) {
    console.log(formatLog('info', message, context))
  },

  warn(message: string, context?: LogContext) {
    console.warn(formatLog('warn', message, context))
  },

  error(message: string, error?: unknown, context?: LogContext) {
    const errorContext: LogContext = { ...context }
    if (error instanceof Error) {
      errorContext.error_name = error.name
      errorContext.error_message = error.message
      errorContext.stack = error.stack
    } else if (error !== undefined) {
      errorContext.error = String(error)
    }
    console.error(formatLog('error', message, errorContext))
  },
}
