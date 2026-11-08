import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core'
import { MatAnchor, MatButton } from '@angular/material/button'
import { MatCard, MatCardActions, MatCardContent } from '@angular/material/card'
import { MatDialog } from '@angular/material/dialog'
import { MatIcon } from '@angular/material/icon'
import { Router, RouterLink } from '@angular/router'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { PrerequisitesList } from '../../branch-management'
import { confirmAction } from '../../shared/ui/confirm-dialog'
import { ErrorPanel } from '../../shared/ui/error-panel'
import { LoadingState } from '../../shared/ui/loading-state'
import type { Versioned } from '../../shared/util/etag'
import { errorView } from '../../shared/util/error-view'
import { hasCode, isApiError } from '../../shared/util/problem'
import { APP_SETTINGS } from '../../shared/util/settings'
import { bookingErrorMessages, isChangeable, isPastCutoff, needsRebooking, type Appointment } from '../model/appointment'
import { BookingApi } from '../data/booking-api'
import { MyAppointmentsStore } from '../data/my-appointments.store'
import { AppointmentSummary } from '../ui/appointment-summary'
import { StatusChip } from '../ui/status-chip'
import { useBranch } from './branch-details'
import { DateStep } from './date-step'
import { TimeStep } from './time-step'

interface Notice {
  kind: 'success' | 'warning' | 'error'
  /** Translation key */
  key: string
  params?: Record<string, string>
}

/**
 * One of the customer's appointments, with reschedule and cancel. The actions are offered only for statuses that
 * allow them; after the cutoff they stay visible but disabled, with the reason (FE-7). No optimistic updates.
 */
@Component({
  selector: 'app-appointment-detail-page',
  imports: [
    AppointmentSummary,
    DateStep,
    ErrorPanel,
    LoadingState,
    MatAnchor,
    MatButton,
    MatCard,
    MatCardActions,
    MatCardContent,
    MatIcon,
    PrerequisitesList,
    RouterLink,
    StatusChip,
    TimeStep,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page narrow" aria-labelledby="detail-title">
      <a mat-button routerLink="/appointments" class="back-link">
        <mat-icon>arrow_back</mat-icon>
        {{ 'booking.detail.back' | translate }}
      </a>
      @if (loadError()) {
        <app-error-panel [error]="loadError()" [messages]="messages" (retry)="load(reference())" />
      } @else if (value(); as value) {
        <div class="title">
          <h1 id="detail-title">{{ 'booking.reference' | translate: { reference: value.reference } }}</h1>
          <app-status-chip [status]="value.status" />
        </div>

        @if (notice(); as notice) {
          <p class="notice" [class]="notice.kind" [attr.role]="notice.kind === 'success' ? 'status' : 'alert'">
            {{ notice.key | translate: notice.params }}
          </p>
        }
        @if (rebooking()) {
          <p class="notice warning" role="alert">{{ 'booking.rebooking.explain' | translate }}</p>
        }

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
            @if (changeable()) {
              <app-prerequisites-list [items]="branchInfo.prerequisites(value.serviceId)" />
            }
          </mat-card-content>
          @if (changeable()) {
            <mat-card-actions>
              <button
                mat-flat-button
                type="button"
                [disabled]="pastCutoff() || working()"
                [attr.aria-describedby]="pastCutoff() ? 'cutoff-why' : null"
                (click)="startReschedule()"
              >
                {{ (rebooking() ? 'booking.rebooking.choose' : 'booking.detail.reschedule') | translate }}
              </button>
              <button
                mat-button
                type="button"
                class="destructive"
                [disabled]="pastCutoff() || working()"
                [attr.aria-describedby]="pastCutoff() ? 'cutoff-why' : null"
                (click)="cancel()"
              >
                {{ 'booking.detail.cancel' | translate }}
              </button>
            </mat-card-actions>
            @if (pastCutoff()) {
              <p id="cutoff-why" class="why">{{ 'booking.errors.PAST_CUTOFF' | translate }}</p>
            }
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
            @if (working()) {
              <app-loading-state [label]="'booking.detail.saving' | translate" />
            }
            <button mat-button type="button" (click)="stopReschedule()">{{ 'common.cancel' | translate }}</button>
          </section>
        }
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
    .notice {
      padding: 0.75rem 1rem;
      border-radius: var(--mat-sys-corner-medium);
    }
    .notice.success {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .notice.warning,
    .notice.error {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .destructive {
      --mat-button-text-label-text-color: var(--mat-sys-error);
    }
    .why {
      margin: 0 1rem 1rem;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .reschedule {
      margin-top: 1.5rem;
    }
  `,
})
export class AppointmentDetailPage {
  readonly reference = input.required<string>()
  /** Set after booking: shows the booking reference (FE-6) */
  readonly booked = input<string>()
  /** Set from "choose a new time": opens rescheduling straight away */
  readonly reschedule = input<string>()

  private readonly api = inject(BookingApi)
  private readonly appointments = inject(MyAppointmentsStore)
  private readonly dialog = inject(MatDialog)
  private readonly translate = inject(TranslateService)
  private readonly router = inject(Router)
  private readonly cutoffMinutes = inject(APP_SETTINGS).changeCutoffMinutes
  protected readonly branchInfo = useBranch()
  protected readonly messages = bookingErrorMessages

  protected readonly appointment = signal<Versioned<Appointment> | undefined>(undefined)
  protected readonly loadError = signal<unknown>(undefined)
  protected readonly notice = signal<Notice | undefined>(undefined)
  /** Set when the server answered PAST_CUTOFF; the actions stay visible but disabled, with the reason */
  private readonly serverSaysPastCutoff = signal(false)
  protected readonly working = signal(false)
  protected readonly rescheduling = signal(false)
  protected readonly newDate = signal<string | undefined>(undefined)
  protected readonly slotTaken = signal(false)
  protected readonly timesVersion = signal(0)

  protected readonly value = computed(() => this.appointment()?.value)
  protected readonly branch = this.branchInfo.detail
  protected readonly changeable = computed(() => {
    const value = this.value()
    return value ? isChangeable(value) : false
  })
  protected readonly rebooking = computed(() => {
    const value = this.value()
    return value ? needsRebooking(value) : false
  })
  protected readonly pastCutoff = computed(() => {
    const value = this.value()
    return this.serverSaysPastCutoff() || (value ? isPastCutoff(value, this.cutoffMinutes) : false)
  })

  constructor() {
    effect(() => {
      const reference = this.reference()
      untracked(() => void this.load(reference))
    })
    effect(() => {
      const booked = this.booked()
      const reference = this.reference()
      untracked(() => {
        if (booked) this.notice.set({ kind: 'success', key: 'booking.detail.booked', params: { reference } })
      })
    })
    effect(() => {
      if (this.reschedule()) untracked(() => this.rescheduling.set(true))
    })
  }

  protected async load(reference: string): Promise<void> {
    this.loadError.set(undefined)
    try {
      const appointment = await this.api.myAppointment(reference)
      this.appointment.set(appointment)
    } catch (error) {
      this.loadError.set(error)
    }
  }

  private async handleFailure(error: unknown): Promise<void> {
    if (hasCode(error, 'PAST_CUTOFF')) {
      this.serverSaysPastCutoff.set(true)
      this.rescheduling.set(false)
    } else if (hasCode(error, 'INVALID_STATE') || (isApiError(error) && error.isStale)) {
      // The appointment changed meanwhile: say so and show the latest version
      this.notice.set({ kind: 'warning', key: 'booking.errors.INVALID_STATE' })
      this.rescheduling.set(false)
      await this.load(this.reference())
    } else if (hasCode(error, 'SLOT_UNAVAILABLE')) {
      // Stay on the time step and load its times again
      this.slotTaken.set(true)
      this.timesVersion.update((version) => version + 1)
    } else {
      this.notice.set({ kind: 'error', key: errorView(error, bookingErrorMessages).messageKey })
    }
  }

  protected async cancel(): Promise<void> {
    const current = this.appointment()
    if (!current) return
    const t = (key: string, params?: Record<string, string>) => this.translate.instant(key, params) as string
    const confirmed = await confirmAction(this.dialog, {
      title: t('booking.detail.cancelTitle'),
      message: t('booking.detail.cancelConfirm', { reference: current.value.reference }),
      confirmLabel: t('booking.detail.cancel'),
      cancelLabel: t('booking.detail.keep'),
      destructive: true,
    })
    if (!confirmed) return
    this.working.set(true)
    this.notice.set(undefined)
    try {
      this.appointment.set(await this.api.cancel(current))
      this.appointments.invalidate()
      this.notice.set({ kind: 'success', key: 'booking.detail.cancelled' })
    } catch (error) {
      await this.handleFailure(error)
    } finally {
      this.working.set(false)
    }
  }

  protected async rescheduleTo(time: string): Promise<void> {
    const current = this.appointment()
    const date = this.newDate()
    if (!current || !date) return
    this.working.set(true)
    this.notice.set(undefined)
    this.slotTaken.set(false)
    try {
      this.appointment.set(await this.api.reschedule(current, date, time))
      this.appointments.invalidate()
      this.stopReschedule()
      this.notice.set({ kind: 'success', key: 'booking.detail.rescheduled' })
    } catch (error) {
      await this.handleFailure(error)
    } finally {
      this.working.set(false)
    }
  }

  protected startReschedule(): void {
    this.notice.set(undefined)
    this.slotTaken.set(false)
    this.newDate.set(undefined)
    this.rescheduling.set(true)
  }

  protected stopReschedule(): void {
    this.rescheduling.set(false)
    this.newDate.set(undefined)
    if (this.reschedule()) void this.router.navigate([], { queryParams: {}, replaceUrl: true })
  }
}
