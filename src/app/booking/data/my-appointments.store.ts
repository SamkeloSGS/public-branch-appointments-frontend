import { Injectable, inject, signal } from '@angular/core'
import { appendPage, hasNextPage } from '../../shared/util/page'
import type { Appointment, AppointmentFilter } from '../model/appointment'
import { BookingApi } from './booking-api'

export interface AppointmentList {
  /** The pages loaded so far, in the server's order */
  items: Appointment[]
  /** The last page loaded, counting from 0 */
  page: number
  totalItems: number
  hasMore: boolean
  loaded: boolean
  loading: boolean
  error: unknown
}

const emptyList = (): AppointmentList => ({
  items: [],
  page: 0,
  totalItems: 0,
  hasMore: false,
  loaded: false,
  loading: false,
  error: undefined,
})

/**
 * The customer's upcoming and past appointments, a page at a time. Changes come only from the server's answers (no
 * optimistic updates). Provided on the booking routes, so leaving the customer's booking screens discards it (spec 4.5).
 */
@Injectable()
export class MyAppointmentsStore {
  private readonly api = inject(BookingApi)
  readonly lists = signal<Record<AppointmentFilter, AppointmentList>>({ upcoming: emptyList(), past: emptyList() })

  private patch(filter: AppointmentFilter, change: Partial<AppointmentList>): void {
    this.lists.update((lists) => ({ ...lists, [filter]: { ...lists[filter], ...change } }))
  }

  /** The first page, replacing what was loaded. */
  async load(filter: AppointmentFilter): Promise<void> {
    await this.fetch(filter, 0, [])
  }

  /** The next page, added after the appointments already shown. */
  async loadMore(filter: AppointmentFilter): Promise<void> {
    const list = this.lists()[filter]
    if (!list.hasMore || list.loading) return
    await this.fetch(filter, list.page + 1, list.items)
  }

  async ensureLoaded(filter: AppointmentFilter): Promise<void> {
    if (!this.lists()[filter].loaded) await this.load(filter)
  }

  /** After a booking, reschedule or cancel the lists are stale; they reload from the first page when next shown. */
  invalidate(): void {
    this.patch('upcoming', { loaded: false })
    this.patch('past', { loaded: false })
  }

  private async fetch(filter: AppointmentFilter, page: number, shown: Appointment[]): Promise<void> {
    this.patch(filter, { loading: true, error: undefined })
    try {
      const next = appendPage(shown, await this.api.mine(filter, page))
      this.patch(filter, {
        items: next.items,
        page: next.page,
        totalItems: next.totalItems,
        hasMore: hasNextPage(next),
        loaded: true,
      })
    } catch (error) {
      this.patch(filter, { error })
    } finally {
      this.patch(filter, { loading: false })
    }
  }
}
