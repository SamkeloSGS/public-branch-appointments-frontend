import { NgTemplateOutlet } from '@angular/common'
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatDialog } from '@angular/material/dialog'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { Session } from '../../identity'
import { confirmAction } from '../../shared/ui/confirm-dialog'
import { ErrorPanel } from '../../shared/ui/error-panel'
import { LoadingState } from '../../shared/ui/loading-state'
import { errorView } from '../../shared/util/error-view'
import { hasCode, isApiError } from '../../shared/util/problem'
import {
  contactDetailsRequest,
  contactDetailsValues,
  customerErrorMessages,
  type ContactDetailsValues,
  type Preferences,
} from '../model/customer'
import { ProfileStore } from '../data/profile.store'
import { ContactDetailsForm, type FieldError } from '../ui/contact-details-form'
import { PreferencesForm } from '../ui/preferences-form'

type Section = 'details' | 'preferences' | 'erase'

interface Notice {
  section: Section
  kind: 'success' | 'warning' | 'error'
  /** Translation key */
  key: string
}

/** Contact details, contact preferences and erasing the customer's data (FE-8). */
@Component({
  selector: 'app-profile-page',
  imports: [
    ContactDetailsForm,
    ErrorPanel,
    LoadingState,
    MatButton,
    MatCard,
    MatCardContent,
    NgTemplateOutlet,
    PreferencesForm,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="profile-title" class="page narrow">
      <h1 id="profile-title">{{ 'customer.profile.title' | translate }}</h1>
      @if (loadError()) {
        <app-error-panel [error]="loadError()" [messages]="messages" (retry)="load()" />
      } @else if (!profile()) {
        <app-loading-state />
      } @else {
        <mat-card appearance="outlined">
          <mat-card-content>
            <h2 id="details-title">{{ 'customer.profile.details' | translate }}</h2>
            <ng-container *ngTemplateOutlet="noticeFor; context: { $implicit: 'details' }" />
            <app-contact-details-form
              [initial]="details()"
              [submitLabel]="'customer.profile.saveDetails' | translate"
              [pending]="pending() === 'details'"
              [fieldError]="fieldError()"
              (save)="saveDetails($event)"
            />
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-content>
            <h2>{{ 'customer.preferences.title' | translate }}</h2>
            <ng-container *ngTemplateOutlet="noticeFor; context: { $implicit: 'preferences' }" />
            <app-preferences-form
              [customer]="profile()!.value"
              [pending]="pending() === 'preferences'"
              (save)="savePreferences($event)"
            />
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="danger">
          <mat-card-content>
            <h2>{{ 'customer.erase.title' | translate }}</h2>
            <p>{{ 'customer.erase.explain' | translate }}</p>
            <ng-container *ngTemplateOutlet="noticeFor; context: { $implicit: 'erase' }" />
            <button mat-stroked-button type="button" class="destructive" [disabled]="pending() === 'erase'" (click)="erase()">
              {{ 'customer.erase.start' | translate }}
            </button>
          </mat-card-content>
        </mat-card>
      }
    </section>

    <ng-template #noticeFor let-section>
      @if (notice(); as notice) {
        @if (notice.section === section) {
          <p class="notice" [class]="notice.kind" [attr.role]="notice.kind === 'success' ? 'status' : 'alert'">
            {{ notice.key | translate }}
          </p>
        }
      }
    </ng-template>
  `,
  styles: `
    mat-card {
      margin-bottom: 1rem;
    }
    h2 {
      margin-top: 0;
      font: var(--mat-sys-title-medium);
    }
    .danger {
      border-color: var(--mat-sys-error);
    }
    .destructive {
      --mat-button-outlined-label-text-color: var(--mat-sys-error);
    }
    .notice {
      padding: 0.5rem 0.75rem;
      border-radius: var(--mat-sys-corner-small);
    }
    .notice.success {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .notice.warning,
    .notice.error {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class ProfilePage {
  private readonly store = inject(ProfileStore)
  private readonly session = inject(Session)
  private readonly dialog = inject(MatDialog)
  private readonly translate = inject(TranslateService)

  protected readonly messages = customerErrorMessages
  protected readonly profile = this.store.profile
  protected readonly loadError = signal<unknown>(undefined)
  protected readonly pending = signal<Section | undefined>(undefined)
  protected readonly notice = signal<Notice | undefined>(undefined)
  protected readonly fieldError = signal<FieldError | undefined>(undefined)
  /** The form's values; after a 412 they are the user's unsaved input, not the reloaded profile (FE-15) */
  protected readonly details = signal<ContactDetailsValues>(contactDetailsValues())

  constructor() {
    void this.load()
  }

  protected async load(): Promise<void> {
    this.loadError.set(undefined)
    try {
      const profile = await this.store.load()
      if (profile) this.details.set(contactDetailsValues(profile.value))
    } catch (error) {
      this.loadError.set(error)
    }
  }

  private async run(section: Section, action: () => Promise<void>, success: string): Promise<boolean> {
    this.pending.set(section)
    this.notice.set(undefined)
    this.fieldError.set(undefined)
    try {
      await action()
      this.notice.set({ section, kind: 'success', key: success })
      return true
    } catch (error) {
      if (isApiError(error) && error.isStale) {
        // Changed elsewhere: load the latest version, keep the input, ask to review and save again
        await this.store.load().catch(() => undefined)
        this.notice.set({ section, kind: 'warning', key: 'errors.staleKept' })
      } else if (hasCode(error, 'EMAIL_IN_USE') || hasCode(error, 'CONTACT_DETAILS_UNAVAILABLE')) {
        this.fieldError.set({ field: 'email', key: customerErrorMessages.CONTACT_DETAILS_UNAVAILABLE })
      } else {
        this.notice.set({ section, kind: 'error', key: errorView(error, customerErrorMessages).messageKey })
      }
      return false
    } finally {
      this.pending.set(undefined)
    }
  }

  protected saveDetails(values: ContactDetailsValues): void {
    this.details.set(values)
    void this.run('details', () => this.store.saveContactDetails(contactDetailsRequest(values)), 'customer.profile.saved')
  }

  protected savePreferences(preferences: Preferences): void {
    void this.run('preferences', () => this.store.savePreferences(preferences), 'customer.profile.saved')
  }

  /** Erasing needs the confirmation word typed, warns about upcoming appointments, then signs out (FE-8). */
  protected async erase(): Promise<void> {
    const t = (key: string) => this.translate.instant(key) as string
    const confirmed = await confirmAction(this.dialog, {
      title: t('customer.erase.title'),
      message: t('customer.erase.warning'),
      confirmLabel: t('customer.erase.confirm'),
      cancelLabel: t('common.cancel'),
      typedWord: t('customer.erase.word'),
      typedLabel: this.translate.instant('common.typeToConfirm', { word: t('customer.erase.word') }) as string,
      destructive: true,
    })
    if (!confirmed) return
    const erased = await this.run('erase', () => this.store.erase(), 'customer.erase.done')
    if (erased) await this.session.signOut()
  }
}
