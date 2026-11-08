import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { LocalTimePipe } from '../../shared/ui/format.pipes'

/** Open start times as buttons, in branch-local time. */
@Component({
  selector: 'app-time-slot-grid',
  imports: [LocalTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="slots" [attr.aria-label]="label()">
      @for (time of times(); track time) {
        <li>
          <button
            type="button"
            class="slot"
            [class.selected]="time === selected()"
            [attr.aria-pressed]="time === selected()"
            (click)="select.emit(time)"
          >
            {{ time | localTime }}
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    .slots {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
      gap: 0.5rem;
    }
    .slot {
      width: 100%;
      min-height: 2.75rem;
      border: 1px solid var(--mat-sys-outline);
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-surface);
      color: var(--mat-sys-primary);
      font: var(--mat-sys-label-large);
      cursor: pointer;
    }
    .slot:hover {
      background: var(--mat-sys-surface-container-high);
    }
    .slot:focus-visible {
      outline: 3px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
    .slot.selected {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
  `,
})
export class TimeSlotGrid {
  readonly times = input.required<readonly string[]>()
  readonly selected = input<string>()
  readonly label = input.required<string>()
  readonly select = output<string>()
}
