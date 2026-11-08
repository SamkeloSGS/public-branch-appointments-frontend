import { expect, test } from '@playwright/test'
import { expectAccessible, expectNoHorizontalScroll } from './support/checks'

// The public customer screens: automated accessibility checks, keyboard use and phone width (FE-17), and no admin
// code for a customer (FE-18). Run at 360 px (project "phone") and on desktop.

test('FE-17 the branch page is accessible, names the time zone and fits the screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Opening hours' })).toBeVisible()
  await expect(page.getByText(/time zone: South Africa Standard Time/)).toBeVisible()
  await expectAccessible(page)
  await expectNoHorizontalScroll(page)
})

test('FE-17 the booking steps before sign-in can be done with a keyboard alone', async ({ page }) => {
  await page.goto('/')
  // The page's own link: the site name in the header has the same text
  const book = page.getByRole('main').getByRole('link', { name: 'Book an appointment' })
  await expect(book).toBeVisible()
  await book.focus()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { name: 'What do you need help with?' })).toBeVisible()
  await expectAccessible(page)
  await expectNoHorizontalScroll(page)
  await page.locator('mat-action-list button').first().focus()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { name: 'Choose a date' })).toBeVisible()
  await expectAccessible(page)
  await expectNoHorizontalScroll(page)
  const day = page.locator('button.day:not([disabled])').first()
  await expect(day).toBeVisible()
  await day.focus()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { name: /^Choose a time on/ })).toBeVisible()
  await expectAccessible(page)
  await expectNoHorizontalScroll(page)
  await page.locator('button.slot').first().focus()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { name: 'Confirm your booking' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in to book' })).toBeVisible()
  await expectAccessible(page)
  await expectNoHorizontalScroll(page)
})

test('FE-18 a customer journey downloads no admin-area code', async ({ page }) => {
  const adminCode: string[] = []
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'script') return
    const body = await response.text().catch(() => '')
    if (/app-admin-shell|app-day-list-page|app-staff-page/.test(body)) adminCode.push(response.url())
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Opening hours' })).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Book an appointment' }).click()
  await expect(page.getByRole('heading', { name: 'What do you need help with?' })).toBeVisible()
  // The services listed means the booking page's code has loaded (waiting for an idle network can wait forever)
  await expect(page.locator('mat-action-list button').first()).toBeVisible()
  expect(adminCode).toEqual([])
})
