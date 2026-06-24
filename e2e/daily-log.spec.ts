import { readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { test, expect, type Page } from '@playwright/test'

import { mockDailyLearnApi } from './helpers/daily-learn-mock'

function sectionsNav(page: Page) {
  return page.getByRole('navigation', { name: /Daily log sections/i })
}

test.describe('1 Sentence Everyday', () => {
  /** Reset storage once per test without addInitScript — reload must keep seeded rows for CSV round-trip. */
  test.beforeEach(async ({ page }) => {
    await mockDailyLearnApi(page)
    await page.goto('/games/daily-log')
    await page.evaluate(() => {
      try {
        localStorage.removeItem('daily_learn_entries')
        localStorage.removeItem('daily_learn_sync_key')
      } catch {
        /* ignore */
      }
    })
    await page.reload()
  })

  test('shows today entry and tabs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '1 Sentence Everyday' })).toBeVisible({ timeout: 5000 })
    await expect(sectionsNav(page).getByRole('button', { name: 'analytics' })).toBeVisible()
    await expect(page.getByPlaceholder(/One sentence/i)).toBeVisible()
  })

  test('can type in today textarea', async ({ page }) => {
    const textarea = page.getByPlaceholder(/One sentence/i)
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('E2E test entry')
    await expect(textarea).toHaveValue('E2E test entry')
  })

  test('submit persists entry and shows in history', async ({ page }) => {
    const phrase = `E2E save ${Date.now()}`
    await page.getByPlaceholder(/One sentence/i).fill(phrase)
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
    await expect(page.locator('.whitespace-pre-wrap').filter({ hasText: phrase })).toBeVisible()
  })

  test('analytics tab loads counts after save', async ({ page }) => {
    await page.getByPlaceholder(/One sentence/i).fill(`analytics marker ${Date.now()}`)
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 15000 })
    await sectionsNav(page).getByRole('button', { name: 'analytics' }).click()
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
    await expect(page.getByText('Total entries')).toBeVisible()
    await expect(page.getByText('This week')).toBeVisible()
  })

  test('CSV import merge surfaces commas and quoted text', async ({ page }) => {
    const csv =
      'date,text,updatedAt\n2023-08-08,"Learned comma, pause",2023-08-08T15:00:00.000Z\n'
    await sectionsNav(page).getByRole('button', { name: 'export' }).click()
    await page.getByTestId('daily-learn-csv-import').setInputFiles({
      name: 'fixture.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })
    await expect(page.getByRole('status')).toContainText(/Imported/)
    await page.getByRole('button', { name: /← Log/ }).click()
    await expect(page.locator('.whitespace-pre-wrap').filter({ hasText: /Learned comma, pause/ })).toBeVisible()
  })

  test('CSV import rejects invalid header', async ({ page }) => {
    await sectionsNav(page).getByRole('button', { name: 'export' }).click()
    await page.getByTestId('daily-learn-csv-import').setInputFiles({
      name: 'bad.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('foo,bar\n2023-01-01,z'),
    })
    await expect(page.getByRole('status')).toContainText(/Header row must include/)
  })

  test('CSV export download round-trips through import', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'daily_learn_entries',
        JSON.stringify([
          {
            date: '2019-07-07',
            text: 'Quoted "comma, ok"',
            updatedAt: '2019-07-07T18:00:00.000Z',
          },
        ]),
      )
    })
    await page.reload()
    await sectionsNav(page).getByRole('button', { name: 'export' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV' }).click(),
    ])
    const tmpPath = join(tmpdir(), `daily-learn-e2e-${Date.now()}.csv`)
    await download.saveAs(tmpPath)
    const csv = readFileSync(tmpPath, 'utf8')
    unlinkSync(tmpPath)
    expect(csv).toContain('comma')

    await page.evaluate(() => localStorage.removeItem('daily_learn_entries'))
    await page.reload()
    await sectionsNav(page).getByRole('button', { name: 'export' }).click()
    await page.getByTestId('daily-learn-csv-import').setInputFiles({
      name: 'roundtrip.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })
    await expect(page.getByRole('status')).toContainText(/Imported/)
    await page.getByRole('button', { name: /← Log/ }).click()
    await expect(page.locator('.whitespace-pre-wrap').filter({ hasText: /Quoted.*comma/ })).toBeVisible()
  })

  test('sync tab restore handles empty server response', async ({ page }) => {
    await sectionsNav(page).getByRole('button', { name: 'sync' }).click()
    await page.getByPlaceholder(/sync password or device ID/i).fill('e2e-empty-user')
    await page.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByText(/No entries found/i)).toBeVisible({ timeout: 15000 })
  })
})
