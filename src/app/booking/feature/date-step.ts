import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core'
import { TranslatePipe } from '@ngx-translate/core'
import { ErrorPanel } from '../../shared/ui/error-panel'
import { ZoneNote } from '../../shared/ui/zone-note'
import { addDays, earlier, firstOfMonth, lastOfMonth, later, todayIn } from '../model/calendar'
import { BookingApi } from '../data/booking-api'
import { DayPicker } from '../ui/day-picker'

/** Step 3: a date. Days without open times are marked unavailable, from GET /availability/days for the month shown. */
@Component({
  selector: 'app-date-step',
  imports: [DayPicker, ErrorPanel, TranslatePipe, ZoneNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>{{ 'booking.date.title' | translate }}</h2>
    <app-zone-note [timeZone]="timeZone()" />
    <app-error-panel [error]="error()" (retry)="load()" />
    <app-day-picker
      [today]="today()"
      [month]="month()"
      [availableDates]="dates()"
      [selected]="selected()"
      [loading]="loading()"
      [label]="'booking.date.title' | translate"
      (select)="select.emit($event)"
      (monthChange)="month.set($event)"
    />
    @if (!loading() && !error() && dates().length === 0) {
      <p class="none" role="status">{{ 'booking.date.noneThisMonth' | translate }}</p>
    }
  `,
  styles: `
    .none {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class DateStep {
  readonly serviceId = input.required<string>()
  readonly timeZone = input.required<string>()
  readonly selected = input<string>()
  readonly select = output<string>()

  private readonly api = inject(BookingApi)
  protected readonly today = computed(() => todayIn(this.timeZone()))
  protected readonly month = signal('')
  protected readonly dates = signal<string[]>([])
  protected readonly loading = signal(false)
  protected readonly error = signal<unknown>(undefined)

  constructor() {
    effect(() => this.month.set(firstOfMonth(this.selected() ?? this.today())))
    effect(() => {
      this.month()
      this.serviceId()
      void this.load()
    })
  }

  /** The API answers at most 31 days at a time, from today on. */
  protected async load(): Promise<void> {
    const month = this.month()
    if (!month) return
    const from = later(month, this.today())
    const to = earlier(lastOfMonth(month), addDays(from, 30))
    this.error.set(undefined)
    this.dates.set([])
    if (from > to) return
    this.loading.set(true)
    try {
      const dates = await this.api.availableDays(this.serviceId(), from, to)
      if (month === this.month()) this.dates.set(dates)
    } catch (error) {
      this.error.set(error)
    } finally {
      this.loading.set(false)
    }
  }
}
