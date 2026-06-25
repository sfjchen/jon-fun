import { test, expect } from '@playwright/test'
import {
  createPokerRoom,
  joinPokerRoom,
  expectPotAmount,
  pokerModeTab,
  startPokerGame,
  waitForPokerTable,
} from './helpers/poker-flow'

test.describe('Texas Hold\'em', () => {
  test('lobby shows Create Room and Join Room tabs', async ({ page }) => {
    await page.goto('/games/poker')
    await expect(page.getByRole('heading', { name: /Texas Hold'em/i })).toBeVisible()
    await expect(pokerModeTab(page, 'create')).toBeVisible()
    await expect(pokerModeTab(page, 'join')).toBeVisible()
  })

  test('Create Room form has required fields', async ({ page }) => {
    await page.goto('/games/poker')
    await expect(page.locator('#poker-host-name')).toBeVisible()
    await expect(page.getByRole('spinbutton').first()).toBeVisible()
  })

  test('Join Room requires 4-digit PIN', async ({ page }) => {
    await page.goto('/games/poker')
    await pokerModeTab(page, 'join').click()
    const pinInput = page.locator('#poker-join-pin').or(page.getByPlaceholder('0000')).first()
    await expect(pinInput).toBeVisible()
    await pinInput.fill('12')
    await expect(page.getByRole('button', { name: 'Continue to Select Seat' })).toBeDisabled()
    await pinInput.fill('1234')
    await expect(page.getByRole('button', { name: 'Continue to Select Seat' })).toBeEnabled()
  })

  test('Create Room form submits (requires Supabase)', async ({ page }) => {
    await page.goto('/games/poker')
    const nameInput = page.locator('#poker-host-name')
    await nameInput.click()
    await nameInput.pressSequentially('E2E Host', { delay: 20 })
    const submit = page.locator('form button[type="submit"]')
    await expect(submit).toBeEnabled()
    await submit.click()
    try {
      await page.waitForURL(/\/lobby\//, { timeout: 25_000 })
    } catch {
      await expect(
        page.getByText(/Failed|error|invalid|Unauthorized|could not|Network|Something went wrong/i).first(),
      ).toBeVisible({ timeout: 10_000 })
    }
  })
})

test.describe('Texas Hold\'em multiplayer (Supabase)', () => {
  test('guest appears in host lobby via realtime sync', async ({ browser }) => {
    const tag = Date.now()
    const hostName = `Host${tag}`
    const guestName = `Guest${tag}`

    const hostCtx = await browser.newContext()
    const guestCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    const guestPage = await guestCtx.newPage()

    try {
      const pin = await createPokerRoom(hostPage, hostName)
      await joinPokerRoom(guestPage, pin, guestName)

      await expect(hostPage.getByText(guestName)).toBeVisible({ timeout: 20_000 })
      await expect(guestPage.getByText(hostName)).toBeVisible()
      await expect(hostPage.getByText('Players (2/12)')).toBeVisible()
    } finally {
      await hostCtx.close()
      await guestCtx.close()
    }
  })

  test('host starts game and chip/pot state syncs between players', async ({ browser }) => {
    const tag = Date.now()
    const hostName = `Host${tag}`
    const guestName = `Guest${tag}`

    const hostCtx = await browser.newContext()
    const guestCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    const guestPage = await guestCtx.newPage()

    try {
      const pin = await createPokerRoom(hostPage, hostName)
      await joinPokerRoom(guestPage, pin, guestName)

      await startPokerGame(hostPage)
      await waitForPokerTable(guestPage)

      // 2-player heads-up: big blind posted → pot $10
      await expectPotAmount(hostPage, 10)
      await expectPotAmount(guestPage, 10)

      // Starting stacks: 100 BB = $1000; host (BB) has $990, guest has $1000
      await expect(hostPage.getByText('$990')).toBeVisible({ timeout: 15_000 })
      await expect(guestPage.getByText('$1,000')).toBeVisible({ timeout: 15_000 })

      // Guest acts first (seat 1); host waits
      await expect(guestPage.getByText('Your Turn')).toBeVisible({ timeout: 15_000 })
      await expect(hostPage.getByText('Waiting for other players')).toBeVisible()
      await expect(guestPage.getByRole('button', { name: /Call \$10/ })).toBeVisible()

      await guestPage.getByRole('button', { name: /Call \$10/ }).click()

      // Pot doubles after call; turn passes to host (big blind)
      await expectPotAmount(hostPage, 20)
      await expectPotAmount(guestPage, 20)
      await expect(hostPage.getByText('Your Turn')).toBeVisible({ timeout: 20_000 })
      await expect(hostPage.getByRole('button', { name: 'Check' })).toBeVisible()
    } finally {
      await hostCtx.close()
      await guestCtx.close()
    }
  })

  test('bet action syncs pot across clients', async ({ browser }) => {
    const tag = Date.now()
    const hostName = `Host${tag}`
    const guestName = `Guest${tag}`

    const hostCtx = await browser.newContext()
    const guestCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    const guestPage = await guestCtx.newPage()

    try {
      const pin = await createPokerRoom(hostPage, hostName)
      await joinPokerRoom(guestPage, pin, guestName)
      await startPokerGame(hostPage)
      await waitForPokerTable(guestPage)

      await expect(guestPage.getByText('Your Turn')).toBeVisible({ timeout: 15_000 })
      await guestPage.getByRole('button', { name: /Call \$10/ }).click()
      await expect(hostPage.getByText('Your Turn')).toBeVisible({ timeout: 20_000 })

      // Heads-up after call: host can bet (callAmount === 0, no Raise button)
      await hostPage.getByRole('button', { name: /Bet \$10/ }).click()

      // Pot: $10 BB + $10 call + $10 bet = $30
      await expectPotAmount(hostPage, 30)
      await expectPotAmount(guestPage, 30)

      await expect(guestPage.getByText('Your Turn')).toBeVisible({ timeout: 20_000 })
      await expect(guestPage.getByRole('button', { name: /Call \$|Check/ })).toBeVisible()
    } finally {
      await hostCtx.close()
      await guestCtx.close()
    }
  })
})
