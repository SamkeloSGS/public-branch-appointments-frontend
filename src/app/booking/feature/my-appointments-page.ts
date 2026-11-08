import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core'
import { MatAnchor } from '@angular/material/button'
import { MatTab, MatTabGroup } from '@angular/material/tabs'
import { RouterLink } from '@angular/router'
import { TranslatePipe } from '@ngx-translate/core'
import { EmptyState } from '../../shared/ui/empty-state'
import { ErrorPanel } from '../../shared/ui/error-panel'
import { LoadingState } from '../../shared/ui/loading-state'
import { ShowMore } from '../../shared/ui/show-more'
import { needsRebooking, orderForDisplay, type AppointmentFilter } from '../model/appointment'
import { MyAppointmentsStore } from '../data/my-appointments.store'
import { AppointmentCard } from '../ui/appointment-card'
import { useBranch } from './branch-details'

const FILTERS: readonly AppointmentFilter[] = ['upcoming', 'past']

/** The customer's upcoming and past appointments; those needing a new time come first (FE-7). */
@Component({
  selector: 'app-my-appointments-page',
  imports: [
    AppointmentCard,
    EmptyState,
    ErrorPanel,
    LoadingState,
    MatAnchor,
    MatTab,
    MatTabGroup,
    RouterLink,
    ShowMore,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="mine-title" class="page narrow">
      <div class="title">
        <h1 id="mine-title">{{ 'booking.mine.title' | translate }}</h1>
        <a mat-flat-button routerLink="/book">{{ 'booking.mine.bookNew' | translate }}</a>
      </div>
      <mat-tab-group [selectedIndex]="filterIndex()" (selectedIndexChange)="filterIndex.set($event)">
        @for (filter of filters; track filter) {
          <mat-tab [label]="'booking.mine.' + filter | translate">
            <div class="tab">
              @if (list().error) {
                <app-error-panel [error]="list().error" (retry)="store.load(filter)" />
              } @else if (!list().loaded) {
                <app-loading-state />
              } @else if (items().length === 0) {
                <app-empty-state icon="event" [message]="'booking.mine.none.' + filter | translate" />
              } @else {
                <ul class="list">
                  @for (appointment of items(); track appointment.id) {
                    <li>
                      <app-appointment-card
                        [appointment]="appointment"
                        [serviceName]="branch.serviceName(appointment.serviceId)"
                        [branchName]="branch.detail()?.name"
                        [timeZone]="branch.detail()?.timeZone"
                      >
                        @if (rebooking(appointment)) {
                          <a
                            mat-flat-button
                            [routerLink]="['/appointments', appointment.reference]"
                            [queryParams]="{ reschedule: 1 }"
                          >
                            {{ 'booking.rebooking.choose' | translate }}
                          </a>
                        }
                        <a
                          mat-button
                          [routerLink]="['/appointments', appointment.reference]"
                          [attr.aria-label]="'booking.mine.detailsFor' | translate: { reference: appointment.reference }"
                        >
                          {{ 'booking.mine.details' | translate }}
                        </a>
                      </app-appointment-card>
                    </li>
                  }
                </ul>
                <app-show-more
                  [shown]="list().items.length"
                  [total]="list().totalItems"
                  [loading]="list().loading"
                  (more)="store.loadMore(filter)"
                />
              }
            </div>
          </mat-tab>
        }
      </mat-tab-group>
    </section>
  `,
  styles: `
    .title {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .tab {
      padding-top: 1rem;
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.75rem;
    }
  `,
})
export class MyAppointmentsPage {
  protected readonly store = inject(MyAppointmentsStore)
  protected readonly branch = useBranch()
  protected readonly filters = FILTERS
  protected readonly filterIndex = signal(0)
  protected readonly filter = computed(() => FILTERS[this.filterIndex()] ?? 'upcoming')
  protected readonly list = computed(() => this.store.lists()[this.filter()])
  protected readonly items = computed(() => orderForDisplay(this.list().items, this.filter()))
  protected readonly rebooking = needsRebooking

  constructor() {
    effect(() => {
      const filter = this.filter()
      untracked(() => void this.store.ensureLoaded(filter))
    })
  }
}
