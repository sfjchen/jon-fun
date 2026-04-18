import fs from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

const FIXTURE = path.join(process.cwd(), 'e2e/fixtures/minimal-reader-test.epub')
const hasEpubFixture = fs.existsSync(FIXTURE)

;(hasEpubFixture ? test.describe : test.describe.skip)('E-reader EPUB (local)', () => {
  test('Minimal EPUB: spine import, save, search', async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto('/games/e-reader?e2eUpload=1', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByRole('heading', { name: /Import books into a local-first e-reader/i })).toBeVisible({ timeout: 25_000 })

    await page.getByTestId('reader-file-input').setInputFiles(FIXTURE)
    await expect(page.getByText(/minimal-reader-test\.epub/i)).toBeVisible()

    await page.getByTestId('reader-detect-chapters').click()
    await expect(page.getByTestId('reader-detect-chapters')).toBeDisabled()
    await expect(page.getByTestId('reader-detect-chapters')).toBeEnabled({ timeout: 60_000 })

    await expect(page.getByTestId('reader-import-preview')).toBeVisible({ timeout: 60_000 })
    const summary = page.getByTestId('reader-chapter-summary')
    await expect(summary).toContainText(/EPUB/)
    await expect(summary).toContainText('2 detected chapters')

    const firstTitle = page.getByTestId('reader-import-preview').locator('input').first()
    await expect(firstTitle).toHaveValue(/Chapter One/i)

    await page.getByTestId('reader-save-open').click()
    await expect(page).toHaveURL(/\/games\/e-reader\/read\/.+\/.+/, { timeout: 30_000 })
    await expect(page.getByPlaceholder('Search in book…')).toBeVisible({ timeout: 20_000 })
    await page.getByPlaceholder('Search in book…').fill('Alpha')
    await page.getByRole('button', { name: 'Find' }).click()
    await expect(page.getByText(/\d+\/\d+/).first()).toBeVisible()
  })
})
