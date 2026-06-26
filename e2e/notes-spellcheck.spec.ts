import { test, expect } from '@playwright/test'

import { mockNotesApi, notesEditor, waitForNotesEditor } from './helpers/notes-mock'

test.describe('Notes spellcheck', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await mockNotesApi(page)
    await page.goto('/games/notes', { waitUntil: 'load' })
    await waitForNotesEditor(page)
  })

  test('disables browser spellcheck on note writing surfaces', async ({ page }) => {
    await expect(notesEditor(page)).toHaveAttribute('spellcheck', 'false')
    await expect(page.getByTestId('notes-meeting-title')).toHaveAttribute('spellcheck', 'false')
    await expect(page.getByTestId('notes-tag-input')).toHaveAttribute('spellcheck', 'false')
  })
})
