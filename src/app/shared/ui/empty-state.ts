import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { MatIcon } from '@angular/material/icon'

@Component({
  selector: 'app-empty-state',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty" role="status">
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
      <p>{{ message() }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    .empty {
      display: grid;
      justify-items: center;
      gap: 0.5rem;
      padding: 2rem 1rem;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
    }
    p {
      margin: 0;
    }
  `,
})
export class EmptyState {
  readonly message = input.required<string>()
  readonly icon = input('inbox')
}
