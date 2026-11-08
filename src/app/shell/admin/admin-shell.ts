import { BreakpointObserver } from '@angular/cdk/layout'
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { MatButton, MatIconButton } from '@angular/material/button'
import { MatIcon } from '@angular/material/icon'
import { MatListItem, MatListItemIcon, MatNavList } from '@angular/material/list'
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav'
import { MatToolbar } from '@angular/material/toolbar'
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import { map } from 'rxjs'
import { BranchCatalog } from '../../branch-management'
import { CurrentUser, Session } from '../../identity'
import { ADMIN_SECTIONS } from './admin-sections'

/**
 * Layout of the admin area: desktop-first, a menu showing only what the role can use (FE-3), and the branch's name in
 * the header (spec 4.2).
 */
@Component({
  selector: 'app-admin-shell',
  imports: [
    MatButton,
    MatIcon,
    MatIconButton,
    MatListItem,
    MatListItemIcon,
    MatNavList,
    MatSidenav,
    MatSidenavContainer,
    MatSidenavContent,
    MatToolbar,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#admin-main">{{ 'common.skipToContent' | translate }}</a>
    <mat-toolbar class="header">
      @if (handset()) {
        <button mat-icon-button type="button" [attr.aria-label]="'app.menu' | translate" (click)="nav.toggle()">
          <mat-icon>menu</mat-icon>
        </button>
      }
      <a routerLink="/admin" class="brand">{{ 'admin.title' | translate }}</a>
      <span class="spacer"></span>
      @if (branchName(); as name) {
        <span class="branch">{{ name }}</span>
      }
      <span class="user">{{ currentUser.me()?.displayName ?? session.name() }}</span>
      <button mat-stroked-button type="button" (click)="session.signOut()">{{ 'app.signOut' | translate }}</button>
    </mat-toolbar>
    <mat-sidenav-container class="container">
      <mat-sidenav #nav [mode]="handset() ? 'over' : 'side'" [opened]="!handset()" class="sidenav">
        <mat-nav-list [attr.aria-label]="'admin.navigation' | translate">
          @for (section of sections(); track section.path) {
            <a
              mat-list-item
              [routerLink]="['/admin', section.path]"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              (click)="handset() && nav.close()"
            >
              <mat-icon matListItemIcon aria-hidden="true">{{ section.icon }}</mat-icon>
              {{ section.label | translate }}
            </a>
          }
          <a mat-list-item routerLink="/">
            <mat-icon matListItemIcon aria-hidden="true">home</mat-icon>
            {{ 'admin.customerSite' | translate }}
          </a>
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content>
        <main id="admin-main" tabindex="-1" class="main">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .header {
      gap: 0.75rem;
      background: var(--mat-sys-surface);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .brand {
      color: inherit;
      text-decoration: none;
      font: var(--mat-sys-title-medium);
    }
    .spacer {
      flex: 1;
    }
    .branch {
      font: var(--mat-sys-title-small);
    }
    .user {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .container {
      flex: 1;
    }
    .sidenav {
      width: 15rem;
    }
    .active {
      background: var(--mat-sys-secondary-container);
    }
    .main {
      outline: none;
    }
    @media (max-width: 899px) {
      .user {
        display: none;
      }
    }
  `,
})
export class AdminShell {
  protected readonly session = inject(Session)
  protected readonly currentUser = inject(CurrentUser)

  protected readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 899px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  )

  /** Only the screens the current role can use (FE-3) */
  protected readonly sections = computed(() =>
    ADMIN_SECTIONS.filter((section) => this.currentUser.can(section.minimumRole)),
  )

  protected readonly branchName = signal<string | undefined>(undefined)

  constructor() {
    inject(BranchCatalog)
      .branch()
      .then((branch) => this.branchName.set(branch.name))
      .catch(() => undefined)
  }
}
