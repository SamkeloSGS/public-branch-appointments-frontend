import { describe, expect, it } from 'vitest'
import { contactDetailsRequest, contactDetailsValues, hasContactFor, hasSomeContact, isLastChannel } from './customer'

describe('customer profile rules', () => {
  it('FE-8 the last enabled channel cannot be switched off', () => {
    expect(isLastChannel({ emailEnabled: true, smsEnabled: false, language: 'en' }, 'email')).toBe(true)
    expect(isLastChannel({ emailEnabled: true, smsEnabled: true, language: 'en' }, 'email')).toBe(false)
    expect(isLastChannel({ emailEnabled: false, smsEnabled: true, language: 'en' }, 'sms')).toBe(true)
  })

  it('FE-8 a channel needs its contact detail', () => {
    expect(hasContactFor({ email: 'a@b.test', phone: null }, 'sms')).toBe(false)
    expect(hasContactFor({ email: 'a@b.test', phone: null }, 'email')).toBe(true)
  })

  it('FE-4 the email from the sign-in identity pre-fills the profile', () => {
    expect(contactDetailsValues(undefined, 'customer@appointments.test').email).toBe('customer@appointments.test')
  })

  it('FE-4 at least an email or a phone is required', () => {
    expect(hasSomeContact({ email: '', phone: ' ' })).toBe(false)
    expect(hasSomeContact({ email: '', phone: '+27 82 555 0101' })).toBe(true)
  })

  it('FE-4 blank optional contact details are not sent', () => {
    const values = { givenName: ' Thandi ', familyName: 'Customer', email: '', phone: '+27 82 555 0101', language: 'en' as const }
    expect(contactDetailsRequest(values)).toEqual({
      givenName: 'Thandi',
      familyName: 'Customer',
      email: undefined,
      phone: '+27 82 555 0101',
    })
  })
})

describe('staff customer search', () => {
  it('FE-10 search needs at least 3 characters', async () => {
    const { isSearchable } = await import('./customer')
    expect(isSearchable('ab ')).toBe(false)
    expect(isSearchable('abc')).toBe(true)
  })

  it('FE-10 an email clash names the existing customer', async () => {
    const { existingCustomerId } = await import('./customer')
    expect(existingCustomerId({ code: 'EMAIL_IN_USE', existingCustomerId: 'c-1' })).toBe('c-1')
    expect(existingCustomerId({ code: 'EMAIL_IN_USE' })).toBeUndefined()
  })
})
