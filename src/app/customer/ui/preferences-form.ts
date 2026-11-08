import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatFormField, MatLabel } from '@angular/material/form-field'
import { MatOption, MatSelect } from '@angular/material/select'
import { MatSlideToggle } from '@angular/material/slide-toggle'
import { TranslatePipe } from '@ngx-translate/core'
import { LANGUAGES, hasContactFor, isLastChannel, type Channel, type Customer, type Preferences } from '../model/customer'

/**
 * Contact preferences. The last enabled channel cannot be switched off and the form says why; a channel without its
 * contact detail cannot be switched on (FE-8).
 */
@Component({
  selector: 'app-preferences-form',
  imports: [FormsModule, MatButton, MatFormField, MatLabel, MatOption, MatSelect, MatSlideToggle, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (ngSubmit)="save.emit(preferences())">
      <fieldset>
        <legend>{{ 'customer.preferences.channels' | translate }}</legend>
        @for (channel of channels; track channel) {
          <div class="channel">
            <mat-slide-toggle
              [name]="channel"
              [checked]="enabled(channel)"
              [disabled]="locked(channel)"
              [attr.aria-describedby]="locked(channel) ? channel + '-why' : null"
              (change)="toggle(channel, $event.checked)"
            >
              {{ 'customer.preferences.' + channel | translate }}
            </mat-slide-toggle>
            @if (lockReason(channel); as reason) {
              <p class="why" [id]="channel + '-why'">{{ reason | translate }}</p>
            }
          </div>
        }
      </fieldset>
      <mat-form-field>
        <mat-label>{{ 'customer.fields.language' | translate }}</mat-label>
        <mat-select name="language" [ngModel]="preferences().language" (ngModelChange)="setLanguage($event)">
          @for (language of languages; track language) {
            <mat-option [value]="language">{{ 'languages.' + language | translate }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <button mat-flat-button type="submit" [disabled]="pending()">
        {{ 'customer.preferences.save' | translate }}
      </button>
    </form>
  `,
  styles: `
    form {
      display: grid;
      gap: 0.75rem;
      max-width: 32rem;
    }
    fieldset {
      border: 0;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.5rem;
    }
    legend {
      margin-bottom: 0.5rem;
      font: var(--mat-sys-title-small);
    }
    .why {
      margin: 0.25rem 0 0 3.5rem;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    button {
      justify-self: start;
    }
  `,
})
export class PreferencesForm {
  readonly customer = input.required<Customer>()
  readonly pending = input(false)
  readonly save = output<Preferences>()

  protected readonly channels: readonly Channel[] = ['email', 'sms']
  protected readonly languages = LANGUAGES
  protected readonly preferences = signal<Preferences>({ emailEnabled: true, smsEnabled: false, language: 'en' })

  constructor() {
    effect(() => {
      const customer = this.customer()
      this.preferences.set({
        emailEnabled: customer.emailEnabled,
        smsEnabled: customer.smsEnabled,
        language: customer.language,
      })
    })
  }

  protected enabled(channel: Channel): boolean {
    return channel === 'email' ? this.preferences().emailEnabled : this.preferences().smsEnabled
  }

  protected readonly lockReasons = computed(() => {
    const reasons: Partial<Record<Channel, string>> = {}
    for (const channel of this.channels) {
      if (isLastChannel(this.preferences(), channel)) reasons[channel] = 'customer.preferences.last'
      else if (!this.enabled(channel) && !hasContactFor(this.customer(), channel))
        reasons[channel] = 'customer.preferences.noContact'
    }
    return reasons
  })

  protected lockReason(channel: Channel): string | undefined {
    return this.lockReasons()[channel]
  }

  protected locked(channel: Channel): boolean {
    return this.lockReason(channel) !== undefined
  }

  protected toggle(channel: Channel, on: boolean): void {
    this.preferences.update((current) =>
      channel === 'email' ? { ...current, emailEnabled: on } : { ...current, smsEnabled: on },
    )
  }

  protected setLanguage(language: string): void {
    this.preferences.update((current) => ({ ...current, language }))
  }
}
