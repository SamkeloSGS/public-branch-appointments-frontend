import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { TranslatePipe } from '@ngx-translate/core'
import { InstantInPipe } from '../../shared/ui/format.pipes'
import { canResend, type Notification } from '../model/staff-actions'

/** Notifications with type, status, reason and the outcome per channel, with resend where allowed (FE-14). */
@Component({
  selector: 'app-notification-list',
  imports: [InstantInPipe, MatButton, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-scroll">
      <table class="admin-table">
        <caption class="visually-hidden">{{ caption() }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ 'admin.notifications.created' | translate }}</th>
            <th scope="col">{{ 'admin.notifications.type' | translate }}</th>
            <th scope="col">{{ 'admin.notifications.status' | translate }}</th>
            <th scope="col">{{ 'admin.notifications.channels' | translate }}</th>
            <th scope="col"><span class="visually-hidden">{{ 'admin.day.actions' | translate }}</span></th>
          </tr>
        </thead>
        <tbody>
          @for (notification of notifications(); track notification.id) {
            <tr>
              <td class="nowrap">{{ notification.createdAt | instantIn: timeZone() }}</td>
              <td>{{ 'admin.notifications.types.' + notification.type | translate }}</td>
              <td>
                <span class="status" [class]="notification.status">
                  {{ 'admin.notifications.statuses.' + notification.status | translate }}
                </span>
                @if (notification.statusReason) {
                  <div class="detail">{{ 'admin.notifications.reasons.' + notification.statusReason | translate }}</div>
                }
              </td>
              <td>
                @for (delivery of notification.deliveries; track delivery.channel) {
                  <div class="delivery">
                    <strong>{{ delivery.channel }}</strong>
                    {{ 'admin.notifications.deliveries.' + delivery.status | translate }}
                    <span class="detail">
                      ({{ 'admin.notifications.attempts' | translate: { n: delivery.attempts } }})
                    </span>
                    @if (delivery.lastError) {
                      <div class="detail error">{{ delivery.lastError }}</div>
                    }
                  </div>
                } @empty {
                  <span class="detail">–</span>
                }
              </td>
              <td class="actions">
                @if (showAppointmentLink()) {
                  <button mat-button type="button" (click)="open.emit(notification.appointmentId)">
                    {{ 'admin.notifications.appointment' | translate }}
                  </button>
                }
                @if (canResend(notification)) {
                  <button
                    mat-stroked-button
                    type="button"
                    [disabled]="resending() === notification.id"
                    (click)="resend.emit(notification.id)"
                  >
                    {{ 'admin.notifications.resend' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .nowrap {
      white-space: nowrap;
    }
    .status {
      display: inline-block;
      padding: 0.0625rem 0.5rem;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-surface-container-highest);
      font: var(--mat-sys-label-medium);
    }
    .status.FAILED {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .status.SENT {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .delivery + .delivery {
      margin-top: 0.25rem;
    }
    .detail {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .detail.error {
      color: var(--mat-sys-error);
      overflow-wrap: anywhere;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      justify-content: flex-end;
    }
  `,
})
export class NotificationList {
  readonly notifications = input.required<readonly Notification[]>()
  /** Zone the creation times are shown in: the branch's */
  readonly timeZone = input.required<string>()
  readonly caption = input.required<string>()
  readonly showAppointmentLink = input(false)
  /** ID of the notification being resent */
  readonly resending = input<string>()
  readonly resend = output<string>()
  readonly open = output<string>()

  protected readonly canResend = canResend
}
