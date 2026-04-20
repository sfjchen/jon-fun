import fs from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { installReaderCommunalMock } from './helpers/reader-communal-mock'

const FIXTURE = path.join(process.cwd(), 'e2e/fixtures/meditations-a-new-translation-hardcover.pdf')
const ROOT = path.join(process.cwd(), 'meditations-a-new-translation-hardcover.pdf')
const MEDITATIONS_PDF = fs.existsSync(FIXTURE) ? FIXTURE : ROOT
const hasMeditationsPdf = fs.existsSync(MEDITATIONS_PDF)

;(hasMeditationsPdf ? test.describe : test.describe.skip)('E-reader (local)', () => {
  test('Meditations PDF: multi-chapter import, save, reader search', async ({ page }) => {
    test.setTimeout(180_000)

    installReaderCommunalMock(page)
    await page.goto('/games/e-reader?e2eUpload=1', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByRole('heading', { name: /Import books into the communal e-reader/i })).toBeVisible({ timeout: 25_000 })

    await expect(page.getByTestId('reader-file-input')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('reader-file-input').setInputFiles(MEDITATIONS_PDF)
    await expect(page.getByText(/meditations-a-new-translation-hardcover\.pdf/i)).toBeVisible()

    await page.getByTestId('reader-detect-chapters').click()
    await expect(page.getByTestId('reader-detect-chapters')).toBeDisabled()
    await expect(page.getByTestId('reader-detect-chapters')).toBeEnabled({ timeout: 120_000 })

    await expect(page.getByTestId('reader-import-preview')).toBeVisible({ timeout: 120_000 })
    const summary = page.getByTestId('reader-chapter-summary')
    await expect(summary).toContainText(/PDF/)
    const summaryText = await summary.innerText()
    const m = summaryText.match(/(\d+)\s+detected chapters/)
    expect(m, `expected chapter count in "${summaryText}"`).toBeTruthy()
    expect(Number(m![1])).toBe(12)

    const firstTitle = page.getByTestId('reader-import-preview').locator('input').first()
    await expect(firstTitle).toHaveValue(/Book\s*1/i)

    await page.getByTestId('reader-save-open').click()
    await expect(page).toHaveURL(/\/games\/e-reader\/read\/.+\/.+/, { timeout: 30_000 })
    await expect(page.getByPlaceholder('Search in book…')).toBeVisible({ timeout: 20_000 })
    await page.getByPlaceholder('Search in book…').fill('Marcus')
    await page.getByRole('button', { name: 'Find' }).click()
    await expect(page.getByText(/\d+\/\d+/).first()).toBeVisible()
  })
})
