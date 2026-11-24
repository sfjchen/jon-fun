import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
loadEnvConfig(process.cwd())

test('one device name survives navigation, local-storage loss, and a rename; future scores carry its ID', async ({
  page,
}) => {
  const deviceId = randomUUID(),
    name = `Device-${deviceId.slice(0, 8)}`
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const posted: Record<string, unknown>[] = []
  await page.route('**/api/results**', async (route) => {
    // The saved-run lookup shares this address prefix. It answers that no earlier result exists.
    if (new URL(route.request().url()).pathname.endsWith('/run')) return route.fulfill({ json: { result: null } })
    if (route.request().method() === 'POST') posted.push(route.request().postDataJSON())
    await route.fulfill({ json: { ok: true, rows: [] } })
  })
  try {
    await page.goto('/games/mini')
    await page.evaluate((id) => localStorage.setItem('sfjc_device_id', id), deviceId)
    await page.reload()
    await page.getByRole('button', { name: 'Add your name', exact: true }).click()
    await page.getByLabel('Your name', { exact: true }).fill(name)
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/sync/identity') &&
        r.request().method() === 'POST' &&
        r.request().postDataJSON().player?.name === name,
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    expect((await saved).ok()).toBe(true)
    await expect(page.getByTestId('device-player-name')).toContainText(name)
    for (const route of ['/games/krillion', '/games/spelling-bee', '/games/anthropeum', '/games/daily-log']) {
      await page.goto(route)
      await expect(page.getByTestId('device-player-name').first()).toContainText(name)
      expect(await page.evaluate(() => localStorage.getItem('sfjc_device_id'))).toBe(deviceId)
    }
    await page.evaluate(() => localStorage.clear())
    await page.goto('/games/connections/daily')
    await expect(page.getByTestId('device-player-name')).toContainText(name)
    expect(await page.evaluate(() => localStorage.getItem('sfjc_device_id'))).toBe(deviceId)
    await page.getByRole('button', { name: 'Edit your name', exact: true }).click()
    await page.getByLabel('Your name', { exact: true }).fill(`${name}-new`)
    const renamed = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/sync/identity') &&
        r.request().method() === 'POST' &&
        r.request().postDataJSON().player?.name === `${name}-new`,
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    expect((await renamed).ok()).toBe(true)
    await page.goto('/games/spelling-bee')
    await expect(page.getByRole('heading', { name: 'Spelling Bee', exact: true })).toBeVisible()
    const { puzzle } = await (await page.request.get('/api/daily/bee')).json()
    await page.keyboard.type(puzzle.answers[0])
    await page.keyboard.press('Enter')
    await expect.poll(() => posted.length).toBeGreaterThan(0)
    expect(posted[0]).toMatchObject({ name: `${name}-new`, deviceId, group: 'public' })
    const local = await page.evaluate(() => ({
      name: localStorage.getItem('sfjc_device_label'),
      id: localStorage.getItem('sfjc_device_id'),
    }))
    expect(local).toEqual({ name: `${name}-new`, id: deviceId })
    await page.goto('/games/poker')
    await expect(page.getByPlaceholder('Enter your name')).toHaveValue(`${name}-new`)
  } finally {
    await admin.from('sync_devices').delete().eq('device_id', deviceId)
  }
})

test('Home shares the first control row and each daily game uses its own surface on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [game, bg] of [
    ['krillion', 'rgb(7, 15, 27)'],
    ['anthropeum', 'rgb(247, 243, 234)'],
    ['connections/daily', 'rgb(255, 255, 255)'],
    ['mini', 'rgb(255, 255, 255)'],
    ['spelling-bee', 'rgb(255, 255, 255)'],
  ] as const) {
    await page.goto(`/games/${game}`)
    const home = page.getByRole('link', { name: 'Home', exact: true }),
      scores = page.getByRole('link', { name: 'Leaderboard', exact: true })
    await expect(home).toHaveCount(1)
    // React swaps streamed header content into place right after it first shows, so a box read can briefly come
    // back empty. Polls until both links have boxes, then checks they share a row with Home first.
    await expect
      .poll(async () => {
        const a = await home.boundingBox(),
          b = await scores.boundingBox()
        return a && b ? Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)) < 3 && a.x < b.x : null
      })
      .toBe(true)
    await expect(page.locator('[data-game-theme]').first()).toHaveCSS('background-color', bg)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  }
})
