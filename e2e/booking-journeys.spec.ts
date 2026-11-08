import { expect, test, type Page } from '@playwright/test'
import { signInAsCustomer } from './support/auth'
import { chooseDayAndTime, expectAccessible } from './support/checks'
import { profileCheck, setUpProfile } from './support/profile'

// Customer journeys against the running backend (spec task 17): book with sign-in at the confirm step, reschedule
// and cancel. Uses the local test customer, whose profile is in the demo data.

test.describe.configure({ mode: 'serial' })

let reference: string

async function startBooking(page: Page): Promise<void> {
  await page.goto('/')
  // The page's own link: the site name in the header has the same text
  await page.getByRole('main').getByRole('link', { name: 'Book an appointment' }).click()
  await expect(page.getByRole('heading', { name: 'What do you need help with?' })).toBeVisible()
  await page.locator('mat-action-list button').first().click()
}

test('FE-6 a visitor chooses a time, signs in at confirm, keeps the selection and books once', async ({ page }) => {
  await startBooking(page)
  const { time } = await chooseDayAndTime(page)
  await expect(page.getByRole('heading', { name: 'Confirm your booking' })).toBeVisible()
  const selection = new URL(page.url()).search

  await page.getByRole('button', { name: 'Sign in to book' }).click()
  const checked = profileCheck(page)
  await signInAsCustomer(page)
  // In a fresh database the demo profile is linked to this login by its first save
  if ((await checked).status() === 404) await setUpProfile(page, 'Thandi', 'Nkosi')
  // Back from Keycloak with the same selection (FE-6)
  await expect(page.getByRole('heading', { name: 'Confirm your booking' })).toBeVisible()
  expect(new URL(page.url()).search).toBe(selection)
  await expect(page.locator('app-appointment-summary')).toContainText(time)

  const bookings: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/appointments') bookings.push(request.url())
  })
  const confirm = page.getByRole('button', { name: 'Confirm booking' })
  await confirm.dblclick()

  await expect(page.getByText(/You're booked\. Your booking reference is/)).toBeVisible()
  expect(bookings).toHaveLength(1)
  reference = (await page.locator('h1').innerText()).replace('Booking ', '').trim()
  await expectAccessible(page)
})

test('FE-7 the customer reschedules the appointment', async ({ page }) => {
  test.skip(!reference, 'needs the booking from the previous test')
  await page.goto(`/appointments/${reference}`)
  await signInAsCustomer(page)
  await expect(page.locator('h1')).toHaveText(`Booking ${reference}`)

  await page.getByRole('button', { name: 'Reschedule' }).click()
  await chooseDayAndTime(page)
  await expect(page.getByText('Your appointment has been moved.')).toBeVisible()
  await expect(page.locator('app-status-chip')).toHaveText(/Booked/)
})

test('FE-7 the customer cancels the appointment after confirming', async ({ page }) => {
  test.skip(!reference, 'needs the booking from the first test')
  await page.goto(`/appointments/${reference}`)
  await signInAsCustomer(page)
  await page.getByRole('button', { name: 'Cancel appointment' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText(`Booking ${reference} will be cancelled`)
  await dialog.getByRole('button', { name: 'Cancel appointment' }).click()

  await expect(page.getByText('Your appointment has been cancelled.')).toBeVisible()
  await expect(page.locator('app-status-chip')).toHaveText(/Cancelled/)
  await expect(page.getByRole('button', { name: 'Reschedule' })).toHaveCount(0)
})
