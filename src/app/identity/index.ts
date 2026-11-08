// Public entry of the identity domain: the only file other domains and the app may import. Every domain may use it
// (current user, guards); identity imports no other domain.
export { Session, type SignInOptions } from './data/session'
export { CurrentUser } from './data/current-user.store'
export { authInterceptor } from './data/auth.interceptor'
export {
  signInGuard,
  signUpGuard,
  staffGuard,
  minimumRoleGuard,
  NOT_ALLOWED_PATH,
  type IdentityRouteData,
} from './data/guards'
export { isStaffRole, roleIncludes, type Me, type Role, type StaffRole } from './model/roles'
export { identityAdminRoutes } from './identity.admin.routes'
