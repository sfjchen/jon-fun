import { expect, test } from '@playwright/test'
import { siteDay } from '../src/lib/daily'
import { mockSyncIdentity } from './helpers/sync-identity-mock'

test('the collection opens Crowdict’s dated player and links to Kabloom’s official daily and archive', async ({
  page,
}) => {
  await mockSyncIdentity(page)
  await page.route('https://crowdict.com/**', (route) => route.fulfill({ body: 'Publisher player' }))
  await page.goto('/games/daily-collection')
  await expect(page.getByRole('link', { name: 'Kabloom ↗', exact: true })).toHaveAttribute(
    'href',
    'https://kabloom.io/play/daily',
  )
  await expect(page.getByRole('link', { name: 'Archive on Kabloom ↗' })).toHaveAttribute(
    'href',
    'https://kabloom.io/archive',
  )
  await page.getByRole('link', { name: 'Noillirk', exact: true }).click()
  await expect(page.getByTitle('Crowdict daily puzzle')).toHaveAttribute('src', 'https://crowdict.com')
  await page.getByLabel('Puzzle date', { exact: true }).fill('2026-10-15')
  await page.getByRole('button', { name: 'Open edition' }).click()
  await expect(page.getByTitle('Crowdict puzzle for 2026-10-15')).toHaveAttribute(
    'src',
    'https://crowdict.com/archive/1',
  )
  await page.getByRole('link', { name: 'Today', exact: true }).click()
  await expect(page.getByTitle('Crowdict daily puzzle')).toBeVisible()
})

test('Chainle opens the first archive edition and plays its recorded rounds', async ({ page }) => {
  await mockSyncIdentity(page)
  await page.route('**/api/results**', (route) => route.fulfill({ json: { rows: [] } }))
  const day = '2026-08-20'
  const response = await page.request.get('/api/daily/chainle?d=' + day)
  expect(response.ok()).toBe(true)
  const { puzzle, sourceDate } = await response.json()
  expect(sourceDate).toBe(day)
  await page.goto('/games/chainle')
  await expect(page.getByTitle('Pick a day')).toHaveValue(siteDay())
  await page.getByRole('link', { name: 'Archive', exact: true }).click()
  await page.getByText('August 2026', { exact: true }).click()
  await page.getByRole('link', { name: day, exact: true }).click()
  for (const round of puzzle.pairs) {
    await expect(page.getByRole('heading', { name: round.anchors.join(' · '), exact: true })).toBeVisible()
    await page.getByRole('textbox', { name: 'Your word' }).fill(round.answers[0].word)
    await page.getByRole('button', { name: 'Guess', exact: true }).click()
  }
  await expect(page.getByRole('button', { name: 'Copy result', exact: true })).toBeVisible()
})
