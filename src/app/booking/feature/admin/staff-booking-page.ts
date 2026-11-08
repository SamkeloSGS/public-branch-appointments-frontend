import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatFormField, MatHint, MatLabel, MatPrefix } from '@angular/material/form-field'
import { MatIcon } from '@angular/material/icon'
import { MatInput } from '@angular/material/input'
import { MatProgressBar } from '@angular/material/progress-bar'
import { Router } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import {
  ContactDetailsForm,
  CustomerAdminApi,
  CustomerResults,
  MIN_SEARCH_LENGTH,
  contactDetailsValues,
  customerAdminErrorMessages,
  customerRequest,
  displayName,
  existingCustomerId,
  isSearchable,
  type ContactDetailsValues,
  type Customer,
  type CustomerSummary,
} from '../../../customer'
import { EmptyState } from '../../../shared/ui/empty-state'
import { ErrorPanel } from '../../../shared/ui/error-panel'
import { LoadingState } from '../../../shared/ui/loading-state'
import { newIdempotencyKey } from '../../../shared/util/idempotency'
import { hasCode, isApiError } from '../../../shared/util/problem'
import { staffBookingErrorMessages } from '../../model/appointment'
import { BookingAdminApi } from '../../data/booking-admin-api'
import { AppointmentSummary } from '../../ui/appointment-summary'
import { useBranch } from '../branch-details'
import { DateStep } from '../date-step'
import { ServiceStep } from '../service-step'
import { TimeStep } from '../time-step'

type Step = 'customer' | 'service' | 'date' | 'time' | 'confirm'

const SEARCH_DELAY_MS = 300

/**
 * Book for a customer: find an existing customer or create one, then the same steps as a customer (FE-10). When a new
 * customer's email already exists, that customer is offered instead.
 */
@Component({
  selector: 'app-staff-booking-page',
  imports: [
    AppointmentSummary,
    ContactDetailsForm,
    CustomerResults,
    DateStep,
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
    ServiceStep,
    TimeStep,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page narrow" aria-labelledby="staff-book-title">
      <h1 id="staff-book-title">{{ 'admin.sections.book' | translate }}</h1>
      @if (branch(); as branch) {
        <p class="branch">{{ branch.name }}</p>
      }

      @if (customer(); as customer) {
        <dl class="chosen">
          <div>
            <dt>{{ 'admin.book.customer' | translate }}</dt>
            <dd>{{ name(customer) ?? customer.id }}</dd>
            <dd>
              <button mat-button type="button" (click)="changeCustomer()">{{ 'booking.change' | translate }}</button>
            </dd>
          </div>
        </dl>
      }

      @switch (step()) {
        @case ('customer') {
          @if (!creating()) {
            <h2>{{ 'admin.book.findCustomer' | translate }}</h2>
            <mat-form-field class="search">
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
                  (choose)="chooseById($event)"
                />
              }
            }
            <button mat-stroked-button type="button" class="new" (click)="startCreating()">
              <mat-icon>person_add</mat-icon>
              {{ 'admin.book.newCustomer' | translate }}
            </button>
          } @else {
            <h2>{{ 'admin.book.newCustomer' | translate }}</h2>
            <app-error-panel [error]="createError()" [messages]="customerMessages" [serverDetail]="true" />
            @if (existing(); as existing) {
              <mat-card appearance="outlined" class="existing" role="alert">
                <mat-card-content>
                  <p>{{ 'admin.book.existing' | translate: { name: name(existing) ?? existing.email ?? '' } }}</p>
                  <button mat-flat-button type="button" (click)="useCustomer(existing)">
                    {{ 'admin.book.useExisting' | translate }}
                  </button>
                </mat-card-content>
              </mat-card>
            }
            <app-contact-details-form
              [initial]="newCustomer()"
              [submitLabel]="'admin.book.createCustomer' | translate"
              [pending]="pending()"
              [showLanguage]="true"
              (save)="create($event)"
            />
            <button mat-button type="button" (click)="creating.set(false)">{{ 'common.back' | translate }}</button>
          }
        }
        @case ('service') {
          <app-service-step (select)="serviceId.set($event)" />
        }
        @case ('date') {
          @if (branch(); as branch) {
            <app-date-step
              [serviceId]="serviceId()!"
              [timeZone]="branch.timeZone"
              (select)="date.set($event)"
            />
            <button mat-button type="button" (click)="serviceId.set(undefined)">{{ 'common.back' | translate }}</button>
          } @else {
            <app-loading-state />
          }
        }
        @case ('time') {
          <app-time-step
            [serviceId]="serviceId()!"
            [date]="date()!"
            [timeZone]="branch()!.timeZone"
            [reloadToken]="timesVersion()"
            [notice]="slotTaken() ? ('booking.errors.SLOT_UNAVAILABLE' | translate) : undefined"
            (select)="chooseTime($event)"
            (changeDate)="date.set(undefined)"
          />
        }
        @case ('confirm') {
          <h2>{{ 'booking.confirm.title' | translate }}</h2>
          <mat-card appearance="outlined">
            <mat-card-content>
              <app-appointment-summary
                [serviceName]="branchInfo.serviceName(serviceId()!)"
                [branchName]="branch()?.name"
                [date]="date()!"
                [startTime]="time()!"
                [timeZone]="branch()?.timeZone"
              />
            </mat-card-content>
          </mat-card>
          <app-error-panel [error]="bookError()" [messages]="bookingMessages" [serverDetail]="true" />
          <div class="confirm-actions">
            <button mat-flat-button type="button" [disabled]="pending()" (click)="book()">
              {{ 'booking.confirm.submit' | translate }}
            </button>
            <button mat-button type="button" (click)="time.set(undefined)">{{ 'common.back' | translate }}</button>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .branch {
      margin-top: -0.5rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .search {
      width: 100%;
    }
    .new {
      margin-top: 1rem;
    }
    .existing {
      margin-bottom: 1rem;
      border-color: var(--mat-sys-tertiary);
    }
    .chosen {
      margin: 0 0 1rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container);
    }
    .chosen div {
      display: grid;
      grid-template-columns: 6rem minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.5rem;
    }
    .chosen dt {
      color: var(--mat-sys-on-surface-variant);
    }
    .chosen dd {
      margin: 0;
      font-weight: 500;
    }
    .confirm-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
    }
  `,
})
export class StaffBookingPage {
  private readonly customers = inject(CustomerAdminApi)
  private readonly api = inject(BookingAdminApi)
  private readonly router = inject(Router)
  protected readonly branchInfo = useBranch()
  protected readonly customerMessages = customerAdminErrorMessages
  protected readonly bookingMessages = staffBookingErrorMessages
  protected readonly minSearch = MIN_SEARCH_LENGTH
  protected readonly name = displayName

  protected readonly branch = this.branchInfo.detail
  protected readonly customer = signal<Customer | CustomerSummary | undefined>(undefined)
  protected readonly serviceId = signal<string | undefined>(undefined)
  protected readonly date = signal<string | undefined>(undefined)
  protected readonly time = signal<string | undefined>(undefined)
  protected readonly step = computed<Step>(() => {
    if (!this.customer()) return 'customer'
    if (!this.serviceId()) return 'service'
    if (!this.date()) return 'date'
    if (!this.time()) return 'time'
    return 'confirm'
  })

  protected readonly query = signal('')
  protected readonly results = signal<CustomerSummary[] | undefined>(undefined)
  protected readonly searching = signal(false)
  protected readonly searchError = signal<unknown>(undefined)
  protected readonly creating = signal(false)
  protected readonly newCustomer = signal<ContactDetailsValues>(contactDetailsValues())
  protected readonly existing = signal<Customer | undefined>(undefined)
  protected readonly createError = signal<unknown>(undefined)
  protected readonly pending = signal(false)
  protected readonly bookError = signal<unknown>(undefined)
  protected readonly slotTaken = signal(false)
  protected readonly timesVersion = signal(0)
  /** One key per opening of the confirm step, so a second submit books once */
  private idempotencyKey = newIdempotencyKey()
  private searchTimer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    effect(() => {
      if (this.step() === 'confirm') untracked(() => (this.idempotencyKey = newIdempotencyKey()))
    })
  }

  /** Searches once the query has at least 3 characters, after a short pause in typing. */
  protected onQuery(query: string): void {
    this.query.set(query)
    clearTimeout(this.searchTimer)
    if (!isSearchable(query)) {
      this.results.set(undefined)
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
      // The first page is enough to pick from; a longer list means the query needs to be more precise
      const results = (await this.customers.search(query)).items
      if (query === this.query()) this.results.set(results)
    } catch (error) {
      this.searchError.set(error)
    } finally {
      this.searching.set(false)
    }
  }

  protected chooseById(id: string): void {
    const chosen = this.results()?.find((customer) => customer.id === id)
    if (chosen) this.customer.set(chosen)
  }

  protected startCreating(): void {
    this.existing.set(undefined)
    this.createError.set(undefined)
    const query = this.query().trim()
    this.newCustomer.set({ ...contactDetailsValues(), ...(query.includes('@') ? { email: query } : {}) })
    this.creating.set(true)
  }

  protected async create(values: ContactDetailsValues): Promise<void> {
    this.newCustomer.set(values)
    this.pending.set(true)
    this.createError.set(undefined)
    this.existing.set(undefined)
    try {
      const created = await this.customers.create(customerRequest(values))
      this.useCustomer(created.value)
    } catch (error) {
      const existingId = hasCode(error, 'EMAIL_IN_USE') && isApiError(error) ? existingCustomerId(error.problem) : undefined
      if (existingId) {
        // Offer the customer who already has this email (FE-10)
        try {
          this.existing.set((await this.customers.get(existingId)).value)
        } catch {
          this.createError.set(error)
        }
      } else this.createError.set(error)
    } finally {
      this.pending.set(false)
    }
  }

  protected useCustomer(customer: Customer | CustomerSummary): void {
    this.creating.set(false)
    this.customer.set(customer)
  }

  protected changeCustomer(): void {
    this.customer.set(undefined)
    this.bookError.set(undefined)
  }

  protected chooseTime(time: string): void {
    this.slotTaken.set(false)
    this.bookError.set(undefined)
    this.time.set(time)
  }

  protected async book(): Promise<void> {
    const customer = this.customer()
    const serviceId = this.serviceId()
    const date = this.date()
    const time = this.time()
    if (!customer || !serviceId || !date || !time || this.pending()) return
    this.pending.set(true)
    this.bookError.set(undefined)
    try {
      const appointment = await this.api.bookForCustomer(
        { customerId: customer.id, serviceId, date, time },
        this.idempotencyKey,
      )
      await this.router.navigate(['/admin/appointments', appointment.id])
    } catch (error) {
      if (hasCode(error, 'SLOT_UNAVAILABLE')) {
        // Back to the times, freshly loaded, with an explanation (as for customers, FE-6)
        this.slotTaken.set(true)
        this.timesVersion.update((version) => version + 1)
        this.time.set(undefined)
      } else this.bookError.set(error)
    } finally {
      this.pending.set(false)
    }
  }
}
