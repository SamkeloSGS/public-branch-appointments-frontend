import type { components } from './api.generated'
import type { StaffRole } from './roles'

type Schemas = components['schemas']
export type StaffMember = Schemas['StaffMemberResponse']
export type StaffStatus = StaffMember['status']
export type Invitation = Schemas['InvitationResponse']
export type InviteStaffRequest = Schemas['InviteStaffRequest']
export type ChangeLogEntry = Schemas['ChangeLogEntryResponse']

export const STAFF_ROLES: readonly StaffRole[] = ['BRANCH_STAFF', 'BRANCH_MANAGER']
export const STAFF_STATUSES: readonly StaffStatus[] = ['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED']

/** What the branch manager can do with a staff member in this status; the server checks again. */
export function staffTransitions(status: StaffStatus): ('reinvite' | 'suspend' | 'reinstate' | 'remove')[] {
  switch (status) {
    case 'INVITED':
      return ['reinvite', 'remove']
    case 'ACTIVE':
      return ['suspend', 'remove']
    case 'SUSPENDED':
      return ['reinstate', 'remove']
    default:
      return []
  }
}

/** Translation keys for identity's rule codes. */
export const staffErrorMessages = {
  EMAIL_IN_USE: 'admin.staff.errors.EMAIL_IN_USE',
  LAST_BRANCH_MANAGER: 'admin.staff.errors.LAST_BRANCH_MANAGER',
  SELF_CHANGE_NOT_ALLOWED: 'admin.staff.errors.SELF_CHANGE_NOT_ALLOWED',
  INVALID_STATE: 'admin.staff.errors.INVALID_STATE',
} as const
