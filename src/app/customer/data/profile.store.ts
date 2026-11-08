import { Injectable, inject, signal } from '@angular/core'
import { Session } from '../../identity'
import type { Versioned } from '../../shared/util/etag'
import type { ContactDetailsRequest, ContactPreferencesRequest, Customer, CustomerRequest } from '../model/customer'
import { CustomerApi } from './customer-api'

/**
 * The signed-in customer's own profile with its ETag. `undefined` = not loaded yet, `null` = no profile. Kept at the
 * root because the profile guard checks it before any customer route; reset on sign-out.
 */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly api = inject(CustomerApi)
  private loading: Promise<Versioned<Customer> | null> | undefined

  readonly profile = signal<Versioned<Customer> | null | undefined>(undefined)

  constructor() {
    inject(Session).onSessionEnd(() => this.reset())
  }

  load(): Promise<Versioned<Customer> | null> {
    const loading = this.api.getMine().then((value) => {
      this.profile.set(value)
      return value
    })
    this.loading = loading
    const done = () => {
      if (this.loading === loading) this.loading = undefined
    }
    loading.then(done, done)
    return loading
  }

  async ensureLoaded(): Promise<Versioned<Customer> | null> {
    const profile = this.profile()
    if (profile !== undefined) return profile
    return this.loading ?? this.load()
  }

  private current(): Versioned<Customer> {
    const profile = this.profile()
    if (!profile) throw new Error('No profile loaded')
    return profile
  }

  async create(request: CustomerRequest): Promise<void> {
    this.profile.set(await this.api.create(request))
  }

  async saveContactDetails(request: ContactDetailsRequest): Promise<void> {
    this.profile.set(await this.api.updateContactDetails(this.current(), request))
  }

  async savePreferences(request: ContactPreferencesRequest): Promise<void> {
    this.profile.set(await this.api.updatePreferences(this.current(), request))
  }

  async erase(): Promise<void> {
    await this.api.erase(this.current())
    this.profile.set(null)
  }

  reset(): void {
    this.profile.set(undefined)
    this.loading = undefined
  }
}
