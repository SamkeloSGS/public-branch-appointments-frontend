import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { MatProgressSpinner } from '@angular/material/progress-spinner'
import { TranslatePipe } from '@ngx-translate/core'

@Component({
  selector: 'app-loading-state',
  imports: [MatProgressSpinner, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loading" role="status" aria-live="polite">
      <mat-progress-spinner mode="indeterminate" diameter="28" aria-hidden="true" />
      <span>{{ label() ?? ('common.loading' | translate) }}</span>
    </div>
  `,
  styles: `
    .loading {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1.5rem 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class LoadingState {
  readonly label = input<string>()
}
