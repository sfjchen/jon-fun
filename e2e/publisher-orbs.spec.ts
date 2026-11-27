import { expect, test } from '@playwright/test'
import { siteDay } from '../src/lib/daily'
import { mockSyncIdentity } from './helpers/sync-identity-mock'

const archive = '2026-04-17'
const base = { id: 'example', description: 'Choose the published answer.', starThresholds: [1, 2, 3] }

test('plays exact-date publisher puzzles and restores progress without posting a ranked result', async ({ page }) => {
  await mockSyncIdentity(page)
  const requested: string[] = []
  const rankedPosts: string[] = []
  await page.route('**/api/results**', (route) => {
    if (route.request().method() === 'POST') rankedPosts.push(route.request().url())
    return route.fulfill({ json: { rows: [] } })
  })
  await page.route('**/api/orbs/publisher?**', (route) => {
    const params = new URL(route.request().url()).searchParams
    const day = params.get('d')
    expect(params.get('play')).toBe('1')
    requested.push(day!)
    return route.fulfill({
      json: {
        day,
        playable: {
          orange: {
            ...base,
            type: 'bijection',
            title: day === archive ? 'Archive matches' : 'Today’s matches',
            pairs: [
              { id: 'a', itemA: 'Maple', itemB: 'Tree' },
              { id: 'b', itemA: 'Quartz', itemB: 'Mineral' },
            ],
          },
          green: {
            ...base,
            type: 'categorization',
            title: 'Sorting round',
            categories: ['Liquid', 'Solid'],
            items: [{ id: 's', text: 'Ice', category: 'Solid' }],
          },
          blue: {
            ...base,
            type: 'themed',
            title: 'Written clue',
            clues: [{ id: 'w', hint: 'South American capital', answers: ['Bogotá'] }],
          },
          purple: { ...base, type: 'long-list', title: 'Word list', answers: ['apple', 'pear', 'peach', 'mango'] },
        },
      },
    })
  })
  await page.goto('/games/orbs')
  await expect(page.getByRole('link', { name: /Today’s matches/ })).toBeVisible()
  expect(requested).toContain(siteDay())
  await page.getByRole('link', { name: 'Archive', exact: true }).click()
  await page.getByLabel('Publisher’s archive').fill(archive)
  await page.getByRole('button', { name: 'Play publisher edition' }).click()
  await page.getByRole('link', { name: /Archive matches/ }).click()
  expect(requested).toContain(archive)
  await page.getByRole('button', { name: 'Maple', exact: true }).click()
  await page.getByRole('button', { name: 'Mineral', exact: true }).click()
  await expect(page.getByRole('img', { name: '2 of 3 lives' })).toBeVisible()
  await page.getByRole('button', { name: 'Maple', exact: true }).click()
  await page.getByRole('button', { name: 'Tree', exact: true }).click()
  await expect(page.getByRole('img', { name: '1 of 3 orbs' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Maple — Tree')).toBeVisible()
  await expect(page.getByRole('img', { name: '2 of 3 lives' })).toBeVisible()

  await page.getByRole('link', { name: /All four puzzles/ }).click()
  await page.getByRole('link', { name: /Sorting round/ }).click()
  await page.getByRole('button', { name: 'Ice' }).click()
  await page.getByRole('button', { name: 'Solid' }).click()
  await expect(page.getByRole('status')).toHaveText('Round complete · 1 correct')

  await page.getByRole('link', { name: /All four puzzles/ }).click()
  await page.getByRole('link', { name: /Written clue/ }).click()
  await expect(page.getByText('South American capital')).toBeVisible()
  await page.getByRole('textbox', { name: 'Answer' }).fill('Bogota')
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Round complete · 1 correct')

  await page.getByRole('link', { name: /All four puzzles/ }).click()
  await page.getByRole('link', { name: /Word list/ }).click()
  await expect(page.getByRole('img', { name: /lives/ })).toHaveCount(0)
  for (const answer of ['plum', 'apple', 'pear', 'peach']) {
    await page.getByRole('textbox', { name: 'Answer' }).fill(answer)
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
  }
  await expect(page.getByRole('status')).toHaveText('Round complete · 3 correct')
  expect(rankedPosts).toEqual([])
})
