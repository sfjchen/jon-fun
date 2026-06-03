import { test, expect } from '@playwright/test'

const WEDDING_PATH = '/wedding/madelyn-patrick'

test.describe('Madelyn & Patrick wedding site', () => {
  test('loads hero, nav sections, and RSVP form', async ({ page }) => {
    await page.goto(WEDDING_PATH)
    await expect(page).toHaveTitle(/Madelyn Chen & Patrick Ng/)

    await expect(page.getByRole('heading', { level: 1, name: /Madelyn Chen.*Patrick Ng/i })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Wedding sections' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Details' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'RSVP' }).first()).toBeVisible()

    await expect(page.locator('#details')).toBeAttached()
    await expect(page.locator('#rsvp')).toBeAttached()
    await expect(page.getByLabel('Full name *')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send RSVP' })).toBeVisible()
  })

  test('nav anchor links scroll to sections', async ({ page }) => {
    await page.goto(WEDDING_PATH)
    await page.getByRole('link', { name: 'Registry' }).click()
    await expect(page.locator('#registry')).toBeInViewport()
  })

  test('RSVP submit succeeds when API available', async ({ page }) => {
    let posted = false
    await page.route('**/api/wedding/rsvp', async (route) => {
      if (route.request().method() === 'POST') {
        posted = true
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
        return
      }
      await route.continue()
    })

    await page.goto(WEDDING_PATH)
    await page.locator('#rsvp').scrollIntoViewIfNeeded()
    await page.getByLabel('Full name *').fill('E2E Guest')
    await page.locator('#rsvp').getByText('Joyfully accept', { exact: true }).click()
    await page.locator('#rsvp').getByRole('button', { name: 'Send RSVP' }).click()

    await expect(page.getByText('Thank you', { exact: true })).toBeVisible({ timeout: 10000 })
    expect(posted).toBe(true)
  })

  test('Madelyn-Patrick redirect resolves to wedding page', async ({ page }) => {
    await page.goto('/Madelyn-Patrick')
    await expect(page).toHaveURL(/\/wedding\/madelyn-patrick/)
  })
})
