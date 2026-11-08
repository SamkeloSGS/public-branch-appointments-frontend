import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatDialog } from '@angular/material/dialog'
import { MatFormField, MatLabel } from '@angular/material/form-field'
import { MatIcon } from '@angular/material/icon'
import { MatOption, MatSelect } from '@angular/material/select'
import { MatSnackBar } from '@angular/material/snack-bar'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { firstValueFrom } from 'rxjs'
import { confirmAction } from '../../../shared/ui/confirm-dialog'
import { EmptyState } from '../../../shared/ui/empty-state'
import { ErrorPanel } from '../../../shared/ui/error-panel'
import { InstantInPipe } from '../../../shared/ui/format.pipes'
import { LoadingState } from '../../../shared/ui/loading-state'
import { isApiError } from '../../../shared/util/problem'
import type { StaffRole } from '../../model/roles'
import {
  STAFF_ROLES,
  STAFF_STATUSES,
  staffErrorMessages,
  staffTransitions,
  type ChangeLogEntry,
  type StaffMember,
  type StaffStatus,
} from '../../model/staff'
import { StaffApi } from '../../data/staff-api'
import { StaffAccessDialog, type StaffAccessDialogData } from '../../ui/staff-access-dialog'
import { StaffInviteDialog, type StaffInviteDialogData } from '../../ui/staff-invite-dialog'

type Transition = 'reinvite' | 'suspend' | 'reinstate' | 'remove'

/** The branch manager: invite staff, set roles, suspend, reinstate, remove, and see each change log. */
@Component({
  selector: 'app-staff-page',
  imports: [
    EmptyState,
    ErrorPanel,
    FormsModule,
    InstantInPipe,
    LoadingState,
    MatButton,
    MatCard,
    MatCardContent,
    MatFormField,
    MatIcon,
    MatLabel,
    MatOption,
    MatSelect,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="staff-title">
      <div class="title">
        <h1 id="staff-title">{{ 'admin.sections.staff' | translate }}</h1>
        <button mat-flat-button type="button" (click)="invite()">
          <mat-icon>person_add</mat-icon>
          {{ 'admin.staff.invite' | translate }}
        </button>
      </div>
      <app-error-panel [error]="actionError()" [messages]="messages" [serverDetail]="true" />

      @if (invitation(); as invitation) {
        <mat-card appearance="outlined" class="invitation" role="status">
          <mat-card-content>
            <p>{{ 'admin.staff.invited' | translate: { name: invitation.name, email: invitation.email } }}</p>
            <p class="hint">{{ 'admin.staff.invitedHint' | translate }}</p>
          </mat-card-content>
        </mat-card>
      }



      <div class="filters">
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>{{ 'admin.staff.role' | translate }}</mat-label>
          <mat-select [value]="roleFilter()" (valueChange)="roleFilter.set($event)">
            <mat-option [value]="undefined">{{ 'admin.staff.any' | translate }}</mat-option>
            @for (role of roles; track role) {
              <mat-option [value]="role">{{ 'admin.staff.roles.' + role | translate }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>{{ 'admin.staff.status' | translate }}</mat-label>
          <mat-select [value]="statusFilter()" (valueChange)="statusFilter.set($event)">
            <mat-option [value]="undefined">{{ 'admin.staff.any' | translate }}</mat-option>
            @for (status of statuses; track status) {
              <mat-option [value]="status">{{ 'admin.staff.statuses.' + status | translate }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      @if (loadError()) {
        <app-error-panel [error]="loadError()" (retry)="load()" />
      } @else if (!members()) {
        <app-loading-state />
      } @else if (visible().length === 0) {
        <app-empty-state icon="badge" [message]="'admin.staff.none' | translate" />
      } @else {
        <div class="table-scroll">
          <table class="admin-table">
            <caption class="visually-hidden">{{ 'admin.sections.staff' | translate }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ 'admin.staff.displayName' | translate }}</th>
                <th scope="col">{{ 'admin.staff.role' | translate }}</th>
                <th scope="col">{{ 'admin.staff.status' | translate }}</th>
                <th scope="col">{{ 'admin.day.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (member of visible(); track member.id) {
                <tr>
                  <td>
                    {{ member.displayName }}
                    <div class="detail">{{ member.email }}</div>
                  </td>
                  <td>{{ 'admin.staff.roles.' + member.role | translate }}</td>
                  <td>
                    {{ 'admin.staff.statuses.' + member.status | translate }}
                    @if (member.status === 'INVITED' && member.invitationExpiresAt) {
                      <div class="detail">
                        {{ 'admin.staff.expires' | translate: { date: (member.invitationExpiresAt | instantIn: zone) } }}
                      </div>
                    }
                  </td>
                  <td class="row-actions">
                    @if (member.status !== 'REMOVED') {
                      <button mat-button type="button" (click)="editAccess(member)">{{ 'admin.staff.access' | translate }}</button>
                    }
                    @for (transition of transitions(member); track transition) {
                      <button
                        mat-button
                        type="button"
                        [class.destructive]="transition === 'suspend' || transition === 'remove'"
                        [disabled]="working()"
                        (click)="change(member, transition)"
                      >
                        {{ 'admin.staff.' + transition | translate }}
                      </button>
                    }
                    <button mat-button type="button" [attr.aria-expanded]="logFor() === member.id" (click)="toggleLog(member)">
                      {{ 'admin.staff.changeLog' | translate }}
                    </button>
                  </td>
                </tr>
                @if (logFor() === member.id) {
                  <tr class="log-row">
                    <td colspan="5">
                      @if (log(); as log) {
                        <ol class="log">
                          @for (entry of log; track entry.id) {
                            <li>
                              <span class="when">{{ entry.occurredAt | instantIn: zone }}</span>
                              {{ 'admin.staff.actions.' + entry.action | translate }}
                              @if (entry.detail) {
                                <span class="detail">– {{ entry.detail }}</span>
                              }
                            </li>
                          }
                        </ol>
                      } @else {
                        <app-loading-state />
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .title {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .invitation {
      margin-bottom: 1rem;
    }
    .invitation {
      border-color: var(--mat-sys-primary);
    }
    .hint {
      margin-bottom: 0;
      color: var(--mat-sys-on-surface-variant);
    }
    h2 {
      margin-top: 0;
      font: var(--mat-sys-title-medium);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: 0 1rem;
      align-items: start;
    }
    .submit {
      display: flex;
      gap: 0.5rem;
      padding-top: 0.5rem;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin: 1rem 0;
    }
    .detail {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .row-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    .destructive {
      --mat-button-text-label-text-color: var(--mat-sys-error);
    }
    .log {
      margin: 0;
      padding-inline-start: 1.25rem;
    }
    .when {
      font-variant-numeric: tabular-nums;
      margin-inline-end: 0.5rem;
    }
  `,
})
export class StaffPage {
  private readonly api = inject(StaffApi)
  private readonly dialog = inject(MatDialog)
  private readonly snackBar = inject(MatSnackBar)
  private readonly translate = inject(TranslateService)

  /** Change log times are shown in the branch's zone */
  protected readonly zone = 'Africa/Johannesburg'
  protected readonly roles = STAFF_ROLES
  protected readonly statuses = STAFF_STATUSES
  protected readonly messages = staffErrorMessages
  protected readonly members = signal<StaffMember[] | undefined>(undefined)
  protected readonly roleFilter = signal<StaffRole | undefined>(undefined)
  protected readonly statusFilter = signal<StaffStatus | undefined>(undefined)
  protected readonly loadError = signal<unknown>(undefined)
  protected readonly actionError = signal<unknown>(undefined)
  protected readonly working = signal(false)
  /** The last invitation sent: Keycloak emails the person their setup link once it is saved */
  protected readonly invitation = signal<{ name: string; email: string } | undefined>(undefined)
  protected readonly logFor = signal<string | undefined>(undefined)
  protected readonly log = signal<ChangeLogEntry[] | undefined>(undefined)
  private lastInvitedRole: StaffRole = 'BRANCH_STAFF'

  protected readonly visible = computed(() =>
    (this.members() ?? []).filter(
      (member) =>
        (!this.roleFilter() || member.role === this.roleFilter()) &&
        (!this.statusFilter() || member.status === this.statusFilter()),
    ),
  )
  protected readonly transitions = (member: StaffMember) => staffTransitions(member.status)

  constructor() {
    void this.load()
  }

  protected async load(): Promise<void> {
    this.loadError.set(undefined)
    try {
      const members = await this.api.list()
      this.members.set([...members].sort((a, b) => a.displayName.localeCompare(b.displayName)))
    } catch (error) {
      this.loadError.set(error)
    }
  }

  private replace(member: StaffMember): void {
    this.members.update((list) => {
      const others = (list ?? []).filter((candidate) => candidate.id !== member.id)
      return [...others, member].sort((a, b) => a.displayName.localeCompare(b.displayName))
    })
  }

  private async act(action: () => Promise<void>, success?: string): Promise<boolean> {
    this.working.set(true)
    this.actionError.set(undefined)
    try {
      await action()
      if (success) this.snackBar.open(this.translate.instant(success) as string, undefined, { duration: 3000 })
      return true
    } catch (error) {
      this.actionError.set(error)
      if (isApiError(error) && error.isStale) await this.load()
      return false
    } finally {
      this.working.set(false)
    }
  }

  /** Invitations are sent from a dialog, which stays open to show a rejection (e.g. the email is already staff). */
  protected async invite(): Promise<void> {
    this.actionError.set(undefined)
    const data: StaffInviteDialogData = {
      messages: this.messages,
      role: this.lastInvitedRole,
      invite: async (request) => {
        const invitation = await this.api.invite(request)
        this.lastInvitedRole = request.role
        this.replace(invitation.staffMember)
        this.invitation.set({ name: invitation.staffMember.displayName, email: request.email.trim() })
      },
    }
    const ref = this.dialog.open<StaffInviteDialog, StaffInviteDialogData, boolean>(StaffInviteDialog, {
      data,
      width: '32rem',
      maxWidth: 'calc(100vw - 2rem)',
      autoFocus: 'first-tabbable',
    })
    await firstValueFrom(ref.afterClosed())
  }

  /** The role is changed in a dialog, which stays open to show a rejection (e.g. the last branch manager). */
  protected async editAccess(member: StaffMember): Promise<void> {
    this.actionError.set(undefined)
    const data: StaffAccessDialogData = {
      member,
      messages: this.messages,
      save: async (role) => {
        try {
          this.replace(await this.api.changeRole(member, role))
        } catch (error) {
          if (isApiError(error) && error.isStale) await this.load()
          throw error
        }
      },
    }
    const ref = this.dialog.open<StaffAccessDialog, StaffAccessDialogData, boolean>(StaffAccessDialog, {
      data,
      width: '32rem',
      maxWidth: 'calc(100vw - 2rem)',
      autoFocus: 'first-tabbable',
    })
    const saved = await firstValueFrom(ref.afterClosed())
    if (saved) this.snackBar.open(this.translate.instant('admin.saved') as string, undefined, { duration: 3000 })
    if (this.logFor() === member.id) await this.loadLog(member.id)
  }

  protected async change(member: StaffMember, transition: Transition): Promise<void> {
    const t = (key: string, params?: Record<string, string>) => this.translate.instant(key, params) as string
    if (transition === 'suspend' || transition === 'remove') {
      const confirmed = await confirmAction(this.dialog, {
        title: t(`admin.staff.confirm.${transition}.title`, { name: member.displayName }),
        message: t(`admin.staff.confirm.${transition}.message`, { name: member.displayName }),
        confirmLabel: t(`admin.staff.${transition}`),
        cancelLabel: t('common.cancel'),
        destructive: true,
      })
      if (!confirmed) return
    }
    await this.act(async () => {
      const updated = transition === 'remove' ? await this.api.remove(member) : await this.api.transition(member, transition)
      this.replace(updated)
      if (this.logFor() === member.id) await this.loadLog(member.id)
    }, `admin.staff.done.${transition}`)
  }

  protected toggleLog(member: StaffMember): void {
    if (this.logFor() === member.id) {
      this.logFor.set(undefined)
      return
    }
    this.logFor.set(member.id)
    void this.loadLog(member.id)
  }

  private async loadLog(id: string): Promise<void> {
    this.log.set(undefined)
    try {
      const entries = await this.api.changes(id)
      if (this.logFor() === id) this.log.set(entries)
    } catch (error) {
      this.actionError.set(error)
      this.logFor.set(undefined)
    }
  }
}
