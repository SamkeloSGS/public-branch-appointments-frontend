import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http'
import { inject } from '@angular/core'
import { NEVER, catchError, from, switchMap, throwError } from 'rxjs'
import { isApiUrl } from '../../shared/util/http'
import { Session } from './session'

const STEP_UP_ERROR = 'insufficient_user_authentication'

/**
 * Attaches the access token to requests to the API on the app's own origin only, never to other hosts (FE-2), and
 * answers the API's step-up error by starting the second-factor sign-in, which returns to the same page. A token
 * rejected although the session looked valid also sends the user to sign in and back.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isApiUrl(request.url)) return next(request)
  const session = inject(Session)

  return from(session.accessToken()).pipe(
    switchMap((token) =>
      next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request),
    ),
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) return throwError(() => error)
      const challenge = error.headers.get('WWW-Authenticate') ?? ''
      if (challenge.includes(STEP_UP_ERROR)) {
        void session.signIn(window.location.href, { secondFactor: true })
        return NEVER // the page is leaving for Keycloak, so the caller shows no error
      }
      if (session.signedIn()) {
        void session.signIn(window.location.href)
        return NEVER
      }
      return throwError(() => error)
    }),
  )
}
