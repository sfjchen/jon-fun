import { test, expect } from '@playwright/test'
import { notesEditor, waitForNotesEditor } from './helpers/notes-mock'

test.describe('Notes sync restore (mock API)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('restore panel pulls sessions from server', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('notes_sessions')
      localStorage.removeItem('notes_sync_key')
      localStorage.setItem('notes_user_id', 'device-only-id')
      localStorage.setItem('notes_ui_prefs', JSON.stringify({ panelOpen: true }))
    })

    await page.route('**/api/notes/sessions**', async (route) => {
      const url = route.request().url()
      if (route.request().method() === 'GET' && url.includes('userId=restore-key-123')) {
        await route.fulfill({
          json: {
            sessions: [
              {
                id: 'restored-session',
                title: 'Restored Note',
                notes: 'restored body text',
                tags: [],
                metadata: { meetingAt: new Date().toISOString() },
                lookups: [],
                screenshots: {},
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        })
        return
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { sessions: [] } })
        return
      }
      await route.fulfill({ json: { ok: true } })
    })

    await page.route('**/api/notes/glossary**', async (route) => {
      await route.fulfill({ json: route.request().method() === 'GET' ? { entries: [] } : { ok: true } })
    })
    await page.route('**/api/notes/sources**', async (route) => {
      await route.fulfill({ json: route.request().method() === 'GET' ? { sources: [] } : { ok: true } })
    })

    await page.goto('/games/notes')
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('notes-sync-toggle').click()
    await expect(page.getByTestId('notes-sync-panel')).toBeVisible()

    await page.getByTestId('notes-restore-key-input').fill('restore-key-123')
    await page.getByTestId('notes-restore-btn').click()

    await expect(page.getByTestId('notes-meeting-title')).toHaveValue('Restored Note', { timeout: 10_000 })
    await waitForNotesEditor(page)
    await expect(notesEditor(page)).toContainText('restored body text', { timeout: 10_000 })

    const syncKey = await page.evaluate(() => localStorage.getItem('notes_sync_key'))
    expect(syncKey).toBe('restore-key-123')
  })

  test('restore with owner sync password clears local when server vault empty', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'notes_sessions',
        JSON.stringify([
          {
            id: 'local-only',
            title: 'Old local note',
            notes: 'stale',
            tags: [],
            metadata: {},
            lookups: [],
            screenshots: {},
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]),
      )
      localStorage.removeItem('notes_sync_key')
      localStorage.setItem('notes_user_id', 'non-admin-device')
    })

    await page.route('**/api/notes/sessions**', async (route) => {
      const url = route.request().url()
      if (route.request().method() === 'GET' && url.includes('userId=MLpnko') && url.includes('syncPassword=MLpnko')) {
        await route.fulfill({ json: { sessions: [] } })
        return
      }
      await route.fulfill({ json: { sessions: [] } })
    })

    await page.goto('/games/notes')
    await page.getByTestId('notes-sync-toggle').click()
    await page.getByTestId('notes-restore-key-input').fill('MLpnko#12')
    await page.getByTestId('notes-restore-btn').click()

    await expect(page.getByTestId('notes-sync-panel')).toContainText('server is empty', { timeout: 10_000 })
    await expect(page.getByTestId('notes-meeting-title')).toHaveValue('')
  })

  test('restore drops local-only note when server has different vault', async ({ page }) => {
    const now = new Date().toISOString()
    await page.addInitScript(({ now }) => {
      localStorage.setItem(
        'notes_sessions',
        JSON.stringify([
          {
            id: 'local-only-note',
            title: 'Local only',
            notes: 'should disappear',
            tags: [],
            metadata: {},
            lookups: [],
            screenshots: {},
            startedAt: now,
            updatedAt: now,
          },
        ]),
      )
      localStorage.setItem('notes_active_session_id', 'local-only-note')
      localStorage.removeItem('notes_sync_key')
    }, { now })

    await page.route('**/api/notes/sessions**', async (route) => {
      const url = route.request().url()
      if (route.request().method() === 'GET' && url.includes('userId=restore-drop-local')) {
        await route.fulfill({
          json: {
            sessions: [
              {
                id: 'server-note',
                title: 'Server note',
                notes: 'from server',
                tags: [],
                metadata: {},
                lookups: [],
                screenshots: {},
                startedAt: now,
                updatedAt: now,
              },
            ],
          },
        })
        return
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { sessions: [] } })
        return
      }
      await route.fulfill({ json: { ok: true } })
    })

    await page.route('**/api/notes/glossary**', async (route) => {
      await route.fulfill({ json: route.request().method() === 'GET' ? { entries: [] } : { ok: true } })
    })
    await page.route('**/api/notes/sources**', async (route) => {
      await route.fulfill({ json: route.request().method() === 'GET' ? { sources: [] } : { ok: true } })
    })

    await page.goto('/games/notes')
    await page.getByTestId('notes-sync-toggle').click()
    await page.getByTestId('notes-restore-key-input').fill('restore-drop-local')
    await page.getByTestId('notes-restore-btn').click()

    await expect(page.getByTestId('notes-meeting-title')).toHaveValue('Server note', { timeout: 10_000 })
    const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('notes_sessions') ?? '[]'))
    expect(sessions.map((s: { id: string }) => s.id)).toEqual(['server-note'])
  })

  test('save and sync merges local and remote sessions', async ({ page }) => {
    const localTime = '2026-01-01T12:00:00.000Z'
    const remoteTime = '2026-01-02T12:00:00.000Z'
    await page.addInitScript(({ localTime, remoteTime }) => {
      localStorage.setItem(
        'notes_sessions',
        JSON.stringify([
          {
            id: 'local-merge-note',
            title: 'Local merge',
            notes: 'local body',
            tags: [],
            metadata: {},
            lookups: [],
            screenshots: {},
            startedAt: localTime,
            updatedAt: localTime,
          },
        ]),
      )
      localStorage.setItem('notes_active_session_id', 'local-merge-note')
      localStorage.setItem('notes_sync_key', 'merge-sync-key')
    }, { localTime, remoteTime })

    await page.route('**/api/notes/sessions**', async (route) => {
      const url = route.request().url()
      if (route.request().method() === 'GET' && url.includes('userId=merge-sync-key')) {
        await route.fulfill({
          json: {
            sessions: [
              {
                id: 'remote-merge-note',
                title: 'Remote merge',
                notes: 'remote body',
                tags: [],
                metadata: {},
                lookups: [],
                screenshots: {},
                startedAt: remoteTime,
                updatedAt: remoteTime,
              },
            ],
          },
        })
        return
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { sessions: [] } })
        return
      }
      if (route.request().method() === 'POST') {
        await route.fulfill({ json: { ok: true } })
        return
      }
      await route.continue()
    })

    await page.route('**/api/notes/glossary**', async (route) => {
      await route.fulfill({ json: route.request().method() === 'GET' ? { entries: [] } : { ok: true } })
    })
    await page.route('**/api/notes/sources**', async (route) => {
      await route.fulfill({ json: route.request().method() === 'GET' ? { sources: [] } : { ok: true } })
    })

    await page.goto('/games/notes')
    await page.getByTestId('notes-sync-toggle').click()
    await page.getByTestId('notes-sync-save').click()
    await expect(page.getByTestId('notes-sync-panel')).toContainText('Synced', { timeout: 10_000 })

    const ids = await page.evaluate(() => {
      const sessions = JSON.parse(localStorage.getItem('notes_sessions') ?? '[]') as { id: string }[]
      return sessions.map((s) => s.id).sort()
    })
    expect(ids).toEqual(['local-merge-note', 'remote-merge-note'])
  })
})
