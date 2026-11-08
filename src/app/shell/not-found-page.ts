import { ChangeDetectionStrategy, Component } from '@angular/core'
import { MatAnchor } from '@angular/material/button'
import { RouterLink } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import { EmptyState } from '../shared/ui/empty-state'

@Component({
  selector: 'app-not-found-page',
  imports: [EmptyState, MatAnchor, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="not-found-title">
      <h1 id="not-found-title">{{ 'common.notFound.title' | translate }}</h1>
      <app-empty-state icon="explore_off" [message]="'common.notFound.body' | translate">
        <a mat-stroked-button routerLink="/">{{ 'common.home' | translate }}</a>
      </app-empty-state>
    </section>
  `,
})
export class NotFoundPage {}
