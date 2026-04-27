export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError }

export type AppError = {
  code: ErrorCode
  message: string
  details?: unknown
}

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  TICKET_ALREADY_OPEN: 'TICKET_ALREADY_OPEN',
  INTEGRATION_FAILED: 'INTEGRATION_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

export const errorMessages: Record<ErrorCode, string> = {
  UNAUTHORIZED: 'You need to sign in to continue.',
  FORBIDDEN: "You don't have access to this resource.",
  QUOTA_EXCEEDED:
    "You've used all your weekly request tickets for this tier. Your next one becomes available Monday.",
  TICKET_ALREADY_OPEN:
    'Please close your current open ticket of this type before opening a new one.',
  INTEGRATION_FAILED:
    "We couldn't reach this service. Try again, or contact support if it persists.",
  VALIDATION_FAILED: 'Some of the information looks off. Check the highlighted fields.',
  NOT_FOUND: "We couldn't find what you were looking for.",
  RATE_LIMITED: 'Too many requests right now. Wait a moment and try again.',
  INTERNAL: "Something went wrong on our end. We've been notified.",
}

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err(code: ErrorCode, message?: string, details?: unknown): Result<never> {
  return { ok: false, error: { code, message: message ?? errorMessages[code], details } }
}

export function lookupMessage(error: AppError): string {
  return error.message ?? errorMessages[error.code] ?? errorMessages.INTERNAL
}
