import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** WCAG 2.1 AA automated checks on the current page (FE-17). */
export async function expectAccessible(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const violations = results.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')} (${node.any[0]?.message ?? violation.help})`),
  )
  expect(violations).toEqual([])
}

/** The page fits the screen width (spec 4.6). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

/**
 * Chooses a day with open times, then a time at random in its second half: runs on the same day then rarely clash
 * with each other or with a booking left behind by an interrupted run.
 */
export async function chooseDayAndTime(page: Page, wanted?: string): Promise<{ time: string }> {
  await expect(page.getByRole('heading', { name: 'Choose a date' })).toBeVisible()
  const day = page.locator('button.day:not([disabled])').first()
  await expect(day).toBeVisible()
  await day.click()
  const slots = page.locator('button.slot')
  await expect(slots.first()).toBeVisible()
  const count = await slots.count()
  const half = Math.floor(count / 2)
  const slot = wanted
    ? slots.filter({ hasText: wanted })
    : slots.nth(half + Math.floor(Math.random() * (count - half)))
  const time = (await slot.innerText()).trim()
  await slot.click()
  return { time }
}
