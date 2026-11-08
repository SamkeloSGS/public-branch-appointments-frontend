import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { MatIconButton } from '@angular/material/button'
import { MatIcon } from '@angular/material/icon'
import { MatProgressBar } from '@angular/material/progress-bar'
import { TranslatePipe } from '@ngx-translate/core'
import { LocalDatePipe, LocalMonthPipe } from '../../shared/ui/format.pipes'
import { addMonths, datesOfMonth, firstOfMonth, weekdayIndex, type LocalDate } from '../model/calendar'

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const

/**
 * A month of branch-local dates. Days without open times are shown as unavailable (FE-6). Dates stay strings, so the
 * browser's zone never shifts a day.
 */
@Component({
  selector: 'app-day-picker',
  imports: [LocalDatePipe, LocalMonthPipe, MatIcon, MatIconButton, MatProgressBar, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker" role="group" [attr.aria-label]="label()">
      <div class="header">
        <button
          mat-icon-button
          type="button"
          [disabled]="!canGoBack()"
          [attr.aria-label]="'booking.date.previousMonth' | translate"
          (click)="monthChange.emit(previousMonth())"
        >
          <mat-icon>chevron_left</mat-icon>
        </button>
        <h3 class="month" aria-live="polite">{{ month() | localMonth }}</h3>
        <button
          mat-icon-button
          type="button"
          [attr.aria-label]="'booking.date.nextMonth' | translate"
          (click)="monthChange.emit(nextMonth())"
        >
          <mat-icon>chevron_right</mat-icon>
        </button>
      </div>
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-hidden="true" />
      }
      <div class="grid">
        @for (weekday of weekdays; track weekday) {
          <span class="weekday" aria-hidden="true">{{ ('days.' + weekday | translate).slice(0, 2) }}</span>
        }
        @for (cell of cells(); track $index) {
          @if (cell) {
            <button
              type="button"
              class="day"
              [class.selected]="cell.date === selected()"
              [class.today]="cell.date === today()"
              [disabled]="!cell.available"
              [attr.aria-pressed]="cell.date === selected()"
              [attr.aria-label]="
                (cell.date | localDate) + (cell.available ? '' : ' – ' + ('booking.date.unavailable' | translate))
              "
              (click)="select.emit(cell.date)"
            >
              {{ cell.day }}
            </button>
          } @else {
            <span aria-hidden="true"></span>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .picker {
      max-width: 24rem;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .month {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 0.25rem;
      margin-top: 0.5rem;
    }
    .weekday {
      text-align: center;
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .day {
      aspect-ratio: 1;
      min-height: 2.5rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-medium);
      cursor: pointer;
    }
    .day:hover:not(:disabled) {
      background: var(--mat-sys-surface-container-high);
    }
    .day:focus-visible {
      outline: 3px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
    .day:disabled {
      cursor: default;
      border-color: transparent;
      background: transparent;
      color: var(--mat-sys-on-surface-variant);
      text-decoration: line-through;
      opacity: 0.6;
    }
    .day.today {
      font-weight: 700;
    }
    .day.selected {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      border-color: var(--mat-sys-primary);
    }
  `,
})
export class DayPicker {
  /** Today in the branch's zone */
  readonly today = input.required<LocalDate>()
  /** Any date in the month shown */
  readonly month = input.required<LocalDate>()
  readonly availableDates = input.required<readonly LocalDate[]>()
  readonly selected = input<LocalDate>()
  readonly loading = input(false)
  readonly label = input.required<string>()
  readonly select = output<LocalDate>()
  readonly monthChange = output<LocalDate>()

  protected readonly weekdays = WEEKDAYS
  protected readonly previousMonth = computed(() => addMonths(this.month(), -1))
  protected readonly nextMonth = computed(() => addMonths(this.month(), 1))
  protected readonly canGoBack = computed(() => firstOfMonth(this.month()) > firstOfMonth(this.today()))

  protected readonly cells = computed(() => {
    const available = new Set(this.availableDates())
    const dates = datesOfMonth(this.month())
    const leading: null[] = Array.from({ length: weekdayIndex(dates[0] ?? this.month()) }, () => null)
    return [
      ...leading,
      ...dates.map((date) => ({ date, day: Number(date.slice(8)), available: available.has(date) })),
    ]
  })
}
