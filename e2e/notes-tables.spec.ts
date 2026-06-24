import { test, expect } from '@playwright/test'
import { mockNotesApi, notesEditor, waitForNotesEditor } from './helpers/notes-mock'

test.describe('Notes inline markdown tables', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await mockNotesApi(page)
    await page.goto('/games/notes')
    await waitForNotesEditor(page)
  })

  test('toolbar inserts editable table with header row', async ({ page }) => {
    await page.getByTestId('notes-table-insert-btn').click()
    await expect(page.getByTestId('notes-table-insert-popover')).toBeVisible()
    await page.getByTestId('notes-table-insert-confirm').click()

    const table = notesEditor(page).locator('table')
    await expect(table).toBeVisible({ timeout: 10_000 })
    await expect(table.locator('th')).toHaveCount(3)
    await expect(table.locator('tr')).toHaveCount(3)

    const firstCell = table.locator('th').first()
    await firstCell.click()
    await page.keyboard.type('Metric')
    await expect(firstCell).toContainText('Metric')
  })

  test('table bubble menu adds row and column', async ({ page }) => {
    await page.getByTestId('notes-table-insert-btn').click()
    await page.getByTestId('notes-table-rows-input').fill('2')
    await page.getByTestId('notes-table-cols-input').fill('2')
    await page.getByTestId('notes-table-insert-confirm').click()

    const table = notesEditor(page).locator('table')
    await expect(table).toBeVisible({ timeout: 10_000 })
    await table.locator('td').first().click()

    await expect(page.getByTestId('notes-table-menu')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('notes-table-menu').getByRole('button', { name: '+↓ row' }).click()
    await expect(table.locator('tr')).toHaveCount(3)

    await page.getByTestId('notes-table-menu').getByRole('button', { name: '+→ col' }).click()
    await expect(table.locator('tr').first().locator('th, td')).toHaveCount(3)
  })

  test('paste tab-separated text from Excel creates inline table', async ({ page }) => {
    await notesEditor(page).click()
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData('text/plain', 'Ticker\tPrice\nAAPL\t190\nMSFT\t420')
      const editor = document.querySelector('[data-testid="notes-tiptap-editor"] .ProseMirror')!
      const ev = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt })
      editor.dispatchEvent(ev)
    })

    const table = notesEditor(page).locator('table')
    await expect(table).toBeVisible({ timeout: 10_000 })
    await expect(table).toContainText('AAPL')
    await expect(table).toContainText('190')
    await expect(table).toContainText('Ticker')
  })

  test('markdown table round-trips through session restore', async ({ page }) => {
    const md = '| Fund | TVPI |\n| --- | --- |\n| Alpha | 1.2 |'
    await page.evaluate((notesMd) => {
      const session = {
        id: 'table-restore',
        title: 'Table restore',
        notes: notesMd,
        tags: [],
        metadata: {},
        lookups: [],
        screenshots: {},
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem('notes_sessions', JSON.stringify([session]))
      localStorage.setItem('notes_active_session_id', session.id)
    }, md)

    await page.reload()
    await waitForNotesEditor(page)

    const table = notesEditor(page).locator('table')
    await expect(table).toBeVisible({ timeout: 10_000 })
    await expect(table).toContainText('Alpha')
    await expect(table).toContainText('1.2')
  })

  test('cell edits persist in localStorage session', async ({ page }) => {
    await page.getByTestId('notes-table-insert-btn').click()
    await page.getByTestId('notes-table-rows-input').fill('2')
    await page.getByTestId('notes-table-cols-input').fill('2')
    await page.getByTestId('notes-table-insert-confirm').click()

    const cell = notesEditor(page).locator('table th').first()
    await cell.click()
    await page.keyboard.type('Revenue')

    await page.waitForTimeout(400)

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('notes_sessions')
      const sessions = raw ? (JSON.parse(raw) as { notes: string }[]) : []
      return sessions[0]?.notes ?? ''
    })

    expect(stored).toMatch(/Revenue/)
    expect(stored).toMatch(/\|/)
  })
})
