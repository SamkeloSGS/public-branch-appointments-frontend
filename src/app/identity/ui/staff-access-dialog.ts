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
import { MatFormField, MatLabel } from '@angular/material/form-field'
import { MatOption, MatSelect } from '@angular/material/select'
import { TranslatePipe } from '@ngx-translate/core'
import { ErrorPanel } from '../../shared/ui/error-panel'
import type { StaffRole } from '../model/roles'
import { STAFF_ROLES, type StaffMember } from '../model/staff'

export interface StaffAccessDialogData {
  member: StaffMember
  /** Translation keys for identity's rule codes */
  messages: Readonly<Record<string, string>>
  /** Saves the change; a rejection is shown in the dialog, which stays open */
  save: (role: StaffRole) => Promise<void>
}

/** Changes a staff member's role. Closes with true once the server has accepted the change. */
@Component({
  selector: 'app-staff-access-dialog',
  imports: [
    ErrorPanel,
    FormsModule,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatLabel,
    MatOption,
    MatSelect,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'admin.staff.changeAccess' | translate: { name: data.member.displayName } }}</h2>
    <form #accessForm="ngForm" (ngSubmit)="submit(accessForm.valid ?? false)">
      <mat-dialog-content>
        <p class="email">{{ data.member.email }}</p>
        <app-error-panel [error]="error()" [messages]="data.messages" [serverDetail]="true" />
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
        <button mat-button type="button" [mat-dialog-close]="false" [disabled]="saving()">
          {{ 'common.cancel' | translate }}
        </button>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ 'admin.save' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .full {
      width: 100%;
    }
    .email {
      margin-top: 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class StaffAccessDialog {
  protected readonly data = inject<StaffAccessDialogData>(MAT_DIALOG_DATA)
  private readonly dialogRef = inject<MatDialogRef<StaffAccessDialog, boolean>>(MatDialogRef)

  protected readonly roles = STAFF_ROLES
  protected readonly role = signal<StaffRole>(this.data.member.role)
  protected readonly saving = signal(false)
  protected readonly error = signal<unknown>(undefined)

  protected async submit(valid: boolean): Promise<void> {
    if (!valid || this.saving()) return
    this.saving.set(true)
    this.error.set(undefined)
    this.dialogRef.disableClose = true
    try {
      await this.data.save(this.role())
      this.dialogRef.close(true)
    } catch (error) {
      this.error.set(error)
    } finally {
      this.saving.set(false)
      this.dialogRef.disableClose = false
    }
  }
}
