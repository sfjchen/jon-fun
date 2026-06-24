import { test, expect } from '@playwright/test'
import { mockNotesApi, waitForNotesEditor } from './helpers/notes-mock'

test.describe('Notes file attachments', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await mockNotesApi(page)
    await page.goto('/games/notes')
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

  test('drop CSV file inserts editable spreadsheet attachment', async ({ page }) => {
    const editor = page.locator('.ProseMirror')
    await editor.click()

    await page.evaluate(() => {
      const csv = 'Ticker,Price\nAAPL,190\nMSFT,420'
      const file = new File([csv], 'positions.csv', { type: 'text/csv' })
      const dt = new DataTransfer()
      dt.items.add(file)
      const el = document.querySelector('.ProseMirror')
      if (!el) throw new Error('editor missing')
      el.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }),
      )
    })

    await expect(page.getByTestId('notes-attachment-sheet')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('notes-attachment')).toHaveAttribute('data-attachment-kind', 'spreadsheet')
    await expect(page.locator('.note-attachment__table')).toContainText('AAPL')
    await expect(page.locator('.note-attachment__table')).toContainText('190')
  })

  test('selected attachment shows resize handle', async ({ page }) => {
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

    await page.getByTestId('notes-attachment').click()
    await expect(page.getByTestId('notes-attachment-resize')).toBeVisible()

    const handle = page.getByTestId('notes-attachment-resize')
    const box = await handle.boundingBox()
    expect(box).toBeTruthy()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + 80, box.y + 60)
      await page.mouse.up()
    }

    const width = await page.evaluate(() => {
      const raw = localStorage.getItem('notes_sessions')
      if (!raw) return 0
      const sessions = JSON.parse(raw) as { screenshots: Record<string, { display?: { widthPx?: number } }> }[]
      return sessions[0]?.screenshots?.['resize-e2e']?.display?.widthPx ?? 0
    })
    expect(width).toBeGreaterThan(300)
  })
})
