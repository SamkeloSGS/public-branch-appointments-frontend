import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardActions, MatCardContent } from '@angular/material/card'
import { MatDialog } from '@angular/material/dialog'
import { MatIcon } from '@angular/material/icon'
import { MatSnackBar } from '@angular/material/snack-bar'
import { Router, RouterLink } from '@angular/router'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { confirmAction } from '../../../shared/ui/confirm-dialog'
import { EmptyState } from '../../../shared/ui/empty-state'
import { ErrorPanel } from '../../../shared/ui/error-panel'
import { LoadingState } from '../../../shared/ui/loading-state'
import type { Versioned } from '../../../shared/util/etag'
import { hasCode, isApiError } from '../../../shared/util/problem'
import { APP_SETTINGS } from '../../../shared/util/settings'
import { staffBookingErrorMessages, type Appointment } from '../../model/appointment'
import { todayIn } from '../../model/calendar'
import { staffActions, type Notification, type StaffAction } from '../../model/staff-actions'
import { BookingAdminApi, type StatusAction } from '../../data/booking-admin-api'
import { AppointmentSummary } from '../../ui/appointment-summary'
import { NotificationList } from '../../ui/notification-list'
import { StatusChip } from '../../ui/status-chip'
import { useBranch } from '../branch-details'
import { DateStep } from '../date-step'
import { TimeStep } from '../time-step'

const STATUS_ACTIONS: Partial<Record<StaffAction, StatusAction>> = {
  checkIn: 'check-in',
  complete: 'complete',
  noShow: 'no-show',
  cancel: 'cancel',
}

/** One appointment for staff: its details, the actions valid now, rescheduling, and its notifications (FE-14). */
@Component({
  selector: 'app-appointment-admin-page',
  imports: [
    AppointmentSummary,
    DateStep,
    EmptyState,
    ErrorPanel,
    LoadingState,
    MatButton,
    MatCard,
    MatCardActions,
    MatCardContent,
    MatIcon,
    NotificationList,
    RouterLink,
    StatusChip,
    TimeStep,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="appointment-title">
      @if (value(); as value) {
        <a mat-button class="back-link" routerLink="/admin/day" [queryParams]="{ date: value.date }">
          <mat-icon>arrow_back</mat-icon>
          {{ 'admin.appointment.back' | translate }}
        </a>
      }
      @if (loadError()) {
        <app-error-panel [error]="loadError()" [messages]="messages" (retry)="load(id())" />
      } @else if (value(); as value) {
        <div class="title">
          <h1 id="appointment-title">{{ 'booking.reference' | translate: { reference: value.reference } }}</h1>
          <app-status-chip [status]="value.status" />
        </div>
        <app-error-panel [error]="actionError()" [messages]="messages" [serverDetail]="true" />

        <mat-card appearance="outlined">
          <mat-card-content>
            <app-appointment-summary
              [serviceName]="branchInfo.serviceName(value.serviceId)"
              [branchName]="branch()?.name"
              [date]="value.date"
              [startTime]="value.startTime"
              [endTime]="value.endTime"
              [timeZone]="branch()?.timeZone"
            />
            <p class="booked-by">{{ 'admin.appointment.bookedBy.' + value.bookedBy | translate }}</p>
          </mat-card-content>
          @if (actions().length > 0) {
            <mat-card-actions class="actions">
              @for (action of actions(); track action) {
                <button
                  mat-stroked-button
                  type="button"
                  [class.destructive]="action === 'cancel' || action === 'noShow'"
                  [disabled]="working()"
                  (click)="run(action)"
                >
                  {{ 'admin.actions.' + action | translate }}
                </button>
              }
            </mat-card-actions>
          }
        </mat-card>

        @if (rescheduling() && branch(); as branch) {
          <section class="reschedule" aria-labelledby="reschedule-title">
            <h2 id="reschedule-title">{{ 'booking.detail.chooseNewTime' | translate }}</h2>
            @if (!newDate()) {
              <app-date-step
                [serviceId]="value.serviceId"
                [timeZone]="branch.timeZone"
                (select)="newDate.set($event)"
              />
            } @else {
              <app-time-step
                [serviceId]="value.serviceId"
                [date]="newDate()!"
                [timeZone]="branch.timeZone"
                [reloadToken]="timesVersion()"
                [notice]="slotTaken() ? ('booking.errors.SLOT_UNAVAILABLE' | translate) : undefined"
                (select)="rescheduleTo($event)"
                (changeDate)="newDate.set(undefined)"
              />
            }
            <button mat-button type="button" (click)="rescheduling.set(false)">{{ 'common.cancel' | translate }}</button>
          </section>
        }

        <section class="notifications" aria-labelledby="notifications-title">
          <h2 id="notifications-title">{{ 'admin.notifications.title' | translate }}</h2>
          @if (notificationsError()) {
            <app-error-panel [error]="notificationsError()" (retry)="loadNotifications(value.id)" />
          } @else if (!notifications()) {
            <app-loading-state />
          } @else if (notifications()!.length === 0) {
            <app-empty-state icon="notifications_off" [message]="'admin.notifications.none' | translate" />
          } @else {
            <app-notification-list
              [notifications]="notifications()!"
              [timeZone]="branch()?.timeZone ?? 'Africa/Johannesburg'"
              [caption]="'admin.notifications.title' | translate"
              [resending]="resending()"
              (resend)="resend($event)"
            />
          }
        </section>
      } @else {
        <app-loading-state />
      }
    </section>
  `,
  styles: `
    .title {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }
    .booked-by {
      margin: 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .actions {
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .destructive {
      --mat-button-outlined-label-text-color: var(--mat-sys-error);
    }
    .reschedule,
    .notifications {
      margin-top: 1.5rem;
    }
  `,
})
export class AppointmentAdminPage {
  readonly id = input.required<string>()
  /** ?reschedule=1 opens rescheduling straight away */
  readonly reschedule = input<string>()

  private readonly api = inject(BookingAdminApi)
  private readonly dialog = inject(MatDialog)
  private readonly snackBar = inject(MatSnackBar)
  private readonly translate = inject(TranslateService)
  private readonly router = inject(Router)
  private readonly settings = inject(APP_SETTINGS)
  protected readonly branchInfo = useBranch()
  protected readonly messages = staffBookingErrorMessages

  protected readonly appointment = signal<Versioned<Appointment> | undefined>(undefined)
  protected readonly loadError = signal<unknown>(undefined)
  protected readonly actionError = signal<unknown>(undefined)
  protected readonly working = signal(false)
  protected readonly rescheduling = signal(false)
  protected readonly newDate = signal<string | undefined>(undefined)
  protected readonly slotTaken = signal(false)
  protected readonly timesVersion = signal(0)
  protected readonly notifications = signal<Notification[] | undefined>(undefined)
  protected readonly notificationsError = signal<unknown>(undefined)
  protected readonly resending = signal<string | undefined>(undefined)

  protected readonly value = computed(() => this.appointment()?.value)
  protected readonly branch = this.branchInfo.detail
  protected readonly actions = computed(() => {
    const value = this.value()
    if (!value) return []
    return staffActions(value, {
      today: todayIn(this.branch()?.timeZone ?? 'Africa/Johannesburg'),
      now: new Date(),
      noShowGraceMinutes: this.settings.noShowGraceMinutes,
    })
  })

  constructor() {
    effect(() => {
      const id = this.id()
      untracked(() => {
        void this.load(id)
        void this.loadNotifications(id)
      })
    })
    effect(() => {
      if (this.reschedule()) untracked(() => this.rescheduling.set(true))
    })
  }

  protected async load(id: string): Promise<void> {
    this.loadError.set(undefined)
    try {
      const appointment = await this.api.appointment(id)
      this.appointment.set(appointment)
    } catch (error) {
      this.loadError.set(error)
    }
  }

  protected async loadNotifications(id: string): Promise<void> {
    this.notificationsError.set(undefined)
    try {
      this.notifications.set(await this.api.appointmentNotifications(id))
    } catch (error) {
      this.notificationsError.set(error)
    }
  }

  protected async run(action: StaffAction): Promise<void> {
    const current = this.appointment()
    if (!current) return
    if (action === 'reschedule') {
      this.newDate.set(undefined)
      this.slotTaken.set(false)
      this.rescheduling.set(true)
      return
    }
    const statusAction = STATUS_ACTIONS[action]
    if (!statusAction) return
    if (action === 'cancel' || action === 'noShow') {
      const t = (key: string, params?: Record<string, string>) => this.translate.instant(key, params) as string
      const confirmed = await confirmAction(this.dialog, {
        title: t(`admin.confirm.${action}.title`),
        message: t(`admin.confirm.${action}.message`, {
          customer: current.value.reference,
          reference: current.value.reference,
        }),
        confirmLabel: t(`admin.actions.${action}`),
        cancelLabel: t('common.back'),
        destructive: true,
      })
      if (!confirmed) return
    }
    await this.change(() => this.api.changeStatus(current, statusAction), `admin.done.${action}`)
  }

  protected async rescheduleTo(time: string): Promise<void> {
    const current = this.appointment()
    const date = this.newDate()
    if (!current || !date) return
    this.slotTaken.set(false)
    const done = await this.change(() => this.api.reschedule(current, date, time), 'admin.done.reschedule')
    if (done) this.rescheduling.set(false)
  }

  private async change(action: () => Promise<Versioned<Appointment>>, success: string): Promise<boolean> {
    this.working.set(true)
    this.actionError.set(undefined)
    try {
      this.appointment.set(await action())
      this.snackBar.open(this.translate.instant(success) as string, undefined, { duration: 3000 })
      void this.loadNotifications(this.id())
      if (this.reschedule()) void this.router.navigate([], { queryParams: {}, replaceUrl: true })
      return true
    } catch (error) {
      if (hasCode(error, 'SLOT_UNAVAILABLE')) {
        this.slotTaken.set(true)
        this.timesVersion.update((version) => version + 1)
      } else {
        this.actionError.set(error)
        if ((isApiError(error) && error.isStale) || hasCode(error, 'INVALID_STATE')) await this.load(this.id())
      }
      return false
    } finally {
      this.working.set(false)
    }
  }

  /** Sends a notification again; the new notification appears as pending (FE-14). */
  protected async resend(notificationId: string): Promise<void> {
    this.resending.set(notificationId)
    try {
      const created = await this.api.resend(notificationId)
      this.notifications.update((list) => [created, ...(list ?? [])])
      this.snackBar.open(this.translate.instant('admin.notifications.resent') as string, undefined, { duration: 3000 })
    } catch (error) {
      this.actionError.set(error)
    } finally {
      this.resending.set(undefined)
    }
  }
}
