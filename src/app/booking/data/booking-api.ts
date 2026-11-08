import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { ifMatch, versioned, type Versioned } from '../../shared/util/etag'
import { API_PATH, body, call } from '../../shared/util/http'
import { pageParams, type Page } from '../../shared/util/page'
import type { components } from '../model/api.generated'
import type { Appointment, AppointmentFilter } from '../model/appointment'
import { localDateTime } from '../model/calendar'

type Schemas = components['schemas']

export interface BookingRequest {
  serviceId: string
  date: string
  time: string
}

const APPOINTMENTS = `${API_PATH}/appointments`

/** Booking API for customers: availability, booking, and the customer's own appointments. */
@Injectable({ providedIn: 'root' })
export class BookingApi {
  private readonly http = inject(HttpClient)

  /** Dates with at least one open time in [from, to] (at most 31 days). */
  async availableDays(serviceId: string, from: string, to: string): Promise<string[]> {
    const params = new HttpParams({ fromObject: { serviceId, from, to } })
    const response = await call(
      this.http.get<Schemas['AvailableDaysResponse']>(`${API_PATH}/availability/days`, { params, observe: 'response' }),
    )
    return body(response).dates
  }

  /** Open start times on one date, in branch-local time. Never cached: each call asks the server again (spec 4.5). */
  async openTimes(serviceId: string, date: string): Promise<string[]> {
    const params = new HttpParams({ fromObject: { serviceId, date } })
    const response = await call(
      this.http.get<Schemas['AvailabilityResponse']>(`${API_PATH}/availability`, { params, observe: 'response' }),
    )
    return body(response).openTimes
  }

  /** Books an appointment. Every attempt from one confirm step sends the same idempotency key, so it books once. */
  async book(request: BookingRequest, idempotencyKey: string): Promise<Versioned<Appointment>> {
    const payload: Schemas['BookingRequest'] = {
      serviceId: request.serviceId,
      start: localDateTime(request.date, request.time),
    }
    return versioned(
      await call(
        this.http.post<Appointment>(APPOINTMENTS, payload, {
          observe: 'response',
          headers: { 'Idempotency-Key': idempotencyKey },
        }),
      ),
    )
  }

  /** One page of the customer's upcoming (soonest first) or past (latest first) appointments. */
  async mine(filter: AppointmentFilter, page = 0): Promise<Page<Appointment>> {
    const params = pageParams(new HttpParams({ fromObject: { filter } }), page)
    return body(await call(this.http.get<Page<Appointment>>(`${APPOINTMENTS}/mine`, { params, observe: 'response' })))
  }

  async myAppointment(reference: string): Promise<Versioned<Appointment>> {
    return versioned(
      await call(
        this.http.get<Appointment>(`${APPOINTMENTS}/mine/${encodeURIComponent(reference)}`, { observe: 'response' }),
      ),
    )
  }

  async reschedule(current: Versioned<Appointment>, date: string, time: string): Promise<Versioned<Appointment>> {
    const payload: Schemas['RescheduleRequest'] = { start: localDateTime(date, time) }
    return versioned(
      await call(
        this.http.post<Appointment>(
          `${APPOINTMENTS}/mine/${encodeURIComponent(current.value.reference)}/reschedule`,
          payload,
          { observe: 'response', headers: ifMatch(current) },
        ),
      ),
    )
  }

  async cancel(current: Versioned<Appointment>): Promise<Versioned<Appointment>> {
    return versioned(
      await call(
        this.http.post<Appointment>(
          `${APPOINTMENTS}/mine/${encodeURIComponent(current.value.reference)}/cancel`,
          null,
          { observe: 'response', headers: ifMatch(current) },
        ),
      ),
    )
  }
}
