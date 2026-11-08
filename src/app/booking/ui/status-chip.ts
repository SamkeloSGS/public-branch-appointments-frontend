import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { TranslatePipe } from '@ngx-translate/core'
import type { AppointmentStatus } from '../model/appointment'

/** An appointment's status in the customer's words. */
@Component({
  selector: 'app-status-chip',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="status" [class]="status()">{{ 'booking.status.' + status() | translate }}</span>`,
  styles: `
    .status {
      display: inline-block;
      padding: 0.125rem 0.625rem;
      border-radius: var(--mat-sys-corner-full);
      font: var(--mat-sys-label-medium);
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface);
    }
    .BOOKED,
    .CHECKED_IN {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .REBOOKING_REQUIRED,
    .NO_SHOW {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class StatusChip {
  readonly status = input.required<AppointmentStatus>()
}
