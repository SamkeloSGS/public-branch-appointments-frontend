import { HttpErrorResponse, type HttpResponse } from '@angular/common/http'
import { firstValueFrom, type Observable } from 'rxjs'
import { ApiError, problemFrom } from './problem'

/** The root of every API version. The access token is only ever sent to requests below it (FE-2). */
export const API_ROOT = '/api'

/** The API version this app is written against; every API client builds its addresses from it. */
export const API_PATH = `${API_ROOT}/v1`

/** Whether a request URL is an API request on the app's own origin. */
export function isApiUrl(url: string, origin: string = window.location.origin): boolean {
  let parsed: URL
  try {
    parsed = new URL(url, origin)
  } catch {
    return false
  }
  return parsed.origin === origin && (parsed.pathname === API_ROOT || parsed.pathname.startsWith(`${API_ROOT}/`))
}

/**
 * Awaits one HTTP call and returns the full response, or throws an ApiError for a rejected request or a network
 * failure. Every API client in a domain's `data` layer goes through this.
 */
export async function call<T>(request: Observable<HttpResponse<T>>): Promise<HttpResponse<T>> {
  try {
    return await firstValueFrom(request)
  } catch (cause) {
    if (cause instanceof HttpErrorResponse) {
      if (cause.status === 0) throw ApiError.network(cause)
      throw new ApiError(cause.status, problemFrom(cause.error), cause.headers)
    }
    throw cause
  }
}

/** The body of a successful response; the API always sends one where this is used. */
export function body<T>(response: HttpResponse<T>): T {
  return response.body as T
}
