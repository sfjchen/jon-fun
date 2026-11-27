/** Verifies archive browsing, random selection and separate daily and archive completions. */

import { test, expect } from '@playwright/test'
import { siteDay } from '../src/lib/daily'
import { ORBS_FIRST_DAY, type OrbsPuzzle } from '../src/lib/orbs'
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
  await page.getByRole('link', { name: 'Back to archive' }).click()
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
  await expect(page.getByRole('alert').filter({ hasText: 'Choose a past date' })).toBeVisible()
})

test('Orbs archives reopen the full dated edition with the same puzzles and independent progress', async ({ page }) => {
  await mockSyncIdentity(page)
  const rankedPosts: string[] = []
  await page.route('**/api/results**', (route) => {
    if (route.request().method() === 'POST') rankedPosts.push(route.request().url())
    return route.fulfill({ json: { rows: [] } })
  })
  const day = ORBS_FIRST_DAY
  const { puzzle }: { puzzle: OrbsPuzzle } = await (await page.request.get(`/api/daily/orbs?d=${day}`)).json()
  const first = puzzle.categories[0]!
  const editionNav = page.getByRole('navigation', { name: 'Daily Orbs puzzles' })
  const firstQuestion = first.questions[0]!
  await page.goto(`/games/orbs/local?d=${day}`)
  await expect(editionNav.getByRole('link')).toHaveCount(4)
  const dailyTitles = await editionNav.getByRole('link').allTextContents()
  await editionNav.getByRole('link', { name: new RegExp(first.title) }).click()
  const dailyClues = await page
    .getByRole('region', { name: first.title, exact: true })
    .getByRole('heading', { level: 3 })
    .allTextContents()

  await page.goto('/games/orbs/archive')
  await page.getByText('Browse complete local editions').click()
  await page.getByRole('link', { name: day, exact: true }).click()
  await expect(editionNav.getByRole('link')).toHaveCount(4)
  expect(await editionNav.getByRole('link').allTextContents()).toEqual(dailyTitles)
  await editionNav.getByRole('link', { name: new RegExp(first.title) }).click()
  const board = page.getByRole('region', { name: first.title, exact: true })
  expect(await board.getByRole('heading', { level: 3 }).allTextContents()).toEqual(dailyClues)
  await expect(page.getByRole('link', { name: /Publisher’s edition/ })).toHaveAttribute(
    'href',
    `https://dailyorbs.com/${day}`,
  )
  await board
    .getByRole('group', { name: firstQuestion.prompt, exact: true })
    .getByRole('button', { name: firstQuestion.options[firstQuestion.answer], exact: true })
    .click()
  await page.reload()
  await expect(board.getByText(`Correct · ${firstQuestion.options[firstQuestion.answer]}`)).toBeVisible()
  await page.goto(`/games/orbs/archive/play?d=${day}&c=${first.id}`)
  await expect(board.getByText(`Correct · ${firstQuestion.options[firstQuestion.answer]}`)).toBeVisible()
  await page.goto(`/games/orbs/local?d=${day}`)
  await expect(page.getByRole('region', { name: 'Orbs progress' })).toContainText('0/12 orbs')
  expect(rankedPosts).toEqual([])
})
