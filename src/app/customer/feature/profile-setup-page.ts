import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { Router } from '@angular/router'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { Session } from '../../identity'
import { ErrorPanel } from '../../shared/ui/error-panel'
import { hasCode } from '../../shared/util/problem'
import { contactDetailsValues, customerErrorMessages, customerRequest, type ContactDetailsValues } from '../model/customer'
import { ProfileStore } from '../data/profile.store'
import { ContactDetailsForm } from '../ui/contact-details-form'

/** Only same-app paths are followed after setup, never another site. */
function safeReturnPath(value: string | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

/** First-time profile: the email is pre-filled from the sign-in identity; afterwards the user returns (FE-4). */
@Component({
  selector: 'app-profile-setup-page',
  imports: [ContactDetailsForm, ErrorPanel, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="setup-title" class="page narrow">
      <h1 id="setup-title">{{ 'customer.setup.title' | translate }}</h1>
      <p>{{ 'customer.setup.intro' | translate }}</p>
      <app-error-panel [error]="error()" [messages]="messages" (retry)="save(lastValues!)" />
      <app-contact-details-form
        [initial]="initial()"
        [submitLabel]="'customer.setup.submit' | translate"
        [pending]="pending()"
        [showLanguage]="true"
        (save)="save($event)"
      />
    </section>
  `,
})
export class ProfileSetupPage {
  readonly returnTo = input<string>()

  private readonly store = inject(ProfileStore)
  private readonly router = inject(Router)
  private readonly session = inject(Session)
  private readonly translate = inject(TranslateService)

  protected readonly messages = customerErrorMessages
  protected readonly initial = computed(() => ({
    ...contactDetailsValues(undefined, this.session.email()),
    language: contactDetailsValues({ language: this.translate.getCurrentLang() ?? undefined }).language,
  }))
  protected readonly pending = signal(false)
  protected readonly error = signal<unknown>(undefined)
  protected lastValues: ContactDetailsValues | undefined

  protected async save(values: ContactDetailsValues): Promise<void> {
    this.lastValues = values
    this.pending.set(true)
    this.error.set(undefined)
    try {
      await this.store.create(customerRequest(values))
      await this.router.navigateByUrl(safeReturnPath(this.returnTo()), { replaceUrl: true })
    } catch (error) {
      if (hasCode(error, 'PROFILE_EXISTS')) {
        await this.store.load()
        await this.router.navigateByUrl(safeReturnPath(this.returnTo()), { replaceUrl: true })
      } else this.error.set(error)
    } finally {
      this.pending.set(false)
    }
  }
}
