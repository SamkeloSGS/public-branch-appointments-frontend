import type { Routes } from '@angular/router'
import { bookingAdminRoutes } from '../../booking'
import { branchManagementAdminRoutes } from '../../branch-management'
import { customerAdminRoutes } from '../../customer'
import { identityAdminRoutes } from '../../identity'

// The admin area, loaded only when a staff member opens /admin (FE-18). Each domain brings its own screens; the menu
// is in admin-sections.ts.
export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-shell').then((m) => m.AdminShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'admin.home.title',
        loadComponent: () => import('./admin-home-page').then((m) => m.AdminHomePage),
      },
      ...bookingAdminRoutes,
      ...branchManagementAdminRoutes,
      ...customerAdminRoutes,
      ...identityAdminRoutes,
    ],
  },
]
