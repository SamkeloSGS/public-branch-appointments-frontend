import type { components } from './api.generated'
import type { Appointment } from './appointment'

type Schemas = components['schemas']
export type DayListEntry = Schemas['DayListEntryResponse']
export type OverbookedDay = Schemas['OverbookedDayResponse']
export type OverbookedInterval = Schemas['Interval']
export type ImpactPreviewRequest = Schemas['ImpactPreviewRequest']
export type Impact = Schemas['ImpactResponse']
export type Notification = Schemas['NotificationResponse']
export type NotificationStatus = Notification['status']
export type Delivery = Schemas['DeliveryResponse']

/** What staff can do with an appointment (spec 6, FE-9). */
export type StaffAction = 'checkIn' | 'complete' | 'noShow' | 'reschedule' | 'cancel'

export interface StaffActionContext {
  /** Today in the branch's zone, yyyy-MM-dd */
  today: string
  now: Date
  /** Minutes after the start from which a no-show may be recorded */
  noShowGraceMinutes: number
}

/**
 * The actions valid for the appointment's status and the current time. Only a convenience: the server checks each
 * action again and its answer is shown.
 */
export function staffActions(appointment: Appointment, context: StaffActionContext): StaffAction[] {
  switch (appointment.status) {
    case 'BOOKED': {
      const actions: StaffAction[] = []
      if (appointment.date === context.today) actions.push('checkIn')
      const graceOver =
        context.now.getTime() >= new Date(appointment.startsAt).getTime() + context.noShowGraceMinutes * 60_000
      if (graceOver) actions.push('noShow')
      actions.push('reschedule', 'cancel')
      return actions
    }
    case 'CHECKED_IN':
      return ['complete']
    case 'REBOOKING_REQUIRED':
      return ['reschedule', 'cancel']
    default:
      return []
  }
}

/** Day list order: by start time (FE-9). */
export function byStart(entries: readonly DayListEntry[]): DayListEntry[] {
  return [...entries].sort((a, b) => a.appointment.startsAt.localeCompare(b.appointment.startsAt))
}

/** Replaces one appointment in the day list with the server's answer, keeping the customer's name. */
export function replaceInDayList(entries: readonly DayListEntry[], updated: Appointment): DayListEntry[] {
  return entries.map((entry) => (entry.appointment.id === updated.id ? { ...entry, appointment: updated } : entry))
}

/** A notification that staff may send again. */
export function canResend(notification: Pick<Notification, 'status'>): boolean {
  return notification.status === 'FAILED' || notification.status === 'SENT' || notification.status === 'SKIPPED'
}

/** Whether an impact preview needs the admin's confirmation before saving (spec 6, FE-11). */
export function impactNeedsConfirmation(impact: Impact): boolean {
  return impact.displacedAppointments > 0 || impact.overbookedIntervals > 0
}
