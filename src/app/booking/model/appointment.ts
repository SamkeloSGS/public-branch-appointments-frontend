import type { components } from './api.generated'

type Schemas = components['schemas']
export type Appointment = Schemas['AppointmentResponse']
export type AppointmentStatus = Appointment['status']
export type AppointmentFilter = 'upcoming' | 'past'

/** Statuses a customer may reschedule or cancel from; the server checks again. */
const CHANGEABLE: readonly AppointmentStatus[] = ['BOOKED', 'REBOOKING_REQUIRED']

export function isChangeable(appointment: Pick<Appointment, 'status'>): boolean {
  return CHANGEABLE.includes(appointment.status)
}

export function needsRebooking(appointment: Pick<Appointment, 'status'>): boolean {
  return appointment.status === 'REBOOKING_REQUIRED'
}

/**
 * Whether a booked appointment is past the online change cutoff. Used only to explain up front why reschedule and
 * cancel are unavailable; appointments that need rebooking are exempt, as on the server.
 */
export function isPastCutoff(
  appointment: Pick<Appointment, 'status' | 'startsAt'>,
  cutoffMinutes: number,
  now: Date = new Date(),
): boolean {
  if (appointment.status !== 'BOOKED') return false
  return now.getTime() >= new Date(appointment.startsAt).getTime() - cutoffMinutes * 60_000
}

/** Appointments needing a new time first, then by start. */
export function orderForDisplay(appointments: readonly Appointment[], filter: AppointmentFilter): Appointment[] {
  return [...appointments].sort((a, b) => {
    if (filter === 'upcoming' && needsRebooking(a) !== needsRebooking(b)) return needsRebooking(a) ? -1 : 1
    const byStart = a.startsAt.localeCompare(b.startsAt)
    return filter === 'upcoming' ? byStart : -byStart
  })
}

/** Translation keys for the booking module's error codes (spec section 7). */
export const bookingErrorMessages = {
  SLOT_UNAVAILABLE: 'booking.errors.SLOT_UNAVAILABLE',
  OUTSIDE_BOOKING_WINDOW: 'booking.errors.OUTSIDE_BOOKING_WINDOW',
  OFFERING_UNAVAILABLE: 'booking.errors.OFFERING_UNAVAILABLE',
  CUSTOMER_INACTIVE: 'booking.errors.CUSTOMER_INACTIVE',
  OVERLAPPING_APPOINTMENT: 'booking.errors.OVERLAPPING_APPOINTMENT',
  TOO_MANY_APPOINTMENTS: 'booking.errors.TOO_MANY_APPOINTMENTS',
  PAST_CUTOFF: 'booking.errors.PAST_CUTOFF',
  INVALID_STATE: 'booking.errors.INVALID_STATE',
} as const

/** The same codes in staff wording, for screens where staff act for a customer. */
export const staffBookingErrorMessages = {
  ...bookingErrorMessages,
  CUSTOMER_INACTIVE: 'admin.bookingErrors.CUSTOMER_INACTIVE',
  OVERLAPPING_APPOINTMENT: 'admin.bookingErrors.OVERLAPPING_APPOINTMENT',
  TOO_MANY_APPOINTMENTS: 'admin.bookingErrors.TOO_MANY_APPOINTMENTS',
} as const
