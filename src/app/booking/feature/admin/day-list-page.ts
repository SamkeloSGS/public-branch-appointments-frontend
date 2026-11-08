import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton, MatIconButton } from '@angular/material/button'
import { MatDialog } from '@angular/material/dialog'
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field'
import { MatIcon } from '@angular/material/icon'
import { MatInput } from '@angular/material/input'
import { MatSnackBar } from '@angular/material/snack-bar'
import { Router, RouterLink } from '@angular/router'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { confirmAction } from '../../../shared/ui/confirm-dialog'
import { EmptyState } from '../../../shared/ui/empty-state'
import { ErrorPanel } from '../../../shared/ui/error-panel'
import { LoadingState } from '../../../shared/ui/loading-state'
import { LocalDatePipe, LocalTimePipe } from '../../../shared/ui/format.pipes'
import { ZoneNote } from '../../../shared/ui/zone-note'
import { fromVersion } from '../../../shared/util/etag'
import { hasCode, isApiError } from '../../../shared/util/problem'
import { APP_SETTINGS } from '../../../shared/util/settings'
import { staffBookingErrorMessages, type Appointment } from '../../model/appointment'
import { addDays, isLocalDate, todayIn } from '../../model/calendar'
import { byStart, replaceInDayList, staffActions, type DayListEntry, type StaffAction } from '../../model/staff-actions'
import { BookingAdminApi, type StatusAction } from '../../data/booking-admin-api'
import { StatusChip } from '../../ui/status-chip'
import { useBranch } from '../branch-details'

const STATUS_ACTIONS: Partial<Record<StaffAction, StatusAction>> = {
  checkIn: 'check-in',
  complete: 'complete',
  noShow: 'no-show',
  cancel: 'cancel',
}

/**
 * The branch's appointments for a date, by start time, with only the actions valid for each row's status and
 * the current time. A row takes the server's answer after an action, without reloading the page (FE-9).
 */
@Component({
  selector: 'app-day-list-page',
  imports: [
    EmptyState,
    ErrorPanel,
    FormsModule,
    LoadingState,
    LocalDatePipe,
    LocalTimePipe,
    MatButton,
    MatFormField,
    MatIcon,
    MatIconButton,
    MatInput,
    MatLabel,
    MatSuffix,
    RouterLink,
    StatusChip,
    TranslatePipe,
    ZoneNote,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="day-title">
      <h1 id="day-title">{{ 'admin.sections.day' | translate }}</h1>
      <div class="toolbar">
        <div class="date">
          <button mat-icon-button type="button" [attr.aria-label]="'admin.day.previous' | translate" (click)="shift(-1)">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>{{ 'admin.day.date' | translate }}</mat-label>
            <input matInput type="date" [ngModel]="day()" (ngModelChange)="chooseDate($event)" />
          </mat-form-field>
          <button mat-icon-button type="button" [attr.aria-label]="'admin.day.next' | translate" (click)="shift(1)">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <button mat-button type="button" (click)="chooseDate(today())">{{ 'admin.day.today' | translate }}</button>
        </div>
        <form class="find" (submit)="$event.preventDefault(); findReference()">
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>{{ 'admin.day.reference' | translate }}</mat-label>
            <input matInput name="reference" autocomplete="off" [(ngModel)]="reference" />
            <button mat-icon-button matSuffix type="submit" [attr.aria-label]="'admin.day.find' | translate">
              <mat-icon>search</mat-icon>
            </button>
          </mat-form-field>
        </form>
        <a mat-flat-button routerLink="/admin/book">
          <mat-icon>add</mat-icon>
          {{ 'admin.sections.book' | translate }}
        </a>
      </div>
      <app-error-panel [error]="findError()" [messages]="messages" />
      <h2 class="day">{{ day() | localDate }}</h2>
      @if (timeZone(); as zone) {
        <app-zone-note [timeZone]="zone" />
      }
      <app-error-panel [error]="actionError()" [messages]="messages" [serverDetail]="true" />
      @if (error()) {
        <app-error-panel [error]="error()" (retry)="load()" />
      } @else if (!entries()) {
        <app-loading-state />
      } @else if (entries()!.length === 0) {
        <app-empty-state icon="event_available" [message]="'admin.day.none' | translate" />
      } @else {
        <div class="table-scroll">
          <table class="admin-table">
            <caption class="visually-hidden">{{ 'admin.day.caption' | translate: { date: (day() | localDate) } }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ 'admin.day.time' | translate }}</th>
                <th scope="col">{{ 'admin.day.customer' | translate }}</th>
                <th scope="col">{{ 'admin.day.service' | translate }}</th>
                <th scope="col">{{ 'admin.day.status' | translate }}</th>
                <th scope="col">{{ 'admin.day.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of entries(); track entry.appointment.id) {
                <tr>
                  <td class="time">
                    {{ entry.appointment.startTime | localTime }}–{{ entry.appointment.endTime | localTime }}
                  </td>
                  <td>
                    <a [routerLink]="['/admin/appointments', entry.appointment.id]">
                      {{ entry.customerName ?? ('admin.day.unknownCustomer' | translate) }}
                    </a>
                    <div class="reference">{{ entry.appointment.reference }}</div>
                  </td>
                  <td>{{ branch.serviceName(entry.appointment.serviceId) ?? '…' }}</td>
                  <td><app-status-chip [status]="entry.appointment.status" /></td>
                  <td class="actions">
                    @for (action of actionsFor(entry.appointment); track action) {
                      <button
                        mat-stroked-button
                        type="button"
                        [class.destructive]="action === 'cancel' || action === 'noShow'"
                        [disabled]="working() === entry.appointment.id"
                        [attr.aria-label]="
                          ('admin.actions.' + action | translate) + ' – ' + (entry.customerName ?? entry.appointment.reference)
                        "
                        (click)="run(entry, action)"
                      >
                        {{ 'admin.actions.' + action | translate }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1.5rem;
      margin-bottom: 0.5rem;
    }
    .date,
    .find {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .day {
      margin: 1rem 0 0.25rem;
      font: var(--mat-sys-title-medium);
    }
    .time {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .reference {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }
    .destructive {
      --mat-button-outlined-label-text-color: var(--mat-sys-error);
    }
  `,
})
export class DayListPage {
  /** Optional ?date=yyyy-MM-dd */
  readonly date = input<string>()

  private readonly api = inject(BookingAdminApi)
  private readonly router = inject(Router)
  private readonly dialog = inject(MatDialog)
  private readonly snackBar = inject(MatSnackBar)
  private readonly translate = inject(TranslateService)
  private readonly settings = inject(APP_SETTINGS)
  protected readonly branch = useBranch()
  protected readonly messages = staffBookingErrorMessages

  protected readonly timeZone = computed(() => this.branch.detail()?.timeZone)
  protected readonly today = computed(() => todayIn(this.timeZone() ?? 'Africa/Johannesburg'))
  protected readonly day = computed(() => {
    const requested = this.date()
    return isLocalDate(requested) ? requested : this.today()
  })
  protected readonly entries = signal<DayListEntry[] | undefined>(undefined)
  protected readonly error = signal<unknown>(undefined)
  protected readonly actionError = signal<unknown>(undefined)
  protected readonly findError = signal<unknown>(undefined)
  protected readonly working = signal<string | undefined>(undefined)
  /** Re-evaluated every minute, so a no-show becomes possible without a reload */
  private readonly now = signal(new Date())
  protected reference = ''

  constructor() {
    effect(() => {
      this.day()
      untracked(() => void this.load())
    })
    const timer = setInterval(() => this.now.set(new Date()), 60_000)
    inject(DestroyRef).onDestroy(() => clearInterval(timer))
  }

  protected async load(): Promise<void> {
    const date = this.day()
    this.entries.set(undefined)
    this.error.set(undefined)
    try {
      const entries = await this.api.dayList(date)
      if (date === this.day()) this.entries.set(byStart(entries))
    } catch (error) {
      this.error.set(error)
    }
  }

  protected actionsFor(appointment: Appointment): StaffAction[] {
    return staffActions(appointment, {
      today: this.today(),
      now: this.now(),
      noShowGraceMinutes: this.settings.noShowGraceMinutes,
    })
  }

  protected chooseDate(date: string): void {
    if (!isLocalDate(date)) return
    void this.router.navigate([], { queryParams: { date: date === this.today() ? null : date }, replaceUrl: true })
  }

  protected shift(days: number): void {
    this.chooseDate(addDays(this.day(), days))
  }

  protected async findReference(): Promise<void> {
    const reference = this.reference.trim().toUpperCase()
    if (!reference) return
    this.findError.set(undefined)
    try {
      const appointment = await this.api.byReference(reference)
      await this.router.navigate(['/admin/appointments', appointment.id])
    } catch (error) {
      this.findError.set(error)
    }
  }

  protected async run(entry: DayListEntry, action: StaffAction): Promise<void> {
    if (action === 'reschedule') {
      await this.router.navigate(['/admin/appointments', entry.appointment.id], { queryParams: { reschedule: 1 } })
      return
    }
    const statusAction = STATUS_ACTIONS[action]
    if (!statusAction) return
    if (action === 'cancel' || action === 'noShow') {
      const t = (key: string, params?: Record<string, string>) => this.translate.instant(key, params) as string
      const who = entry.customerName ?? entry.appointment.reference
      const confirmed = await confirmAction(this.dialog, {
        title: t(`admin.confirm.${action}.title`),
        message: t(`admin.confirm.${action}.message`, { customer: who, reference: entry.appointment.reference }),
        confirmLabel: t(`admin.actions.${action}`),
        cancelLabel: t('common.back'),
        destructive: true,
      })
      if (!confirmed) return
    }
    this.working.set(entry.appointment.id)
    this.actionError.set(undefined)
    try {
      const updated = await this.api.changeStatus(fromVersion(entry.appointment), statusAction)
      this.entries.update((entries) => entries && replaceInDayList(entries, updated.value))
      this.snackBar.open(this.translate.instant(`admin.done.${action}`) as string, undefined, { duration: 3000 })
    } catch (error) {
      this.actionError.set(error)
      if ((isApiError(error) && error.isStale) || hasCode(error, 'INVALID_STATE')) {
        await this.refreshRow(entry.appointment.id)
      }
    } finally {
      this.working.set(undefined)
    }
  }

  /** The row changed elsewhere: show its latest version (FE-15). */
  private async refreshRow(id: string): Promise<void> {
    try {
      const latest = await this.api.appointment(id)
      this.entries.update((entries) => entries && replaceInDayList(entries, latest.value))
    } catch {
      await this.load()
    }
  }
}
