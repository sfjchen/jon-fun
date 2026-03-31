import { test, expect } from '@playwright/test'

/** After Create / Join: room PIN visible, or `party-error` (Supabase missing tables, network, etc.). */
async function expectPartyRoomOrError(page: import('@playwright/test').Page) {
  const pin = page.getByTestId('party-room-pin')
  const err = page.getByTestId('party-error').first()
  await expect
    .poll(
      async () => {
        if (await pin.isVisible().catch(() => false)) return true
        if (await err.isVisible().catch(() => false)) return true
        return false
      },
      { timeout: 50_000 },
    )
    .toBeTruthy()
}

/** Party lobby lives in the first `aside` — scope buttons so we never click a duplicate role elsewhere on the page. */
function partyLobby(page: import('@playwright/test').Page) {
  return page.locator('aside').first()
}

async function pressPartyLobbyButton(
  page: import('@playwright/test').Page,
  label: string,
  mobile: boolean,
) {
  const btn = partyLobby(page).getByRole('button', { name: label })
  await expect(btn).toBeEnabled({ timeout: 25_000 })
  if (mobile) await btn.tap()
  else await btn.click()
}

async function waitPartyLobbyReady(page: import('@playwright/test').Page, createLabel: string) {
  await expect(partyLobby(page).getByRole('button', { name: createLabel })).toBeEnabled({ timeout: 25_000 })
}

const PARTY_GAMES = [
  {
    path: '/games/quip-clash',
    theme2Path: '/theme2/games/quip-clash',
    heading: /Quip Clash/i,
    createLabel: 'Create room',
  },
  {
    path: '/games/fib-it',
    theme2Path: '/theme2/games/fib-it',
    heading: /Fib It/i,
    createLabel: 'Create',
  },
  {
    path: '/games/enough-about-you',
    theme2Path: '/theme2/games/enough-about-you',
    heading: /Enough About You/i,
    createLabel: 'Create',
  },
] as const

test.describe('Party games (Quip Clash, Fib It, Enough About You)', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  for (const g of PARTY_GAMES) {
    test(`${g.path} loads lobby UI`, async ({ page }) => {
      await page.goto(g.path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: g.heading })).toBeVisible()
      await expect(page.getByPlaceholder(/name/i).first()).toBeVisible()
      await expect(page.getByPlaceholder('PIN')).toBeVisible()
      await expect(partyLobby(page).getByRole('button', { name: 'Join' })).toBeVisible()
      await expect(partyLobby(page).getByRole('button', { name: g.createLabel })).toBeVisible()
    })

    test(`${g.theme2Path} loads`, async ({ page }) => {
      await page.goto(g.theme2Path, { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(new RegExp(g.theme2Path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      await expect(page.getByRole('heading', { name: g.heading })).toBeVisible()
    })
  }

  test('Quip Clash: create room (Supabase) or error', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === 'Mobile Chrome'
    await page.goto('/games/quip-clash', { waitUntil: 'domcontentloaded' })
    await waitPartyLobbyReady(page, 'Create room')
    await page.getByPlaceholder('Your name').fill('E2E Quip Host')
    await pressPartyLobbyButton(page, 'Create room', mobile)
    await expectPartyRoomOrError(page)
  })

  test('Fib It: create room (Supabase) or error', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === 'Mobile Chrome'
    await page.goto('/games/fib-it', { waitUntil: 'domcontentloaded' })
    await waitPartyLobbyReady(page, 'Create')
    await page.getByPlaceholder('Name').fill('E2E Fib Host')
    await pressPartyLobbyButton(page, 'Create', mobile)
    await expectPartyRoomOrError(page)
  })

  test('Enough About You: create room (Supabase) or error', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === 'Mobile Chrome'
    await page.goto('/games/enough-about-you', { waitUntil: 'domcontentloaded' })
    await waitPartyLobbyReady(page, 'Create')
    await page.getByPlaceholder('Name').fill('E2E EAY Host')
    await pressPartyLobbyButton(page, 'Create', mobile)
    await expectPartyRoomOrError(page)
  })

  test('Fib It: invalid PIN join shows party-error', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === 'Mobile Chrome'
    await page.goto('/games/fib-it', { waitUntil: 'domcontentloaded' })
    await waitPartyLobbyReady(page, 'Create')
    await page.getByPlaceholder('Name').fill('E2E Joiner')
    await page.getByPlaceholder('PIN').fill('9999')
    await pressPartyLobbyButton(page, 'Join', mobile)
    await expect(page.getByTestId('party-error').first()).toBeVisible({ timeout: 25_000 })
  })

  test('theme switch preserves Quip Clash path', async ({ page }) => {
    await page.goto('/games/quip-clash', { waitUntil: 'domcontentloaded' })
    await page.getByRole('link', { name: 'Theme 2' }).click()
    await expect(page).toHaveURL(/\/theme2\/games\/quip-clash/)
    await expect(page.getByRole('heading', { name: /Quip Clash/i })).toBeVisible()
    await page.getByRole('link', { name: 'Main' }).click()
    await expect(page).toHaveURL(/\/games\/quip-clash/)
  })

  test('← Home from Fib It', async ({ page }) => {
    await page.goto('/games/fib-it', { waitUntil: 'domcontentloaded' })
    await waitPartyLobbyReady(page, 'Create')
    const homeLink = page.getByRole('link', { name: '← Home' })
    await expect(homeLink).toBeVisible()
    await Promise.all([
      page.waitForURL((url) => new URL(url).pathname === '/', { timeout: 25_000 }),
      homeLink.click(),
    ])
    await expect(page.getByRole('link', { name: /TMR System/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Fib It/i }).first()).toBeVisible()
  })
})
