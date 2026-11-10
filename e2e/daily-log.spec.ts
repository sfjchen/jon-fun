import { readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { test, expect, type Page } from '@playwright/test'

import { mockDailyLearnApi, setDailyLearnMockServerEntries, triggerDailyLearnTabVisible } from './helpers/daily-learn-mock'

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

  test('sync with an empty account keeps local entries', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'daily_learn_entries',
        JSON.stringify([{ date: '2019-03-01', text: 'Only on this browser', updatedAt: '2019-03-01T10:00:00.000Z' }]),
      )
    })
    await page.reload()
    await sectionsNav(page).getByRole('button', { name: 'sync' }).click()
    await page.getByPlaceholder(/sync password or device ID/i).fill('e2e-empty-user')
    await page.getByRole('button', { name: 'Sync', exact: true }).click()
    await expect(page.getByText('Synced 1 entries')).toBeVisible({ timeout: 15000 })
  })

  test('fresh browser sync merges both sides and keeps the newer copy per day', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'daily_learn_entries',
        JSON.stringify([
          { date: '2019-04-01', text: 'Typed here before syncing', updatedAt: '2019-04-01T10:00:00.000Z' },
          { date: '2019-04-02', text: 'Newer local edit', updatedAt: '2019-04-03T10:00:00.000Z' },
        ]),
      )
    })
    await page.reload()
    await setDailyLearnMockServerEntries(
      page,
      [
        { date: '2019-04-02', text: 'Older server copy', updatedAt: '2019-04-02T10:00:00.000Z' },
        { date: '2019-04-05', text: 'From my other laptop', updatedAt: '2019-04-05T10:00:00.000Z' },
        { date: '2019-04-06', text: '', updatedAt: '2019-04-06T10:00:00.000Z' },
      ],
      'e2e-shared-key',
    )
    await sectionsNav(page).getByRole('button', { name: 'sync' }).click()
    await page.getByPlaceholder(/sync password or device ID/i).fill('e2e-shared-key')
    await page.getByRole('button', { name: 'Sync', exact: true }).click()
    await expect(page.getByText('Synced 3 entries')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: /← Log/ }).click()
    for (const t of ['Typed here before syncing', 'Newer local edit', 'From my other laptop']) {
      await expect(page.locator('.whitespace-pre-wrap').filter({ hasText: t })).toBeVisible()
    }
    await expect(page.locator('.whitespace-pre-wrap').filter({ hasText: 'Older server copy' })).toHaveCount(0)
  })

  test('deleted entry stays deleted when the server still has an older copy', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'daily_learn_entries',
        JSON.stringify([{ date: '2019-05-01', text: '', updatedAt: '2019-05-02T10:00:00.000Z' }]),
      )
    })
    await page.reload()
    await setDailyLearnMockServerEntries(page, [
      { date: '2019-05-01', text: 'Deleted on another device', updatedAt: '2019-05-01T10:00:00.000Z' },
    ])
    const pushed = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/api/daily-learn/entries'))
    await triggerDailyLearnTabVisible(page)
    await pushed
    const stored = await page.evaluate(() => localStorage.getItem('daily_learn_entries') ?? '')
    expect(JSON.parse(stored)).toEqual([{ date: '2019-05-01', text: '', updatedAt: '2019-05-02T10:00:00.000Z' }])
    await expect(page.locator('.whitespace-pre-wrap').filter({ hasText: 'Deleted on another device' })).toHaveCount(0)
  })

  test('shortcut hint shows Cmd+Enter on Mac', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' })
    })
    await page.reload()
    await expect(page.getByTestId('daily-learn-submit-shortcut-hint')).toContainText('Cmd+Enter to submit')
  })

  test('shortcut hint shows Ctrl+Enter on Windows', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' })
    })
    await page.reload()
    await expect(page.getByTestId('daily-learn-submit-shortcut-hint')).toContainText('Ctrl+Enter to submit')
  })

  test('Ctrl+Enter submits today entry on Windows', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' })
    })
    await page.reload()
    const phrase = `E2E ctrl-enter ${Date.now()}`
    const textarea = page.getByPlaceholder(/One sentence/i)
    await textarea.fill(phrase)
    await textarea.press('Control+Enter')
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.whitespace-pre-wrap').filter({ hasText: phrase })).toBeVisible()
  })

  test('visibility refetch updates history from server', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'daily_learn_entries',
        JSON.stringify([
          {
            date: '2018-06-01',
            text: 'Stale local only',
            updatedAt: '2018-06-01T10:00:00.000Z',
          },
        ]),
      )
    })
    await page.reload()
    await expect(page.locator('.whitespace-pre-wrap').filter({ hasText: 'Stale local only' })).toBeVisible()

    await setDailyLearnMockServerEntries(page, [
      {
        date: '2018-06-02',
        text: 'Fresh from another device',
        updatedAt: '2018-06-02T12:00:00.000Z',
      },
      {
        date: '2018-06-01',
        text: 'Stale local only',
        updatedAt: '2018-06-01T10:00:00.000Z',
      },
    ])

    await triggerDailyLearnTabVisible(page)
    await expect(page.locator('.whitespace-pre-wrap').filter({ hasText: 'Fresh from another device' })).toBeVisible({
      timeout: 15000,
    })
  })

  test('visibility refetch does not wipe dirty today draft', async ({ page }) => {
    const today = await page.evaluate(() => {
      const now = new Date()
      if (now.getHours() < 5) {
        const prev = new Date(now)
        prev.setDate(prev.getDate() - 1)
      }
      const d = now.getHours() < 5 ? new Date(now.getTime() - 86400000) : now
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    })

    await page.evaluate(
      ({ date }) => {
        localStorage.setItem(
          'daily_learn_entries',
          JSON.stringify([
            {
              date,
              text: 'Old saved today',
              updatedAt: '2020-01-01T10:00:00.000Z',
            },
          ]),
        )
      },
      { date: today },
    )
    await page.reload()
    await expect(page.getByPlaceholder(/One sentence/i)).toHaveValue('Old saved today')

    await setDailyLearnMockServerEntries(page, [
      {
        date: today,
        text: 'Saved on phone remotely',
        updatedAt: '2030-01-01T12:00:00.000Z',
      },
    ])

    const textarea = page.getByPlaceholder(/One sentence/i)
    await textarea.fill('Unsaved draft in progress')
    await triggerDailyLearnTabVisible(page)

    await expect(textarea).toHaveValue('Unsaved draft in progress', { timeout: 15000 })
    await expect(page.getByTestId('daily-learn-remote-today-hint')).toBeVisible()
    await page.getByTestId('daily-learn-remote-today-hint').click()
    await expect(textarea).toHaveValue('Saved on phone remotely')
  })
})
