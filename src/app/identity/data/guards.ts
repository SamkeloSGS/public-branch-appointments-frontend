import { inject } from '@angular/core'
import { Router, type ActivatedRouteSnapshot, type CanActivateFn, type RouterStateSnapshot } from '@angular/router'
import { isStaffRole, roleIncludes, type StaffRole } from '../model/roles'
import { CurrentUser } from './current-user.store'
import { Session } from './session'

// Route guards decide only what to show (spec 4.2); the API checks every request itself, and a 403 is always handled.

/** Route data read by the guards. */
export interface IdentityRouteData {
  /** The lowest staff role that may open the page */
  minimumRole?: StaffRole
}

export const NOT_ALLOWED_PATH = '/not-allowed'

const absolute = (state: RouterStateSnapshot) => new URL(state.url, window.location.origin).href

/** The page needs a signed-in user: a visitor is sent to Keycloak and returned to the same page. */
export const signInGuard: CanActivateFn = async (_route, state) => {
  const session = inject(Session)
  if (session.signedIn()) return true
  await session.signIn(absolute(state))
  return false
}

/**
 * The sign-up address given to invited staff (and anyone else): starts Keycloak's registration for a visitor, and
 * sends someone already signed in to the home page.
 */
export const signUpGuard: CanActivateFn = async () => {
  const session = inject(Session)
  if (session.signedIn()) return inject(Router).parseUrl('/')
  await session.signUp()
  return false
}

/**
 * The admin area: a signed-in staff member with the second factor. Anyone else signed in sees the "not allowed"
 * page (FE-3); a staff member without the second factor is taken through it by Keycloak and returned.
 */
export const staffGuard: CanActivateFn = async (_route, state) => {
  const session = inject(Session)
  const router = inject(Router)
  if (!session.signedIn()) {
    await session.signIn(absolute(state), { secondFactor: true })
    return false
  }
  const me = await inject(CurrentUser)
    .load()
    .catch(() => undefined)
  if (me === undefined) return true // could not check; the pages show the API's answer
  if (!me || !isStaffRole(me.role)) return router.parseUrl(NOT_ALLOWED_PATH)
  if (!me.secondFactor) {
    await session.signIn(absolute(state), { secondFactor: true })
    return false
  }
  return true
}

/** A page with `data.minimumRole`: a lower role sees the "not allowed" page instead of a blank screen (FE-3). */
export const minimumRoleGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const required = (route.data as IdentityRouteData).minimumRole
  if (!required) return true
  const me = await inject(CurrentUser)
    .load()
    .catch(() => undefined)
  if (me === undefined) return true
  return roleIncludes(me?.role, required) ? true : inject(Router).parseUrl(NOT_ALLOWED_PATH)
}
