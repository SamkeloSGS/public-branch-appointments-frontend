import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { TranslatePipe } from '@ngx-translate/core'
import { EmptyState } from '../../shared/ui/empty-state'
import { ErrorPanel } from '../../shared/ui/error-panel'
import { LoadingState } from '../../shared/ui/loading-state'
import { LocalDatePipe } from '../../shared/ui/format.pipes'
import { ZoneNote } from '../../shared/ui/zone-note'
import { BookingApi } from '../data/booking-api'
import { TimeSlotGrid } from '../ui/time-slot-grid'

/** Step 4: a time. Open times are fetched every time this step opens or the date changes, never reused (spec 4.5). */
@Component({
  selector: 'app-time-step',
  imports: [EmptyState, ErrorPanel, LoadingState, LocalDatePipe, MatButton, TimeSlotGrid, TranslatePipe, ZoneNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>{{ 'booking.time.title' | translate: { date: (date() | localDate) } }}</h2>
    <app-zone-note [timeZone]="timeZone()" />
    @if (notice()) {
      <p class="notice" role="alert">{{ notice() }}</p>
    }
    @if (error()) {
      <app-error-panel [error]="error()" (retry)="load()" />
    } @else if (!times()) {
      <app-loading-state />
    } @else if (times()!.length === 0) {
      <app-empty-state icon="event_busy" [message]="'booking.time.none' | translate">
        <button mat-stroked-button type="button" (click)="changeDate.emit()">
          {{ 'booking.time.otherDate' | translate }}
        </button>
      </app-empty-state>
    } @else {
      <app-time-slot-grid
        [times]="times()!"
        [selected]="selected()"
        [label]="'booking.time.available' | translate"
        (select)="select.emit($event)"
      />
    }
  `,
  styles: `
    .notice {
      padding: 0.75rem 1rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
  `,
})
export class TimeStep {
  readonly serviceId = input.required<string>()
  readonly date = input.required<string>()
  readonly timeZone = input.required<string>()
  readonly selected = input<string>()
  /** Shown above the times, e.g. that the time chosen was just taken */
  readonly notice = input<string>()
  /** Changing it loads the times again, e.g. after the time chosen was taken */
  readonly reloadToken = input(0)
  readonly select = output<string>()
  readonly changeDate = output()

  private readonly api = inject(BookingApi)
  protected readonly times = signal<string[] | undefined>(undefined)
  protected readonly error = signal<unknown>(undefined)

  constructor() {
    effect(() => {
      this.serviceId()
      this.date()
      this.reloadToken()
      void this.load()
    })
  }

  protected async load(): Promise<void> {
    const date = this.date()
    this.times.set(undefined)
    this.error.set(undefined)
    try {
      const times = await this.api.openTimes(this.serviceId(), date)
      if (date === this.date()) this.times.set(times)
    } catch (error) {
      this.error.set(error)
    }
  }
}
