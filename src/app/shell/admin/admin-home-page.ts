import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatIcon } from '@angular/material/icon'
import { RouterLink } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import { CurrentUser, Session } from '../../identity'
import { ADMIN_SECTIONS } from './admin-sections'

/** The admin landing page: who is signed in and the screens the role can use. */
@Component({
  selector: 'app-admin-home-page',
  imports: [MatCard, MatCardContent, MatIcon, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="admin-home-title">
      <h1 id="admin-home-title">{{ 'admin.home.title' | translate }}</h1>
      <p>{{ 'admin.home.welcome' | translate: { name: name() } }}</p>
      <ul class="tiles">
        @for (section of sections(); track section.path) {
          <li>
            <a class="tile" [routerLink]="['/admin', section.path]">
              <mat-card appearance="outlined">
                <mat-card-content>
                  <mat-icon aria-hidden="true">{{ section.icon }}</mat-icon>
                  <span>{{ section.label | translate }}</span>
                </mat-card-content>
              </mat-card>
            </a>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .tiles {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
      gap: 1rem;
    }
    .tile {
      color: inherit;
      text-decoration: none;
    }
    .tile:focus-visible {
      outline: 3px solid var(--mat-sys-primary);
      outline-offset: 2px;
      border-radius: var(--mat-sys-corner-medium);
    }
    mat-card-content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
  `,
})
export class AdminHomePage {
  private readonly currentUser = inject(CurrentUser)
  private readonly session = inject(Session)
  protected readonly sections = computed(() =>
    ADMIN_SECTIONS.filter((section) => this.currentUser.can(section.minimumRole)),
  )
  protected readonly name = computed(() => this.currentUser.me()?.displayName ?? this.session.name() ?? '')
}
