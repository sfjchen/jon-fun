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

async function focusFirstBodyCell(page: import('@playwright/test').Page) {
  const table = notesEditor(page).locator('table')
  const cell = table.locator('td').first()
  await cell.click()
  return cell
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

  test('keyboard shortcut Ctrl+Alt+T inserts table', async ({ page }) => {
    await notesEditor(page).click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Alt+t' : 'Control+Alt+t')

    await expect(notesEditor(page).locator('table')).toBeVisible({ timeout: 10_000 })
    await expect(notesEditor(page).locator('table th')).toHaveCount(0)
    await expect(notesEditor(page).locator('table td')).toHaveCount(9)
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

  test('table bubble menu adds row and column', async ({ page }) => {
    await insertTable(page, '2', '2')
    const table = notesEditor(page).locator('table')
    await focusFirstBodyCell(page)

    await expect(page.getByTestId('notes-table-menu')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('notes-table-dims')).toContainText('2×2')

    await page.getByTestId('notes-table-menu').getByRole('button', { name: '+↓ row' }).click()
    await expect(table.locator('tr')).toHaveCount(3)

    await page.getByTestId('notes-table-menu').getByRole('button', { name: '+→ col' }).click()
    await expect(table.locator('tr').first().locator('th, td')).toHaveCount(3)
  })

  test('table menu toggles header column and cell alignment', async ({ page }) => {
    await insertTable(page, '2', '2')
    await focusFirstBodyCell(page)
    await expect(page.getByTestId('notes-table-menu')).toBeVisible()

    await page.getByTestId('notes-table-menu').getByRole('button', { name: 'H col' }).click()
    await expect(notesEditor(page).locator('table th')).toHaveCount(2)

    await notesEditor(page).locator('table td').first().click()
    await page.getByTestId('notes-table-menu').getByRole('button', { name: '➡' }).click()

    const align = await page.evaluate(() => {
      const ed = (window as Window & { __notesE2eEditor?: () => { getAttributes: (n: string) => { align?: string } } })
        .__notesE2eEditor?.()
      return ed?.getAttributes('tableCell').align ?? ed?.getAttributes('tableHeader').align ?? null
    })
    expect(align).toBe('right')
  })

  test('merge cells via shift-click and menu', async ({ page }) => {
    await insertTable(page, '2', '2')

    const table = notesEditor(page).locator('table')
    await expect(table).toBeVisible({ timeout: 10_000 })
    const row = table.locator('tr').first()
    await row.locator('td').nth(0).click()
    await row.locator('td').nth(1).click({ modifiers: ['Shift'] })

    await expect(page.getByTestId('notes-table-menu')).toBeVisible()
    await page.getByTestId('notes-table-menu').getByRole('button', { name: 'Merge' }).click()
    await expect(table.locator('[colspan="2"]')).toHaveCount(1)
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

  test('bold formatting works inside table cell', async ({ page }) => {
    await insertTable(page, '2', '2')
    await notesEditor(page).locator('table td').first().click()
    await page.keyboard.type('bold')
    await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+a`)
    await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+b`)

    await expect(notesEditor(page).locator('table td strong')).toContainText('bold')
  })

  test('copy CSV button writes tabular data to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await insertTable(page, '2', '2')

    await notesEditor(page).locator('table td').first().click()
    await page.keyboard.type('X')
    await notesEditor(page).locator('table td').nth(1).click()
    await page.keyboard.type('Y')

    await expect(page.getByTestId('notes-table-menu')).toBeVisible()
    await page.getByTestId('notes-table-menu').getByRole('button', { name: 'CSV' }).click()
    await expect(page.getByTestId('notes-table-menu').getByRole('button', { name: 'Copied!' })).toBeVisible({
      timeout: 3000,
    })

    const clip = await page.evaluate(async () => navigator.clipboard.readText())
    expect(clip).toMatch(/X/)
    expect(clip).toMatch(/Y/)
    expect(clip).toContain(',')
  })
})
