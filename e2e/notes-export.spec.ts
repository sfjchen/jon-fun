import fs from 'node:fs'

import { test, expect, type Download } from '@playwright/test'

import {
  mockNotesApi,
  notesEditor,
  SESSIONS_KEY,
  waitForNotesEditor,
  waitForNotesTrigger,
} from './helpers/notes-mock'

async function readTextDownload(download: Download): Promise<{ name: string; text: string }> {
  const name = download.suggestedFilename()
  const path = await download.path()
  if (!path) throw new Error('Download path missing')
  return { name, text: fs.readFileSync(path, 'utf8') }
}

async function readBinaryDownload(download: Download): Promise<{ name: string; buf: Buffer }> {
  const name = download.suggestedFilename()
  const path = await download.path()
  if (!path) throw new Error('Download path missing')
  return { name, buf: fs.readFileSync(path) }
}

test.describe('Notes export', () => {
  test.use({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })

  test.beforeEach(async ({ page }) => {
    await mockNotesApi(page)
    await page.goto('/games/notes', { waitUntil: 'load' })
    await page.evaluate((key) => {
      try {
        localStorage.removeItem(key)
        localStorage.removeItem('notes_active_session_id')
        localStorage.removeItem('notes_ui_prefs')
      } catch {
        /* ignore */
      }
    }, SESSIONS_KEY)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForNotesEditor(page)
  })

  test('markdown export download has full structured content', async ({ page }) => {
    const title = page.getByTestId('notes-meeting-title')
    await title.click()
    await title.fill('Export E2E Sample')
    await notesEditor(page).click()
    await page.keyboard.type('**Bold term** in notes')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Action item line >')
    await page.keyboard.press('Enter')
    await page.keyboard.type('MOIC?')
    await waitForNotesTrigger(page)

    await page.getByTestId('notes-export-toggle').click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('notes-export-md').click(),
    ])
    const { name, text } = await readTextDownload(download)
    expect(name).toMatch(/^notes-export-e2e-sample-.*\.md$/)
    expect(text).toMatch(/^# Export E2E Sample/m)
    expect(text).toContain('## Notes')
    expect(text).toContain('**Bold term**')
    expect(text).toContain('## AI Lookups')
    expect(text).toContain('### MOIC?')
    expect(text).toContain('**A:**')
    expect(text).toContain('## Action Items')
    expect(text).toContain('- [ ] Action item line')
  })

  test('PDF export download is valid PDF file', async ({ page }) => {
    test.setTimeout(90_000)
    const title = page.getByTestId('notes-meeting-title')
    await title.click()
    await title.fill('PDF Export Test')
    await notesEditor(page).click()
    await page.keyboard.type('Content for PDF export check.')

    await page.getByTestId('notes-export-toggle').click()
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByTestId('notes-export-pdf').click(),
    ])
    const { name, buf } = await readBinaryDownload(download)
    expect(name).toMatch(/^notes-pdf-export-test-.*\.pdf$/)
    expect(buf.slice(0, 5).toString()).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(800)
  })

})
