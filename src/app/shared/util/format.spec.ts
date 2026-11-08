import { describe, expect, it } from 'vitest'
import { formatDate, formatInstant, formatTime, zoneName } from './format'

describe('display formatting in the branch zone', () => {
  it('FE-16 branch-local times are shown as given, whatever the browser zone', () => {
    expect(formatTime('10:00:00', 'en-ZA')).toBe('10:00')
    expect(formatDate('2026-10-14', 'en-ZA')).toBe('Wednesday, 14 October 2026')
  })

  it('FE-16 instants are shown in the named zone, with the zone named', () => {
    const instant = '2026-10-14T08:00:00Z'
    expect(formatInstant(instant, 'Africa/Johannesburg', 'en-ZA')).toContain('10:00')
    expect(formatInstant(instant, 'America/New_York', 'en-ZA')).toContain('04:00')
    expect(zoneName('Africa/Johannesburg', 'en-ZA')).toBe('South Africa Standard Time')
  })
})
