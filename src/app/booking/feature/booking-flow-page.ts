import { NgTemplateOutlet } from '@angular/common'
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { Router } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import { BranchCatalog, serviceName, type BranchDetail } from '../../branch-management'
import { ErrorPanel } from '../../shared/ui/error-panel'
import { LoadingState } from '../../shared/ui/loading-state'
import { LocalDatePipe, LocalTimePipe } from '../../shared/ui/format.pipes'
import type { Appointment } from '../model/appointment'
import {
  currentStep,
  isComplete,
  reopen,
  selectionFromQuery,
  selectionToQuery,
  type BookingSelection,
  type BookingStep,
} from '../model/selection'
import { MyAppointmentsStore } from '../data/my-appointments.store'
import { StepIndicator } from '../ui/step-indicator'
import { ConfirmStep } from './confirm-step'
import { DateStep } from './date-step'
import { ServiceStep } from './service-step'
import { TimeStep } from './time-step'

type ChangeableStep = Exclude<BookingStep, 'confirm'>

/**
 * The booking flow: service, date, time, confirm (FE-6). The selection is the page address, so it survives
 * the trip to Keycloak and back, the back button goes to the previous step, and a selection can be shared as a link.
 */
@Component({
  selector: 'app-booking-flow-page',
  imports: [
    ConfirmStep,
    DateStep,
    ErrorPanel,
    LoadingState,
    LocalDatePipe,
    LocalTimePipe,
    MatButton,
    NgTemplateOutlet,
    ServiceStep,
    StepIndicator,
    TimeStep,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="book-title" class="page narrow">
      <h1 id="book-title">{{ 'booking.title' | translate }}</h1>
      <app-step-indicator [current]="step()" />

      @if (selection().serviceId) {
        <dl class="chosen">
          @if (selection().serviceId) {
            <ng-container
              *ngTemplateOutlet="chosen; context: { step: 'service', value: serviceTitle() ?? '…' }"
            />
          }
          @if (selection().date) {
            <ng-container
              *ngTemplateOutlet="chosen; context: { step: 'date', value: selection().date | localDate: 'medium' }"
            />
          }
          @if (selection().time) {
            <ng-container *ngTemplateOutlet="chosen; context: { step: 'time', value: selection().time | localTime }" />
          }
        </dl>
      }

      @switch (step()) {
        @case ('service') {
          <app-service-step (select)="chooseService($event)" />
        }
        @default {
          @if (branchError()) {
            <app-error-panel [error]="branchError()" (retry)="loadBranch()" />
          } @else if (branchDetail(); as branch) {
            @if (step() === 'date') {
              <app-date-step
                [serviceId]="selection().serviceId!"
                [timeZone]="branch.timeZone"
                (select)="chooseDate($event)"
              />
            } @else if (step() === 'time') {
              <app-time-step
                [serviceId]="selection().serviceId!"
                [date]="selection().date!"
                [timeZone]="branch.timeZone"
                [notice]="slotTaken() ? ('booking.errors.SLOT_UNAVAILABLE' | translate) : undefined"
                (select)="chooseTime($event)"
                (changeDate)="change('date')"
              />
            } @else if (complete(); as complete) {
              <app-confirm-step
                [selection]="complete"
                [serviceName]="serviceTitle()"
                [prerequisites]="prerequisites()"
                [branchName]="branch.name"
                [timeZone]="branch.timeZone"
                (booked)="onBooked($event)"
                (slotTaken)="onSlotTaken()"
              />
            }
          } @else {
            <app-loading-state />
          }
        }
      }
    </section>

    <ng-template #chosen let-step="step" let-value="value">
      <div>
        <dt>{{ 'booking.steps.' + step | translate }}</dt>
        <dd>{{ value }}</dd>
        <dd>
          <button
            mat-button
            type="button"
            [attr.aria-label]="'booking.changeStep' | translate: { step: ('booking.steps.' + step | translate) }"
            (click)="change(step)"
          >
            {{ 'booking.change' | translate }}
          </button>
        </dd>
      </div>
    </ng-template>
  `,
  styles: `
    .chosen {
      display: grid;
      gap: 0.125rem;
      margin: 0 0 1.25rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container);
    }
    .chosen div {
      display: grid;
      grid-template-columns: 4.5rem minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.5rem;
    }
    .chosen dt {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .chosen dd {
      margin: 0;
      font-weight: 500;
      overflow-wrap: anywhere;
    }
  `,
})
export class BookingFlowPage {
  // The query parameters, bound by the router
  readonly service = input<string>()
  readonly date = input<string>()
  readonly time = input<string>()

  private readonly router = inject(Router)
  private readonly catalog = inject(BranchCatalog)
  private readonly appointments = inject(MyAppointmentsStore)

  protected readonly selection = computed(() =>
    selectionFromQuery({ service: this.service(), date: this.date(), time: this.time() }),
  )
  protected readonly step = computed(() => currentStep(this.selection()))
  protected readonly complete = computed(() => {
    const selection = this.selection()
    return isComplete(selection) ? selection : undefined
  })
  protected readonly branchDetail = signal<BranchDetail | undefined>(undefined)
  protected readonly branchError = signal<unknown>(undefined)
  protected readonly serviceTitle = computed(() => {
    const serviceId = this.selection().serviceId
    const branch = this.branchDetail()
    return serviceId && branch ? serviceName(branch, serviceId) : undefined
  })
  protected readonly prerequisites = computed(() => {
    const serviceId = this.selection().serviceId
    return this.branchDetail()?.services.find((service) => service.serviceId === serviceId)?.prerequisites ?? []
  })
  protected readonly slotTaken = signal(false)

  constructor() {
    void this.loadBranch()
  }

  protected async loadBranch(): Promise<void> {
    this.branchError.set(undefined)
    try {
      this.branchDetail.set(await this.catalog.branch())
    } catch (error) {
      this.branchError.set(error)
    }
  }

  private go(next: BookingSelection, replaceUrl = false): void {
    void this.router.navigate(['/book'], { queryParams: selectionToQuery(next), replaceUrl })
  }

  protected change(target: ChangeableStep): void {
    this.slotTaken.set(false)
    this.go(reopen(this.selection(), target))
  }

  protected chooseService(serviceId: string): void {
    this.go({ serviceId })
  }

  protected chooseDate(date: string): void {
    this.go({ ...this.selection(), date, time: undefined })
  }

  protected chooseTime(time: string): void {
    this.slotTaken.set(false)
    this.go({ ...this.selection(), time })
  }

  /** The time was taken meanwhile: back to the time step, which loads fresh times, with an explanation (FE-6). */
  protected onSlotTaken(): void {
    this.slotTaken.set(true)
    this.go({ ...this.selection(), time: undefined }, true)
  }

  protected onBooked(appointment: Appointment): void {
    this.appointments.invalidate()
    void this.router.navigate(['/appointments', appointment.reference], {
      queryParams: { booked: 1 },
      replaceUrl: true,
    })
  }
}
