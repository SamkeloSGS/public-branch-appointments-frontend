import { InjectionToken } from '@angular/core'

/** Environment settings the app passes to the domains (see src/environments). */
export interface AppSettings {
  /** Minutes before the start after which an appointment can no longer be changed online (explanation only) */
  changeCutoffMinutes: number
  /** Minutes after the start from which staff may record a no-show (the backend's booking.no-show-grace) */
  noShowGraceMinutes: number
}

export const APP_SETTINGS = new InjectionToken<AppSettings>('APP_SETTINGS', {
  factory: () => ({ changeCutoffMinutes: 60, noShowGraceMinutes: 15 }),
})
