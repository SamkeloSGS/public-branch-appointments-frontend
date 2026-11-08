import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core'
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { MatOption, MatSelect } from '@angular/material/select'
import { TranslatePipe } from '@ngx-translate/core'
import {
  LANGUAGES,
  NAME_MAX_LENGTH,
  PHONE_PATTERN,
  hasSomeContact,
  type ContactDetailsValues,
} from '../model/customer'

export interface FieldError {
  field: keyof ContactDetailsValues
  /** Translation key */
  key: string
}

function someContact(group: AbstractControl): ValidationErrors | null {
  const { email, phone } = group.value as Pick<ContactDetailsValues, 'email' | 'phone'>
  return hasSomeContact({ email: email ?? '', phone: phone ?? '' }) ? null : { contactRequired: true }
}

/** Name and contact details; validates for a better experience, the server decides. Values in, submit out. */
@Component({
  selector: 'app-contact-details-form',
  imports: [
    MatButton,
    MatError,
    MatFormField,
    MatHint,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="names">
        <mat-form-field>
          <mat-label>{{ 'customer.fields.givenName' | translate }}</mat-label>
          <input matInput formControlName="givenName" autocomplete="given-name" required />
          <mat-error>{{ errorKey('givenName') | translate }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'customer.fields.familyName' | translate }}</mat-label>
          <input matInput formControlName="familyName" autocomplete="family-name" required />
          <mat-error>{{ errorKey('familyName') | translate }}</mat-error>
        </mat-form-field>
      </div>
      <p class="hint" id="contact-hint">{{ 'customer.fields.contactHint' | translate }}</p>
      <mat-form-field>
        <mat-label>{{ 'customer.fields.email' | translate }}</mat-label>
        <input matInput type="email" formControlName="email" autocomplete="email" aria-describedby="contact-hint" />
        <mat-error>{{ errorKey('email') | translate }}</mat-error>
      </mat-form-field>
      <mat-form-field>
        <mat-label>{{ 'customer.fields.phone' | translate }}</mat-label>
        <input matInput type="tel" formControlName="phone" autocomplete="tel" aria-describedby="contact-hint" />
        <mat-hint>+27 82 555 0101</mat-hint>
        <mat-error>{{ errorKey('phone') | translate }}</mat-error>
      </mat-form-field>
      @if (showLanguage()) {
        <mat-form-field>
          <mat-label>{{ 'customer.fields.language' | translate }}</mat-label>
          <mat-select formControlName="language">
            @for (language of languages; track language) {
              <mat-option [value]="language">{{ 'languages.' + language | translate }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      @if (form.hasError('contactRequired') && (form.touched || attempted)) {
        <p class="form-error" role="alert">{{ 'customer.validation.contactRequired' | translate }}</p>
      }
      <button mat-flat-button type="submit" [disabled]="pending()">{{ submitLabel() }}</button>
    </form>
  `,
  styles: `
    form {
      display: grid;
      gap: 0.25rem;
      max-width: 32rem;
    }
    .names {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      column-gap: 1rem;
    }
    .hint {
      margin: 0 0 0.75rem;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .form-error {
      margin: 0 0 0.75rem;
      color: var(--mat-sys-error);
    }
    button {
      justify-self: start;
    }
  `,
})
export class ContactDetailsForm {
  readonly initial = input.required<ContactDetailsValues>()
  readonly submitLabel = input.required<string>()
  readonly pending = input(false)
  readonly showLanguage = input(false)
  /** A rejection from the server that concerns one field, shown next to it */
  readonly fieldError = input<FieldError>()
  readonly save = output<ContactDetailsValues>()

  protected readonly languages = LANGUAGES
  protected attempted = false
  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      givenName: ['', [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)]],
      familyName: ['', [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)]],
      email: ['', [Validators.email]],
      phone: ['', [Validators.pattern(PHONE_PATTERN)]],
      language: ['en' as ContactDetailsValues['language']],
    },
    { validators: someContact },
  )

  constructor() {
    effect(() => this.form.reset(this.initial()))
    effect(() => {
      const fieldError = this.fieldError()
      if (!fieldError) return
      const control = this.form.controls[fieldError.field]
      control.setErrors({ server: fieldError.key })
      control.markAsTouched()
    })
  }

  protected errorKey(field: keyof ContactDetailsValues): string {
    const errors = this.form.controls[field].errors
    if (!errors) return ''
    if (typeof errors['server'] === 'string') return errors['server']
    if (errors['required']) return 'validation.required'
    if (errors['maxlength']) return 'validation.tooLong'
    if (errors['email']) return 'validation.email'
    if (errors['pattern']) return 'validation.phone'
    return 'validation.invalid'
  }

  protected submit(): void {
    this.attempted = true
    this.form.markAllAsTouched()
    if (this.form.invalid) return
    this.save.emit(this.form.getRawValue())
  }
}
