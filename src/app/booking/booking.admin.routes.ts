import type { Routes } from '@angular/router'
import { minimumRoleGuard, type IdentityRouteData } from '../identity'

// Admin screens of booking and notification (spec 6). Loaded lazily inside the admin area only (FE-18).
const staff: IdentityRouteData = { minimumRole: 'BRANCH_STAFF' }
const manager: IdentityRouteData = { minimumRole: 'BRANCH_MANAGER' }

export const bookingAdminRoutes: Routes = [
  {
    path: 'day',
    title: 'admin.sections.day',
    canActivate: [minimumRoleGuard],
    data: staff,
    loadComponent: () => import('./feature/admin/day-list-page').then((m) => m.DayListPage),
  },
  {
    path: 'book',
    title: 'admin.sections.book',
    canActivate: [minimumRoleGuard],
    data: staff,
    loadComponent: () => import('./feature/admin/staff-booking-page').then((m) => m.StaffBookingPage),
  },
  {
    path: 'notifications',
    title: 'admin.sections.notifications',
    canActivate: [minimumRoleGuard],
    data: staff,
    loadComponent: () => import('./feature/admin/failed-notifications-page').then((m) => m.FailedNotificationsPage),
  },
  {
    path: 'overbooked',
    title: 'admin.sections.overbooked',
    canActivate: [minimumRoleGuard],
    data: manager,
    loadComponent: () => import('./feature/admin/overbooked-page').then((m) => m.OverbookedPage),
  },
  {
    path: 'appointments/:id',
    title: 'admin.sections.appointment',
    canActivate: [minimumRoleGuard],
    data: staff,
    loadComponent: () => import('./feature/admin/appointment-admin-page').then((m) => m.AppointmentAdminPage),
  },
]
