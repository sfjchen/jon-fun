import { test, expect, type Page } from '@playwright/test'

import { CONNECTIONS_E2E_SLUG, installConnectionsApiMock } from './helpers/connections-mock'

/**
 * Deselects the words a wrong guess leaves selected, as in the original game.
 */
async function clearSelection(page: Page) {
  const clear = page.getByRole('button', { name: 'Deselect all' })
  if (await clear.isEnabled()) await clear.click()
}

test.describe('Connections', () => {
  test.beforeEach(({ page }) => {
    installConnectionsApiMock(page)
  })

  test('library loads seeded puzzle and opens play', async ({ page }) => {
    await page.goto('/games/connections', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByTestId('connections-library')).toBeVisible({ timeout: 25_000 })
    await expect(page.getByTestId('connections-library-loading')).not.toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /^Connections$/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'E2E Demo Puzzle' })).toBeVisible()
    await expect(page.getByTestId('connections-library-card')).toHaveCount(1)

    await page.getByRole('link', { name: 'Play', exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(`/games/connections/play/${CONNECTIONS_E2E_SLUG}`))
    await expect(page.getByTestId('connections-play-loading')).not.toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'E2E Demo Puzzle' })).toBeVisible()
    await expect(page.getByTestId('connections-board')).toBeVisible()
  })

  test('full solve shows win result', async ({ page }) => {
    await page.goto(`/games/connections/play/${CONNECTIONS_E2E_SLUG}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await expect(page.getByTestId('connections-board')).toBeVisible({ timeout: 25_000 })

    async function submitGroup(words: string[]) {
      for (const w of words) {
        await page.getByRole('button', { name: w, exact: true }).click()
      }
      await page.getByRole('button', { name: 'Submit' }).click()
    }

    await submitGroup(['Mercury', 'Venus', 'Earth', 'Mars'])
    await expect(page.getByText('Inner planets')).toBeVisible()
    await submitGroup(['King', 'Queen', 'Rook', 'Knight'])
    await expect(page.getByText('Chess pieces')).toBeVisible()
    await submitGroup(['Spring', 'Summer', 'Fall', 'Winter'])
    await expect(page.getByText('Seasons')).toBeVisible()
    await submitGroup(['North', 'South', 'East', 'West'])
    await expect(page.getByTestId('connections-result')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Perfect!' })).toBeVisible()
  })

  test('one-away wrong guess shows toast', async ({ page }) => {
    await page.goto(`/games/connections/play/${CONNECTIONS_E2E_SLUG}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await expect(page.getByTestId('connections-board')).toBeVisible({ timeout: 25_000 })

    await page.getByRole('button', { name: 'Mercury', exact: true }).click()
    await page.getByRole('button', { name: 'Venus', exact: true }).click()
    await page.getByRole('button', { name: 'Earth', exact: true }).click()
    await page.getByRole('button', { name: 'King', exact: true }).click()
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText('One away...')).toBeVisible({ timeout: 5000 })
  })

  test('repeating a wrong guess does not cost a life', async ({ page }) => {
    await page.goto(`/games/connections/play/${CONNECTIONS_E2E_SLUG}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await expect(page.getByTestId('connections-board')).toBeVisible({ timeout: 25_000 })

    for (const order of [
      ['Mercury', 'Venus', 'Earth', 'King'],
      ['King', 'Earth', 'Venus', 'Mercury'],
    ]) {
      await clearSelection(page)
      for (const w of order) await page.getByRole('button', { name: w, exact: true }).click()
      await page.getByRole('button', { name: 'Submit' }).click()
    }
    await expect(page.getByText('Already guessed!')).toBeVisible({ timeout: 5000 })
    await expect(page.getByLabel('3 mistakes remaining')).toBeVisible()
  })

  test('losing keeps the board with every group revealed', async ({ page }) => {
    await page.goto(`/games/connections/play/${CONNECTIONS_E2E_SLUG}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await expect(page.getByTestId('connections-board')).toBeVisible({ timeout: 25_000 })

    for (const fourth of ['King', 'Queen', 'Rook', 'Knight']) {
      await clearSelection(page)
      for (const w of ['Mercury', 'Venus', 'Earth', fourth])
        await page.getByRole('button', { name: w, exact: true }).click()
      await page.getByRole('button', { name: 'Submit' }).click()
    }
    await expect(page.getByTestId('connections-result')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('connections-board')).toBeVisible()
    await expect(page.getByTestId('connections-revealed-group')).toHaveCount(4)
    await expect(page.getByText('Inner planets')).toBeVisible()
    await expect(page.getByTestId('connections-revealed-group').first()).toHaveAttribute('title', 'Difficulty 1 · Easy')
    await expect(page.getByTestId('connections-revealed-group').last()).toHaveAttribute('title', 'Difficulty 4 · Hard')
  })

  test('daily puzzle loads from the library and resumes after reload', async ({ page }) => {
    await page.goto('/games/connections', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.getByTestId('connections-daily-card').click()
    await expect(page).toHaveURL(/\/games\/connections\/daily$/)
    await expect(page.getByTestId('connections-board')).toBeVisible({ timeout: 25_000 })

    const tiles = page.getByTestId('connections-board').locator('.grid button')
    await expect(tiles).toHaveCount(16)
    for (let j = 0; j < 4; j++) await tiles.nth(j).click()
    await page.getByRole('button', { name: 'Submit' }).click()
    const lives = page.getByLabel(/mistakes remaining$/)
    const left = await lives.getAttribute('aria-label')
    const solved = await page.getByTestId('connections-revealed-group').count()
    expect(left === '3 mistakes remaining' || solved === 1).toBe(true)

    await page.reload()
    await expect(page.getByTestId('connections-board')).toBeVisible({ timeout: 25_000 })
    await expect(lives).toHaveAttribute('aria-label', left ?? '')
    await expect(page.getByTestId('connections-revealed-group')).toHaveCount(solved)

    await page.getByRole('button', { name: 'Previous day' }).click()
    await expect(page).toHaveURL(/\/games\/connections\/daily\?d=\d{4}-\d{2}-\d{2}$/)
    await expect(page.getByLabel('4 mistakes remaining')).toBeVisible()
  })

  test('a lost daily game posts a 0 score for the saved player', async ({ page }) => {
    const posts: Record<string, unknown>[] = []
    await page.route('**/api/results**', (route) => {
      if (route.request().method() === 'POST') posts.push(route.request().postDataJSON() as Record<string, unknown>)
      return route.fulfill({ json: route.request().method() === 'POST' ? { ok: true } : { rows: [] } })
    })
    await page.addInitScript(() =>
      localStorage.setItem('sfjc_player', JSON.stringify({ name: 'Tester', group: 'public' })),
    )
    const { puzzle } = (await (await page.request.get('/api/daily/connections')).json()) as {
      puzzle: { groups: { words: string[] }[] }
    }
    await page.goto('/games/connections/daily', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByTestId('connections-board')).toBeVisible({ timeout: 25_000 })
    const [a, b, c, d] = puzzle.groups.map((g) => g.words)
    for (const guess of [
      [a![0], a![1], b![0], b![1]],
      [a![0], a![2], b![0], b![2]],
      [c![0], c![1], d![0], d![1]],
      [c![0], c![2], d![0], d![2]],
    ]) {
      await clearSelection(page)
      for (const w of guess) await page.getByRole('button', { name: w!, exact: true }).click()
      await page.getByRole('button', { name: 'Submit' }).click()
    }
    await expect(page.getByTestId('connections-result')).toBeVisible({ timeout: 10_000 })
    await expect.poll(() => posts[0]).toMatchObject({ name: 'Tester', group: 'public', game: 'connections', score: 0 })
  })

  test('search with no matches shows empty search state', async ({ page }) => {
    await page.goto('/games/connections', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByTestId('connections-library-card')).toHaveCount(1, { timeout: 25_000 })
    await page.getByRole('searchbox', { name: 'Search puzzles' }).fill('xyznomatch-connections')
    await expect(page.getByTestId('connections-library-no-matches')).toBeVisible()
    await expect(page.getByText('No matches')).toBeVisible()
  })

  test('new editor shows checklist', async ({ page }) => {
    await page.goto('/games/connections/new', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByRole('heading', { name: 'New puzzle' })).toBeVisible({ timeout: 25_000 })
    await expect(page.getByText('Checklist')).toBeVisible()
    await expect(page.getByText(/Yellow \/ Green \/ Blue \/ Purple each used once/)).toBeVisible()
  })
})
