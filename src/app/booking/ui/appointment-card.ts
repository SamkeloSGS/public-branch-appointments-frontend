import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { MatCard, MatCardActions, MatCardContent } from '@angular/material/card'
import { MatIcon } from '@angular/material/icon'
import { TranslatePipe } from '@ngx-translate/core'
import { LocalDatePipe, LocalTimePipe, ZoneNamePipe } from '../../shared/ui/format.pipes'
import { needsRebooking, type Appointment } from '../model/appointment'
import { StatusChip } from './status-chip'

/**
 * One appointment in a list: service, branch, date and time in the branch's zone (FE-7). An appointment that needs a
 * new time is shown prominently; the "choose a new time" action is projected.
 */
@Component({
  selector: 'app-appointment-card',
  imports: [LocalDatePipe, LocalTimePipe, MatCard, MatCardActions, MatCardContent, MatIcon, StatusChip, TranslatePipe, ZoneNamePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card appearance="outlined" class="appointment" [class.rebooking]="rebooking()">
      <mat-card-content>
        @if (rebooking()) {
          <p class="alert" role="status">
            <mat-icon aria-hidden="true" inline>warning</mat-icon>
            {{ 'booking.rebooking.notice' | translate }}
          </p>
        }
        <div class="head">
          <h3>{{ serviceName() ?? '…' }}</h3>
          <app-status-chip [status]="appointment().status" />
        </div>
        <p class="when">
          {{ appointment().date | localDate: 'medium' }}, {{ appointment().startTime | localTime }}–{{
            appointment().endTime | localTime
          }}
          @if (timeZone()) {
            <span class="zone">({{ timeZone()! | zoneName }})</span>
          }
        </p>
        <p class="where">{{ branchName() ?? '…' }}</p>
        <p class="reference">{{ 'booking.reference' | translate: { reference: appointment().reference } }}</p>
      </mat-card-content>
      <mat-card-actions align="end">
        <ng-content />
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    .rebooking {
      border-color: var(--mat-sys-error);
      border-width: 2px;
    }
    .alert {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin: 0 0 0.5rem;
      color: var(--mat-sys-error);
      font-weight: 500;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    h3 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    p {
      margin: 0.25rem 0 0;
    }
    .zone,
    .reference {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class AppointmentCard {
  readonly appointment = input.required<Appointment>()
  readonly serviceName = input<string>()
  readonly branchName = input<string>()
  readonly timeZone = input<string>()
  protected readonly rebooking = computed(() => needsRebooking(this.appointment()))
}
