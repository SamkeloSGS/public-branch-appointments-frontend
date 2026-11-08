import type { Routes } from '@angular/router'
import { signInGuard } from '../identity'
import { profileGuard } from './data/profile.guard'

/** Customer-area routes of the customer domain: profile setup and profile (spec 5). */
export const customerRoutes: Routes = [
  {
    path: 'profile/setup',
    canActivate: [signInGuard],
    title: 'customer.setup.title',
    loadComponent: () => import('./feature/profile-setup-page').then((m) => m.ProfileSetupPage),
  },
  {
    path: 'profile',
    canActivate: [signInGuard, profileGuard],
    title: 'customer.profile.title',
    loadComponent: () => import('./feature/profile-page').then((m) => m.ProfilePage),
  },
]
