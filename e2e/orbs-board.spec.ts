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
  await page.goto(`/games/orbs?d=${day}`)
  const nav = page.getByRole('navigation', { name: 'Daily Orbs puzzles' })

  await nav.getByRole('button', { name: new RegExp(write.title) }).click()
  const writing = page.getByRole('region', { name: write.title, exact: true })
  const typed = write.questions[0]!
  await writing
    .getByRole('textbox', { name: typed.prompt, exact: true })
    .fill(typed.options[typed.answer].toUpperCase())
  await writing.getByRole('button', { name: 'Check' }).first().click()
  await expect(writing.getByText(`Correct · ${typed.options[typed.answer]}`)).toBeVisible()

  await nav.getByRole('button', { name: new RegExp(match.title) }).click()
  const matching = page.getByRole('region', { name: match.title, exact: true })
  const paired = match.questions[0]!
  await matching.getByRole('combobox', { name: paired.prompt, exact: true }).selectOption(String(paired.answer))
  await matching.getByRole('button', { name: 'Match', exact: true }).first().click()
  await expect(matching.getByText(`Correct · ${paired.options[paired.answer]}`)).toBeVisible()
  await expect(matching.getByRole('combobox').first().locator(`option[value="${paired.answer}"]`)).toBeDisabled()

  await nav.getByRole('button', { name: new RegExp(sort.title) }).click()
  const sorting = page.getByRole('region', { name: sort.title, exact: true })
  const grouped = sort.questions[0]!
  await sorting
    .getByRole('group', { name: grouped.prompt, exact: true })
    .getByRole('button', { name: grouped.options[grouped.answer], exact: true })
    .click()
  await expect(sorting.getByText(`Correct · ${grouped.options[grouped.answer]}`)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Orbs progress' })).toContainText('3/12 orbs')
})
