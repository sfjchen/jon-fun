import { test, expect } from '@playwright/test'
import { mockNotesApi, notesEditor, waitForNotesEditor } from './helpers/notes-mock'

async function insertTable(page: import('@playwright/test').Page, rows = '3', cols = '3') {
  await page.getByTestId('notes-table-insert-btn').click()
  await expect(page.getByTestId('notes-table-insert-popover')).toBeVisible()
  await page.getByTestId('notes-table-rows-input').fill(rows)
  await page.getByTestId('notes-table-cols-input').fill(cols)
  await page.getByTestId('notes-table-insert-confirm').click()
  await expect(notesEditor(page).locator('table')).toBeVisible({ timeout: 10_000 })
}

test.describe('Notes inline markdown tables', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await mockNotesApi(page)
    await page.goto('/games/notes?notesE2e=1')
    await waitForNotesEditor(page)
  })

  test('toolbar inserts editable table without header row by default', async ({ page }) => {
    await insertTable(page)

    const table = notesEditor(page).locator('table')
    await expect(table.locator('th')).toHaveCount(0)
    await expect(table.locator('td')).toHaveCount(9)
    await expect(table.locator('tr')).toHaveCount(3)

    const firstCell = table.locator('td').first()
    await firstCell.click()
    await page.keyboard.type('Metric')
    await expect(firstCell).toContainText('Metric')
  })

  test('Tab moves between table cells', async ({ page }) => {
    await insertTable(page, '2', '2')
    const table = notesEditor(page).locator('table')
    await table.locator('td').first().click()
    await page.keyboard.type('A')
    await page.keyboard.press('Tab')
    await page.keyboard.type('B')
    await expect(table).toContainText('A')
    await expect(table).toContainText('B')
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
    await expect(table.locator('th')).toHaveCount(0)
    await expect(table).toContainText('AAPL')
    await expect(table).toContainText('Ticker')
  })

  test('cell edits persist as markdown pipe table', async ({ page }) => {
    await insertTable(page, '2', '2')

    const cell = notesEditor(page).locator('table td').first()
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

    const md = await page.evaluate(() => {
      const fn = (window as Window & { __notesE2eGetMarkdown?: () => string }).__notesE2eGetMarkdown
      return fn?.() ?? ''
    })
    expect(md).toMatch(/Revenue/)
    expect(md).toMatch(/\|/)
  })

})
