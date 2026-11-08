import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { totp } from './totp'

// Sign-in through the local Keycloak realm with the test users from the backend's keycloak/local/ folder. These are
// local test credentials only; never point these tests at a shared environment.

export const PASSWORD = process.env['E2E_PASSWORD'] ?? 'Local-dev-password-1'
export const CUSTOMER = 'customer@appointments.test'
export const MANAGER = 'manager@appointments.test'

/**
 * Authenticator secrets of the staff test users, kept out of version control. A secret is recorded when the test
 * sets up the authenticator itself (a user without one), or given as E2E_TOTP_SECRET_<USER> (e.g.
 * E2E_TOTP_SECRET_MANAGER). `npm run e2e:reset-otp` removes the local test users' authenticators so the next run
 * records new ones.
 */
const SECRETS_FILE = resolve('e2e/.auth/totp-secrets.json')

function readSecrets(): Record<string, string> {
  return existsSync(SECRETS_FILE) ? (JSON.parse(readFileSync(SECRETS_FILE, 'utf8')) as Record<string, string>) : {}
}

function secretFor(email: string): string | undefined {
  const user = email.split('@')[0]!.toUpperCase()
  return process.env[`E2E_TOTP_SECRET_${user}`] ?? readSecrets()[email]
}

function saveSecret(email: string, secret: string): void {
  mkdirSync(dirname(SECRETS_FILE), { recursive: true })
  writeFileSync(SECRETS_FILE, JSON.stringify({ ...readSecrets(), [email]: secret }, null, 2))
}

async function enterCredentials(page: Page, email: string): Promise<void> {
  await expect(page.locator('#username')).toBeVisible()
  await page.locator('#username').fill(email)
  await page.locator('#password').fill(PASSWORD)
  await page.locator('#kc-login').click()
}

/** Signs in on the Keycloak page the app sent the browser to, and waits to be back in the app. */
export async function signInAsCustomer(page: Page): Promise<void> {
  await enterCredentials(page, CUSTOMER)
  await page.waitForURL(/localhost:4200/)
}

/**
 * Signs in a staff member with the second factor. Sets up the authenticator when Keycloak asks for it and records
 * the secret; skips the test when the user already has an authenticator whose secret is unknown.
 */
export async function signInAsStaff(page: Page, email: string): Promise<void> {
  await enterCredentials(page, email)
  const setup = page.locator('#kc-totp-secret-key, #mode-manual')
  const code = page.locator('#otp')
  await expect(setup.or(code).first()).toBeVisible()

  if (await code.isVisible()) {
    const secret = secretFor(email)
    test.skip(!secret, `${email} has an authenticator whose secret is unknown: run npm run e2e:reset-otp first`)
    await code.fill(totp(secret!))
    await page.locator('#kc-login').click()
  } else {
    if (await page.locator('#mode-manual').isVisible()) await page.locator('#mode-manual').click()
    const secret = (await page.locator('#kc-totp-secret-key').innerText()).replace(/\s/g, '')
    saveSecret(email, secret)
    await page.locator('#totp').fill(totp(secret))
    if (await page.locator('#userLabel').isVisible()) await page.locator('#userLabel').fill('e2e')
    await page.locator('#saveTOTPBtn, [type=submit]').first().click()
  }
  await page.waitForURL(/localhost:4200/)
}
