import fs from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { installReaderCommunalMock } from './helpers/reader-communal-mock'

/** Optional local fixture (not always in CI clones). */
const FIXTURE = path.join(process.cwd(), 'e2e/fixtures/dokumen.pub_meditations-a-new-translation-hardcover.epub')
const hasFixture = fs.existsSync(FIXTURE)

;(hasFixture ? test.describe : test.describe.skip)('E-reader Meditations EPUB (local)', () => {
  test('Meditations EPUB: spine import, split control, save, search', async ({ page }) => {
    test.setTimeout(180_000)

    installReaderCommunalMock(page)
    await page.goto('/games/e-reader?e2eUpload=1', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByRole('heading', { name: /Import books into the communal e-reader/i })).toBeVisible({ timeout: 25_000 })

    await page.getByTestId('reader-file-input').setInputFiles(FIXTURE)
    await expect(page.getByText(/Selected:.*dokumen\.pub.*meditations.*\.epub/i)).toBeVisible()

    await page.getByTestId('reader-detect-chapters').click()
    await expect(page.getByTestId('reader-detect-chapters')).toBeDisabled()
    await expect(page.getByTestId('reader-detect-chapters')).toBeEnabled({ timeout: 120_000 })

    await expect(page.getByTestId('reader-import-preview')).toBeVisible({ timeout: 120_000 })
    const summary = page.getByTestId('reader-chapter-summary')
    await expect(summary).toContainText(/EPUB/)
    const summaryText = await summary.innerText()
    const m = summaryText.match(/(\d+)\s+detected chapters/)
    expect(m, `expected chapter count in "${summaryText}"`).toBeTruthy()
    const chapterCount = Number(m![1])
    expect(chapterCount).toBeGreaterThanOrEqual(14)

    const splitBtns = page.getByTestId('reader-split-chapter')
    await expect(splitBtns.first()).toBeEnabled()
    await splitBtns.first().click()
    await expect(summary).toContainText(new RegExp(`${chapterCount + 1}\\s+detected chapters`))

    await page.getByTestId('reader-save-open').click()
    await expect(page).toHaveURL(/\/games\/e-reader\/read\/.+\/.+/, { timeout: 30_000 })
    await expect(page.getByPlaceholder('Search in book…')).toBeVisible({ timeout: 20_000 })
    await page.getByPlaceholder('Search in book…').fill('Marcus')
    await page.getByRole('button', { name: 'Find' }).click()
    await expect(page.getByText(/\d+\/\d+/).first()).toBeVisible()
  })
})
