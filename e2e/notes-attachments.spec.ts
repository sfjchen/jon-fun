import { test, expect } from '@playwright/test'
import {
  dropCsvOnNotesEditor,
  mockNotesApi,
  seedSpreadsheetAttachmentSession,
  waitForNotesEditor,
} from './helpers/notes-mock'

const isProductionDeploy = (process.env.PLAYWRIGHT_BASE_URL ?? (process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1' ? 'https://sfjc.dev' : '')).includes(
  'sfjc.dev',
)

test.describe('Notes file attachments', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await mockNotesApi(page)
    await page.goto('/games/notes?notesE2e=1')
    await waitForNotesEditor(page)
  })

  test('restored attachment marker renders image when screenshot map present', async ({ page }) => {
    await page.evaluate(() => {
      const id = 'screenshot-e2e-restore'
      const base64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      const session = {
        id: 'attach-restore',
        title: 'Attach restore',
        notes: `[📎 ${id}]`,
        tags: [],
        metadata: {},
        lookups: [],
        screenshots: {
          [id]: {
            id,
            base64,
            mimeType: 'image/png',
            kind: 'image',
            display: { widthPx: 200, heightPx: 120 },
          },
        },
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem('notes_sessions', JSON.stringify([session]))
      localStorage.setItem('notes_active_session_id', session.id)
    })
    await page.reload()
    await waitForNotesEditor(page)
    await expect(page.getByTestId('notes-attachment-img')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('notes-attachment')).toHaveAttribute('data-attachment-kind', 'image')
  })

  test('restored spreadsheet attachment renders editable table', async ({ page }) => {
    await seedSpreadsheetAttachmentSession(page)
    await page.reload()
    await waitForNotesEditor(page)
    await expect(page.getByTestId('notes-attachment-sheet')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('notes-attachment')).toHaveAttribute('data-attachment-kind', 'spreadsheet')
    await expect(page.locator('.note-attachment__table')).toContainText('AAPL')
  })

  test('drop CSV file inserts editable spreadsheet attachment', async ({ page }) => {
    test.skip(isProductionDeploy, 'CSV insert hook runs locally with ?notesE2e=1; deploy uses restore smoke')
    await dropCsvOnNotesEditor(page, 'Ticker,Price\nAAPL,190\nMSFT,420', 'positions.csv')

    await expect(page.getByTestId('notes-attachment-sheet')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('notes-attachment')).toHaveAttribute('data-attachment-kind', 'spreadsheet')
    await expect(page.locator('.note-attachment__table')).toContainText('AAPL')
    await expect(page.locator('.note-attachment__table')).toContainText('190')
  })

  test('selected attachment shows resize handle', async ({ page }) => {
    test.skip(isProductionDeploy, 'Resize E2E runs locally with ?notesE2e=1; deploy uses restore smoke')
    await page.evaluate(() => {
      const id = 'resize-e2e'
      const base64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      const session = {
        id: 'attach-resize',
        title: 'Resize',
        notes: `[📎 ${id}]`,
        tags: [],
        metadata: {},
        lookups: [],
        screenshots: {
          [id]: {
            id,
            base64,
            mimeType: 'image/png',
            kind: 'image',
            display: { widthPx: 300, heightPx: 200 },
          },
        },
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem('notes_sessions', JSON.stringify([session]))
      localStorage.setItem('notes_active_session_id', session.id)
    })
    await page.reload()
    await waitForNotesEditor(page)

    await page.evaluate(() => {
      const fn = (window as Window & { __notesE2eSelectAttachment?: (id: string) => boolean }).__notesE2eSelectAttachment
      if (!fn?.('resize-e2e')) throw new Error('notesE2e select attachment failed')
    })
    await expect(page.getByTestId('notes-attachment-resize')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('notes-attachment')).toHaveClass(/note-attachment--selected/)
  })
})
