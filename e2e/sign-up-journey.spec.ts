import { expect, test } from '@playwright/test'
import { PASSWORD } from './support/auth'
import { chooseDayAndTime } from './support/checks'
import { linkIn, waitForEmail } from './support/mail'
import { setUpProfile } from './support/profile'

// A new customer from nothing to a confirmed booking against the running backend: chooses a time, registers in
// Keycloak from the sign-in page, verifies the email through the link Keycloak sends (read from Mailpit), fills in the
// first-time profile, books, and receives the confirmation email. Every run registers a new address.

test('FE-4 FE-6 a new customer registers, verifies their email, sets up a profile, books and is emailed', async ({
  page,
}) => {
  // The confirmation email waits for the backend's notification dispatcher, which runs once a minute
  test.setTimeout(180_000)
  const email = `e2e-${Date.now()}@appointments.test`

  // Choose a service and a time as a visitor
  await page.goto('/')
  await page.getByRole('main').getByRole('link', { name: 'Book an appointment' }).click()
  await expect(page.getByRole('heading', { name: 'What do you need help with?' })).toBeVisible()
  await page.locator('mat-action-list button').first().click()
  const { time } = await chooseDayAndTime(page)
  await expect(page.getByRole('heading', { name: 'Confirm your booking' })).toBeVisible()
  const selection = new URL(page.url()).search

  // Register on Keycloak's page, reached from its sign-in page. With email verification on, Keycloak asks for the
  // password only after the email is verified, so nobody can set one for an address they don't own.
  await page.getByRole('button', { name: 'Sign in to book' }).click()
  await page.getByRole('link', { name: 'Register' }).click()
  await page.locator('#email').fill(email)
  await page.locator('#firstName').fill('Ayanda')
  await page.locator('#lastName').fill('Mokoena')
  await page.locator('[type=submit]').click()
  await expect(page.getByText(/verify your email address/i).first()).toBeVisible()

  // Verify with the link from the email, choose the password, and Keycloak returns to the app signed in
  const verification = await waitForEmail(email, /verify email/i)
  await page.goto(linkIn(verification, 'http://localhost:8180/'))
  const proceed = page.getByRole('link', { name: /back to application|click here to proceed/i })
  const newPassword = page.locator('#password-new')
  await expect(proceed.or(newPassword).first()).toBeVisible()
  if (await proceed.isVisible()) await proceed.click()
  await newPassword.fill(PASSWORD)
  await page.locator('#password-confirm').fill(PASSWORD)
  await page.locator('[type=submit]').click()

  // Back at the confirm step without a profile, the app asks for one first, with the email from the sign-in filled
  // in, and then returns to the same selection
  await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible()
  await expect(page.getByLabel('Email')).toHaveValue(email)
  await setUpProfile(page, 'Ayanda', 'Mokoena')

  await expect(page.getByRole('heading', { name: 'Confirm your booking' })).toBeVisible()
  expect(new URL(page.url()).search).toBe(selection)
  await expect(page.locator('app-appointment-summary')).toContainText(time)
  await page.getByRole('button', { name: 'Confirm booking' }).click()
  await expect(page.getByText(/You're booked\. Your booking reference is/)).toBeVisible()
  const reference = (await page.locator('h1').innerText()).replace('Booking ', '').trim()

  try {
    // The confirmation email names the booking and links to it
    const confirmation = await waitForEmail(email, /appointment confirmed/i, 120_000)
    expect(confirmation.text).toContain(reference)
    expect(linkIn(confirmation, 'http://localhost:4200/')).toContain(`/appointments/${reference}`)
  } finally {
    // Leaves no booking behind: one left at the same time would overbook the staff journey's interval
    await page.goto(`/appointments/${reference}`)
    await page.getByRole('button', { name: 'Cancel appointment' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel appointment' }).click()
    await expect(page.getByText('Your appointment has been cancelled.')).toBeVisible()
  }
})
