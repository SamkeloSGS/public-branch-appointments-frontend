import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
  type MatDialog,
} from '@angular/material/dialog'
import { MatFormField, MatLabel } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { firstValueFrom } from 'rxjs'

export interface ConfirmDialogData {
  /** Translated texts: the dialog names what will happen (spec 6) */
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  /** When set, the user must type this word before confirming (FE-8) */
  typedWord?: string
  typedLabel?: string
  destructive?: boolean
}

/** Confirmation for destructive or far-reaching actions. Closes with true when confirmed. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [
    FormsModule,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatInput,
    MatLabel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      @if (data.typedWord) {
        <mat-form-field class="typed">
          <mat-label>{{ data.typedLabel }}</mat-label>
          <input matInput autocomplete="off" [ngModel]="typed()" (ngModelChange)="typed.set($event)" />
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">{{ data.cancelLabel }}</button>
      <button
        mat-flat-button
        type="button"
        [class.destructive]="data.destructive"
        [disabled]="!confirmable()"
        [mat-dialog-close]="true"
      >
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .typed {
      width: 100%;
    }
    .destructive {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA)
  protected readonly typed = signal('')
  protected readonly confirmable = computed(
    () => !this.data.typedWord || this.typed().trim() === this.data.typedWord,
  )
}

/** Opens the confirmation dialog and resolves to whether the user confirmed. */
export async function confirmAction(dialog: MatDialog, data: ConfirmDialogData): Promise<boolean> {
  const ref = dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data, maxWidth: '32rem' })
  return (await firstValueFrom(ref.afterClosed())) === true
}
