import fs from 'node:fs'

import { test, expect, type Download } from '@playwright/test'

import { buildSessionExportHtml, buildSessionMarkdown } from '../src/lib/notes/export'
import type { NoteSession } from '../src/lib/notes/types'
import {
  mockNotesApi,
  notesEditor,
  SESSIONS_KEY,
  waitForNotesEditor,
  waitForNotesTrigger,
} from './helpers/notes-mock'

function sampleExportSession(): NoteSession {
  const now = '2026-06-22T15:30:00.000Z'
  return {
    id: 'e2e-export-session',
    title: 'Export E2E Sample',
    notes: '**Bold term** in notes\n\nAction item line >\n\nMOIC?',
    tags: ['E2E'],
    metadata: {},
    lookups: [
      {
        id: 'lk-e2e',
        type: 'line',
        query: 'MOIC',
        context: 'MOIC?',
        triggeredAt: '2026-06-22T15:31:00.000Z',
        conversation: [
          { role: 'user', content: 'MOIC?' },
          { role: 'assistant', content: 'Multiple on invested capital.' },
        ],
      },
    ],
    screenshots: {},
    startedAt: now,
    updatedAt: now,
  }
}

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
        localStorage.removeItem('notes_user_id')
        localStorage.removeItem('notes_ui_prefs')
      } catch {
        /* ignore */
      }
    }, SESSIONS_KEY)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForNotesEditor(page)
  })

  test('export HTML preview renders structured document (visual)', async ({ page }) => {
    const html = buildSessionExportHtml(sampleExportSession())
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toHaveText('Export E2E Sample')
    await expect(page.locator('h2')).toHaveCount(3)
    await expect(page.locator('.notes-body strong')).toHaveText('Bold term')
    await expect(page.locator('.lookup-block')).toContainText('Multiple on invested capital')
    await expect(page.locator('.action-list li')).toHaveText('Action item line')
    await expect(page.locator('.tag')).toHaveText('E2E')
    await expect(page).toHaveScreenshot('notes-export-html-preview.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.06,
    })
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

  test('Ctrl+E exports markdown without opening menu', async ({ page }) => {
    await notesEditor(page).click()
    await page.keyboard.type('Quick export line')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.keyboard.press('Control+e'),
    ])
    const { text } = await readTextDownload(download)
    expect(text).toContain('# Untitled')
    expect(text).toContain('Quick export line')
    expect(text).toContain('## Notes')
  })

  test('buildSessionMarkdown matches live session after edits', async ({ page }) => {
    await notesEditor(page).click()
    await page.keyboard.type('sync check >')
    const mdFromPage = await page.evaluate(() => {
      const raw = localStorage.getItem('notes_sessions')
      if (!raw) return ''
      const sessions = JSON.parse(raw) as NoteSession[]
      const activeId = localStorage.getItem('notes_active_session_id')
      const session = sessions.find((s) => s.id === activeId) ?? sessions[0]
      if (!session) return ''
      return session.notes
    })
    expect(mdFromPage).toContain('sync check')
    const session = sampleExportSession()
    session.notes = mdFromPage
    const md = buildSessionMarkdown(session)
    expect(md).toContain('- [ ] sync check')
  })
})
