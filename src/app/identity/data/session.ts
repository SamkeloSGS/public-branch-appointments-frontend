import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core'
import { KEYCLOAK_EVENT_SIGNAL, KeycloakEventType } from 'keycloak-angular'
import Keycloak from 'keycloak-js'

// The Keycloak session. keycloak-angular initialises keycloak-js at start-up in "check" mode (app.config.ts), so a
// returning user is recognised and a visitor can browse. Tokens live only in the keycloak-js instance in memory,
// never in browser storage (FE-2).

/** Refresh the token when it has less than this many seconds left. */
const MIN_VALIDITY_SECONDS = 30
const REFRESH_CHECK_MS = 15_000

export interface SignInOptions {
  /** Ask Keycloak for the second factor (acr 2); Keycloak takes users without an authenticator through setting one up */
  secondFactor?: boolean
}

interface TokenClaims {
  signedIn: boolean
  secondFactor: boolean
  email: string | undefined
  name: string | undefined
}

const signedOut: TokenClaims = { signedIn: false, secondFactor: false, email: undefined, name: undefined }

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly keycloak = inject(Keycloak)
  private readonly claims = signal<TokenClaims>(signedOut)
  private readonly endCallbacks: (() => void)[] = []
  private refreshTimer: ReturnType<typeof setInterval> | undefined

  readonly signedIn = computed(() => this.claims().signedIn)
  /** The token says the session has the second factor (acr 2) */
  readonly secondFactor = computed(() => this.claims().secondFactor)
  readonly email = computed(() => this.claims().email)
  readonly name = computed(() => this.claims().name)

  constructor() {
    this.readToken()
    const events = inject(KEYCLOAK_EVENT_SIGNAL, { optional: true })
    if (events) {
      effect(() => {
        const event = events()
        if (event.type === KeycloakEventType.AuthRefreshError) void this.signIn()
        else if (event.type === KeycloakEventType.TokenExpired) void this.refresh()
        else this.readToken()
      })
    }
    this.refreshTimer = setInterval(() => void this.refresh(), REFRESH_CHECK_MS)
    inject(DestroyRef).onDestroy(() => clearInterval(this.refreshTimer))
  }

  private readToken(): void {
    if (!this.keycloak.authenticated) {
      this.claims.set(signedOut)
      return
    }
    const parsed = this.keycloak.tokenParsed as Record<string, unknown> | undefined
    this.claims.set({
      signedIn: true,
      secondFactor: Number(parsed?.['acr'] ?? 0) >= 2,
      email: typeof parsed?.['email'] === 'string' ? parsed['email'] : undefined,
      name: typeof parsed?.['name'] === 'string' ? parsed['name'] : undefined,
    })
  }

  /** Refreshes the token before it expires. If that fails the user signs in again and returns to the same page. */
  async refresh(): Promise<boolean> {
    if (!this.keycloak.authenticated) return false
    try {
      await this.keycloak.updateToken(MIN_VALIDITY_SECONDS)
      this.readToken()
      return true
    } catch {
      await this.signIn()
      return false
    }
  }

  /** A valid access token, or undefined for a visitor. */
  async accessToken(): Promise<string | undefined> {
    if (!this.keycloak.authenticated) return undefined
    return (await this.refresh()) ? this.keycloak.token : undefined
  }

  /** Sends the user to Keycloak and back to `returnTo` (default: the current page). */
  async signIn(returnTo: string = window.location.href, options: SignInOptions = {}): Promise<void> {
    await this.keycloak.login({
      redirectUri: new URL(returnTo, window.location.origin).href,
      ...(options.secondFactor ? { acrValues: '2' } : {}),
    })
  }

  /**
   * Sends the visitor to Keycloak's registration page and back to `returnTo`. Goes through keycloak-js, which adds
   * the PKCE parameters the realm requires: a hand-made registration address is refused with invalid_request.
   */
  async signUp(returnTo: string = window.location.origin + '/'): Promise<void> {
    await this.keycloak.register({ redirectUri: new URL(returnTo, window.location.origin).href })
  }

  /** Registers a callback run when the session ends; root-level stores register their reset here. */
  onSessionEnd(callback: () => void): void {
    this.endCallbacks.push(callback)
  }

  /** Resets every store, then signs out of Keycloak and returns to the home page. */
  async signOut(): Promise<void> {
    this.endCallbacks.forEach((callback) => callback())
    this.claims.set(signedOut)
    await this.keycloak.logout({ redirectUri: `${window.location.origin}/` })
  }
}
