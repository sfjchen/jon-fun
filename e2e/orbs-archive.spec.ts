/** Verifies archive browsing, random selection and separate daily and archive completions. */

import { test, expect } from '@playwright/test'
import { siteDay } from '../src/lib/daily'
import type { OrbsPuzzle } from '../src/lib/orbs'
import { mockSyncIdentity } from './helpers/sync-identity-mock'

test('a random archive round saves an archive mark and sends no ranked score', async ({ page }) => {
  await mockSyncIdentity(page)
  await page.addInitScript(() =>
    localStorage.setItem('sfjc_player', JSON.stringify({ name: 'Alice', group: 'daily-e2e' })),
  )
  const rankedPosts: string[] = []
  await page.route('**/api/results**', (route) => {
    if (route.request().method() === 'POST') rankedPosts.push(route.request().url())
    return route.fulfill({ json: { rows: [{ name: 'Alice', game: 'orbs', day: '2026-11-21', score: 0, stats: {} }] } })
  })
  await page.goto('/games/orbs/archive')
  const trivia = page.getByRole('region', { name: 'Arts & Culture', exact: true })
  await trivia.getByText('Choose a date').click()
  await expect(trivia.getByText(siteDay(), { exact: true })).toHaveCount(0)
  const finishedDaily = trivia.getByRole('listitem').filter({ hasText: '2026-11-21' })
  await expect(finishedDaily.getByRole('img', { name: 'Daily: Completed' })).toBeVisible()
  await expect(finishedDaily.getByRole('img', { name: 'Archive: Not done' })).toBeVisible()
  await page.evaluate(() => {
    Math.random = () => 0
  })
  await trivia.getByRole('button', { name: 'Random' }).click()
  await expect(page).toHaveURL(/\/archive\/play\?d=.+&c=trivia/)
  const day = new URL(page.url()).searchParams.get('d')!
  const { puzzle }: { puzzle: OrbsPuzzle } = await (await page.request.get(`/api/daily/orbs?d=${day}`)).json()
  for (const question of puzzle.categories.find((item) => item.id === 'trivia')!.questions) {
    await page.getByRole('button', { name: question.options[question.answer], exact: true }).click()
  }
  await expect(page.getByTestId('orbs-result')).toHaveText('3/3 orbs')
  await page.getByRole('link', { name: 'Back to categories' }).click()
  await expect(trivia.getByText(/^1 of \d+ rounds played$/)).toBeVisible()
  await trivia.getByText('Choose a date').click()
  const played = trivia.getByRole('listitem').filter({ hasText: day })
  await expect(played.getByRole('img', { name: 'Archive: Completed' })).toBeVisible()
  await expect(played.getByRole('img', { name: 'Daily: Not done' })).toBeVisible()
  const words = page.getByRole('region', { name: 'Wordplay', exact: true })
  await expect(words.getByText(/^0 of \d+ rounds played$/)).toBeVisible()
  await trivia.getByRole('button', { name: 'Random' }).click()
  await expect(page).toHaveURL(/\/archive\/play\?d=.+&c=trivia/)
  await expect(page).not.toHaveURL(new RegExp(`d=${day}&c=trivia`))
  expect(rankedPosts).toEqual([])

  await page.goto(`/games/orbs/archive/play?d=${siteDay()}&c=trivia`)
  await expect(page.getByRole('alert').filter({ hasText: 'Choose a category and a past date' })).toBeVisible()
})
