import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatDialog } from '@angular/material/dialog'
import { MatSnackBar } from '@angular/material/snack-bar'
import { RouterLink } from '@angular/router'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { BranchAdminApi } from '../../../branch-management'
import { confirmAction } from '../../../shared/ui/confirm-dialog'
import { EmptyState } from '../../../shared/ui/empty-state'
import { ErrorPanel } from '../../../shared/ui/error-panel'
import { LoadingState } from '../../../shared/ui/loading-state'
import { LocalDatePipe, LocalTimePipe } from '../../../shared/ui/format.pipes'
import { ZoneNote } from '../../../shared/ui/zone-note'
import { fromVersion } from '../../../shared/util/etag'
import { staffBookingErrorMessages, type Appointment } from '../../model/appointment'
import { addDays, todayIn } from '../../model/calendar'
import type { OverbookedDay } from '../../model/staff-actions'
import { BookingAdminApi } from '../../data/booking-admin-api'
import { StatusChip } from '../../ui/status-chip'
import { useBranch } from '../branch-details'

/** How far ahead overbooked days are looked for; the API allows at most 92 days. */
const LOOK_AHEAD_DAYS = 91

/**
 * Overbooked pool days with the appointments in each overbooked interval. The branch manager chooses who moves; the
 * list then reloads, and an interval that is no longer overbooked disappears (FE-12).
 */
@Component({
  selector: 'app-overbooked-page',
  imports: [
    EmptyState,
    ErrorPanel,
    LoadingState,
    LocalDatePipe,
    LocalTimePipe,
    MatButton,
    MatCard,
    MatCardContent,
    RouterLink,
    StatusChip,
    TranslatePipe,
    ZoneNote,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="overbooked-title">
      <h1 id="overbooked-title">{{ 'admin.sections.overbooked' | translate }}</h1>
      <p class="intro">{{ 'admin.overbooked.intro' | translate }}</p>
      @if (timeZone(); as zone) {
        <app-zone-note [timeZone]="zone" />
      }
      <app-error-panel [error]="actionError()" [messages]="messages" [serverDetail]="true" />
      @if (error()) {
        <app-error-panel [error]="error()" (retry)="load()" />
      } @else if (!days()) {
        <app-loading-state />
      } @else if (days()!.length === 0) {
        <app-empty-state icon="check_circle" [message]="'admin.overbooked.none' | translate" />
      } @else {
        @for (day of days(); track day.poolId + day.date) {
          <mat-card appearance="outlined" class="day">
            <mat-card-content>
              <h2>{{ day.date | localDate }} · {{ poolName(day.poolId) }}</h2>
              @for (interval of day.intervals; track interval.start) {
                <section class="interval">
                  <h3>
                    {{ interval.start | localTime }}–{{ interval.end | localTime }}
                    <span class="load">
                      {{ 'admin.overbooked.load' | translate: { load: interval.load, capacity: interval.capacity } }}
                    </span>
                  </h3>
                  <ul>
                    @for (appointment of interval.appointments; track appointment.id) {
                      <li>
                        <a [routerLink]="['/admin/appointments', appointment.id]">{{ appointment.reference }}</a>
                        <span>{{ appointment.startTime | localTime }}–{{ appointment.endTime | localTime }}</span>
                        <span>{{ branch.serviceName(appointment.serviceId) ?? '' }}</span>
                        <app-status-chip [status]="appointment.status" />
                        @if (appointment.status === 'BOOKED') {
                          <button
                            mat-stroked-button
                            type="button"
                            [disabled]="working()"
                            (click)="displace(appointment)"
                          >
                            {{ 'admin.overbooked.displace' | translate }}
                          </button>
                        }
                      </li>
                    }
                  </ul>
                </section>
              }
            </mat-card-content>
          </mat-card>
        }
      }
    </section>
  `,
  styles: `
    .intro {
      color: var(--mat-sys-on-surface-variant);
    }
    .day {
      margin-bottom: 1rem;
    }
    h2 {
      margin-top: 0;
      font: var(--mat-sys-title-medium);
    }
    h3 {
      margin: 0.75rem 0 0.25rem;
      font: var(--mat-sys-title-small);
    }
    .load {
      margin-inline-start: 0.5rem;
      color: var(--mat-sys-error);
      font-weight: 400;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
      padding: 0.375rem 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
  `,
})
export class OverbookedPage {
  private readonly api = inject(BookingAdminApi)
  private readonly branchAdmin = inject(BranchAdminApi)
  private readonly dialog = inject(MatDialog)
  private readonly snackBar = inject(MatSnackBar)
  private readonly translate = inject(TranslateService)
  protected readonly branch = useBranch()
  protected readonly messages = staffBookingErrorMessages

  protected readonly timeZone = computed(() => this.branch.detail()?.timeZone)
  protected readonly days = signal<OverbookedDay[] | undefined>(undefined)
  private readonly pools = signal<ReadonlyMap<string, string>>(new Map())
  protected readonly error = signal<unknown>(undefined)
  protected readonly actionError = signal<unknown>(undefined)
  protected readonly working = signal(false)

  constructor() {
    void this.load()
    this.branchAdmin
      .pools()
      .then((pools) => this.pools.set(new Map(pools.map((pool) => [pool.id, pool.name]))))
      .catch(() => undefined)
  }

  protected poolName(poolId: string): string {
    return this.pools().get(poolId) ?? ''
  }

  protected async load(): Promise<void> {
    this.error.set(undefined)
    const from = todayIn(this.timeZone() ?? 'Africa/Johannesburg')
    try {
      this.days.set(await this.api.overbooked(from, addDays(from, LOOK_AHEAD_DAYS)))
    } catch (error) {
      this.error.set(error)
    }
  }

  /** Moving an appointment out needs confirmation naming it; the customer is asked to choose a new time. */
  protected async displace(appointment: Appointment): Promise<void> {
    const t = (key: string, params?: Record<string, string>) => this.translate.instant(key, params) as string
    const confirmed = await confirmAction(this.dialog, {
      title: t('admin.confirm.displace.title'),
      message: t('admin.confirm.displace.message', { reference: appointment.reference }),
      confirmLabel: t('admin.overbooked.displace'),
      cancelLabel: t('common.back'),
      destructive: true,
    })
    if (!confirmed) return
    this.working.set(true)
    this.actionError.set(undefined)
    try {
      await this.api.changeStatus(fromVersion(appointment), 'displace')
      this.snackBar.open(t('admin.done.displace', { reference: appointment.reference }), undefined, { duration: 3000 })
    } catch (error) {
      this.actionError.set(error)
    } finally {
      this.working.set(false)
      await this.load()
    }
  }
}
