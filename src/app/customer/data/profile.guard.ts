import { Injectable, inject } from '@angular/core'
import { Router, type CanActivateFn, type UrlTree } from '@angular/router'
import { Session } from '../../identity'
import { ProfileStore } from './profile.store'

export const PROFILE_SETUP_PATH = '/profile/setup'

/**
 * Sends a signed-in customer without a profile to profile setup before a screen that needs one, and back afterwards
 * (FE-4). A failure to load the profile lets the page open and show its own error.
 */
export const profileGuard: CanActivateFn = async (_route, state) => {
  if (!inject(Session).signedIn()) return true
  const profiles = inject(CustomerProfiles)
  return (await profiles.hasProfile()) === false ? profiles.setupUrl(state.url) : true
}

/** Profile checks other domains use through the customer entry file. */
@Injectable({ providedIn: 'root' })
export class CustomerProfiles {
  private readonly store = inject(ProfileStore)
  private readonly router = inject(Router)

  /** Whether the signed-in user has a customer profile; undefined when it could not be checked. */
  async hasProfile(): Promise<boolean | undefined> {
    try {
      return (await this.store.ensureLoaded()) !== null
    } catch {
      return undefined
    }
  }

  setupUrl(returnTo: string): UrlTree {
    return this.router.createUrlTree([PROFILE_SETUP_PATH], { queryParams: { returnTo } })
  }

  /** Forgets the loaded profile, e.g. after the booking API answered PROFILE_REQUIRED. */
  forget(): void {
    this.store.reset()
  }
}
