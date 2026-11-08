import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { ifMatch, versioned, type Versioned } from '../../shared/util/etag'
import { API_PATH, body, call } from '../../shared/util/http'
import { emptyPage, pageParams, type Page } from '../../shared/util/page'
import type { ContactDetailsRequest, Customer, CustomerRequest, CustomerSummary } from '../model/customer'
import { isSearchable } from '../model/customer'

const ADMIN = `${API_PATH}/admin/customers`
const one = (id: string) => `${ADMIN}/${encodeURIComponent(id)}`

/**
 * Customers for staff. Every staff access is written to the backend's access audit. Deactivate, reactivate and erase
 * are for the branch manager only; the API decides.
 */
@Injectable({ providedIn: 'root' })
export class CustomerAdminApi {
  private readonly http = inject(HttpClient)

  /** One page of matches by name prefix, exact email or exact phone; never sent for fewer than 3 characters (spec 6). */
  async search(query: string, page = 0): Promise<Page<CustomerSummary>> {
    if (!isSearchable(query)) return emptyPage()
    const params = pageParams(new HttpParams({ fromObject: { query: query.trim() } }), page)
    return body(await call(this.http.get<Page<CustomerSummary>>(ADMIN, { params, observe: 'response' })))
  }

  async get(id: string): Promise<Versioned<Customer>> {
    return versioned(await call(this.http.get<Customer>(one(id), { observe: 'response' })))
  }

  /** A customer without a login account, for a walk-in or phone booking. EMAIL_IN_USE names the existing one. */
  async create(request: CustomerRequest): Promise<Versioned<Customer>> {
    return versioned(await call(this.http.post<Customer>(ADMIN, request, { observe: 'response' })))
  }

  async update(current: Versioned<Customer>, request: ContactDetailsRequest): Promise<Versioned<Customer>> {
    return versioned(
      await call(this.http.put<Customer>(one(current.value.id), request, { observe: 'response', headers: ifMatch(current) })),
    )
  }

  async deactivate(current: Versioned<Customer>): Promise<Versioned<Customer>> {
    return this.statusChange(current, 'deactivate')
  }

  async reactivate(current: Versioned<Customer>): Promise<Versioned<Customer>> {
    return this.statusChange(current, 'reactivate')
  }

  /** Erases the customer's personal data for good; the ID stays valid. */
  async erase(current: Versioned<Customer>): Promise<void> {
    await call(this.http.delete<void>(one(current.value.id), { observe: 'response', headers: ifMatch(current) }))
  }

  private async statusChange(current: Versioned<Customer>, action: string): Promise<Versioned<Customer>> {
    return versioned(
      await call(
        this.http.post<Customer>(`${one(current.value.id)}/${action}`, null, {
          observe: 'response',
          headers: ifMatch(current),
        }),
      ),
    )
  }
}
