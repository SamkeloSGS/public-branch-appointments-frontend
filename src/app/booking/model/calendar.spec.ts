import { describe, expect, it } from 'vitest'
import { addDays, addMonths, datesOfMonth, firstOfMonth, lastOfMonth, localDateTime, todayIn, weekdayIndex } from './calendar'

describe('branch-local dates', () => {
  it('FE-16 today is taken in the branch zone, not the browser zone', () => {
    // 23:30 in New York on the 13th is already the 14th in Johannesburg
    const now = new Date('2026-10-14T03:30:00Z')
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/New_York')
    expect(todayIn('Africa/Johannesburg', now)).toBe('2026-10-14')
    expect(todayIn('America/New_York', now)).toBe('2026-10-13')
  })

  it('FE-16 date arithmetic does not shift across zones or daylight saving', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02') // the browser zone's DST change
    expect(firstOfMonth('2026-02-17')).toBe('2026-02-01')
    expect(lastOfMonth('2028-02-03')).toBe('2028-02-29')
  })

  it('FE-16 the start sent to the API is the branch-local date and time, never converted', () => {
    expect(localDateTime('2026-10-14', '10:00')).toBe('2026-10-14T10:00:00')
    expect(localDateTime('2026-10-14', '10:00:00')).toBe('2026-10-14T10:00:00')
  })

  it('FE-6 the day picker lays out a month from Monday', () => {
    expect(weekdayIndex('2026-10-12')).toBe(0) // a Monday
    expect(weekdayIndex('2026-10-18')).toBe(6) // a Sunday
    expect(datesOfMonth('2026-02-10')).toHaveLength(28)
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01')
  })
})
