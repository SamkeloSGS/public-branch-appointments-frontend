import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatDialog } from '@angular/material/dialog'
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { MatOption, MatSelect } from '@angular/material/select'
import { MatSnackBar } from '@angular/material/snack-bar'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { confirmAction } from '../../../shared/ui/confirm-dialog'
import { EmptyState } from '../../../shared/ui/empty-state'
import { ErrorPanel } from '../../../shared/ui/error-panel'
import { LoadingState } from '../../../shared/ui/loading-state'
import { fromVersion } from '../../../shared/util/etag'
import { isApiError } from '../../../shared/util/problem'
import type { ServiceCategory } from '../../model/branch'
import type { AdminBranch, Offering, Pool } from '../../model/branch-admin'
import { BranchAdminApi } from '../../data/branch-admin-api'
import { BranchCatalog } from '../../data/branch-catalog'

interface OfferingForm {
  /** Set when changing an existing offering */
  offering?: Offering
  serviceId: string
  poolId: string
  durationMinutes: number | null
  slotIntervalMinutes: number
  minLeadTimeMinutes: number
  maxAdvanceDays: number
}

const newOfferingForm = (poolId = ''): OfferingForm => ({
  serviceId: '',
  poolId,
  durationMinutes: null,
  slotIntervalMinutes: 15,
  minLeadTimeMinutes: 60,
  maxAdvanceDays: 60,
})

/** Capacity pools and the services the branch offers, with each offering's booking rules (FE-11). */
@Component({
  selector: 'app-capacity-page',
  imports: [
    EmptyState,
    ErrorPanel,
    FormsModule,
    LoadingState,
    MatButton,
    MatCard,
    MatCardContent,
    MatFormField,
    MatHint,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="capacity-title">
      <h1 id="capacity-title">{{ 'admin.sections.capacity' | translate }}</h1>
      @if (branch(); as branch) {
        <p class="branch">{{ branch.name }}</p>
      }
      <app-error-panel [error]="actionError()" [serverDetail]="true" />
      @if (loadError()) {
        <app-error-panel [error]="loadError()" (retry)="load()" />
      } @else if (!pools() || !offerings()) {
        <app-loading-state />
      } @else {
        <h2>{{ 'admin.capacity.pools' | translate }}</h2>
        <p class="intro">{{ 'admin.capacity.poolsIntro' | translate }}</p>
        @if (pools()!.length === 0) {
          <app-empty-state icon="groups" [message]="'admin.capacity.noPools' | translate" />
        } @else {
          <div class="table-scroll">
            <table class="admin-table">
              <caption class="visually-hidden">{{ 'admin.capacity.pools' | translate }}</caption>
              <thead>
                <tr>
                  <th scope="col">{{ 'admin.capacity.poolName' | translate }}</th>
                  <th scope="col">{{ 'admin.capacity.baseCapacity' | translate }}</th>
                  <th scope="col"><span class="visually-hidden">{{ 'admin.day.actions' | translate }}</span></th>
                </tr>
              </thead>
              <tbody>
                @for (pool of pools(); track pool.id) {
                  <tr>
                    <td>{{ pool.name }}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        class="number"
                        [value]="pool.baseCapacity"
                        [attr.aria-label]="('admin.capacity.baseCapacity' | translate) + ' – ' + pool.name"
                        #capacity
                      />
                    </td>
                    <td>
                      <button
                        mat-stroked-button
                        type="button"
                        [disabled]="working() || +capacity.value === pool.baseCapacity || capacity.value === ''"
                        (click)="changeCapacity(pool, +capacity.value)"
                      >
                        {{ 'admin.save' | translate }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        <form class="inline-form" #poolForm="ngForm" (ngSubmit)="definePool(poolForm.valid ?? false)">
          <mat-form-field>
            <mat-label>{{ 'admin.capacity.poolName' | translate }}</mat-label>
            <input matInput name="poolName" required maxlength="100" [(ngModel)]="newPoolName" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'admin.capacity.baseCapacity' | translate }}</mat-label>
            <input matInput type="number" name="poolCapacity" required min="0" [(ngModel)]="newPoolCapacity" />
          </mat-form-field>
          <button mat-flat-button type="submit" [disabled]="working()">{{ 'admin.capacity.addPool' | translate }}</button>
        </form>

        <h2>{{ 'admin.capacity.offerings' | translate }}</h2>
        @if (offerings()!.length === 0) {
          <app-empty-state icon="design_services" [message]="'admin.capacity.noOfferings' | translate" />
        } @else {
          <div class="table-scroll">
            <table class="admin-table">
              <caption class="visually-hidden">{{ 'admin.capacity.offerings' | translate }}</caption>
              <thead>
                <tr>
                  <th scope="col">{{ 'admin.capacity.service' | translate }}</th>
                  <th scope="col">{{ 'admin.capacity.pool' | translate }}</th>
                  <th scope="col">{{ 'admin.capacity.duration' | translate }}</th>
                  <th scope="col">{{ 'admin.capacity.slotInterval' | translate }}</th>
                  <th scope="col">{{ 'admin.capacity.leadTime' | translate }}</th>
                  <th scope="col">{{ 'admin.capacity.maxAdvance' | translate }}</th>
                  <th scope="col">{{ 'admin.capacity.state' | translate }}</th>
                  <th scope="col"><span class="visually-hidden">{{ 'admin.day.actions' | translate }}</span></th>
                </tr>
              </thead>
              <tbody>
                @for (offering of offerings(); track offering.id) {
                  <tr [class.inactive]="!offering.active">
                    <td>{{ serviceName(offering.serviceId) }}</td>
                    <td>{{ poolName(offering.poolId) }}</td>
                    <td>{{ 'branchManagement.minutes' | translate: { minutes: offering.durationMinutes } }}</td>
                    <td>{{ 'branchManagement.minutes' | translate: { minutes: offering.slotIntervalMinutes } }}</td>
                    <td>{{ 'branchManagement.minutes' | translate: { minutes: offering.minLeadTimeMinutes } }}</td>
                    <td>{{ 'admin.capacity.days' | translate: { days: offering.maxAdvanceDays } }}</td>
                    <td>{{ (offering.active ? 'admin.capacity.active' : 'admin.capacity.withdrawn') | translate }}</td>
                    <td class="row-actions">
                      @if (offering.active) {
                        <button mat-button type="button" (click)="edit(offering)">{{ 'admin.edit' | translate }}</button>
                        <button mat-button type="button" class="destructive" [disabled]="working()" (click)="withdraw(offering)">
                          {{ 'admin.capacity.withdraw' | translate }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <mat-card appearance="outlined" class="offering-form">
          <mat-card-content>
            <h3>
              {{
                (form.offering ? 'admin.capacity.changeOffering' : 'admin.capacity.offerService')
                  | translate: { service: form.offering ? serviceName(form.offering!.serviceId) : '' }
              }}
            </h3>
            <form #offeringForm="ngForm" (ngSubmit)="saveOffering(offeringForm.valid ?? false)">
              <div class="grid">
                @if (!form.offering) {
                  <mat-form-field>
                    <mat-label>{{ 'admin.capacity.service' | translate }}</mat-label>
                    <mat-select name="serviceId" required [(ngModel)]="form.serviceId">
                      @for (category of offerable(); track category.id) {
                        @for (service of category.services; track service.id) {
                          <mat-option [value]="service.id">{{ service.name }} · {{ category.name }}</mat-option>
                        }
                      }
                    </mat-select>
                  </mat-form-field>
                }
                <mat-form-field>
                  <mat-label>{{ 'admin.capacity.pool' | translate }}</mat-label>
                  <mat-select name="poolId" required [(ngModel)]="form.poolId">
                    @for (pool of pools(); track pool.id) {
                      <mat-option [value]="pool.id">{{ pool.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'admin.capacity.duration' | translate }}</mat-label>
                  <input matInput type="number" name="duration" min="5" [(ngModel)]="form.durationMinutes" />
                  <mat-hint>{{ 'admin.capacity.durationHint' | translate }}</mat-hint>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'admin.capacity.slotInterval' | translate }}</mat-label>
                  <input matInput type="number" name="slot" required min="5" [(ngModel)]="form.slotIntervalMinutes" />
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'admin.capacity.leadTime' | translate }}</mat-label>
                  <input matInput type="number" name="lead" required min="0" [(ngModel)]="form.minLeadTimeMinutes" />
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'admin.capacity.maxAdvance' | translate }}</mat-label>
                  <input matInput type="number" name="advance" required min="1" [(ngModel)]="form.maxAdvanceDays" />
                </mat-form-field>
              </div>
              <div class="form-actions">
                <button mat-flat-button type="submit" [disabled]="working()">{{ 'admin.save' | translate }}</button>
                @if (form.offering) {
                  <button mat-button type="button" (click)="form = newForm()">{{ 'common.cancel' | translate }}</button>
                }
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      }
    </section>
  `,
  styles: `
    .branch,
    .intro {
      color: var(--mat-sys-on-surface-variant);
    }
    .branch {
      margin-top: -0.5rem;
    }
    h2 {
      margin-top: 2rem;
    }
    .number {
      width: 5rem;
      padding: 0.375rem 0.5rem;
      border: 1px solid var(--mat-sys-outline);
      border-radius: var(--mat-sys-corner-extra-small);
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
    }
    .inline-form {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 1rem;
      margin-top: 1rem;
    }
    .inactive {
      color: var(--mat-sys-on-surface-variant);
    }
    .row-actions {
      white-space: nowrap;
    }
    .destructive {
      --mat-button-text-label-text-color: var(--mat-sys-error);
    }
    .offering-form {
      margin-top: 1rem;
    }
    h3 {
      margin-top: 0;
      font: var(--mat-sys-title-medium);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
      gap: 0 1rem;
    }
    .form-actions {
      display: flex;
      gap: 0.5rem;
    }
  `,
})
export class CapacityPage {
  private readonly api = inject(BranchAdminApi)
  private readonly catalog = inject(BranchCatalog)
  private readonly dialog = inject(MatDialog)
  private readonly snackBar = inject(MatSnackBar)
  private readonly translate = inject(TranslateService)

  protected readonly branch = signal<AdminBranch | undefined>(undefined)
  protected readonly pools = signal<Pool[] | undefined>(undefined)
  protected readonly offerings = signal<Offering[] | undefined>(undefined)
  private readonly categories = signal<ServiceCategory[]>([])
  protected readonly loadError = signal<unknown>(undefined)
  protected readonly actionError = signal<unknown>(undefined)
  protected readonly working = signal(false)
  protected form: OfferingForm = newOfferingForm()
  protected newPoolName = ''
  protected newPoolCapacity: number | null = null

  /** Services of the branch's segments that it does not offer yet */
  protected readonly offerable = computed(() => {
    const segments = this.branch()?.segments ?? []
    const offered = new Set((this.offerings() ?? []).filter((offering) => offering.active).map((o) => o.serviceId))
    return this.categories()
      .filter((category) => segments.includes(category.segment))
      .map((category) => ({ ...category, services: category.services.filter((service) => !offered.has(service.id)) }))
      .filter((category) => category.services.length > 0)
  })

  constructor() {
    void this.load()
    this.catalog
      .serviceCatalog()
      .then((categories) => this.categories.set(categories))
      .catch(() => undefined)
  }

  protected newForm(): OfferingForm {
    return newOfferingForm(this.pools()?.[0]?.id)
  }

  protected async load(): Promise<void> {
    this.loadError.set(undefined)
    try {
      const [branch, pools, offerings] = await Promise.all([
        this.api.branch(),
        this.api.pools(),
        this.api.offerings(),
      ])
      this.branch.set(branch.value)
      this.pools.set(pools)
      this.offerings.set([...offerings].sort((a, b) => Number(b.active) - Number(a.active)))
      if (!this.form.offering && !this.form.poolId) this.form = this.newForm()
    } catch (error) {
      this.loadError.set(error)
    }
  }

  protected serviceName(serviceId: string): string {
    for (const category of this.categories()) {
      const service = category.services.find((candidate) => candidate.id === serviceId)
      if (service) return service.name
    }
    return this.translate.instant('admin.capacity.retiredService') as string
  }

  protected poolName(poolId: string): string {
    return this.pools()?.find((pool) => pool.id === poolId)?.name ?? ''
  }

  private async act(action: () => Promise<unknown>): Promise<boolean> {
    this.working.set(true)
    this.actionError.set(undefined)
    try {
      await action()
      this.snackBar.open(this.translate.instant('admin.saved') as string, undefined, { duration: 3000 })
      return true
    } catch (error) {
      this.actionError.set(error)
      if (isApiError(error) && error.isStale) await this.load()
      return false
    } finally {
      this.working.set(false)
    }
  }

  protected async definePool(valid: boolean): Promise<void> {
    if (!valid || this.newPoolCapacity === null) return
    const saved = await this.act(async () => {
      const pool = await this.api.definePool(this.newPoolName.trim(), this.newPoolCapacity!)
      this.pools.update((pools) => [...(pools ?? []), pool.value])
    })
    if (saved) {
      this.newPoolName = ''
      this.newPoolCapacity = null
    }
  }

  protected async changeCapacity(pool: Pool, baseCapacity: number): Promise<void> {
    await this.act(async () => {
      const saved = await this.api.changePool(fromVersion(pool), baseCapacity)
      this.pools.update((pools) => pools?.map((candidate) => (candidate.id === pool.id ? saved.value : candidate)))
    })
  }

  protected edit(offering: Offering): void {
    this.form = {
      offering,
      serviceId: offering.serviceId,
      poolId: offering.poolId,
      durationMinutes: offering.durationMinutes,
      slotIntervalMinutes: offering.slotIntervalMinutes,
      minLeadTimeMinutes: offering.minLeadTimeMinutes,
      maxAdvanceDays: offering.maxAdvanceDays,
    }
  }

  protected async saveOffering(valid: boolean): Promise<void> {
    if (!valid) return
    const form = this.form
    const rules = {
      poolId: form.poolId,
      durationMinutes: form.durationMinutes ?? undefined,
      slotIntervalMinutes: form.slotIntervalMinutes,
      minLeadTimeMinutes: form.minLeadTimeMinutes,
      maxAdvanceDays: form.maxAdvanceDays,
    }
    const saved = await this.act(async () => {
      const offering = form.offering
        ? await this.api.changeOffering(fromVersion(form.offering), rules)
        : await this.api.offer({ serviceId: form.serviceId, ...rules })
      this.offerings.update((list) => [
        offering.value,
        ...(list ?? []).filter((candidate) => candidate.id !== offering.value.id),
      ])
    })
    if (saved) this.form = this.newForm()
  }

  protected async withdraw(offering: Offering): Promise<void> {
    const t = (key: string, params?: Record<string, string>) => this.translate.instant(key, params) as string
    const confirmed = await confirmAction(this.dialog, {
      title: t('admin.capacity.withdrawTitle'),
      message: t('admin.capacity.withdrawMessage', { service: this.serviceName(offering.serviceId) }),
      confirmLabel: t('admin.capacity.withdraw'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    })
    if (!confirmed) return
    await this.act(async () => {
      const saved = await this.api.withdraw(fromVersion(offering))
      this.offerings.update((list) => list?.map((candidate) => (candidate.id === offering.id ? saved.value : candidate)))
    })
  }
}
