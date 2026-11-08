import type { Routes } from '@angular/router'
import { minimumRoleGuard, type IdentityRouteData } from './data/guards'

// Admin screens of identity (spec 6). Loaded lazily inside the admin area only (FE-18).
export const identityAdminRoutes: Routes = [
  {
    path: 'staff',
    title: 'admin.sections.staff',
    canActivate: [minimumRoleGuard],
    data: { minimumRole: 'BRANCH_MANAGER' } satisfies IdentityRouteData,
    loadComponent: () => import('./feature/admin/staff-page').then((m) => m.StaffPage),
  },
]
