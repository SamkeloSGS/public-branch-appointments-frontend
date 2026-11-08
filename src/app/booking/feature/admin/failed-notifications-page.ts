import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { MatSnackBar } from '@angular/material/snack-bar'
import { Router } from '@angular/router'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { EmptyState } from '../../../shared/ui/empty-state'
import { ErrorPanel } from '../../../shared/ui/error-panel'
import { LoadingState } from '../../../shared/ui/loading-state'
import { ShowMore } from '../../../shared/ui/show-more'
import { appendPage, hasNextPage, type Page } from '../../../shared/util/page'
import type { Notification } from '../../model/staff-actions'
import { BookingAdminApi } from '../../data/booking-admin-api'
import { NotificationList } from '../../ui/notification-list'
import { useBranch } from '../branch-details'

/** The branch's failed notifications of the last 30 days, with resend (FE-14). */
@Component({
  selector: 'app-failed-notifications-page',
  imports: [EmptyState, ErrorPanel, LoadingState, NotificationList, ShowMore, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="failed-title">
      <h1 id="failed-title">{{ 'admin.sections.notifications' | translate }}</h1>
      <p class="intro">{{ 'admin.notifications.failedIntro' | translate }}</p>
      <app-error-panel [error]="actionError()" />
      @if (error()) {
        <app-error-panel [error]="error()" (retry)="load()" />
      } @else if (!notifications()) {
        <app-loading-state />
      } @else if (notifications()!.length === 0) {
        <app-empty-state icon="mark_email_read" [message]="'admin.notifications.noneFailed' | translate" />
      } @else {
        <app-notification-list
          [notifications]="notifications()!"
          [timeZone]="timeZone()"
          [caption]="'admin.sections.notifications' | translate"
          [showAppointmentLink]="true"
          [resending]="resending()"
          (resend)="resend($event)"
          (open)="openAppointment($event)"
        />
        <app-show-more
          [shown]="failedShown()"
          [total]="failed()?.totalItems ?? 0"
          [loading]="loadingMore()"
          (more)="more()"
        />
      }
    </section>
  `,
  styles: `
    .intro {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class FailedNotificationsPage {
  private readonly api = inject(BookingAdminApi)
  private readonly router = inject(Router)
  private readonly snackBar = inject(MatSnackBar)
  private readonly translate = inject(TranslateService)
  private readonly branch = useBranch()

  protected readonly timeZone = computed(() => this.branch.detail()?.timeZone ?? 'Africa/Johannesburg')
  protected readonly notifications = signal<Notification[] | undefined>(undefined)
  protected readonly error = signal<unknown>(undefined)
  protected readonly actionError = signal<unknown>(undefined)
  protected readonly resending = signal<string | undefined>(undefined)
  /** The failed notifications loaded so far; resent copies are only in `notifications` */
  protected readonly failed = signal<Page<Notification> | undefined>(undefined)
  protected readonly failedShown = computed(() => this.failed()?.items.length ?? 0)
  protected readonly loadingMore = signal(false)

  constructor() {
    void this.load()
  }

  protected async load(): Promise<void> {
    this.notifications.set(undefined)
    this.failed.set(undefined)
    this.error.set(undefined)
    try {
      const failed = await this.api.notifications({ status: 'FAILED' })
      this.failed.set(failed)
      this.notifications.set(failed.items)
    } catch (error) {
      this.error.set(error)
    }
  }

  /** The next page of failed notifications, added at the end of the list. */
  protected async more(): Promise<void> {
    const failed = this.failed()
    if (!failed || !hasNextPage(failed)) return
    this.loadingMore.set(true)
    this.actionError.set(undefined)
    try {
      const next = await this.api.notifications({ status: 'FAILED' }, failed.page + 1)
      this.failed.set(appendPage(failed.items, next))
      this.notifications.update((list) => [...(list ?? []), ...next.items])
    } catch (error) {
      this.actionError.set(error)
    } finally {
      this.loadingMore.set(false)
    }
  }

  /** The resent message appears as pending at the top of the list (FE-14). */
  protected async resend(id: string): Promise<void> {
    this.resending.set(id)
    this.actionError.set(undefined)
    try {
      const created = await this.api.resend(id)
      this.notifications.update((list) => [created, ...(list ?? [])])
      this.snackBar.open(this.translate.instant('admin.notifications.resent') as string, undefined, { duration: 3000 })
    } catch (error) {
      this.actionError.set(error)
    } finally {
      this.resending.set(undefined)
    }
  }

  protected openAppointment(appointmentId: string): void {
    void this.router.navigate(['/admin/appointments', appointmentId])
  }
}
