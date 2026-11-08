import { HttpParams } from '@angular/common/http'

/** One page of a list the API pages (`PageResponse`): `page` counts from 0, `size` is the requested page size. */
export interface Page<T> {
  items: T[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

/** The API's default page size; it accepts 1 to 100. */
export const PAGE_SIZE = 20

export function emptyPage<T>(): Page<T> {
  return { items: [], page: 0, size: PAGE_SIZE, totalItems: 0, totalPages: 0 }
}

/** Query parameters asking for one page. */
export function pageParams(params: HttpParams, page: number, size = PAGE_SIZE): HttpParams {
  return params.set('page', page).set('size', size)
}

export function hasNextPage(page: Page<unknown>): boolean {
  return page.page + 1 < page.totalPages
}

/** A list shown as "load more": the items loaded so far, followed by the next page's items. */
export function appendPage<T>(loaded: readonly T[], next: Page<T>): Page<T> {
  return { ...next, items: [...loaded, ...next.items] }
}
