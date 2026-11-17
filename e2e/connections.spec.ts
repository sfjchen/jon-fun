import { test, expect } from '@playwright/test'

import {
  CONNECTIONS_E2E_SLUG,
  installConnectionsApiMock,
} from './helpers/connections-mock'

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
    await expect(page.getByRole('heading', { name: 'Nice!' })).toBeVisible()
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
    await expect(page.getByText('One away!')).toBeVisible({ timeout: 5000 })
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
      for (const w of order) await page.getByRole('button', { name: w, exact: true }).click()
      await page.getByRole('button', { name: 'Submit' }).click()
    }
    await expect(page.getByText('Already guessed!')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('3 lives left')).toBeVisible()
  })

  test('losing keeps the board with every group revealed', async ({ page }) => {
    await page.goto(`/games/connections/play/${CONNECTIONS_E2E_SLUG}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await expect(page.getByTestId('connections-board')).toBeVisible({ timeout: 25_000 })

    for (const fourth of ['King', 'Queen', 'Rook', 'Knight']) {
      for (const w of ['Mercury', 'Venus', 'Earth', fourth]) await page.getByRole('button', { name: w, exact: true }).click()
      await page.getByRole('button', { name: 'Submit' }).click()
    }
    await expect(page.getByTestId('connections-result')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('connections-board')).toBeVisible()
    await expect(page.getByTestId('connections-revealed-group')).toHaveCount(4)
    await expect(page.getByText('Inner planets')).toBeVisible()
    await expect(page.getByTestId('connections-revealed-group').first()).toContainText('1 · Easy')
    await expect(page.getByTestId('connections-revealed-group').last()).toContainText('4 · Hard')
  })

  test('daily puzzle loads from the library and resumes after reload', async ({ page }) => {
    await page.goto('/games/connections', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.getByTestId('connections-daily-card').click()
    await expect(page).toHaveURL(/\/games\/connections\/daily$/)
    await expect(page.getByTestId('connections-board')).toBeVisible({ timeout: 25_000 })
    await expect(page.getByRole('button', { name: 'Next day' })).toBeDisabled()

    const tiles = page.getByTestId('connections-board').locator('.grid button')
    await expect(tiles).toHaveCount(16)
    for (let j = 0; j < 4; j++) await tiles.nth(j).click()
    await page.getByRole('button', { name: 'Submit' }).click()
    const lives = await page.getByText(/lives? left/).textContent()
    const solved = await page.getByTestId('connections-revealed-group').count()
    expect(lives === '3 lives left' || solved === 1).toBe(true)

    await page.reload()
    await expect(page.getByTestId('connections-board')).toBeVisible({ timeout: 25_000 })
    await expect(page.getByText(/lives? left/)).toHaveText(lives ?? '')
    await expect(page.getByTestId('connections-revealed-group')).toHaveCount(solved)

    await page.getByRole('button', { name: 'Previous day' }).click()
    await expect(page).toHaveURL(/\/games\/connections\/daily\?d=\d{4}-\d{2}-\d{2}$/)
    await expect(page.getByText('4 lives left')).toBeVisible()
  })

  test('daily result goes to the Scores board with a name and shows the rank', async ({ page }) => {
    const posts: Record<string, unknown>[] = []
    await page.route('**/api/results**', async (route) => {
      const req = route.request()
      if (req.method() === 'POST') {
        posts.push(req.postDataJSON() as Record<string, unknown>)
        return route.fulfill({ json: { ok: true } })
      }
      const mine = posts.at(-1)
      const rows = [
        { name: 'Friend', game: 'connections', day: mine?.today, score: 80, stats: {} },
        ...(mine ? [{ name: mine.name, game: 'connections', day: mine.today, score: mine.score, stats: {} }] : []),
      ]
      return route.fulfill({ json: { rows } })
    })
    page.on('dialog', (d) => void d.accept())

    await page.goto('/games/connections/daily', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByTestId('connections-daily-join')).toBeVisible({ timeout: 25_000 })
    await page.getByLabel('Your name').fill('Tester')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('connections-daily-scores')).toContainText('Playing as Tester')

    await page.getByRole('button', { name: 'Give up' }).click()
    await expect(page.getByTestId('connections-daily-rank')).toHaveText(/^#2 of 2 today on the public board · score 0/)
    expect(posts[0]).toMatchObject({ name: 'Tester', group: 'public', game: 'connections', score: 0 })
  })

  test('a private group code keeps the result off the public board', async ({ page }) => {
    const posts: Record<string, unknown>[] = []
    await page.route('**/api/results**', (route) => {
      if (route.request().method() === 'POST') posts.push(route.request().postDataJSON() as Record<string, unknown>)
      return route.fulfill({ json: route.request().method() === 'POST' ? { ok: true } : { rows: [] } })
    })
    page.on('dialog', (d) => void d.accept())
    await page.goto('/games/connections/daily', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.getByLabel('Your name').fill('Tester', { timeout: 25_000 })
    await page.getByLabel('Keep my scores private').check()
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
    await page.getByLabel('Group code').fill('Our-Group')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('connections-daily-scores')).toContainText('private group our-group')
    await page.getByRole('button', { name: 'Give up' }).click()
    await expect.poll(() => posts[0]?.group).toBe('our-group')
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
