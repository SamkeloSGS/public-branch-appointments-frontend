import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { MatIcon } from '@angular/material/icon'
import { TranslatePipe } from '@ngx-translate/core'
import { BOOKING_STEPS, type BookingStep } from '../model/selection'

/** Where the customer is in the four booking steps. */
@Component({
  selector: 'app-step-indicator',
  imports: [MatIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="steps" [attr.aria-label]="'booking.steps.label' | translate">
      @for (step of steps; track step; let index = $index) {
        <li
          [class.done]="index < currentIndex()"
          [class.current]="index === currentIndex()"
          [attr.aria-current]="index === currentIndex() ? 'step' : null"
        >
          <span class="marker" aria-hidden="true">
            @if (index < currentIndex()) {
              <mat-icon class="tick">check</mat-icon>
            } @else {
              {{ index + 1 }}
            }
          </span>
          <span class="name">{{ 'booking.steps.' + step | translate }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    .steps {
      list-style: none;
      display: flex;
      gap: 0.25rem;
      margin: 0 0 1.25rem;
      padding: 0;
    }
    li {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      min-width: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-small);
    }
    .tick {
      width: 18px;
      height: 18px;
      font-size: 18px;
      line-height: 18px;
    }
    .marker {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 50%;
      border: 1px solid var(--mat-sys-outline);
    }
    .done .marker {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      border-color: transparent;
    }
    .current {
      color: var(--mat-sys-primary);
      font-weight: 600;
    }
    .current .marker {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      border-color: transparent;
    }
    .name {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class StepIndicator {
  readonly current = input.required<BookingStep>()
  protected readonly steps = BOOKING_STEPS
  protected readonly currentIndex = computed(() => BOOKING_STEPS.indexOf(this.current()))
}
