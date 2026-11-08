import type { Routes } from '@angular/router'
import { minimumRoleGuard, type IdentityRouteData } from '../identity'

// Admin screens of the customer domain (spec 6). Loaded lazily inside the admin area only (FE-18).
export const customerAdminRoutes: Routes = [
  {
    path: 'customers',
    title: 'admin.sections.customers',
    canActivate: [minimumRoleGuard],
    data: { minimumRole: 'BRANCH_STAFF' } satisfies IdentityRouteData,
    loadComponent: () => import('./feature/admin/customers-page').then((m) => m.CustomersPage),
  },
]
