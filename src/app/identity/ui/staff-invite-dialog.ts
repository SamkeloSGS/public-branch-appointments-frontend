import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog'
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { MatOption, MatSelect } from '@angular/material/select'
import { TranslatePipe } from '@ngx-translate/core'
import { ErrorPanel } from '../../shared/ui/error-panel'
import type { StaffRole } from '../model/roles'
import { STAFF_ROLES, type InviteStaffRequest } from '../model/staff'

export interface StaffInviteDialogData {
  /** Translation keys for identity's rule codes */
  messages: Readonly<Record<string, string>>
  /** The role the form starts with, e.g. the one used for the last invitation */
  role: StaffRole
  /** Sends the invitation; a rejection is shown in the dialog, which stays open */
  invite: (request: InviteStaffRequest) => Promise<void>
}

/** Invites a staff member. Closes with true once the invitation is sent. */
@Component({
  selector: 'app-staff-invite-dialog',
  imports: [
    ErrorPanel,
    FormsModule,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatError,
    MatFormField,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'admin.staff.invite' | translate }}</h2>
    <form #inviteForm="ngForm" (ngSubmit)="submit(inviteForm.valid ?? false)">
      <mat-dialog-content>
        <app-error-panel [error]="error()" [messages]="data.messages" [serverDetail]="true" />
        <mat-form-field class="full">
          <mat-label>{{ 'admin.staff.displayName' | translate }}</mat-label>
          <input
            matInput
            name="displayName"
            required
            maxlength="100"
            autocomplete="off"
            [ngModel]="displayName()"
            (ngModelChange)="displayName.set($event)"
          />
          <mat-error>{{ 'validation.required' | translate }}</mat-error>
        </mat-form-field>
        <mat-form-field class="full">
          <mat-label>{{ 'admin.staff.email' | translate }}</mat-label>
          <input
            matInput
            type="email"
            name="email"
            required
            email
            autocomplete="off"
            [ngModel]="email()"
            (ngModelChange)="email.set($event)"
          />
          <mat-error>{{ 'validation.email' | translate }}</mat-error>
        </mat-form-field>
        <mat-form-field class="full">
          <mat-label>{{ 'admin.staff.role' | translate }}</mat-label>
          <mat-select name="role" required [ngModel]="role()" (ngModelChange)="role.set($event)">
            @for (option of roles; track option) {
              <mat-option [value]="option">{{ 'admin.staff.roles.' + option | translate }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" [mat-dialog-close]="false" [disabled]="sending()">
          {{ 'common.cancel' | translate }}
        </button>
        <button mat-flat-button type="submit" [disabled]="sending()">{{ 'admin.staff.sendInvite' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .full {
      width: 100%;
    }
  `,
})
export class StaffInviteDialog {
  protected readonly data = inject<StaffInviteDialogData>(MAT_DIALOG_DATA)
  private readonly dialogRef = inject<MatDialogRef<StaffInviteDialog, boolean>>(MatDialogRef)

  protected readonly roles = STAFF_ROLES
  protected readonly displayName = signal('')
  protected readonly email = signal('')
  protected readonly role = signal<StaffRole>(this.data.role)
  protected readonly sending = signal(false)
  protected readonly error = signal<unknown>(undefined)

  protected async submit(valid: boolean): Promise<void> {
    if (!valid || this.sending()) return
    this.sending.set(true)
    this.error.set(undefined)
    this.dialogRef.disableClose = true
    try {
      await this.data.invite({
        displayName: this.displayName().trim(),
        email: this.email().trim(),
        role: this.role(),
      })
      this.dialogRef.close(true)
    } catch (error) {
      this.error.set(error)
    } finally {
      this.sending.set(false)
      this.dialogRef.disableClose = false
    }
  }
}
