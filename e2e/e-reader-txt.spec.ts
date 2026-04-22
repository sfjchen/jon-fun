import fs from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { installReaderCommunalMock } from './helpers/reader-communal-mock'

const TXT = path.join(process.cwd(), 'e2e/fixtures/minimal-reader-test.txt')

test.describe('E-reader TXT import', () => {
  test('multi-chapter TXT: import, save, search', async ({ page }) => {
    test.setTimeout(120_000)
    fs.accessSync(TXT)

    installReaderCommunalMock(page)
    await page.goto('/games/e-reader?e2eUpload=1', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByRole('heading', { name: /Import books into the communal e-reader/i })).toBeVisible({
      timeout: 25_000,
    })

    await page.getByTestId('reader-file-input').setInputFiles(TXT)
    await page.getByTestId('reader-detect-chapters').click()
    await expect(page.getByTestId('reader-import-preview')).toBeVisible({ timeout: 60_000 })

    const summary = page.getByTestId('reader-chapter-summary')
    await expect(summary).toContainText(/Text/i)
    await expect(summary).toContainText(/2/)

    await page.getByTestId('reader-save-open').click()
    await expect(page).toHaveURL(/\/games\/e-reader\/read\/.+\/.+/, { timeout: 30_000 })
    await expect(page.getByPlaceholder('Search in book…')).toBeVisible({ timeout: 20_000 })

    await page.getByPlaceholder('Search in book…').fill('gamma')
    await page.getByRole('button', { name: 'Find' }).click()
    await expect(page.getByText(/\d+\/\d+/).first()).toBeVisible()
  })
})

test.describe('E-reader progress + settings', () => {
  test('restores scroll after reload when progress saved', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Mobile Chrome', 'Short chapter may not scroll on narrow viewports')
    test.setTimeout(120_000)
    fs.accessSync(TXT)

    installReaderCommunalMock(page)
    await page.goto('/games/e-reader?e2eUpload=1', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.getByTestId('reader-file-input').setInputFiles(TXT)
    await page.getByTestId('reader-detect-chapters').click()
    await expect(page.getByTestId('reader-import-preview')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('reader-save-open').click()
    await expect(page).toHaveURL(/\/games\/e-reader\/read\/.+\/.+/, { timeout: 30_000 })

    await page.evaluate(() => window.scrollTo(0, 400))
    await page.waitForTimeout(400)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByPlaceholder('Search in book…')).toBeVisible({ timeout: 20_000 })

    const y = await page.evaluate(() => window.scrollY)
    expect(y).toBeGreaterThan(50)
  })

  test('mobile: reader settings panel opens', async ({ page }) => {
    test.setTimeout(90_000)
    fs.accessSync(TXT)

    await page.setViewportSize({ width: 390, height: 844 })
    installReaderCommunalMock(page)
    await page.goto('/games/e-reader?e2eUpload=1', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.getByTestId('reader-file-input').setInputFiles(TXT)
    await page.getByTestId('reader-detect-chapters').click()
    await expect(page.getByTestId('reader-import-preview')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('reader-save-open').click()
    await expect(page).toHaveURL(/\/games\/e-reader\/read\/.+\/.+/, { timeout: 30_000 })

    await page.getByRole('button', { name: 'Reader settings' }).click()
    await expect(page.getByRole('dialog', { name: 'Reader settings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Customize your reading view/i })).toBeVisible()
  })
})
