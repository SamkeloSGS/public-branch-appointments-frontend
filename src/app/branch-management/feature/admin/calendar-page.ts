import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatCheckbox } from '@angular/material/checkbox'
import { MatDialog } from '@angular/material/dialog'
import { MatFormField, MatLabel } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { MatOption, MatSelect } from '@angular/material/select'
import { MatSnackBar } from '@angular/material/snack-bar'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { confirmAction } from '../../../shared/ui/confirm-dialog'
import { EmptyState } from '../../../shared/ui/empty-state'
import { ErrorPanel } from '../../../shared/ui/error-panel'
import { LoadingState } from '../../../shared/ui/loading-state'
import { LocalDatePipe, LocalTimePipe, formattingLocale } from '../../../shared/ui/format.pipes'
import { formatDate } from '../../../shared/util/format'
import { ZoneNote } from '../../../shared/ui/zone-note'
import {
  OVERRIDE_REASONS,
  fromTimeInput,
  rangeProblems,
  type AdminBranch,
  type CalendarException,
  type CapacityOverride,
  type OverrideReason,
  type Pool,
  type TimeRangeValue,
} from '../../model/branch-admin'
import { BranchAdminApi } from '../../data/branch-admin-api'
import { TimeRangesEditor } from '../../ui/time-ranges-editor'
import { useImpactPreview } from './impact-preview'

interface ExceptionForm {
  date: string
  type: 'CLOSED' | 'SPECIAL_HOURS'
  hours: TimeRangeValue[]
  reason: string
}

interface OverrideForm {
  poolId: string
  date: string
  wholeDay: boolean
  start: string
  end: string
  capacity: number | null
  reason: OverrideReason
  note: string
}

const newExceptionForm = (): ExceptionForm => ({ date: '', type: 'CLOSED', hours: [], reason: '' })
const newOverrideForm = (poolId = ''): OverrideForm => ({
  poolId,
  date: '',
  wholeDay: true,
  start: '',
  end: '',
  capacity: null,
  reason: 'SHORT_STAFFED',
  note: '',
})

const toApiRange = (range: TimeRangeValue) => ({ start: fromTimeInput(range.start), end: fromTimeInput(range.end) })

/**
 * Calendar exceptions (closed days, special hours) and capacity overrides for the branch. Each is previewed
 * first; with appointments displaced or intervals overbooked the admin must confirm (FE-11).
 */
@Component({
  selector: 'app-calendar-page',
  imports: [
    EmptyState,
    ErrorPanel,
    FormsModule,
    LoadingState,
    LocalDatePipe,
    LocalTimePipe,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatCard,
    MatCardContent,
    MatCheckbox,
    MatFormField,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    TimeRangesEditor,
    TranslatePipe,
    ZoneNote,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="calendar-title">
      <h1 id="calendar-title">{{ 'admin.sections.calendar' | translate }}</h1>
      @if (branch(); as branch) {
        <p class="branch">{{ branch.name }}</p>
        <app-zone-note [timeZone]="branch.timeZone" />
      }
      @if (loadError()) {
        <app-error-panel [error]="loadError()" (retry)="load()" />
      } @else if (!exceptions() || !overrides() || !pools()) {
        <app-loading-state />
      } @else {
        <div class="columns">
          <section aria-labelledby="exceptions-title">
            <h2 id="exceptions-title">{{ 'admin.calendar.exceptions' | translate }}</h2>
            @if (exceptions()!.length === 0) {
              <app-empty-state icon="event_available" [message]="'admin.calendar.noExceptions' | translate" />
            } @else {
              <ul class="items">
                @for (exception of exceptions(); track exception.id) {
                  <li>
                    <div>
                      <strong>{{ exception.date | localDate: 'medium' }}</strong>
                      ·
                      @if (exception.type === 'CLOSED') {
                        {{ 'admin.calendar.closed' | translate }}
                      } @else {
                        @for (range of exception.hours; track range.start; let last = $last) {
                          {{ range.start | localTime }}–{{ range.end | localTime }}{{ last ? '' : ', ' }}
                        }
                      }
                      @if (exception.reason) {
                        <div class="detail">{{ exception.reason }}</div>
                      }
                    </div>
                    <button mat-button type="button" class="destructive" [disabled]="working()" (click)="removeException(exception)">
                      {{ 'admin.remove' | translate }}
                    </button>
                  </li>
                }
              </ul>
            }

            <mat-card appearance="outlined">
              <mat-card-content>
                <h3>{{ 'admin.calendar.addException' | translate }}</h3>
                <app-error-panel [error]="exceptionError()" [serverDetail]="true" />
                <form #exceptionNgForm="ngForm" (ngSubmit)="addException(exceptionNgForm.valid ?? false)">
                  <mat-form-field>
                    <mat-label>{{ 'admin.calendar.date' | translate }}</mat-label>
                    <input matInput type="date" name="exceptionDate" required [min]="today()" [(ngModel)]="exceptionForm.date" />
                  </mat-form-field>
                  <mat-button-toggle-group
                    name="exceptionType"
                    [(ngModel)]="exceptionForm.type"
                    [attr.aria-label]="'admin.calendar.type' | translate"
                  >
                    <mat-button-toggle value="CLOSED">{{ 'admin.calendar.closed' | translate }}</mat-button-toggle>
                    <mat-button-toggle value="SPECIAL_HOURS">{{ 'admin.calendar.specialHours' | translate }}</mat-button-toggle>
                  </mat-button-toggle-group>
                  @if (exceptionForm.type === 'SPECIAL_HOURS') {
                    <div class="hours">
                      <app-time-ranges-editor
                        [ranges]="exceptionForm.hours"
                        [label]="'admin.calendar.specialHours' | translate"
                        (rangesChange)="exceptionForm.hours = $event"
                      />
                      @if (hoursMissing()) {
                        <p class="problem" role="alert">{{ 'admin.calendar.hoursRequired' | translate }}</p>
                      }
                    </div>
                  }
                  <mat-form-field class="wide">
                    <mat-label>{{ 'admin.calendar.reason' | translate }}</mat-label>
                    <input matInput name="exceptionReason" maxlength="200" [(ngModel)]="exceptionForm.reason" />
                  </mat-form-field>
                  <button mat-flat-button type="submit" [disabled]="working()">{{ 'admin.calendar.save' | translate }}</button>
                </form>
              </mat-card-content>
            </mat-card>
          </section>

          <section aria-labelledby="overrides-title">
            <h2 id="overrides-title">{{ 'admin.calendar.overrides' | translate }}</h2>
            @if (overrides()!.length === 0) {
              <app-empty-state icon="tune" [message]="'admin.calendar.noOverrides' | translate" />
            } @else {
              <ul class="items">
                @for (override of overrides(); track override.id) {
                  <li>
                    <div>
                      <strong>{{ override.date | localDate: 'medium' }}</strong>
                      · {{ poolName(override.poolId) }} ·
                      @if (override.window; as window) {
                        {{ window.start | localTime }}–{{ window.end | localTime }}
                      } @else {
                        {{ 'admin.calendar.wholeDay' | translate }}
                      }
                      · {{ 'admin.calendar.capacityOf' | translate: { capacity: override.capacity } }}
                      <div class="detail">
                        {{ 'admin.calendar.reasons.' + override.reason | translate }}
                        @if (override.note) {
                          – {{ override.note }}
                        }
                      </div>
                    </div>
                    <button mat-button type="button" class="destructive" [disabled]="working()" (click)="removeOverride(override)">
                      {{ 'admin.remove' | translate }}
                    </button>
                  </li>
                }
              </ul>
            }

            <mat-card appearance="outlined">
              <mat-card-content>
                <h3>{{ 'admin.calendar.addOverride' | translate }}</h3>
                <app-error-panel [error]="overrideError()" [serverDetail]="true" />
                <form #overrideNgForm="ngForm" (ngSubmit)="addOverride(overrideNgForm.valid ?? false)">
                  <div class="grid">
                    <mat-form-field>
                      <mat-label>{{ 'admin.capacity.pool' | translate }}</mat-label>
                      <mat-select name="overridePool" required [(ngModel)]="overrideForm.poolId">
                        @for (pool of pools(); track pool.id) {
                          <mat-option [value]="pool.id">{{ pool.name }} ({{ pool.baseCapacity }})</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field>
                      <mat-label>{{ 'admin.calendar.date' | translate }}</mat-label>
                      <input matInput type="date" name="overrideDate" required [min]="today()" [(ngModel)]="overrideForm.date" />
                    </mat-form-field>
                    <mat-form-field>
                      <mat-label>{{ 'admin.calendar.capacity' | translate }}</mat-label>
                      <input matInput type="number" name="overrideCapacity" required min="0" [(ngModel)]="overrideForm.capacity" />
                    </mat-form-field>
                    <mat-form-field>
                      <mat-label>{{ 'admin.calendar.reason' | translate }}</mat-label>
                      <mat-select name="overrideReason" required [(ngModel)]="overrideForm.reason">
                        @for (reason of reasons; track reason) {
                          <mat-option [value]="reason">{{ 'admin.calendar.reasons.' + reason | translate }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>
                  <mat-checkbox name="wholeDay" [(ngModel)]="overrideForm.wholeDay">
                    {{ 'admin.calendar.wholeDay' | translate }}
                  </mat-checkbox>
                  @if (!overrideForm.wholeDay) {
                    <div class="grid">
                      <mat-form-field>
                        <mat-label>{{ 'admin.hours.from' | translate }}</mat-label>
                        <input matInput type="time" name="windowStart" required [(ngModel)]="overrideForm.start" />
                      </mat-form-field>
                      <mat-form-field>
                        <mat-label>{{ 'admin.hours.to' | translate }}</mat-label>
                        <input matInput type="time" name="windowEnd" required [(ngModel)]="overrideForm.end" />
                      </mat-form-field>
                    </div>
                  }
                  <mat-form-field class="wide">
                    <mat-label>{{ 'admin.calendar.note' | translate }}</mat-label>
                    <input matInput name="overrideNote" maxlength="200" [(ngModel)]="overrideForm.note" />
                  </mat-form-field>
                  <button mat-flat-button type="submit" [disabled]="working()">{{ 'admin.calendar.save' | translate }}</button>
                </form>
              </mat-card-content>
            </mat-card>
          </section>
        </div>
      }
    </section>
  `,
  styles: `
    .branch {
      margin-top: -0.5rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
      gap: 1.5rem;
      align-items: start;
    }
    .items {
      list-style: none;
      margin: 0 0 1rem;
      padding: 0;
    }
    .items li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .detail {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .destructive {
      --mat-button-text-label-text-color: var(--mat-sys-error);
    }
    h3 {
      margin-top: 0;
      font: var(--mat-sys-title-medium);
    }
    form {
      display: grid;
      gap: 0.5rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
      gap: 0 1rem;
    }
    .problem {
      margin: 0.25rem 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-error);
    }
    .hours {
      margin: 0.25rem 0 0.5rem;
    }
    form > button {
      justify-self: start;
    }
  `,
})
export class CalendarPage {
  private readonly api = inject(BranchAdminApi)
  private readonly dialog = inject(MatDialog)
  private readonly snackBar = inject(MatSnackBar)
  private readonly translate = inject(TranslateService)
  private readonly confirmImpact = useImpactPreview()

  protected readonly reasons = OVERRIDE_REASONS
  protected readonly branch = signal<AdminBranch | undefined>(undefined)
  protected readonly pools = signal<Pool[] | undefined>(undefined)
  protected readonly exceptions = signal<CalendarException[] | undefined>(undefined)
  protected readonly overrides = signal<CapacityOverride[] | undefined>(undefined)
  protected readonly loadError = signal<unknown>(undefined)
  protected readonly exceptionError = signal<unknown>(undefined)
  protected readonly overrideError = signal<unknown>(undefined)
  protected readonly working = signal(false)
  /** Special hours need at least one valid range */
  protected readonly hoursMissing = signal(false)
  protected readonly today = computed(() => {
    const zone = this.branch()?.timeZone ?? 'Africa/Johannesburg'
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date())
  })
  protected exceptionForm: ExceptionForm = newExceptionForm()
  protected overrideForm: OverrideForm = newOverrideForm()

  constructor() {
    void this.load()
  }

  protected async load(): Promise<void> {
    this.loadError.set(undefined)
    try {
      const [branch, pools, exceptions, overrides] = await Promise.all([
        this.api.branch(),
        this.api.pools(),
        this.api.exceptions(),
        this.api.overrides(),
      ])
      this.branch.set(branch.value)
      this.pools.set(pools)
      this.exceptions.set([...exceptions].sort((a, b) => a.date.localeCompare(b.date)))
      this.overrides.set([...overrides].sort((a, b) => a.date.localeCompare(b.date)))
      if (!this.overrideForm.poolId) this.overrideForm.poolId = pools[0]?.id ?? ''
    } catch (error) {
      this.loadError.set(error)
    }
  }

  protected poolName(poolId: string): string {
    return this.pools()?.find((pool) => pool.id === poolId)?.name ?? ''
  }

  private done(): void {
    this.snackBar.open(this.translate.instant('admin.saved') as string, undefined, { duration: 3000 })
  }

  protected async addException(valid: boolean): Promise<void> {
    const form = this.exceptionForm
    if (!valid) return
    const hoursMissing = form.type === 'SPECIAL_HOURS' && (form.hours.length === 0 || rangeProblems(form.hours).length > 0)
    this.hoursMissing.set(hoursMissing)
    if (hoursMissing) return
    const hours = form.type === 'SPECIAL_HOURS' ? form.hours.map(toApiRange) : []
    this.working.set(true)
    this.exceptionError.set(undefined)
    try {
      const go = await this.confirmImpact({
        kind: 'CALENDAR_EXCEPTION',
        date: form.date,
        exceptionType: form.type,
        hours,
      })
      if (!go) return
      const added = await this.api.addException({
        date: form.date,
        type: form.type,
        hours,
        reason: form.reason.trim() || undefined,
      })
      this.exceptions.update((list) => [...(list ?? []), added].sort((a, b) => a.date.localeCompare(b.date)))
      this.exceptionForm = newExceptionForm()
      this.done()
    } catch (error) {
      this.exceptionError.set(error)
    } finally {
      this.working.set(false)
    }
  }

  protected async addOverride(valid: boolean): Promise<void> {
    const form = this.overrideForm
    if (!valid || form.capacity === null) return
    const window = form.wholeDay ? undefined : { start: fromTimeInput(form.start), end: fromTimeInput(form.end) }
    this.working.set(true)
    this.overrideError.set(undefined)
    try {
      const go = await this.confirmImpact({
        kind: 'CAPACITY_OVERRIDE',
        date: form.date,
        poolId: form.poolId,
        window,
        capacity: form.capacity,
      })
      if (!go) return
      const added = await this.api.setOverride({
        poolId: form.poolId,
        date: form.date,
        window,
        capacity: form.capacity,
        reason: form.reason,
        note: form.note.trim() || undefined,
      })
      this.overrides.update((list) => [...(list ?? []), added].sort((a, b) => a.date.localeCompare(b.date)))
      this.overrideForm = newOverrideForm(form.poolId)
      this.done()
    } catch (error) {
      this.overrideError.set(error)
    } finally {
      this.working.set(false)
    }
  }

  private longDate(date: string): string {
    return formatDate(date, formattingLocale(this.translate.getCurrentLang()))
  }

  private async confirmRemoval(message: string): Promise<boolean> {
    const t = (key: string) => this.translate.instant(key) as string
    return confirmAction(this.dialog, {
      title: t('admin.calendar.removeTitle'),
      message,
      confirmLabel: t('admin.remove'),
      cancelLabel: t('common.cancel'),
    })
  }

  protected async removeException(exception: CalendarException): Promise<void> {
    const message = this.translate.instant('admin.calendar.removeException', { date: this.longDate(exception.date) }) as string
    if (!(await this.confirmRemoval(message))) return
    await this.remove(
      () => this.api.removeException(exception.id),
      () => this.exceptions.update((list) => list?.filter((candidate) => candidate.id !== exception.id)),
      this.exceptionError,
    )
  }

  protected async removeOverride(override: CapacityOverride): Promise<void> {
    const message = this.translate.instant('admin.calendar.removeOverride', { date: this.longDate(override.date) }) as string
    if (!(await this.confirmRemoval(message))) return
    await this.remove(
      () => this.api.removeOverride(override.id),
      () => this.overrides.update((list) => list?.filter((candidate) => candidate.id !== override.id)),
      this.overrideError,
    )
  }

  private async remove(
    action: () => Promise<void>,
    after: () => void,
    errorSignal: ReturnType<typeof signal<unknown>>,
  ): Promise<void> {
    this.working.set(true)
    errorSignal.set(undefined)
    try {
      await action()
      after()
      this.done()
    } catch (error) {
      errorSignal.set(error)
    } finally {
      this.working.set(false)
    }
  }
}
