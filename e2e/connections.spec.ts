import { test, expect } from '@playwright/test'

import {
  CONNECTIONS_E2E_SLUG,
  installConnectionsApiMock,
} from './helpers/connections-mock'

test.describe('Connections (community)', () => {
  test.beforeEach(({ page }) => {
    installConnectionsApiMock(page)
  })

  test('library loads seeded puzzle and opens play', async ({ page }) => {
    await page.goto('/games/connections', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByTestId('connections-library')).toBeVisible({ timeout: 25_000 })
    await expect(page.getByTestId('connections-library-loading')).not.toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /Connections \(community\)/i })).toBeVisible()
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
