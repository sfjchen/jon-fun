/** Exercises each modern Orbs format and checks that answers stay scoped to their puzzle. */

import { expect, test } from '@playwright/test'
import { ORBS_BOARD_FIRST_DAY, type OrbsPuzzle } from '../src/lib/orbs'
import { mockSyncIdentity } from './helpers/sync-identity-mock'

test('Orbs reveals original written, matching and sorting puzzles from the chosen date', async ({ page }) => {
  await mockSyncIdentity(page)
  await page.route('**/api/results**', (route) => route.fulfill({ json: { rows: [] } }))
  const day = ORBS_BOARD_FIRST_DAY
  const { puzzle }: { puzzle: OrbsPuzzle } = await (await page.request.get(`/api/daily/orbs?d=${day}`)).json()
  const write = puzzle.categories.find((category) => category.format === 'type')!
  const match = puzzle.categories.find((category) => category.format === 'match')!
  const sort = puzzle.categories.find((category) => category.format === 'sort')!
  await page.goto(`/games/orbs/local?d=${day}`)
  const nav = page.getByRole('navigation', { name: 'Daily Orbs puzzles' })

  await nav.getByRole('link', { name: new RegExp(write.title) }).click()
  await expect(nav).toHaveCount(0)
  await expect(page).toHaveURL(/puzzle=words/)
  const writing = page.getByRole('region', { name: write.title, exact: true })
  const typed = write.questions[0]!
  await writing
    .getByRole('textbox', { name: typed.prompt, exact: true })
    .fill(typed.options[typed.answer].toUpperCase())
  await writing.getByRole('button', { name: 'Check' }).first().click()
  await expect(writing.getByText(`Correct · ${typed.options[typed.answer]}`)).toBeVisible()

  await page.getByRole('link', { name: /Back to puzzles/ }).click()
  await nav.getByRole('link', { name: new RegExp(match.title) }).click()
  const matching = page.getByRole('region', { name: match.title, exact: true })
  const paired = match.questions[0]!
  const clue = matching.getByRole('button', { name: paired.prompt, exact: true })
  const right = matching.getByRole('button', { name: paired.options[paired.answer], exact: true })
  const wrong = matching.getByRole('button', { name: paired.options[(paired.answer + 1) % 3]!, exact: true })
  await expect(matching.getByRole('img', { name: '3 of 3 lives' })).toBeVisible()
  await clue.click()
  await expect(clue).toHaveAttribute('aria-pressed', 'true')
  await wrong.click()
  await expect(matching.getByRole('img', { name: '2 of 3 lives' })).toBeVisible()
  await expect(matching.getByRole('status')).toHaveText('One life lost. Try again.')
  await right.click()
  await clue.click()
  await expect(matching.getByText(`Correct · ${paired.options[paired.answer]}`)).toBeVisible()
  await expect(right).toBeDisabled()
  await expect(matching.getByRole('img', { name: '1 of 3 orbs' })).toBeVisible()
  await page.reload()
  await expect(matching.getByRole('img', { name: '2 of 3 lives' })).toBeVisible()

  await page.getByRole('link', { name: /Back to puzzles/ }).click()
  await expect(
    nav.getByRole('link', { name: new RegExp(match.title) }).getByRole('img', { name: '2 of 3 lives' }),
  ).toBeVisible()
  await nav.getByRole('link', { name: new RegExp(sort.title) }).click()
  const sorting = page.getByRole('region', { name: sort.title, exact: true })
  const grouped = sort.questions[0]!
  await sorting
    .getByRole('group', { name: grouped.prompt, exact: true })
    .getByRole('button', { name: grouped.options[grouped.answer], exact: true })
    .click()
  await expect(sorting.getByText(`Correct · ${grouped.options[grouped.answer]}`)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Orbs progress' })).toContainText('3/12 orbs')
})
