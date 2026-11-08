import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { ifMatch, versioned, type Versioned } from '../../shared/util/etag'
import { API_PATH, call } from '../../shared/util/http'
import { isApiError } from '../../shared/util/problem'
import type {
  ContactDetailsRequest,
  ContactPreferencesRequest,
  Customer,
  CustomerRequest,
} from '../model/customer'

const ME = `${API_PATH}/customers/me`

/** The signed-in customer's own profile: /api/customers/me. */
@Injectable({ providedIn: 'root' })
export class CustomerApi {
  private readonly http = inject(HttpClient)

  /** The profile, or null when the user has none yet. */
  async getMine(): Promise<Versioned<Customer> | null> {
    try {
      return versioned(await call(this.http.get<Customer>(ME, { observe: 'response' })))
    } catch (error) {
      if (isApiError(error) && error.isNotFound) return null
      throw error
    }
  }

  async create(body: CustomerRequest): Promise<Versioned<Customer>> {
    return versioned(await call(this.http.post<Customer>(ME, body, { observe: 'response' })))
  }

  async updateContactDetails(current: Versioned<Customer>, body: ContactDetailsRequest): Promise<Versioned<Customer>> {
    return versioned(
      await call(this.http.put<Customer>(ME, body, { observe: 'response', headers: ifMatch(current) })),
    )
  }

  async updatePreferences(
    current: Versioned<Customer>,
    body: ContactPreferencesRequest,
  ): Promise<Versioned<Customer>> {
    return versioned(
      await call(
        this.http.put<Customer>(`${ME}/contact-preferences`, body, { observe: 'response', headers: ifMatch(current) }),
      ),
    )
  }

  async erase(current: Versioned<Customer>): Promise<void> {
    await call(this.http.delete<void>(ME, { observe: 'response', headers: ifMatch(current) }))
  }
}
