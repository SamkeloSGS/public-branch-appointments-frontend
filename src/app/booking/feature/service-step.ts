import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field'
import { MatIcon } from '@angular/material/icon'
import { MatInput } from '@angular/material/input'
import { MatActionList, MatListItem, MatListItemLine, MatListItemTitle } from '@angular/material/list'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { BranchCatalog } from '../../branch-management'
import { EmptyState } from '../../shared/ui/empty-state'
import { ErrorPanel } from '../../shared/ui/error-panel'
import { LoadingState } from '../../shared/ui/loading-state'

interface ServiceGroup {
  label: string
  services: { id: string; name: string; description?: string | null }[]
}

/** Step 1: one of the services the branch takes bookings for, grouped by customer segment. */
@Component({
  selector: 'app-service-step',
  imports: [
    EmptyState,
    ErrorPanel,
    FormsModule,
    LoadingState,
    MatActionList,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    MatListItem,
    MatListItemLine,
    MatListItemTitle,
    MatPrefix,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>{{ 'booking.service.title' | translate }}</h2>
    <mat-form-field class="search">
      <mat-label>{{ 'booking.service.search' | translate }}</mat-label>
      <mat-icon matPrefix aria-hidden="true">search</mat-icon>
      <input matInput type="search" [ngModel]="search()" (ngModelChange)="search.set($event)" />
    </mat-form-field>
    @if (error()) {
      <app-error-panel [error]="error()" (retry)="load()" />
    } @else if (!groups()) {
      <app-loading-state />
    } @else if (visible().length === 0) {
      <app-empty-state icon="search_off" [message]="'booking.service.none' | translate" />
    } @else {
      @for (group of visible(); track group.label) {
        <h3 class="group">{{ group.label }}</h3>
        <mat-action-list>
          @for (service of group.services; track service.id) {
            <button mat-list-item type="button" (click)="select.emit(service.id)">
              <span matListItemTitle>{{ service.name }}</span>
              @if (service.description) {
                <span matListItemLine>{{ service.description }}</span>
              }
            </button>
          }
        </mat-action-list>
      }
    }
  `,
  styles: `
    .search {
      width: 100%;
      max-width: 24rem;
    }
    .group {
      margin: 1rem 0 0;
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class ServiceStep {
  readonly select = output<string>()

  private readonly catalog = inject(BranchCatalog)
  private readonly translate = inject(TranslateService)
  protected readonly groups = signal<ServiceGroup[] | undefined>(undefined)
  protected readonly error = signal<unknown>(undefined)
  protected readonly search = signal('')

  protected readonly visible = computed(() => {
    const term = this.search().trim().toLocaleLowerCase()
    return (this.groups() ?? [])
      .map((group) => ({
        ...group,
        services: group.services
          .filter((service) => !term || service.name.toLocaleLowerCase().includes(term))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((group) => group.services.length > 0)
  })

  constructor() {
    void this.load()
  }

  protected async load(): Promise<void> {
    this.groups.set(undefined)
    this.error.set(undefined)
    const segment = (value: string) => this.translate.instant(`segments.${value}`) as string
    try {
      const branch = await this.catalog.branch()
      const bySegment = new Map<string, ServiceGroup>()
      for (const service of branch.services) {
        const label = segment(service.segment)
        const group = bySegment.get(label) ?? { label, services: [] }
        group.services.push({ id: service.serviceId, name: service.name, description: service.description })
        bySegment.set(label, group)
      }
      this.groups.set([...bySegment.values()])
    } catch (error) {
      this.error.set(error)
    }
  }
}
