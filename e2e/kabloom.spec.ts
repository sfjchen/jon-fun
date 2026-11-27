/** Kabloom: the synthetic edition plays through a spent answer, a suggestion, a reload mid-climb and the summit. */

import { test, expect } from '@playwright/test'
import synthetic from '../tests/fixtures/publisher/kabloom-synthetic.json'
import { siteDay } from '../src/lib/daily'
import { mockSyncIdentity } from './helpers/sync-identity-mock'

test('climb resumes after a reload and reaches the summit', async ({ page }) => {
  test.setTimeout(90_000)
  await mockSyncIdentity(page)
  const day = siteDay()
  const { referenceRuns, ...payload } = synthetic.payload
  await page.route('**/api/results**', (r) => r.fulfill({ json: { rows: [], result: null } }))
  await page.route('**/api/daily/kabloom**', (r) =>
    r.fulfill({ json: { day, sourceDate: day, puzzle: { ...payload, date: day, editionId: synthetic.editionId } } }),
  )

  await page.goto('/games/kabloom')
  await page.getByRole('button', { name: 'Start the climb' }).click({ timeout: 25_000 })
  const answer = page.getByLabel('Your answer')
  const status = page.getByTestId('kabloom-play').getByRole('status')
  const send = async (text: string) => {
    await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled({ timeout: 5_000 })
    await answer.fill(text)
    await answer.press('Enter')
  }
  await send('oak')
  await expect(status).toHaveText('Not this one. Try again.')
  await send('coal')
  await expect(status).toHaveText('Coal clears round 1.')
  await send('coal')
  await expect(status).toHaveText('Coal is already used.')

  await page.reload()
  await expect(page.getByText('Round 2 of 7')).toBeVisible({ timeout: 25_000 })
  await send('ember')
  await expect(status).toHaveText('Ember clears round 2.')
  await send('twigg')
  await expect(status).toHaveText('Did you mean Twig? Send it again to confirm.')
  await page.getByRole('button', { name: 'Twig?' }).click()
  for (const word of referenceRuns.complete.answers.slice(3)) await send(word)
  await expect(page.getByTestId('kabloom-result')).toHaveText('7/7 cleared')
  await expect(page.getByRole('heading', { name: 'Summit!' })).toBeVisible()
})
