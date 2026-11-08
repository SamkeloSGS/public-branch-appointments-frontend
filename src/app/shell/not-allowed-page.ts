import { ChangeDetectionStrategy, Component } from '@angular/core'
import { MatAnchor } from '@angular/material/button'
import { RouterLink } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import { NotAllowed } from '../shared/ui/not-allowed'

/** Shown for a route above the user's role (FE-3). */
@Component({
  selector: 'app-not-allowed-page',
  imports: [MatAnchor, NotAllowed, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-not-allowed>
        <a mat-stroked-button routerLink="/">{{ 'common.home' | translate }}</a>
      </app-not-allowed>
    </div>
  `,
})
export class NotAllowedPage {}
