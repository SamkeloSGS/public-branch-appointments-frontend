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
import { ErrorPanel } from '../../../shared/ui/error-panel'
import { LoadingState } from '../../../shared/ui/loading-state'
import { fromVersion } from '../../../shared/util/etag'
import { isApiError } from '../../../shared/util/problem'
import {
  SEGMENTS,
  prerequisitesFromText,
  prerequisitesToText,
  type AdminCategory,
  type AdminService,
  type Segment,
} from '../../model/branch-admin'
import { BranchAdminApi } from '../../data/branch-admin-api'
import { PrerequisitesList } from '../../ui/prerequisites-list'

/** The branch manager: the service catalog, by customer segment and category (spec 6). */
@Component({
  selector: 'app-services-page',
  imports: [
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
    PrerequisitesList,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="services-title">
      <h1 id="services-title">{{ 'admin.sections.services' | translate }}</h1>
      <app-error-panel [error]="actionError()" [serverDetail]="true" />
      @if (loadError()) {
        <app-error-panel [error]="loadError()" (retry)="load()" />
      } @else if (!categories() || !services()) {
        <app-loading-state />
      } @else {
        @for (segment of segments; track segment) {
          <h2>{{ 'segments.' + segment | translate }}</h2>
          @for (category of categoriesOf(segment); track category.id) {
            <mat-card appearance="outlined" class="category" [class.retired]="!category.active">
              <mat-card-content>
                <div class="category-head">
                  <h3>
                    {{ category.name }}
                    @if (!category.active) {
                      <span class="tag">{{ 'admin.services.retired' | translate }}</span>
                    }
                  </h3>
                  @if (category.active) {
                    <button mat-button type="button" class="destructive" [disabled]="working()" (click)="retireCategory(category)">
                      {{ 'admin.services.retire' | translate }}
                    </button>
                  }
                </div>
                @if (category.description) {
                  <p class="detail">{{ category.description }}</p>
                }
                <ul class="services">
                  @for (service of servicesOf(category.id); track service.id) {
                    <li [class.retired]="!service.active">
                      <div>
                        <strong>{{ service.name }}</strong>
                        <span class="detail">
                          · {{ 'branchManagement.minutes' | translate: { minutes: service.defaultDurationMinutes } }}
                        </span>
                        @if (!service.active) {
                          <span class="tag">{{ 'admin.services.retired' | translate }}</span>
                        }
                        @if (service.description) {
                          <div class="detail">{{ service.description }}</div>
                        }
                        <app-prerequisites-list [items]="service.prerequisites" />
                      </div>
                      <div class="row-actions">
                        <button mat-button type="button" [disabled]="working()" (click)="startEdit(service)">
                          {{ 'admin.services.editDetails' | translate }}
                        </button>
                      </div>
                      @if (editing() === service.id) {
                        <form
                          class="edit"
                          #detailsForm="ngForm"
                          [attr.aria-label]="'admin.services.editDetailsOf' | translate: { name: service.name }"
                          (ngSubmit)="saveDetails(service)"
                        >
                          <mat-form-field>
                            <mat-label>{{ 'admin.services.description' | translate }}</mat-label>
                            <textarea matInput name="editDescription" rows="2" maxlength="500" [(ngModel)]="details.description"></textarea>
                          </mat-form-field>
                          <mat-form-field>
                            <mat-label>{{ 'admin.services.prerequisites' | translate }}</mat-label>
                            <textarea matInput name="editPrerequisites" rows="4" [(ngModel)]="details.prerequisites"></textarea>
                            <mat-hint>{{ 'admin.services.prerequisitesHint' | translate }}</mat-hint>
                          </mat-form-field>
                          <div class="edit-actions">
                            <button mat-flat-button type="submit" [disabled]="working()">{{ 'admin.save' | translate }}</button>
                            <button mat-button type="button" [disabled]="working()" (click)="editing.set(undefined)">
                              {{ 'common.cancel' | translate }}
                            </button>
                          </div>
                        </form>
                      }
                      @if (service.active) {
                        <div class="row-actions">
                          <mat-form-field class="move" subscriptSizing="dynamic">
                            <mat-label>{{ 'admin.services.moveTo' | translate }}</mat-label>
                            <mat-select (valueChange)="move(service, $event)">
                              @for (target of moveTargets(service); track target.id) {
                                <mat-option [value]="target.id">{{ target.name }}</mat-option>
                              }
                            </mat-select>
                          </mat-form-field>
                          <button mat-button type="button" class="destructive" [disabled]="working()" (click)="retireService(service)">
                            {{ 'admin.services.retire' | translate }}
                          </button>
                        </div>
                      }
                    </li>
                  } @empty {
                    <li class="detail">{{ 'admin.services.noServices' | translate }}</li>
                  }
                </ul>
              </mat-card-content>
            </mat-card>
          }
        }

        <div class="forms">
          <mat-card appearance="outlined">
            <mat-card-content>
              <h2>{{ 'admin.services.addCategory' | translate }}</h2>
              <form #categoryForm="ngForm" (ngSubmit)="defineCategory(categoryForm.valid ?? false)">
                <mat-form-field>
                  <mat-label>{{ 'admin.services.name' | translate }}</mat-label>
                  <input matInput name="categoryName" required maxlength="100" [(ngModel)]="newCategory.name" />
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'admin.services.segment' | translate }}</mat-label>
                  <mat-select name="categorySegment" required [(ngModel)]="newCategory.segment">
                    @for (segment of segments; track segment) {
                      <mat-option [value]="segment">{{ 'segments.' + segment | translate }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'admin.services.description' | translate }}</mat-label>
                  <input matInput name="categoryDescription" maxlength="500" [(ngModel)]="newCategory.description" />
                </mat-form-field>
                <button mat-flat-button type="submit" [disabled]="working()">{{ 'admin.save' | translate }}</button>
              </form>
            </mat-card-content>
          </mat-card>
          <mat-card appearance="outlined">
            <mat-card-content>
              <h2>{{ 'admin.services.addService' | translate }}</h2>
              <form #serviceForm="ngForm" (ngSubmit)="defineService(serviceForm.valid ?? false)">
                <mat-form-field>
                  <mat-label>{{ 'admin.services.name' | translate }}</mat-label>
                  <input matInput name="serviceName" required maxlength="100" [(ngModel)]="newService.name" />
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'admin.services.category' | translate }}</mat-label>
                  <mat-select name="serviceCategory" required [(ngModel)]="newService.categoryId">
                    @for (category of activeCategories(); track category.id) {
                      <mat-option [value]="category.id">
                        {{ category.name }} · {{ 'segments.' + category.segment | translate }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'admin.services.duration' | translate }}</mat-label>
                  <input matInput type="number" name="serviceDuration" required min="5" [(ngModel)]="newService.duration" />
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'admin.services.description' | translate }}</mat-label>
                  <input matInput name="serviceDescription" maxlength="500" [(ngModel)]="newService.description" />
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'admin.services.prerequisites' | translate }}</mat-label>
                  <textarea matInput name="servicePrerequisites" rows="3" [(ngModel)]="newService.prerequisites"></textarea>
                  <mat-hint>{{ 'admin.services.prerequisitesHint' | translate }}</mat-hint>
                </mat-form-field>
                <button mat-flat-button type="submit" [disabled]="working()">{{ 'admin.save' | translate }}</button>
              </form>
            </mat-card-content>
          </mat-card>
        </div>
      }
    </section>
  `,
  styles: `
    .category {
      margin-bottom: 0.75rem;
    }
    .category-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    h3 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .services {
      list-style: none;
      margin: 0.5rem 0 0;
      padding: 0;
    }
    .services li {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .retired {
      opacity: 0.7;
    }
    .tag {
      margin-inline-start: 0.5rem;
      padding: 0 0.5rem;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-surface-container-highest);
      font: var(--mat-sys-label-small);
    }
    .detail {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .row-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .move {
      width: 12rem;
    }
    .edit {
      flex-basis: 100%;
      margin: 0.25rem 0 0.5rem;
    }
    .edit-actions {
      display: flex;
      gap: 0.5rem;
    }
    .destructive {
      --mat-button-text-label-text-color: var(--mat-sys-error);
    }
    .forms {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }
    .forms h2 {
      margin-top: 0;
      font: var(--mat-sys-title-medium);
    }
    form {
      display: grid;
    }
    form button {
      justify-self: start;
    }
  `,
})
export class ServicesPage {
  private readonly api = inject(BranchAdminApi)
  private readonly dialog = inject(MatDialog)
  private readonly snackBar = inject(MatSnackBar)
  private readonly translate = inject(TranslateService)

  protected readonly segments = SEGMENTS
  protected readonly categories = signal<AdminCategory[] | undefined>(undefined)
  protected readonly services = signal<AdminService[] | undefined>(undefined)
  protected readonly loadError = signal<unknown>(undefined)
  protected readonly actionError = signal<unknown>(undefined)
  protected readonly working = signal(false)
  protected readonly activeCategories = computed(() => (this.categories() ?? []).filter((category) => category.active))
  protected newCategory = { name: '', segment: 'PERSONAL' as Segment, description: '' }
  protected newService = { name: '', categoryId: '', duration: 30 as number | null, description: '', prerequisites: '' }
  /** The service whose description and prerequisites are being edited */
  protected readonly editing = signal<string | undefined>(undefined)
  protected details = { description: '', prerequisites: '' }

  constructor() {
    void this.load()
  }

  protected async load(): Promise<void> {
    this.loadError.set(undefined)
    try {
      const [categories, services] = await Promise.all([this.api.categories(), this.api.services()])
      this.categories.set([...categories].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)))
      this.services.set([...services].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (error) {
      this.loadError.set(error)
    }
  }

  protected categoriesOf(segment: Segment): AdminCategory[] {
    return (this.categories() ?? []).filter((category) => category.segment === segment)
  }

  protected servicesOf(categoryId: string): AdminService[] {
    return (this.services() ?? []).filter((service) => service.categoryId === categoryId)
  }

  /** Active categories of the same segment that the service could move to */
  protected moveTargets(service: AdminService): AdminCategory[] {
    return this.activeCategories().filter(
      (category) => category.segment === service.segment && category.id !== service.categoryId,
    )
  }

  private async act(action: () => Promise<void>): Promise<boolean> {
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

  private replaceService(service: AdminService): void {
    this.services.update((list) => (list ?? []).map((candidate) => (candidate.id === service.id ? service : candidate)))
  }

  protected async defineCategory(valid: boolean): Promise<void> {
    if (!valid) return
    const request = {
      name: this.newCategory.name.trim(),
      segment: this.newCategory.segment,
      description: this.newCategory.description.trim() || undefined,
    }
    const saved = await this.act(async () => {
      const category = await this.api.defineCategory(request)
      this.categories.update((list) => [...(list ?? []), category.value])
    })
    if (saved) this.newCategory = { name: '', segment: request.segment, description: '' }
  }

  protected async defineService(valid: boolean): Promise<void> {
    if (!valid || this.newService.duration === null) return
    const request = {
      name: this.newService.name.trim(),
      categoryId: this.newService.categoryId,
      defaultDurationMinutes: this.newService.duration,
      description: this.newService.description.trim() || undefined,
      prerequisites: prerequisitesFromText(this.newService.prerequisites),
    }
    const saved = await this.act(async () => {
      const service = await this.api.defineService(request)
      this.services.update((list) => [...(list ?? []), service.value])
    })
    if (saved) {
      this.newService = { name: '', categoryId: request.categoryId, duration: 30, description: '', prerequisites: '' }
    }
  }

  protected startEdit(service: AdminService): void {
    this.details = { description: service.description ?? '', prerequisites: prerequisitesToText(service.prerequisites) }
    this.editing.set(service.id)
  }

  protected async saveDetails(service: AdminService): Promise<void> {
    const request = {
      description: this.details.description.trim() || undefined,
      prerequisites: prerequisitesFromText(this.details.prerequisites),
    }
    const saved = await this.act(async () =>
      this.replaceService((await this.api.updateServiceDetails(fromVersion(service), request)).value),
    )
    if (saved) this.editing.set(undefined)
  }

  protected async move(service: AdminService, categoryId: string): Promise<void> {
    await this.act(async () => this.replaceService((await this.api.moveService(fromVersion(service), categoryId)).value))
  }

  private async confirmRetire(name: string): Promise<boolean> {
    const t = (key: string, params?: Record<string, string>) => this.translate.instant(key, params) as string
    return confirmAction(this.dialog, {
      title: t('admin.services.retireTitle', { name }),
      message: t('admin.services.retireMessage', { name }),
      confirmLabel: t('admin.services.retire'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    })
  }

  protected async retireService(service: AdminService): Promise<void> {
    if (!(await this.confirmRetire(service.name))) return
    await this.act(async () => this.replaceService((await this.api.retireService(fromVersion(service))).value))
  }

  protected async retireCategory(category: AdminCategory): Promise<void> {
    if (!(await this.confirmRetire(category.name))) return
    await this.act(async () => {
      const retired = (await this.api.retireCategory(fromVersion(category))).value
      this.categories.update((list) => (list ?? []).map((candidate) => (candidate.id === retired.id ? retired : candidate)))
    })
  }
}
