import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { TranslatePipe } from '@ngx-translate/core'
import { LocalDatePipe, LocalTimePipe } from '../../shared/ui/format.pipes'
import { ZoneNote } from '../../shared/ui/zone-note'

/** Service, branch, date and time of an appointment, in the branch's local time with the zone named. */
@Component({
  selector: 'app-appointment-summary',
  imports: [LocalDatePipe, LocalTimePipe, TranslatePipe, ZoneNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="summary">
      <div>
        <dt>{{ 'booking.summary.service' | translate }}</dt>
        <dd>{{ serviceName() ?? '…' }}</dd>
      </div>
      <div>
        <dt>{{ 'booking.summary.branch' | translate }}</dt>
        <dd>{{ branchName() ?? '…' }}</dd>
      </div>
      <div>
        <dt>{{ 'booking.summary.date' | translate }}</dt>
        <dd>{{ date() | localDate }}</dd>
      </div>
      <div>
        <dt>{{ 'booking.summary.time' | translate }}</dt>
        <dd>
          {{ startTime() | localTime }}
          @if (endTime()) {
            – {{ endTime() | localTime }}
          }
        </dd>
      </div>
    </dl>
    @if (timeZone()) {
      <app-zone-note [timeZone]="timeZone()!" />
    }
  `,
  styles: `
    .summary {
      display: grid;
      gap: 0.5rem;
      margin: 0 0 0.75rem;
    }
    .summary div {
      display: grid;
      grid-template-columns: 5rem 1fr;
      gap: 0.75rem;
    }
    dt {
      color: var(--mat-sys-on-surface-variant);
    }
    dd {
      margin: 0;
      font-weight: 500;
      overflow-wrap: anywhere;
    }
  `,
})
export class AppointmentSummary {
  readonly serviceName = input<string>()
  readonly branchName = input<string>()
  readonly date = input.required<string>()
  readonly startTime = input.required<string>()
  readonly endTime = input<string>()
  readonly timeZone = input<string>()
}
