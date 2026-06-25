import { test, expect } from '@playwright/test'
import {
  assertNoHorizontalOverflow,
  ensureNotesPanelOpen,
  mockNotesApi,
  notesEditor,
  SESSIONS_KEY,
  waitForNotesEditor,
} from './helpers/notes-mock'

type ViewportCase = {
  name: string
  width: number
  height: number
  mobile: boolean
  panelDefaultOpen: boolean
  minEditorHeight: number
}

const VIEWPORTS: ViewportCase[] = [
  { name: 'small-mobile', width: 390, height: 844, mobile: true, panelDefaultOpen: false, minEditorHeight: 200 },
  { name: 'tablet', width: 768, height: 1024, mobile: false, panelDefaultOpen: true, minEditorHeight: 260 },
  { name: 'laptop', width: 1280, height: 800, mobile: false, panelDefaultOpen: true, minEditorHeight: 280 },
  { name: 'large-desktop', width: 1440, height: 900, mobile: false, panelDefaultOpen: true, minEditorHeight: 300 },
]

for (const vp of VIEWPORTS) {
  test.describe(`Notes viewport ${vp.name} (${vp.width}×${vp.height})`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      ...(vp.mobile ? { isMobile: true, hasTouch: true } : {}),
    })

    test.beforeEach(async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      await mockNotesApi(page)
      await page.goto('/games/notes', { waitUntil: 'load' })
      await page.evaluate((key) => {
        localStorage.removeItem(key)
        localStorage.removeItem('notes_active_session_id')
        localStorage.removeItem('notes_user_id')
        localStorage.removeItem('notes_ui_prefs')
        localStorage.removeItem('notes_glossary')
        localStorage.removeItem('notes_sources')
      }, SESSIONS_KEY)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await waitForNotesEditor(page)
    })

    test('core chrome visible without horizontal overflow', async ({ page }) => {
      await expect(page.getByTestId('notes-meeting-title')).toBeVisible()
      await expect(page.getByTestId('notes-editor-toolbar')).toBeVisible()
      await expect(page.getByTestId('notes-tag-row')).toBeVisible()
      await expect(page.getByTestId('notes-statusbar')).toBeVisible()
      await assertNoHorizontalOverflow(page)
    })

    test('editor fills available height', async ({ page }) => {
      const editorBox = await page.getByTestId('notes-editor').boundingBox()
      expect(editorBox?.height ?? 0).toBeGreaterThan(vp.minEditorHeight)
    })

    test('panel default state and vault at top when open', async ({ page }) => {
      const panel = page.getByTestId('notes-side-panel')
      if (vp.panelDefaultOpen) {
        await expect(panel).toBeVisible()
      } else {
        await expect(panel).toBeHidden()
        await page.getByTestId('notes-toggle-panel').click()
        await expect(panel).toBeVisible()
      }

      await expect(page.getByTestId('notes-vault-panel')).toBeVisible()
      await expect(page.getByTestId('notes-meetings-section')).toBeVisible()
      await expect(page.getByTestId('notes-ai-toggle')).toBeVisible()

      const vaultBox = await page.getByTestId('notes-vault-panel').boundingBox()
      const aiBox = await page.getByTestId('notes-ai-toggle').boundingBox()
      expect(vaultBox?.y ?? 0).toBeLessThan(aiBox?.y ?? Infinity)
    })

    test('toolbar-only formatting; no selection bubble menu', async ({ page }) => {
      const editor = notesEditor(page)
      await editor.click()
      await page.keyboard.type('format check')
      await page.keyboard.press('ControlOrMeta+a')
      await expect(page.getByTestId('notes-editor-toolbar')).toBeVisible()
      await expect(page.locator('.notes-bubble-menu')).toHaveCount(0)
    })

    if (vp.mobile) {
      test('mobile backdrop closes overlay panel', async ({ page }) => {
        await page.getByTestId('notes-toggle-panel').click()
        await expect(page.getByTestId('notes-side-panel')).toBeVisible()
        await expect(page.getByTestId('notes-panel-backdrop')).toBeVisible()
        await page.getByTestId('notes-panel-backdrop').click({ position: { x: 8, y: 200 } })
        await expect(page.getByTestId('notes-side-panel')).toBeHidden()
      })
    } else {
      test('desktop side-by-side layout with panel open', async ({ page }) => {
        await ensureNotesPanelOpen(page)
        const editorBox = await page.getByTestId('notes-editor').boundingBox()
        const panelBox = await page.getByTestId('notes-side-panel').boundingBox()
        expect(editorBox?.width ?? 0).toBeGreaterThan(300)
        expect(panelBox?.width ?? 0).toBeGreaterThan(200)
        expect((editorBox?.x ?? 0) + (editorBox?.width ?? 0)).toBeLessThanOrEqual((panelBox?.x ?? 0) + 2)
        await expect(page.getByTestId('notes-panel-backdrop')).toBeHidden()
      })
    }
  })
}
