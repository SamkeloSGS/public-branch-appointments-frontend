import { HttpParams } from '@angular/common/http'
import { describe, expect, it } from 'vitest'
import { appendPage, emptyPage, hasNextPage, pageParams, type Page } from './page'

describe('paged lists', () => {
  const page = (number: number, items: string[], totalItems: number): Page<string> => ({
    items,
    page: number,
    size: 2,
    totalItems,
    totalPages: Math.ceil(totalItems / 2),
  })

  it('there is a next page until the last one is loaded', () => {
    expect(hasNextPage(page(0, ['a', 'b'], 3))).toBe(true)
    expect(hasNextPage(page(1, ['c'], 3))).toBe(false)
    expect(hasNextPage(emptyPage())).toBe(false)
  })

  it('loading more appends the next page to the items shown', () => {
    const more = appendPage(['a', 'b'], page(1, ['c'], 3))
    expect(more.items).toEqual(['a', 'b', 'c'])
    expect(more.page).toBe(1)
    expect(hasNextPage(more)).toBe(false)
  })

  it('asks for a page and its size', () => {
    expect(pageParams(new HttpParams(), 2).toString()).toBe('page=2&size=20')
  })
})
