import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { TranslatePipe } from '@ngx-translate/core'
import { LocalTimePipe } from '../../shared/ui/format.pipes'
import { DAYS_OF_WEEK, type TimeRange } from '../model/branch'

/** Opening hours per weekday, in the branch's local time as the API gives them. */
@Component({
  selector: 'app-weekly-hours-table',
  imports: [LocalTimePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table class="hours">
      <caption class="visually-hidden">{{ 'branchManagement.openingHours' | translate }}</caption>
      <tbody>
        @for (day of days(); track day.day) {
          <tr>
            <th scope="row">{{ 'days.' + day.day | translate }}</th>
            <td>
              @for (range of day.ranges; track range.start; let last = $last) {
                <span>{{ range.start | localTime }}–{{ range.end | localTime }}</span>
                @if (!last) {
                  ,
                }
              } @empty {
                <span class="closed">{{ 'branchManagement.closed' | translate }}</span>
              }
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    .hours {
      border-collapse: collapse;
      width: 100%;
      max-width: 24rem;
    }
    th,
    td {
      text-align: start;
      padding: 0.375rem 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    th {
      font-weight: 500;
      padding-inline-end: 1rem;
    }
    .closed {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class WeeklyHoursTable {
  readonly weeklyHours = input.required<Record<string, TimeRange[] | undefined>>()
  protected readonly days = computed(() =>
    DAYS_OF_WEEK.map((day) => ({ day, ranges: this.weeklyHours()[day] ?? [] })),
  )
}
