import { describe, expect, it } from 'vitest'
import type { Appointment, AppointmentStatus } from './appointment'
import { byStart, canResend, impactNeedsConfirmation, replaceInDayList, staffActions } from './staff-actions'

function appointment(status: AppointmentStatus, startsAt = '2026-10-14T08:00:00Z', date = '2026-10-14'): Appointment {
  return {
    id: startsAt,
    reference: 'REF',
    customerId: 'c',
    serviceId: 's',
    date,
    startTime: '10:00:00',
    endTime: '10:30:00',
    startsAt,
    endsAt: startsAt,
    status,
    bookedBy: 'STAFF',
    closedReason: null,
    version: 3,
  }
}

const context = (now: string, today = '2026-10-14') => ({ today, now: new Date(now), noShowGraceMinutes: 15 })

describe('staff actions', () => {
  it('FE-9 a booked appointment can be checked in on its date only', () => {
    expect(staffActions(appointment('BOOKED'), context('2026-10-14T07:00:00Z'))).toContain('checkIn')
    expect(staffActions(appointment('BOOKED'), context('2026-10-13T07:00:00Z', '2026-10-13'))).not.toContain('checkIn')
  })

  it('FE-9 a no-show can be recorded only after the grace period', () => {
    expect(staffActions(appointment('BOOKED'), context('2026-10-14T08:10:00Z'))).not.toContain('noShow')
    expect(staffActions(appointment('BOOKED'), context('2026-10-14T08:15:00Z'))).toContain('noShow')
  })

  it('FE-9 only a checked-in appointment can be completed; closed ones offer nothing', () => {
    expect(staffActions(appointment('CHECKED_IN'), context('2026-10-14T08:00:00Z'))).toEqual(['complete'])
    expect(staffActions(appointment('COMPLETED'), context('2026-10-14T08:00:00Z'))).toEqual([])
    expect(staffActions(appointment('CANCELLED'), context('2026-10-14T08:00:00Z'))).toEqual([])
    expect(staffActions(appointment('REBOOKING_REQUIRED'), context('2026-10-14T08:00:00Z'))).toEqual(['reschedule', 'cancel'])
  })

  it('FE-9 the day list is by start time and a row takes the server answer', () => {
    const late = { appointment: appointment('BOOKED', '2026-10-14T12:00:00Z'), customerName: 'B' }
    const early = { appointment: appointment('BOOKED', '2026-10-14T08:00:00Z'), customerName: 'A' }
    expect(byStart([late, early]).map((entry) => entry.customerName)).toEqual(['A', 'B'])
    const updated = { ...early.appointment, status: 'CHECKED_IN' as const, version: 4 }
    const list = replaceInDayList([late, early], updated)
    expect(list[1]).toEqual({ appointment: updated, customerName: 'A' })
  })

  it('FE-14 failed, sent and skipped notifications can be sent again', () => {
    expect(canResend({ status: 'FAILED' })).toBe(true)
    expect(canResend({ status: 'PENDING' })).toBe(false)
  })

  it('FE-11 a non-zero impact needs confirmation', () => {
    expect(impactNeedsConfirmation({ displacedAppointments: 0, overbookedIntervals: 0 })).toBe(false)
    expect(impactNeedsConfirmation({ displacedAppointments: 0, overbookedIntervals: 1 })).toBe(true)
  })
})
