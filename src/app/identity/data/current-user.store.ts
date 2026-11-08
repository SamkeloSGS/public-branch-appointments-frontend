import { HttpClient } from '@angular/common/http'
import { Injectable, computed, inject, signal } from '@angular/core'
import { API_PATH, body, call } from '../../shared/util/http'
import { isStaffRole, roleIncludes, type Me, type StaffRole } from '../model/roles'
import { Session } from './session'

/** The signed-in user's role and second-factor state, loaded once from GET /api/v1/me after sign-in. */
@Injectable({ providedIn: 'root' })
export class CurrentUser {
  private readonly http = inject(HttpClient)
  private readonly session = inject(Session)
  private loading: Promise<Me | null> | undefined

  readonly me = signal<Me | null>(null)
  readonly isStaff = computed(() => isStaffRole(this.me()?.role))
  readonly role = computed(() => this.me()?.role)

  constructor() {
    this.session.onSessionEnd(() => this.reset())
  }

  /** Loads the current user once; null for a visitor. A failed load is retried on the next call. */
  load(): Promise<Me | null> {
    if (!this.session.signedIn()) return Promise.resolve(null)
    this.loading ??= call(this.http.get<Me>(`${API_PATH}/me`, { observe: 'response' }))
      .then((response) => {
        const me = body(response)
        this.me.set(me)
        return me
      })
      .catch((error: unknown) => {
        this.loading = undefined
        throw error
      })
    return this.loading
  }

  /** Whether the current user may do what `required` may do. A convenience for menus; the API decides. */
  can(required: StaffRole): boolean {
    return roleIncludes(this.me()?.role, required)
  }

  reset(): void {
    this.me.set(null)
    this.loading = undefined
  }
}
