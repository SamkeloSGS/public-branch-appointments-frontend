import { expect, test, type Page } from '@playwright/test'
import { MANAGER, signInAsStaff } from './support/auth'
import { chooseDayAndTime } from './support/checks'

// Staff journey (spec task 17). Staff book two demo customers into the same time (FE-10). A capacity override to one
// place that day is previewed: the impact names an overbooked interval and the manager must confirm (FE-11). On the
// overbooked days screen the manager moves one appointment out and the interval disappears (FE-12). Everything is
// cleaned up afterwards. Needs the branch manager test user's authenticator secret (see e2e/support/auth.ts).

const FIRST_CUSTOMER = 'customer@appointments.test'
const SECOND_CUSTOMER = 'sipho.dlamini@customers.test'

/** Books one customer through "Book for a customer" and returns the appointment's admin path. */
async function bookFor(page: Page, email: string, time?: string): Promise<{ path: string; time: string }> {
  await page.getByRole('navigation').getByRole('link', { name: 'Book for a customer' }).click()
  await page.getByLabel('Name, email or mobile number').fill(email)
  await page.locator('app-customer-results button').first().click()
  await page.locator('mat-action-list button').first().click()
  const chosen = await chooseDayAndTime(page, time)
  await page.getByRole('button', { name: 'Confirm booking' }).click()
  await expect(page.getByRole('heading', { name: /^Booking / })).toBeVisible()
  return { path: new URL(page.url()).pathname, time: chosen.time }
}

/** Best-effort clean-up that never hides the test's own failure. */
async function quietly(action: () => Promise<unknown>): Promise<void> {
  await action().catch((error: unknown) => console.warn('Clean-up step failed:', error))
}

async function cancelAppointment(page: Page, path: string): Promise<void> {
  await page.goto(path)
  const cancel = page.locator('mat-card-actions').getByRole('button', { name: 'Cancel' })
  await expect(page.locator('app-status-chip')).toBeVisible()
  if (!(await cancel.isVisible())) return
  await cancel.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('app-status-chip')).toHaveText(/Cancelled/)
}

async function removeTestOverrides(page: Page, calendarPath: string): Promise<void> {
  await page.goto(calendarPath)
  // The section heading appears once the lists have loaded
  await expect(page.getByRole('heading', { name: 'Capacity overrides' })).toBeVisible()
  const overrides = page.locator('li').filter({ hasText: 'e2e override' })
  while ((await overrides.count()) > 0) {
    await overrides.first().getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByText('Saved.').last()).toBeVisible()
  }
}

test('FE-10 FE-11 FE-12 staff book two customers; an override shows its impact; the manager moves one out', async ({
  page,
}) => {
  await page.goto('/admin')
  await signInAsStaff(page, MANAGER)
  await expect(page.getByRole('heading', { name: 'Admin', level: 1 })).toBeVisible()

  const booked: string[] = []
  const calendarPath = '/admin/calendar'
  let overrideAdded = false
  try {
    // FE-10: two customers at the same time
    const first = await bookFor(page, FIRST_CUSTOMER)
    booked.push(first.path)
    const dayLink = new URL(
      (await page.getByRole('link', { name: 'Back to the day list' }).getAttribute('href'))!,
      'http://localhost',
    )
    const date = dayLink.searchParams.get('date')!
    const second = await bookFor(page, SECOND_CUSTOMER, first.time)
    booked.push(second.path)

    // FE-11: one place for the whole day; the preview names the overbooked interval and needs confirmation
    await page.getByRole('navigation').getByRole('link', { name: 'Calendar' }).click()
    await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible()
    expect(new URL(page.url()).pathname).toBe(calendarPath)
    const overrideForm = page.locator('form').filter({ has: page.getByLabel('Places') })
    // The pool of the booked service: the first service offered is a personal one, served by the Consultants pool in
    // the demo data. The form's default pool can be another one.
    await overrideForm.getByRole('combobox', { name: 'Pool' }).click()
    await page.getByRole('option', { name: /^Consultants/ }).click()
    await overrideForm.getByLabel('Date').fill(date)
    await overrideForm.getByLabel('Places').fill('1')
    await overrideForm.getByLabel('Note').fill('e2e override')
    overrideAdded = true
    await overrideForm.getByRole('button', { name: 'Check impact and save' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('This change affects existing appointments')
    await expect(dialog).toContainText(/[1-9]\d* interval\(s\) will be overbooked/)
    await dialog.getByRole('button', { name: 'Save anyway' }).click()
    await expect(page.locator('li').filter({ hasText: 'e2e override' })).toBeVisible()

    // FE-12: the interval lists both appointments; moving one out clears it
    await page.getByRole('navigation').getByRole('link', { name: 'Overbooked days' }).click()
    await expect(page.getByRole('heading', { name: 'Overbooked days', level: 1 })).toBeVisible()
    const firstRow = page.locator('li').filter({ has: page.locator(`a[href="${first.path}"]`) })
    const secondRow = page.locator('li').filter({ has: page.locator(`a[href="${second.path}"]`) })
    await expect(firstRow).toBeVisible()
    await expect(secondRow).toBeVisible()
    await firstRow.getByRole('button', { name: 'Move out' }).click()
    await expect(page.getByRole('dialog')).toContainText('will need a new time')
    await page.getByRole('dialog').getByRole('button', { name: 'Move out' }).click()
    await expect(firstRow).toHaveCount(0)
    await expect(secondRow).toHaveCount(0)
  } finally {
    if (overrideAdded) await quietly(() => removeTestOverrides(page, calendarPath))
    for (const path of booked) await quietly(() => cancelAppointment(page, path))
  }
})
