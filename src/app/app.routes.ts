import type { Routes } from '@angular/router'
import { NOT_ALLOWED_PATH, signUpGuard, staffGuard } from './identity'

// Two separately lazy-loaded areas: the customer area at the root and the admin area under /admin. No customer route
// imports admin code, so a customer who never visits /admin downloads none of it (FE-18). Each domain's routes come
// with its entry file, loaded lazily too, so the start-up bundle holds only the shell, identity and shared code.
export const routes: Routes = [
  {
    path: 'admin',
    canActivate: [staffGuard],
    loadChildren: () => import('./shell/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: '',
    loadComponent: () => import('./shell/customer/customer-shell').then((m) => m.CustomerShell),
    children: [
      { path: '', loadChildren: () => import('./branch-management').then((m) => m.branchManagementRoutes) },
      { path: '', loadChildren: () => import('./booking').then((m) => m.bookingRoutes) },
      { path: '', loadChildren: () => import('./customer').then((m) => m.customerRoutes) },
      // The sign-up address in staff invitations: hands over to Keycloak's registration (with PKCE)
      { path: 'sign-up', canActivate: [signUpGuard], children: [] },
      {
        path: NOT_ALLOWED_PATH.slice(1),
        title: 'common.notAllowed.title',
        loadComponent: () => import('./shell/not-allowed-page').then((m) => m.NotAllowedPage),
      },
      {
        path: '**',
        title: 'common.notFound.title',
        loadComponent: () => import('./shell/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
]
