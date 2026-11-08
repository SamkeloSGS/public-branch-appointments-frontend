import { describe, expect, it } from 'vitest'
import { ApiError, describeError, fieldProblems } from './problem'
import { errorView } from './error-view'

describe('error mapper', () => {
  const messages = { SLOT_UNAVAILABLE: 'booking.errors.SLOT_UNAVAILABLE' }

  it('FE-6 a code the domain knows gets its own message', () => {
    const error = new ApiError(409, { title: 'Booking rejected', code: 'SLOT_UNAVAILABLE' })
    expect(describeError(error, messages)).toEqual({ key: 'booking.errors.SLOT_UNAVAILABLE', retryable: false })
  })

  it('FE-15 a stale version (412) or missing If-Match (428) says the record changed', () => {
    expect(describeError(new ApiError(412, {})).key).toBe('errors.stale')
    expect(describeError(new ApiError(428, {})).key).toBe('errors.stale')
    expect(new ApiError(412, {}).isStale).toBe(true)
  })

  it('FE-15 a network failure and unknown errors offer a retry', () => {
    expect(describeError(ApiError.network(new TypeError('Failed to fetch')))).toEqual({ key: 'errors.network', retryable: true })
    expect(describeError(new ApiError(500, {}))).toEqual({ key: 'errors.generic', retryable: true })
    expect(describeError(new Error('boom'))).toEqual({ key: 'errors.generic', retryable: true })
  })

  it('FE-3 a 403 is shown as the not-allowed state', () => {
    expect(errorView(new ApiError(403, {})).forbidden).toBe(true)
    expect(errorView(new ApiError(404, {})).forbidden).toBe(false)
  })

  it('FE-13 staff screens show the reason the server gives for a rejected change', () => {
    const rejected = new ApiError(409, { detail: 'Branch cannot be activated, missing: weekly hours, an active offering' })
    expect(errorView(rejected, {}, { serverDetail: true }).serverMessage).toBe(
      'Branch cannot be activated, missing: weekly hours, an active offering',
    )
    expect(errorView(rejected).serverMessage).toBeUndefined()
    expect(errorView(new ApiError(500, { detail: 'stack trace' }), {}, { serverDetail: true }).serverMessage).toBeUndefined()
  })

  it('FE-13 staff screens list the invalid fields a 400 names', () => {
    const invalid = new ApiError(400, {
      title: 'Invalid request',
      detail: '2 fields are invalid',
      errors: [{ field: 'givenName', message: 'must not be blank' }, { message: 'dates must be in order' }, 'junk'],
    })
    expect(fieldProblems(invalid)).toEqual([
      { field: 'givenName', message: 'must not be blank' },
      { message: 'dates must be in order' },
    ])
    expect(errorView(invalid, {}, { serverDetail: true }).fields).toHaveLength(2)
    expect(errorView(invalid).fields).toBeUndefined()
    expect(fieldProblems(new ApiError(409, { errors: [{ message: 'x' }] }))).toEqual([])
  })
})
