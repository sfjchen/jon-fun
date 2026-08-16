import { test, expect, type Page } from '@playwright/test'

async function openNewBoardEditor(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('jeopardy:editor-name', 'E2E')
    localStorage.setItem('jeopardy:editor-id', 'e2e-test-id')
    localStorage.setItem('jeopardy:editor-color', '#3b82f6')
  })
  await page.goto('/games/jeopardy')
  await page.getByRole('button', { name: 'Create New Game' }).click()
}

test.describe('Jeopardy', () => {
  test('menu shows Create New Game and upload options', async ({ page }) => {
    await page.goto('/games/jeopardy')
    await expect(page.getByRole('heading', { name: /Jeopardy with Friends/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create New Game' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Upload JSON/i })).toBeVisible()
  })

  test('POST /api/jeopardy/boards creates a board', async ({ request }) => {
    const res = await request.post('/api/jeopardy/boards', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.slug).toMatch(/^[a-z0-9-]+$/)
    expect(body.board?.categories?.length).toBeGreaterThan(0)
  })

  test('Create New Game opens editor', async ({ page }) => {
    await openNewBoardEditor(page)
    await expect(page.getByText(/Category|Question|Answer|Back/i).first()).toBeVisible({ timeout: 3000 })
  })

  test('editor back returns to menu', async ({ page }) => {
    await openNewBoardEditor(page)
    await page.getByRole('button', { name: '← Back' }).click()
    await expect(page.getByRole('button', { name: 'Create New Game' })).toBeVisible()
  })
})
