import { describe, expect, it } from 'vitest'
import { currentStep, reopen, selectionFromQuery, selectionToQuery } from './selection'

const SERVICE = '44ffcdb9-ba9e-4fad-8d41-d3dfbccacabc'

describe('booking selection in the page address', () => {
  it('FE-6 a selection survives a round trip through the query, as after returning from Keycloak', () => {
    const selection = { serviceId: SERVICE, date: '2026-10-14', time: '10:00:00' }
    const query = selectionToQuery(selection)
    // What the browser gives back after the redirect: the same query string, parsed again
    const reparsed = Object.fromEntries(new URLSearchParams(new URLSearchParams(query).toString()))
    expect(selectionFromQuery(reparsed)).toEqual(selection)
    expect(currentStep(selectionFromQuery(reparsed))).toBe('confirm')
  })

  it('FE-6 steps follow service, date, time, confirm', () => {
    expect(currentStep({})).toBe('service')
    expect(currentStep({ serviceId: SERVICE })).toBe('date')
    expect(currentStep({ serviceId: SERVICE, date: '2026-10-14' })).toBe('time')
  })

  it('FE-6 malformed or out-of-order values are ignored', () => {
    expect(selectionFromQuery({ service: 'x', date: '2026-10-14' })).toEqual({
      serviceId: undefined,
      date: undefined,
      time: undefined,
    })
    expect(selectionFromQuery({ service: SERVICE, time: '10:00' }).time).toBeUndefined()
  })

  it('FE-6 changing a step clears what depends on it', () => {
    const full = { serviceId: SERVICE, date: '2026-10-14', time: '10:00' }
    expect(reopen(full, 'time')).toEqual({ ...full, time: undefined })
    expect(reopen(full, 'date')).toEqual({ serviceId: SERVICE })
    expect(reopen(full, 'service')).toEqual({})
  })
})
