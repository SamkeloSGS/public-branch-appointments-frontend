import type { HttpHeaders } from '@angular/common/http'

/** RFC 9457 Problem Details as the API sends them. `code` is set on business rule rejections. */
export interface Problem {
  type?: string
  title?: string
  status?: number
  detail?: string
  code?: string
  [extension: string]: unknown
}

/** One invalid field of a 400: the body property path, query parameter or header, and why (English). */
export interface FieldProblem {
  /** Absent for a rule across fields */
  field?: string
  message: string
}

/** The invalid fields a 400 names in its `errors` list; empty for any other error. */
export function fieldProblems(error: unknown): FieldProblem[] {
  if (!isApiError(error) || error.status !== 400 || !Array.isArray(error.problem['errors'])) return []
  return (error.problem['errors'] as unknown[]).filter(
    (it): it is FieldProblem => !!it && typeof it === 'object' && typeof (it as FieldProblem).message === 'string',
  )
}

export function problemFrom(body: unknown): Problem {
  return body && typeof body === 'object' ? (body as Problem) : {}
}

export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem
  readonly headers: HttpHeaders | undefined
  readonly isNetworkError: boolean

  constructor(status: number, problem: Problem, headers?: HttpHeaders, isNetworkError = false) {
    super(problem.detail ?? problem.title ?? (isNetworkError ? 'Network failure' : `HTTP ${status}`))
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
    this.headers = headers
    this.isNetworkError = isNetworkError
  }

  static network(cause: unknown): ApiError {
    const error = new ApiError(0, {}, undefined, true)
    error.cause = cause
    return error
  }

  get code(): string | undefined {
    return this.problem.code
  }

  get isStale(): boolean {
    return this.status === 412 || this.status === 428
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function hasCode(error: unknown, code: string): error is ApiError {
  return isApiError(error) && error.code === code
}

/** Translation keys for a domain's error codes, e.g. `{ SLOT_UNAVAILABLE: 'booking.errors.SLOT_UNAVAILABLE' }`. */
export type ErrorMessages = Readonly<Record<string, string>>

export interface ErrorDescription {
  /** Translation key of the message to show */
  key: string
  /** Whether trying again may help; shown with a retry option */
  retryable: boolean
}

/**
 * Maps an error to a user-facing message: the domain's message for its code first, then a message for the status,
 * then a generic message with a retry option.
 */
export function describeError(error: unknown, messages: ErrorMessages = {}): ErrorDescription {
  if (!isApiError(error)) return { key: 'errors.generic', retryable: true }
  if (error.isNetworkError) return { key: 'errors.network', retryable: true }
  const forCode = error.code ? messages[error.code] : undefined
  if (forCode) return { key: forCode, retryable: false }
  switch (error.status) {
    case 400:
      return { key: 'errors.invalid', retryable: false }
    case 401:
      return { key: 'errors.signInRequired', retryable: false }
    case 403:
      return { key: 'errors.forbidden', retryable: false }
    case 404:
      return { key: 'errors.notFound', retryable: false }
    case 409:
      return { key: 'errors.conflict', retryable: false }
    case 412:
    case 428:
      return { key: 'errors.stale', retryable: false }
    default:
      return { key: 'errors.generic', retryable: true }
  }
}
