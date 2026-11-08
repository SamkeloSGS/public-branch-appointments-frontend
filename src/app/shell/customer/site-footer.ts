import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { MatIcon } from '@angular/material/icon'
import { RouterLink } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import { BranchCatalog, formatAddress, type BranchDetail } from '../../branch-management'
import { CurrentUser, Session } from '../../identity'

/** The footer of the customer area: the branch's name and address, quick links, and the copyright line. */
@Component({
  selector: 'app-site-footer',
  imports: [MatIcon, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="footer">
      <div class="inner">
        <div class="branch">
          <p class="name">
            <mat-icon aria-hidden="true">store</mat-icon>
            {{ branch()?.name ?? ('app.name' | translate) }}
          </p>
          @if (address(); as address) {
            <p>{{ address }}</p>
          }
        </div>
        <nav [attr.aria-label]="'app.footer.links' | translate">
          <ul>
            <li><a routerLink="/">{{ 'app.nav.branch' | translate }}</a></li>
            <li><a routerLink="/book">{{ 'app.nav.book' | translate }}</a></li>
            @if (showAppointments()) {
              <li><a routerLink="/appointments">{{ 'app.nav.myAppointments' | translate }}</a></li>
            }
          </ul>
        </nav>
      </div>
      <p class="copyright">
        {{ 'app.footer.copyright' | translate: { year: year, name: branch()?.name ?? ('app.name' | translate) } }}
      </p>
    </footer>
  `,
  styles: `
    .footer {
      margin-top: 3rem;
      padding: 1.5rem 1rem 1rem;
      background: var(--mat-sys-surface-container);
      color: var(--mat-sys-on-surface-variant);
      border-top: 1px solid var(--mat-sys-outline-variant);
      font: var(--mat-sys-body-medium);
    }
    .inner {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 1rem 2rem;
      max-width: 72rem;
      margin: 0 auto;
    }
    p {
      margin: 0 0 0.25rem;
    }
    .name {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-title-small);
    }
    ul {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.25rem;
      margin: 0;
      padding: 0;
    }
    a {
      color: inherit;
    }
    a:hover,
    a:focus-visible {
      color: var(--mat-sys-primary);
    }
    .copyright {
      max-width: 72rem;
      margin: 1.25rem auto 0;
      font: var(--mat-sys-body-small);
    }
  `,
})
export class SiteFooter {
  protected readonly branch = signal<BranchDetail | undefined>(undefined)
  protected readonly address = computed(() => {
    const branch = this.branch()
    return branch ? formatAddress(branch.address) : undefined
  })
  protected readonly year = new Date().getFullYear()

  private readonly session = inject(Session)
  private readonly currentUser = inject(CurrentUser)
  /** As in the header: only a signed-in customer has appointments of their own */
  protected readonly showAppointments = computed(() => this.session.signedIn() && !this.currentUser.isStaff())

  constructor() {
    inject(BranchCatalog)
      .branch()
      .then((branch) => this.branch.set(branch))
      .catch(() => undefined)
  }
}
