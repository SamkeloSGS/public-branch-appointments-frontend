import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { TranslatePipe } from '@ngx-translate/core'

/** The "show more" button under a paged list, with how many of the total are shown. Hidden on the last page. */
@Component({
  selector: 'app-show-more',
  imports: [MatButton, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shown() < total()) {
      <div class="more">
        <button mat-stroked-button type="button" [disabled]="loading()" (click)="more.emit()">
          {{ 'common.showMore' | translate }}
        </button>
        <span class="count" aria-live="polite">{{ 'common.shownOf' | translate: { shown: shown(), total: total() } }}</span>
      </div>
    }
  `,
  styles: `
    .more {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .count {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }
  `,
})
export class ShowMore {
  readonly shown = input.required<number>()
  readonly total = input.required<number>()
  readonly loading = input(false)
  readonly more = output()
}
