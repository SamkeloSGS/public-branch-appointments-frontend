import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { MatIcon } from '@angular/material/icon'
import { TranslatePipe } from '@ngx-translate/core'

/** What a customer needs to bring for a service; shows nothing when there is nothing to bring. */
@Component({
  selector: 'app-prerequisites-list',
  imports: [MatIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length > 0) {
      <p class="title">
        <mat-icon aria-hidden="true">checklist</mat-icon>
        {{ 'branchManagement.prerequisites.title' | translate }}
      </p>
      <ul>
        @for (item of items(); track $index) {
          <li>{{ item }}</li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .title {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin: 0.5rem 0 0.25rem;
      font: var(--mat-sys-label-large);
    }
    .title mat-icon {
      font-size: 1.125rem;
      width: 1.125rem;
      height: 1.125rem;
    }
    ul {
      margin: 0;
      padding-inline-start: 1.5rem;
      font: var(--mat-sys-body-medium);
    }
  `,
})
export class PrerequisitesList {
  readonly items = input<readonly string[]>([])
}
