import { ChangeDetectionStrategy, Component } from '@angular/core'
import { MatIcon } from '@angular/material/icon'
import { TranslatePipe } from '@ngx-translate/core'

/** The "not allowed" state, shown for a route above the user's role and for any 403 from the API (FE-3). */
@Component({
  selector: 'app-not-allowed',
  imports: [MatIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="not-allowed" role="alert">
      <mat-icon aria-hidden="true">block</mat-icon>
      <h2>{{ 'common.notAllowed.title' | translate }}</h2>
      <p>{{ 'common.notAllowed.body' | translate }}</p>
      <ng-content />
    </section>
  `,
  styles: `
    .not-allowed {
      display: grid;
      justify-items: center;
      gap: 0.25rem;
      padding: 2rem 1rem;
      text-align: center;
    }
    mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--mat-sys-error);
    }
    h2 {
      margin: 0.5rem 0 0;
      font: var(--mat-sys-title-large);
    }
  `,
})
export class NotAllowed {}
