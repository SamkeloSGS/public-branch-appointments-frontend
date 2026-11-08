// Public entry of the booking domain: the only file other domains and the app may import.
export { bookingRoutes } from './booking.routes'
export { bookingAdminRoutes } from './booking.admin.routes'
export { BookingAdminApi } from './data/booking-admin-api'
export type { Appointment, AppointmentStatus } from './model/appointment'
export { impactNeedsConfirmation, type Impact, type ImpactPreviewRequest } from './model/staff-actions'
