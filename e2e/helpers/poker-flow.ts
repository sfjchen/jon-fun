import { expect, type Page } from '@playwright/test'

export function lobbyPinFromUrl(url: string): string {
  const m = url.match(/\/lobby\/(\d{4})/)
  if (!m?.[1]) throw new Error(`No lobby PIN in URL: ${url}`)
  return m[1]
}

/** Mode tabs on `/games/poker` (Create Room | Join Room). */
export function pokerModeTab(page: Page, mode: 'create' | 'join') {
  const label = mode === 'create' ? 'Create Room' : 'Join Room'
  return page.locator('.flex.gap-4.mb-6 button').filter({ hasText: label })
}

function hostNameInput(page: Page) {
  return page.locator('#poker-host-name').or(page.getByPlaceholder('Enter your name')).first()
}

function joinPinInput(page: Page) {
  return page.locator('#poker-join-pin').or(page.getByPlaceholder('0000')).first()
}

async function fillReactInput(input: ReturnType<Page['locator']>, value: string): Promise<void> {
  await input.click()
  await input.fill('')
  await input.pressSequentially(value, { delay: 20 })
  await expect(input).toHaveValue(value)
}

async function switchPokerMode(page: Page, mode: 'create' | 'join'): Promise<void> {
  await pokerModeTab(page, mode).click()
  if (mode === 'join') {
    await expect(joinPinInput(page)).toBeVisible({ timeout: 10_000 })
  } else {
    await expect(hostNameInput(page)).toBeVisible({ timeout: 10_000 })
  }
}

export async function createPokerRoom(page: Page, hostName: string): Promise<string> {
  await page.goto('/games/poker')
  await expect(page.getByRole('heading', { name: /Texas Hold'em/i })).toBeVisible()
  await switchPokerMode(page, 'create')
  await fillReactInput(hostNameInput(page), hostName)
  const submit = page.locator('form button[type="submit"]')
  await expect(submit).toBeEnabled({ timeout: 10_000 })
  await submit.click()
  await page.waitForURL(/\/lobby\//, { timeout: 25_000 })
  return lobbyPinFromUrl(page.url())
}

export async function joinPokerRoom(page: Page, pin: string, guestName: string): Promise<void> {
  await page.goto('/games/poker')
  await expect(page.getByRole('heading', { name: /Texas Hold'em/i })).toBeVisible()
  await switchPokerMode(page, 'join')
  const pinInput = joinPinInput(page)
  await fillReactInput(pinInput, pin)
  await page.getByRole('button', { name: 'Continue to Select Seat' }).click()
  const nameInput = page.locator('form').getByPlaceholder('Enter your name')
  await fillReactInput(nameInput, guestName)
  const submit = page.locator('form button[type="submit"]')
  await expect(submit).toBeEnabled({ timeout: 10_000 })
  await submit.click()
  await page.waitForURL(/\/lobby\//, { timeout: 25_000 })
}

export async function startPokerGame(hostPage: Page): Promise<void> {
  await expect(hostPage.getByRole('button', { name: 'Start Game' })).toBeEnabled({ timeout: 20_000 })
  await hostPage.getByRole('button', { name: 'Start Game' }).click()
  await hostPage.waitForURL(/\/table\//, { timeout: 25_000 })
}

export async function waitForPokerTable(page: Page): Promise<void> {
  await page.waitForURL(/\/table\//, { timeout: 25_000 })
  await expect(potLocator(page)).toBeVisible({ timeout: 20_000 })
  await expect(potLocator(page)).toContainText(/\$\d/, { timeout: 20_000 })
}

/** Pot display container on the felt table (label + chip amount). */
export function potLocator(page: Page) {
  return page.locator('.border-yellow-400').filter({ has: page.getByText('Pot', { exact: true }) })
}

export async function setBetAmount(page: Page, amount: number): Promise<void> {
  const input = page.locator('input[type="number"]').first()
  await expect(input).toBeVisible({ timeout: 20_000 })
  await input.click()
  await input.selectText()
  await input.pressSequentially(String(amount), { delay: 30 })
  await expect(input).toHaveValue(String(amount))
}

export async function expectPotAmount(page: Page, amount: number, timeout = 20_000): Promise<void> {
  const label = amount === 1 ? '$1' : `$${amount.toLocaleString()}`
  await expect(potLocator(page)).toContainText(label, { timeout })
}
