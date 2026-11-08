import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { ifMatch, versioned, type Versioned } from '../../shared/util/etag'
import { API_PATH, body, call } from '../../shared/util/http'
import { pageParams, type Page } from '../../shared/util/page'
import type { components } from '../model/api.generated'
import type { Appointment } from '../model/appointment'
import { localDateTime } from '../model/calendar'
import type {
  DayListEntry,
  Impact,
  ImpactPreviewRequest,
  Notification,
  NotificationStatus,
  OverbookedDay,
} from '../model/staff-actions'

type Schemas = components['schemas']

const ADMIN = `${API_PATH}/admin`
const segment = (value: string) => encodeURIComponent(value)

/** Status changes staff make on one appointment; each sends the version as If-Match. */
export type StatusAction = 'check-in' | 'complete' | 'no-show' | 'cancel' | 'displace'

/** Booking and notification API for staff (spec 6). */
@Injectable({ providedIn: 'root' })
export class BookingAdminApi {
  private readonly http = inject(HttpClient)

  /** The branch's appointments on a date, by start, with customer names. */
  async dayList(date: string): Promise<DayListEntry[]> {
    const params = new HttpParams({ fromObject: { date } })
    return body(await call(this.http.get<DayListEntry[]>(`${ADMIN}/appointments`, { params, observe: 'response' })))
  }

  async appointment(id: string): Promise<Versioned<Appointment>> {
    return versioned(await call(this.http.get<Appointment>(`${ADMIN}/appointments/${segment(id)}`, { observe: 'response' })))
  }

  /** Finds an appointment by booking reference. */
  async byReference(reference: string): Promise<Appointment> {
    const params = new HttpParams({ fromObject: { reference } })
    return body(await call(this.http.get<Appointment>(`${ADMIN}/appointments`, { params, observe: 'response' })))
  }

  async changeStatus(current: Versioned<Appointment>, action: StatusAction): Promise<Versioned<Appointment>> {
    return versioned(
      await call(
        this.http.post<Appointment>(`${ADMIN}/appointments/${segment(current.value.id)}/${action}`, null, {
          observe: 'response',
          headers: ifMatch(current),
        }),
      ),
    )
  }

  /** Moves the appointment to another open time; staff are not bound by the cutoff. */
  async reschedule(current: Versioned<Appointment>, date: string, time: string): Promise<Versioned<Appointment>> {
    const payload: Schemas['RescheduleRequest'] = { start: localDateTime(date, time) }
    return versioned(
      await call(
        this.http.post<Appointment>(`${ADMIN}/appointments/${segment(current.value.id)}/reschedule`, payload, {
          observe: 'response',
          headers: ifMatch(current),
        }),
      ),
    )
  }

  /** Books for a customer. One idempotency key per confirm step, so a second submit books once. */
  async bookForCustomer(
    request: { customerId: string; serviceId: string; date: string; time: string },
    idempotencyKey: string,
  ): Promise<Appointment> {
    const payload: Schemas['StaffBookingRequest'] = {
      customerId: request.customerId,
      serviceId: request.serviceId,
      start: localDateTime(request.date, request.time),
    }
    return body(
      await call(
        this.http.post<Appointment>(`${ADMIN}/appointments`, payload, {
          observe: 'response',
          headers: { 'Idempotency-Key': idempotencyKey },
        }),
      ),
    )
  }

  /** Overbooked pool days in [from, to] (at most 92 days), with the appointments in each overbooked interval. */
  async overbooked(from: string, to: string): Promise<OverbookedDay[]> {
    const params = new HttpParams({ fromObject: { from, to } })
    return body(await call(this.http.get<OverbookedDay[]>(`${ADMIN}/overbooked`, { params, observe: 'response' })))
  }

  /** What a schedule change would do, without changing anything (spec 6). */
  async scheduleImpact(request: ImpactPreviewRequest): Promise<Impact> {
    return body(await call(this.http.post<Impact>(`${ADMIN}/schedule-impact`, request, { observe: 'response' })))
  }

  async appointmentNotifications(appointmentId: string): Promise<Notification[]> {
    return body(
      await call(
        this.http.get<Notification[]>(`${ADMIN}/appointments/${segment(appointmentId)}/notifications`, {
          observe: 'response',
        }),
      ),
    )
  }

  /** One page of the notifications created in a period (default: the last 30 days), newest first. */
  async notifications(
    filter: { status?: NotificationStatus; from?: string; to?: string } = {},
    page = 0,
  ): Promise<Page<Notification>> {
    let params = pageParams(new HttpParams(), page)
    for (const [key, value] of Object.entries(filter)) if (value) params = params.set(key, value)
    return body(await call(this.http.get<Page<Notification>>(`${ADMIN}/notifications`, { params, observe: 'response' })))
  }

  /** Sends a notification again; the answer is the new, pending notification. */
  async resend(notificationId: string): Promise<Notification> {
    return body(
      await call(
        this.http.post<Notification>(`${ADMIN}/notifications/${segment(notificationId)}/resend`, null, {
          observe: 'response',
        }),
      ),
    )
  }
}
