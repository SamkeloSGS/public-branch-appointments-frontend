import type { Routes } from '@angular/router'
import { minimumRoleGuard, type IdentityRouteData } from '../identity'

// Admin screens of branch management (spec 6), all for the branch manager. Loaded lazily inside the admin area only
// (FE-18).
const manager: IdentityRouteData = { minimumRole: 'BRANCH_MANAGER' }

export const branchManagementAdminRoutes: Routes = [
  {
    path: 'hours',
    title: 'admin.sections.hours',
    canActivate: [minimumRoleGuard],
    data: manager,
    loadComponent: () => import('./feature/admin/hours-page').then((m) => m.HoursPage),
  },
  {
    path: 'capacity',
    title: 'admin.sections.capacity',
    canActivate: [minimumRoleGuard],
    data: manager,
    loadComponent: () => import('./feature/admin/capacity-page').then((m) => m.CapacityPage),
  },
  {
    path: 'calendar',
    title: 'admin.sections.calendar',
    canActivate: [minimumRoleGuard],
    data: manager,
    loadComponent: () => import('./feature/admin/calendar-page').then((m) => m.CalendarPage),
  },
  {
    path: 'services',
    title: 'admin.sections.services',
    canActivate: [minimumRoleGuard],
    data: manager,
    loadComponent: () => import('./feature/admin/services-page').then((m) => m.ServicesPage),
  },
]
