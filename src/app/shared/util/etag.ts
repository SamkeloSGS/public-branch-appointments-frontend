import type { HttpResponse } from '@angular/common/http'

/** A single resource with the ETag it was served with; updates send the ETag back as If-Match (spec 4.3). */
export interface Versioned<T> {
  value: T
  etag: string
}

export function versioned<T>(response: HttpResponse<T>): Versioned<T> {
  const etag = response.headers.get('ETag')
  if (!etag) throw new Error(`No ETag on ${response.url ?? 'response'}`)
  return { value: response.body as T, etag }
}

export function ifMatch(resource: Versioned<unknown>): Record<string, string> {
  return { 'If-Match': resource.etag }
}

/**
 * A resource from a list, which has no ETag header of its own. The API's ETag is the quoted version number, so the
 * version in the body stands in for it.
 */
export function fromVersion<T extends { version: number }>(value: T): Versioned<T> {
  return { value, etag: `"${value.version}"` }
}
