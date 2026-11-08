import { expect, type Page, type Response } from '@playwright/test'

/** Starts watching for the app's check of the signed-in user's profile (GET /api/v1/customers/me). */
export function profileCheck(page: Page): Promise<Response> {
  return page.waitForResponse(
    (response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/v1/customers/me',
  )
}

/** Fills in the first-time profile form the app shows, and saves it (FE-4). */
export async function setUpProfile(page: Page, givenName: string, familyName: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible()
  await page.getByLabel('First name').fill(givenName)
  await page.getByLabel('Last name').fill(familyName)
  await page.getByRole('button', { name: 'Save and continue' }).click()
}
