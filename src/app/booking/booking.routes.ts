import type { Routes } from '@angular/router'
import { profileGuard } from '../customer'
import { signInGuard } from '../identity'
import { MyAppointmentsStore } from './data/my-appointments.store'

/** Customer-area routes of booking: the booking flow and the customer's appointments (spec 5). */
export const bookingRoutes: Routes = [
  {
    path: '',
    providers: [MyAppointmentsStore],
    children: [
      {
        // Steps one to four need no sign-in; the confirm step asks for it
        path: 'book',
        title: 'booking.title',
        loadComponent: () => import('./feature/booking-flow-page').then((m) => m.BookingFlowPage),
      },
      {
        path: 'appointments',
        canActivate: [signInGuard, profileGuard],
        title: 'booking.mine.title',
        loadComponent: () => import('./feature/my-appointments-page').then((m) => m.MyAppointmentsPage),
      },
      {
        path: 'appointments/:reference',
        canActivate: [signInGuard, profileGuard],
        title: 'booking.mine.title',
        loadComponent: () => import('./feature/appointment-detail-page').then((m) => m.AppointmentDetailPage),
      },
    ],
  },
]
