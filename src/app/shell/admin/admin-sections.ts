import type { StaffRole } from '../../identity'

/** One screen of the admin area (spec 6). */
export interface AdminSection {
  /** Path segment under /admin/ */
  path: string
  /** Translation key of the menu label and page title */
  label: string
  icon: string
  minimumRole: StaffRole
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { path: 'day', label: 'admin.sections.day', icon: 'today', minimumRole: 'BRANCH_STAFF' },
  { path: 'book', label: 'admin.sections.book', icon: 'event', minimumRole: 'BRANCH_STAFF' },
  { path: 'customers', label: 'admin.sections.customers', icon: 'people', minimumRole: 'BRANCH_STAFF' },
  { path: 'notifications', label: 'admin.sections.notifications', icon: 'notifications', minimumRole: 'BRANCH_STAFF' },
  { path: 'hours', label: 'admin.sections.hours', icon: 'schedule', minimumRole: 'BRANCH_MANAGER' },
  { path: 'capacity', label: 'admin.sections.capacity', icon: 'groups', minimumRole: 'BRANCH_MANAGER' },
  { path: 'calendar', label: 'admin.sections.calendar', icon: 'calendar_month', minimumRole: 'BRANCH_MANAGER' },
  { path: 'overbooked', label: 'admin.sections.overbooked', icon: 'warning', minimumRole: 'BRANCH_MANAGER' },
  { path: 'services', label: 'admin.sections.services', icon: 'category', minimumRole: 'BRANCH_MANAGER' },
  { path: 'staff', label: 'admin.sections.staff', icon: 'badge', minimumRole: 'BRANCH_MANAGER' },
]
