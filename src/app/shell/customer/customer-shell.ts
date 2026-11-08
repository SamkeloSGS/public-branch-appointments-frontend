import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core'
import { MatButton, MatIconButton } from '@angular/material/button'
import { MatIcon } from '@angular/material/icon'
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu'
import { MatToolbar } from '@angular/material/toolbar'
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import { CurrentUser, Session } from '../../identity'
import { SiteFooter } from './site-footer'

interface NavItem {
  path: string
  /** Translation key */
  label: string
  icon: string
  exact?: boolean
}

/** Layout of the customer area: mobile-first header with navigation, sign-in, the page and the footer. */
@Component({
  selector: 'app-customer-shell',
  imports: [
    MatButton,
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatToolbar,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    SiteFooter,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main">{{ 'common.skipToContent' | translate }}</a>
    <mat-toolbar class="header">
      <a routerLink="/" class="brand">
        <mat-icon aria-hidden="true">event_available</mat-icon>
        <span>{{ 'app.name' | translate }}</span>
      </a>
      <nav class="nav wide" [attr.aria-label]="'app.navigation' | translate">
        @for (item of navItems(); track item.path) {
          <a
            mat-button
            [routerLink]="item.path"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
          >
            <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
            {{ item.label | translate }}
          </a>
        }
      </nav>
      <span class="spacer"></span>
      @if (session.signedIn()) {
        @if (!currentUser.isStaff()) {
          <a
            mat-icon-button
            routerLink="/profile"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            class="profile"
            [attr.aria-label]="'app.nav.profile' | translate"
            [title]="'app.nav.profile' | translate"
          >
            <mat-icon>account_circle</mat-icon>
          </a>
        }
        <button mat-stroked-button type="button" class="wide" (click)="session.signOut()">
          <mat-icon aria-hidden="true">logout</mat-icon>
          {{ 'app.signOut' | translate }}
        </button>
      } @else {
        <button mat-flat-button type="button" (click)="session.signIn()">
          <mat-icon aria-hidden="true">login</mat-icon>
          {{ 'app.signIn' | translate }}
        </button>
      }
      <button
        mat-icon-button
        type="button"
        class="narrow"
        [matMenuTriggerFor]="menu"
        [attr.aria-label]="'app.menu' | translate"
      >
        <mat-icon>menu</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        @for (item of navItems(); track item.path) {
          <a mat-menu-item [routerLink]="item.path">
            <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
            <span>{{ item.label | translate }}</span>
          </a>
        }
        @if (session.signedIn()) {
          <button mat-menu-item type="button" (click)="session.signOut()">
            <mat-icon aria-hidden="true">logout</mat-icon>
            <span>{{ 'app.signOut' | translate }}</span>
          </button>
        }
      </mat-menu>
    </mat-toolbar>
    <main id="main" tabindex="-1" class="main">
      <router-outlet />
    </main>
    <app-site-footer />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .header {
      position: sticky;
      top: 0;
      z-index: 2;
      gap: 0.5rem;
      background: var(--mat-sys-surface);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: inherit;
      text-decoration: none;
      font: var(--mat-sys-title-medium);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .nav {
      display: flex;
      gap: 0.25rem;
      margin-inline-start: 1rem;
    }
    .nav .active,
    .profile.active {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .spacer {
      flex: 1;
    }
    .main {
      flex: 1;
      outline: none;
    }
    @media (max-width: 899px) {
      .wide {
        display: none !important;
      }
    }
    @media (min-width: 900px) {
      .narrow {
        display: none !important;
      }
    }
  `,
})
export class CustomerShell {
  protected readonly session = inject(Session)
  protected readonly currentUser = inject(CurrentUser)

  protected navItems(): NavItem[] {
    const items: NavItem[] = [
      { path: '/', label: 'app.nav.branch', icon: 'store', exact: true },
      { path: '/book', label: 'app.nav.book', icon: 'event' },
    ]
    if (this.session.signedIn()) {
      if (this.currentUser.isStaff()) {
        items.push({ path: '/admin', label: 'app.nav.admin', icon: 'admin_panel_settings' })
      } else {
        items.push({ path: '/appointments', label: 'app.nav.myAppointments', icon: 'event_note' })
      }
    }
    return items
  }

  constructor() {
    // The role decides the menu (FE-3); loading it is a convenience, so a failure just leaves the customer menu
    effect(() => {
      if (this.session.signedIn()) untracked(() => void this.currentUser.load().catch(() => undefined))
    })
  }
}
