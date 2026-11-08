import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { MatAnchor } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import {
  MatAccordion,
  MatExpansionPanel,
  MatExpansionPanelDescription,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion'
import { MatIcon } from '@angular/material/icon'
import { RouterLink } from '@angular/router'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { EmptyState } from '../../shared/ui/empty-state'
import { ErrorPanel } from '../../shared/ui/error-panel'
import { LoadingState } from '../../shared/ui/loading-state'
import { ZoneNote } from '../../shared/ui/zone-note'
import { formatAddress, servicesByCategory, type BranchDetail, type ServiceCategory } from '../model/branch'
import { BranchCatalog } from '../data/branch-catalog'
import { BranchMap } from '../ui/branch-map'
import { PrerequisitesList } from '../ui/prerequisites-list'
import { WeeklyHoursTable } from '../ui/weekly-hours-table'

/**
 * The home page: the branch's address, its location on a map beside its opening hours (in its zone), and the
 * services it takes bookings for, with what to bring, by category in panels that start closed.
 */
@Component({
  selector: 'app-branch-detail-page',
  imports: [
    BranchMap,
    EmptyState,
    ErrorPanel,
    LoadingState,
    MatAccordion,
    MatAnchor,
    MatCard,
    MatCardContent,
    MatExpansionPanel,
    MatExpansionPanelDescription,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatIcon,
    PrerequisitesList,
    RouterLink,
    TranslatePipe,
    WeeklyHoursTable,
    ZoneNote,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="branch-title">
      @if (error()) {
        <app-error-panel [error]="error()" (retry)="load()" />
      } @else if (branch(); as branch) {
        <h1 id="branch-title">{{ branch.name }}</h1>
        <p class="address">{{ address() }}</p>
        <a mat-flat-button routerLink="/book" class="book">
          <mat-icon>event_available</mat-icon>
          {{ 'branchManagement.bookAppointment' | translate }}
        </a>
        <div class="columns">
          <mat-card appearance="outlined">
            <mat-card-content class="map-card">
              <h2>{{ 'branchManagement.map.heading' | translate }}</h2>
              <app-branch-map [location]="branch.location" [name]="branch.name" />
            </mat-card-content>
          </mat-card>
          <mat-card appearance="outlined">
            <mat-card-content>
              <h2>{{ 'branchManagement.openingHours' | translate }}</h2>
              <app-zone-note [timeZone]="branch.timeZone" />
              <app-weekly-hours-table [weeklyHours]="branch.weeklyHours" />
            </mat-card-content>
          </mat-card>
        </div>

        <h2 class="services-title">{{ 'branchManagement.services' | translate }}</h2>
        @if (branch.services.length === 0) {
          <app-empty-state icon="event_busy" [message]="'branchManagement.noServices' | translate" />
        } @else {
          <mat-accordion multi>
            @for (group of groups(); track group.id) {
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title>{{ group.name }}</mat-panel-title>
                  <mat-panel-description>
                    {{ 'segments.' + group.segment | translate }} ·
                    {{ 'branchManagement.serviceCount' | translate: { n: group.services.length } }}
                  </mat-panel-description>
                </mat-expansion-panel-header>
                <ul class="services">
                  @for (service of group.services; track service.serviceId) {
                    <li>
                      <div class="service">
                        <h3>
                          {{ service.name }}
                          <span class="duration">
                            · {{ 'branchManagement.minutes' | translate: { minutes: service.durationMinutes } }}
                          </span>
                        </h3>
                        @if (service.description) {
                          <p class="description">{{ service.description }}</p>
                        }
                        <app-prerequisites-list [items]="service.prerequisites" />
                      </div>
                      <a
                        mat-stroked-button
                        routerLink="/book"
                        [queryParams]="{ service: service.serviceId }"
                        [attr.aria-label]="'branchManagement.bookService' | translate: { service: service.name }"
                      >
                        {{ 'branchManagement.book' | translate }}
                      </a>
                    </li>
                  }
                </ul>
              </mat-expansion-panel>
            }
          </mat-accordion>
        }
      } @else {
        <app-loading-state />
      }
    </section>
  `,
  styles: `
    .address {
      color: var(--mat-sys-on-surface-variant);
    }
    .book {
      margin-bottom: 1.25rem;
    }
    .columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
      gap: 1rem;
      /* Map and hours cards share a row and are the same size */
      align-items: stretch;
    }
    .map-card {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .map-card app-branch-map {
      flex: 1;
    }
    h2 {
      margin-top: 0;
      font: var(--mat-sys-title-medium);
    }
    .services-title {
      margin-top: 1.5rem;
    }
    .services {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .services li {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      padding: 0.75rem 0;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .services li:first-child {
      border-top: none;
      padding-top: 0;
    }
    h3 {
      margin: 0;
      font: var(--mat-sys-title-small);
    }
    .duration,
    .description {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }
    .description {
      margin: 0.25rem 0 0;
    }
  `,
})
export class BranchDetailPage {
  private readonly catalog = inject(BranchCatalog)
  private readonly translate = inject(TranslateService)
  protected readonly branch = signal<BranchDetail | undefined>(undefined)
  private readonly categories = signal<ServiceCategory[]>([])
  protected readonly error = signal<unknown>(undefined)
  protected readonly address = computed(() => {
    const branch = this.branch()
    return branch ? formatAddress(branch.address) : ''
  })
  protected readonly groups = computed(() =>
    servicesByCategory(
      this.branch()?.services ?? [],
      this.categories(),
      (segment) => this.translate.instant(`segments.${segment}`) as string,
    ),
  )

  constructor() {
    void this.load()
    // Category names come from the catalog; without it, services are grouped by segment
    this.catalog
      .serviceCatalog()
      .then((categories) => this.categories.set(categories))
      .catch(() => undefined)
  }

  protected async load(): Promise<void> {
    this.branch.set(undefined)
    this.error.set(undefined)
    try {
      this.branch.set(await this.catalog.branch())
    } catch (error) {
      this.error.set(error)
    }
  }
}
