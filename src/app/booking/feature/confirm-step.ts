import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatIcon } from '@angular/material/icon'
import { MatProgressSpinner } from '@angular/material/progress-spinner'
import { Router } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import { PrerequisitesList } from '../../branch-management'
import { CustomerProfiles } from '../../customer'
import { Session } from '../../identity'
import { ErrorPanel } from '../../shared/ui/error-panel'
import { LoadingState } from '../../shared/ui/loading-state'
import { newIdempotencyKey } from '../../shared/util/idempotency'
import { hasCode } from '../../shared/util/problem'
import { bookingErrorMessages, type Appointment } from '../model/appointment'
import type { BookingSelection } from '../model/selection'
import { BookingApi } from '../data/booking-api'
import { AppointmentSummary } from '../ui/appointment-summary'

/**
 * Step 5: confirm. Sign-in is needed here, and a customer profile. One idempotency key is made when this step opens
 * and sent with every attempt from it, so submitting twice books once (FE-6). No optimistic update: the page waits.
 */
@Component({
  selector: 'app-confirm-step',
  imports: [
    AppointmentSummary,
    ErrorPanel,
    LoadingState,
    MatButton,
    MatCard,
    MatCardContent,
    MatIcon,
    MatProgressSpinner,
    PrerequisitesList,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>{{ 'booking.confirm.title' | translate }}</h2>
    <mat-card appearance="outlined" class="summary">
      <mat-card-content>
        <app-appointment-summary
          [serviceName]="serviceName()"
          [branchName]="branchName()"
          [date]="selection().date"
          [startTime]="selection().time"
          [timeZone]="timeZone()"
        />
        <app-prerequisites-list [items]="prerequisites()" />
      </mat-card-content>
    </mat-card>
    @if (!session.signedIn()) {
      <p>{{ 'booking.confirm.signInNeeded' | translate }}</p>
      <button mat-flat-button type="button" (click)="signIn()">
        <mat-icon>login</mat-icon>
        {{ 'booking.confirm.signIn' | translate }}
      </button>
    } @else if (checkingProfile()) {
      <app-loading-state />
    } @else {
      <app-error-panel [error]="error()" [messages]="messages" (retry)="confirm()" />
      <button mat-flat-button type="button" [disabled]="submitting()" (click)="confirm()">
        @if (submitting()) {
          <mat-progress-spinner mode="indeterminate" diameter="18" aria-hidden="true" />
        } @else {
          <mat-icon>check</mat-icon>
        }
        {{ 'booking.confirm.submit' | translate }}
      </button>
    }
  `,
  styles: `
    .summary {
      margin-bottom: 1rem;
    }
    mat-progress-spinner {
      display: inline-block;
      margin-inline-end: 0.5rem;
    }
  `,
})
export class ConfirmStep {
  readonly selection = input.required<Required<BookingSelection>>()
  readonly serviceName = input<string>()
  readonly branchName = input<string>()
  /** What to bring, shown before the customer books */
  readonly prerequisites = input<readonly string[]>([])
  readonly timeZone = input.required<string>()
  readonly booked = output<Appointment>()
  readonly slotTaken = output()

  protected readonly session = inject(Session)
  private readonly api = inject(BookingApi)
  private readonly profiles = inject(CustomerProfiles)
  private readonly router = inject(Router)
  private readonly idempotencyKey = newIdempotencyKey()

  protected readonly messages = bookingErrorMessages
  protected readonly checkingProfile = signal(this.session.signedIn())
  protected readonly submitting = signal(false)
  protected readonly error = signal<unknown>(undefined)

  constructor() {
    if (this.session.signedIn()) void this.checkProfile()
  }

  private async checkProfile(): Promise<void> {
    if ((await this.profiles.hasProfile()) === false) {
      await this.router.navigateByUrl(this.profiles.setupUrl(this.router.url))
      return
    }
    this.checkingProfile.set(false)
  }

  protected signIn(): void {
    // The selection is in the page address, so it is still there when Keycloak sends the user back (FE-6)
    void this.session.signIn()
  }

  protected async confirm(): Promise<void> {
    if (this.submitting()) return
    this.submitting.set(true)
    this.error.set(undefined)
    try {
      const appointment = await this.api.book(this.selection(), this.idempotencyKey)
      this.booked.emit(appointment.value)
    } catch (error) {
      if (hasCode(error, 'SLOT_UNAVAILABLE')) this.slotTaken.emit()
      else if (hasCode(error, 'PROFILE_REQUIRED')) {
        this.profiles.forget()
        await this.router.navigateByUrl(this.profiles.setupUrl(this.router.url))
      } else this.error.set(error)
    } finally {
      this.submitting.set(false)
    }
  }
}
