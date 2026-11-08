import type { components } from './api.generated'

export type Me = components['schemas']['MeResponse']

export type StaffRole = 'BRANCH_STAFF' | 'BRANCH_MANAGER'
export type Role = 'CUSTOMER' | StaffRole

// The branch manager includes branch staff (same order as the backend's StaffRole).
const STAFF_ORDER: readonly StaffRole[] = ['BRANCH_STAFF', 'BRANCH_MANAGER']

export function isStaffRole(role: string | undefined): role is StaffRole {
  return STAFF_ORDER.includes(role as StaffRole)
}

/** Whether `role` may do what `required` may do. */
export function roleIncludes(role: string | undefined, required: StaffRole): boolean {
  return isStaffRole(role) && STAFF_ORDER.indexOf(role) >= STAFF_ORDER.indexOf(required)
}
