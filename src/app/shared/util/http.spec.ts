import { describe, expect, it } from 'vitest'
import { API_PATH, isApiUrl } from './http'

describe('API address', () => {
  const origin = 'http://localhost:4200'

  it('FE-2 only requests to the API on the app origin count as API requests', () => {
    expect(isApiUrl('/api/v1/me', origin)).toBe(true)
    expect(isApiUrl('http://localhost:4200/api/v1/branch', origin)).toBe(true)
    expect(isApiUrl('/api/v2/branch', origin)).toBe(true)
    expect(isApiUrl('/i18n/en.json', origin)).toBe(false)
    expect(isApiUrl('/apis/other', origin)).toBe(false)
    expect(isApiUrl('https://evil.test/api/me', origin)).toBe(false)
    expect(isApiUrl('http://localhost:8180/realms/appointments/api', origin)).toBe(false)
  })

  it('FE-2 the app calls version 1 of the API', () => {
    expect(API_PATH).toBe('/api/v1')
  })
})
