import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { MatButton, MatIconButton } from '@angular/material/button'
import { MatIcon } from '@angular/material/icon'
import { TranslatePipe } from '@ngx-translate/core'
import { rangeProblems, type TimeRangeValue } from '../model/branch-admin'

/** Opening times of one day as ranges, edited in place; no ranges means closed. */
@Component({
  selector: 'app-time-ranges-editor',
  imports: [MatButton, MatIcon, MatIconButton, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ranges" role="group" [attr.aria-label]="label()">
      @for (range of ranges(); track $index; let index = $index) {
        <div class="range">
          <input
            type="time"
            class="time"
            required
            [value]="range.start"
            [attr.aria-label]="('admin.hours.from' | translate) + ' – ' + label()"
            (change)="update(index, 'start', $any($event.target).value)"
          />
          <span aria-hidden="true">–</span>
          <input
            type="time"
            class="time"
            required
            [value]="range.end"
            [attr.aria-label]="('admin.hours.to' | translate) + ' – ' + label()"
            (change)="update(index, 'end', $any($event.target).value)"
          />
          <button
            mat-icon-button
            type="button"
            [attr.aria-label]="('admin.hours.removeRange' | translate) + ' – ' + label()"
            (click)="remove(index)"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>
      } @empty {
        <span class="closed">{{ 'branchManagement.closed' | translate }}</span>
      }
      <button mat-button type="button" class="add" (click)="add()">
        <mat-icon>add</mat-icon>
        {{ 'admin.hours.addRange' | translate }}
      </button>
      @for (problem of problems(); track problem) {
        <p class="problem" role="alert">{{ problem | translate }}</p>
      }
    </div>
  `,
  styles: `
    .ranges {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 0.75rem;
    }
    .range {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    .time {
      padding: 0.375rem 0.5rem;
      border: 1px solid var(--mat-sys-outline);
      border-radius: var(--mat-sys-corner-extra-small);
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-medium);
    }
    .time:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 1px;
    }
    .closed {
      color: var(--mat-sys-on-surface-variant);
    }
    .problem {
      flex-basis: 100%;
      margin: 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-error);
    }
  `,
})
export class TimeRangesEditor {
  readonly ranges = input.required<readonly TimeRangeValue[]>()
  readonly label = input.required<string>()
  readonly rangesChange = output<TimeRangeValue[]>()

  protected readonly problems = computed(() => rangeProblems(this.ranges()))

  protected update(index: number, field: keyof TimeRangeValue, value: string): void {
    this.rangesChange.emit(this.ranges().map((range, at) => (at === index ? { ...range, [field]: value } : range)))
  }

  protected remove(index: number): void {
    this.rangesChange.emit(this.ranges().filter((_, at) => at !== index))
  }

  protected add(): void {
    const last = this.ranges().at(-1)
    this.rangesChange.emit([...this.ranges(), last ? { start: last.end, end: '' } : { start: '08:00', end: '16:00' }])
  }
}
