import { describe, expect, it } from 'vitest'
import { isChangeable, isPastCutoff, orderForDisplay, type Appointment, type AppointmentStatus } from './appointment'

function appointment(status: AppointmentStatus, startsAt = '2026-10-14T08:00:00Z'): Appointment {
  return {
    id: crypto.randomUUID(),
    reference: status,
    customerId: 'c',
    serviceId: 's',
    date: startsAt.slice(0, 10),
    startTime: '10:00:00',
    endTime: '10:30:00',
    startsAt,
    endsAt: startsAt,
    status,
    bookedBy: 'CUSTOMER',
    closedReason: null,
    version: 0,
  }
}

describe('appointment rules shown to customers', () => {
  it('FE-7 reschedule and cancel are offered only for booked and rebooking-required appointments', () => {
    const offered = (['BOOKED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW', 'REBOOKING_REQUIRED', 'CANCELLED'] as const).filter(
      (status) => isChangeable(appointment(status)),
    )
    expect(offered).toEqual(['BOOKED', 'REBOOKING_REQUIRED'])
  })

  it('FE-7 a booked appointment inside the cutoff is past it; rebooking-required ones are exempt', () => {
    const now = new Date('2026-10-14T07:30:00Z')
    expect(isPastCutoff(appointment('BOOKED', '2026-10-14T08:00:00Z'), 60, now)).toBe(true)
    expect(isPastCutoff(appointment('BOOKED', '2026-10-14T09:00:00Z'), 60, now)).toBe(false)
    expect(isPastCutoff(appointment('REBOOKING_REQUIRED', '2026-10-14T08:00:00Z'), 60, now)).toBe(false)
  })

  it('FE-7 appointments needing a new time are listed first among upcoming ones', () => {
    const ordered = orderForDisplay(
      [
        appointment('BOOKED', '2026-10-14T08:00:00Z'),
        appointment('REBOOKING_REQUIRED', '2026-10-20T08:00:00Z'),
        appointment('BOOKED', '2026-10-13T08:00:00Z'),
      ],
      'upcoming',
    )
    expect(ordered.map((item) => [item.status, item.startsAt.slice(0, 10)])).toEqual([
      ['REBOOKING_REQUIRED', '2026-10-20'],
      ['BOOKED', '2026-10-13'],
      ['BOOKED', '2026-10-14'],
    ])
  })
})
