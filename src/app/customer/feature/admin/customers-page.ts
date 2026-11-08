import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatDialog } from '@angular/material/dialog'
import { MatFormField, MatHint, MatLabel, MatPrefix } from '@angular/material/form-field'
import { MatIcon } from '@angular/material/icon'
import { MatInput } from '@angular/material/input'
import { MatProgressBar } from '@angular/material/progress-bar'
import { MatSnackBar } from '@angular/material/snack-bar'
import { Router } from '@angular/router'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { CurrentUser } from '../../../identity'
import { confirmAction } from '../../../shared/ui/confirm-dialog'
import { EmptyState } from '../../../shared/ui/empty-state'
import { ErrorPanel } from '../../../shared/ui/error-panel'
import { LoadingState } from '../../../shared/ui/loading-state'
import { ShowMore } from '../../../shared/ui/show-more'
import type { Versioned } from '../../../shared/util/etag'
import { appendPage, hasNextPage, type Page } from '../../../shared/util/page'
import { isApiError } from '../../../shared/util/problem'
import {
  MIN_SEARCH_LENGTH,
  contactDetailsRequest,
  contactDetailsValues,
  customerAdminErrorMessages,
  displayName,
  isSearchable,
  type ContactDetailsValues,
  type Customer,
  type CustomerSummary,
} from '../../model/customer'
import { CustomerAdminApi } from '../../data/customer-admin-api'
import { ContactDetailsForm } from '../../ui/contact-details-form'
import { CustomerResults } from '../../ui/customer-results'

const SEARCH_DELAY_MS = 300

/**
 * Customer search and detail for staff. Search starts at 3 characters. Deactivate, reactivate and erase are shown to
 * for the branch manager only (spec 6); every view is written to the backend's access audit.
 */
@Component({
  selector: 'app-customers-page',
  imports: [
    ContactDetailsForm,
    CustomerResults,
    EmptyState,
    ErrorPanel,
    FormsModule,
    LoadingState,
    MatButton,
    MatCard,
    MatCardContent,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatLabel,
    MatPrefix,
    MatProgressBar,
    ShowMore,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="customers-title">
      <h1 id="customers-title">{{ 'admin.sections.customers' | translate }}</h1>
      <div class="layout">
        <div class="search">
          <mat-form-field class="full">
            <mat-label>{{ 'admin.customers.search' | translate }}</mat-label>
            <mat-icon matPrefix aria-hidden="true">search</mat-icon>
            <input matInput type="search" autocomplete="off" [ngModel]="query()" (ngModelChange)="onQuery($event)" />
            <mat-hint>{{ 'admin.customers.searchHint' | translate: { n: minSearch } }}</mat-hint>
          </mat-form-field>
          @if (searching()) {
            <mat-progress-bar mode="indeterminate" aria-hidden="true" />
          }
          <app-error-panel [error]="searchError()" (retry)="search()" />
          @if (results(); as results) {
            @if (results.length === 0) {
              <app-empty-state icon="person_search" [message]="'admin.customers.none' | translate" />
            } @else {
              <app-customer-results
                [customers]="results"
                [label]="'admin.customers.results' | translate"
                [selected]="id()"
                (choose)="open($event)"
              />
              <app-show-more
                [shown]="results.length"
                [total]="resultPage()?.totalItems ?? 0"
                [loading]="searching()"
                (more)="more()"
              />
            }
          }
        </div>

        <div class="detail">
          @if (!id()) {
            <app-empty-state icon="badge" [message]="'admin.customers.choose' | translate" />
          } @else if (loadError()) {
            <app-error-panel [error]="loadError()" (retry)="load(id()!)" />
          } @else if (customer(); as customer) {
            <mat-card appearance="outlined">
              <mat-card-content>
                <div class="head">
                  <h2>{{ name(customer.value) ?? ('admin.customers.erased' | translate) }}</h2>
                  <span class="status" [class]="customer.value.status">
                    {{ 'admin.customers.statuses.' + customer.value.status | translate }}
                  </span>
                </div>
                <p class="meta">
                  {{ (customer.value.linked ? 'admin.customers.linked' : 'admin.customers.notLinked') | translate }}
                </p>
                @if (staleNotice()) {
                  <p class="notice" role="alert">{{ 'errors.staleKept' | translate }}</p>
                }
                <app-error-panel [error]="actionError()" [messages]="messages" [serverDetail]="true" />
                @if (customer.value.status !== 'ERASED') {
                  <app-contact-details-form
                    [initial]="details()"
                    [submitLabel]="'customer.profile.saveDetails' | translate"
                    [pending]="working()"
                    (save)="save($event)"
                  />
                }
                @if (managerActions() && customer.value.status !== 'ERASED') {
                  <div class="manager-actions" role="group" [attr.aria-label]="'admin.customers.managerActions' | translate">
                    @if (customer.value.status === 'ACTIVE') {
                      <button mat-stroked-button type="button" [disabled]="working()" (click)="deactivate()">
                        {{ 'admin.customers.deactivate' | translate }}
                      </button>
                    } @else {
                      <button mat-stroked-button type="button" [disabled]="working()" (click)="reactivate()">
                        {{ 'admin.customers.reactivate' | translate }}
                      </button>
                    }
                    <button mat-stroked-button type="button" class="destructive" [disabled]="working()" (click)="erase()">
                      {{ 'admin.customers.erase' | translate }}
                    </button>
                  </div>
                }
              </mat-card-content>
            </mat-card>
          } @else {
            <app-loading-state />
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr);
      gap: 1.5rem;
      align-items: start;
    }
    .full {
      width: 100%;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-title-large);
    }
    .meta {
      color: var(--mat-sys-on-surface-variant);
    }
    .status {
      padding: 0.0625rem 0.5rem;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font: var(--mat-sys-label-medium);
    }
    .status.DEACTIVATED,
    .status.ERASED {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .manager-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .destructive {
      --mat-button-outlined-label-text-color: var(--mat-sys-error);
    }
    .notice {
      padding: 0.75rem 1rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    @media (max-width: 799px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class CustomersPage {
  /** ?id= the customer shown */
  readonly id = input<string>()

  private readonly api = inject(CustomerAdminApi)
  private readonly router = inject(Router)
  private readonly dialog = inject(MatDialog)
  private readonly snackBar = inject(MatSnackBar)
  private readonly translate = inject(TranslateService)
  private readonly currentUser = inject(CurrentUser)

  protected readonly messages = customerAdminErrorMessages
  protected readonly minSearch = MIN_SEARCH_LENGTH
  protected readonly name = displayName
  protected readonly managerActions = computed(() => this.currentUser.can('BRANCH_MANAGER'))
  protected readonly query = signal('')
  protected readonly results = signal<CustomerSummary[] | undefined>(undefined)
  /** The last page of the search loaded, for its total */
  protected readonly resultPage = signal<Page<CustomerSummary> | undefined>(undefined)
  protected readonly searching = signal(false)
  protected readonly searchError = signal<unknown>(undefined)
  protected readonly customer = signal<Versioned<Customer> | undefined>(undefined)
  protected readonly details = signal<ContactDetailsValues>(contactDetailsValues())
  protected readonly loadError = signal<unknown>(undefined)
  protected readonly actionError = signal<unknown>(undefined)
  protected readonly working = signal(false)
  protected readonly staleNotice = signal(false)
  private searchTimer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    effect(() => {
      const id = this.id()
      untracked(() => {
        this.customer.set(undefined)
        this.actionError.set(undefined)
        this.staleNotice.set(false)
        if (id) void this.load(id)
      })
    })
  }

  protected onQuery(query: string): void {
    this.query.set(query)
    clearTimeout(this.searchTimer)
    if (!isSearchable(query)) {
      this.results.set(undefined)
      this.resultPage.set(undefined)
      return
    }
    this.searchTimer = setTimeout(() => void this.search(), SEARCH_DELAY_MS)
  }

  protected async search(): Promise<void> {
    const query = this.query()
    if (!isSearchable(query)) return
    this.searching.set(true)
    this.searchError.set(undefined)
    try {
      const results = await this.api.search(query)
      if (query === this.query()) {
        this.resultPage.set(results)
        this.results.set(results.items)
      }
    } catch (error) {
      this.searchError.set(error)
    } finally {
      this.searching.set(false)
    }
  }

  /** The next page of the same search, added below the results shown. */
  protected async more(): Promise<void> {
    const query = this.query()
    const shown = this.resultPage()
    if (!shown || !hasNextPage(shown)) return
    this.searching.set(true)
    this.searchError.set(undefined)
    try {
      const next = appendPage(this.results() ?? [], await this.api.search(query, shown.page + 1))
      if (query === this.query()) {
        this.resultPage.set(next)
        this.results.set(next.items)
      }
    } catch (error) {
      this.searchError.set(error)
    } finally {
      this.searching.set(false)
    }
  }

  protected open(id: string): void {
    void this.router.navigate([], { queryParams: { id } })
  }

  protected async load(id: string, keepInput = false): Promise<void> {
    this.loadError.set(undefined)
    try {
      const customer = await this.api.get(id)
      if (id !== this.id()) return
      this.customer.set(customer)
      if (!keepInput) this.details.set(contactDetailsValues(customer.value))
    } catch (error) {
      this.loadError.set(error)
    }
  }

  private async act(action: (current: Versioned<Customer>) => Promise<Versioned<Customer> | void>, success: string): Promise<boolean> {
    const current = this.customer()
    if (!current) return false
    this.working.set(true)
    this.actionError.set(undefined)
    this.staleNotice.set(false)
    try {
      const updated = await action(current)
      if (updated) this.customer.set(updated)
      this.snackBar.open(this.translate.instant(success) as string, undefined, { duration: 3000 })
      return true
    } catch (error) {
      if (isApiError(error) && error.isStale) {
        // Changed elsewhere: show the latest version, keep what was typed (FE-15)
        await this.load(current.value.id, true)
        this.staleNotice.set(true)
      } else this.actionError.set(error)
      return false
    } finally {
      this.working.set(false)
    }
  }

  protected async save(values: ContactDetailsValues): Promise<void> {
    this.details.set(values)
    await this.act((current) => this.api.update(current, contactDetailsRequest(values)), 'admin.saved')
  }

  private async confirm(action: 'deactivate' | 'erase'): Promise<boolean> {
    const current = this.customer()
    const name = (current && displayName(current.value)) ?? ''
    const t = (key: string, params?: Record<string, string>) => this.translate.instant(key, params) as string
    return confirmAction(this.dialog, {
      title: t(`admin.customers.confirm.${action}.title`, { name }),
      message: t(`admin.customers.confirm.${action}.message`, { name }),
      confirmLabel: t(`admin.customers.${action}`),
      cancelLabel: t('common.cancel'),
      destructive: true,
      ...(action === 'erase'
        ? { typedWord: t('customer.erase.word'), typedLabel: t('common.typeToConfirm', { word: t('customer.erase.word') }) }
        : {}),
    })
  }

  protected async deactivate(): Promise<void> {
    if (await this.confirm('deactivate')) await this.act((current) => this.api.deactivate(current), 'admin.customers.done.deactivate')
  }

  protected async reactivate(): Promise<void> {
    await this.act((current) => this.api.reactivate(current), 'admin.customers.done.reactivate')
  }

  /** Erasing removes the personal data for good and cancels upcoming appointments; it needs the word typed. */
  protected async erase(): Promise<void> {
    if (!(await this.confirm('erase'))) return
    const erased = await this.act((current) => this.api.erase(current), 'admin.customers.done.erase')
    if (erased) {
      const id = this.id()
      if (id) await this.load(id)
      this.results.update((list) => list?.filter((customer) => customer.id !== id))
    }
  }
}
