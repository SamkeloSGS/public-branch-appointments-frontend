import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatSnackBar } from '@angular/material/snack-bar'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { ErrorPanel } from '../../../shared/ui/error-panel'
import { LoadingState } from '../../../shared/ui/loading-state'
import { ZoneNote } from '../../../shared/ui/zone-note'
import type { Versioned } from '../../../shared/util/etag'
import { isApiError } from '../../../shared/util/problem'
import { DAYS_OF_WEEK, type DayOfWeek } from '../../model/branch'
import {
  rangeProblems,
  weeklyHoursOf,
  weeklyHoursRequest,
  type AdminBranch,
  type TimeRangeValue,
  type WeeklyHours,
} from '../../model/branch-admin'
import { BranchAdminApi } from '../../data/branch-admin-api'
import { TimeRangesEditor } from '../../ui/time-ranges-editor'
import { useImpactPreview } from './impact-preview'

/** Weekly opening hours of the branch, in its local time (FE-11). */
@Component({
  selector: 'app-hours-page',
  imports: [ErrorPanel, LoadingState, MatButton, MatCard, MatCardContent, TimeRangesEditor, TranslatePipe, ZoneNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page narrow" aria-labelledby="hours-title">
      <h1 id="hours-title">{{ 'admin.sections.hours' | translate }}</h1>
      @if (loadError()) {
        <app-error-panel [error]="loadError()" (retry)="load()" />
      } @else if (branch(); as branch) {
        <p class="branch">{{ branch.value.name }}</p>
        <app-zone-note [timeZone]="branch.value.timeZone" />
        @if (staleNotice()) {
          <p class="notice" role="alert">{{ 'errors.staleKept' | translate }}</p>
        }
        <app-error-panel [error]="saveError()" [serverDetail]="true" />
        <mat-card appearance="outlined">
          <mat-card-content>
            <dl class="week">
              @for (day of days; track day) {
                <div class="day">
                  <dt>{{ 'days.' + day | translate }}</dt>
                  <dd>
                    <app-time-ranges-editor
                      [ranges]="hours()[day]"
                      [label]="'days.' + day | translate"
                      (rangesChange)="setDay(day, $event)"
                    />
                  </dd>
                </div>
              }
            </dl>
          </mat-card-content>
        </mat-card>
        <div class="actions">
          <button mat-flat-button type="button" [disabled]="saving() || invalid()" (click)="save()">
            {{ 'admin.hours.save' | translate }}
          </button>
          <button mat-button type="button" [disabled]="saving()" (click)="reset()">
            {{ 'admin.hours.undo' | translate }}
          </button>
        </div>
      } @else {
        <app-loading-state />
      }
    </section>
  `,
  styles: `
    .branch {
      margin-top: -0.5rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .week {
      margin: 0;
    }
    .day {
      display: grid;
      grid-template-columns: 7rem minmax(0, 1fr);
      align-items: start;
      gap: 0.5rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    dt {
      padding-top: 0.5rem;
      font-weight: 500;
    }
    dd {
      margin: 0;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .notice {
      padding: 0.75rem 1rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    @media (max-width: 599px) {
      .day {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class HoursPage {
  private readonly api = inject(BranchAdminApi)
  private readonly snackBar = inject(MatSnackBar)
  private readonly translate = inject(TranslateService)
  private readonly confirmImpact = useImpactPreview()

  protected readonly days = DAYS_OF_WEEK
  protected readonly branch = signal<Versioned<AdminBranch> | undefined>(undefined)
  protected readonly hours = signal<WeeklyHours>(weeklyHoursOf({}))
  protected readonly loadError = signal<unknown>(undefined)
  protected readonly saveError = signal<unknown>(undefined)
  protected readonly saving = signal(false)
  protected readonly staleNotice = signal(false)
  protected readonly invalid = computed(() => DAYS_OF_WEEK.some((day) => rangeProblems(this.hours()[day]).length > 0))

  constructor() {
    void this.load()
  }

  protected async load(keepInput = false): Promise<void> {
    this.loadError.set(undefined)
    try {
      const branch = await this.api.branch()
      this.branch.set(branch)
      if (!keepInput) this.hours.set(weeklyHoursOf(branch.value.weeklyHours))
    } catch (error) {
      this.loadError.set(error)
    }
  }

  protected setDay(day: DayOfWeek, ranges: TimeRangeValue[]): void {
    this.hours.update((hours) => ({ ...hours, [day]: ranges }))
  }

  protected reset(): void {
    const branch = this.branch()
    if (branch) this.hours.set(weeklyHoursOf(branch.value.weeklyHours))
    this.saveError.set(undefined)
    this.staleNotice.set(false)
  }

  protected async save(): Promise<void> {
    const current = this.branch()
    if (!current || this.invalid()) return
    const days = weeklyHoursRequest(this.hours())
    this.saving.set(true)
    this.saveError.set(undefined)
    this.staleNotice.set(false)
    try {
      if (!(await this.confirmImpact({ kind: 'WEEKLY_HOURS', weeklyHours: days }))) return
      const saved = await this.api.updateWeeklyHours(current, days)
      this.branch.set(saved)
      this.hours.set(weeklyHoursOf(saved.value.weeklyHours))
      this.snackBar.open(this.translate.instant('admin.saved') as string, undefined, { duration: 3000 })
    } catch (error) {
      if (isApiError(error) && error.isStale) {
        // Changed elsewhere: load the latest version but keep the hours being edited (FE-15)
        await this.load(true)
        this.staleNotice.set(true)
      } else this.saveError.set(error)
    } finally {
      this.saving.set(false)
    }
  }
}
