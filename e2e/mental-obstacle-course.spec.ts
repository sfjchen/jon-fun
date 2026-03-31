import { test, expect } from '@playwright/test'
import { domClickTestId, mocStartFromIntro } from './helpers/moc'

/** Short timers + test selectors; see `MOC_E2E_QUERY` in `mental-obstacle-course.ts`. */
const MOC_QUICK = (path: string) =>
  `${path}${path.includes('?') ? '&' : '?'}mocE2e=1`

const isChromiumDesktop = (projectName: string) => projectName === 'chromium'
const isMobileProject = (projectName: string) => projectName === 'Mobile Chrome'

test.describe('Mental Obstacle Course', () => {
  test.describe.configure({ timeout: 90_000 })

  test('loads with title and intro', async ({ page }) => {
    await page.goto('/games/mental-obstacle-course', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByRole('heading', { name: 'Mental Obstacle Course' })).toBeVisible()
    await expect(page.getByText(/not a clinical test/i)).toBeVisible()
    await expect(page.getByTestId('moc-intro-continue')).toBeVisible()
  })

  test('theme2 route loads', async ({ page }) => {
    await page.goto('/theme2/games/mental-obstacle-course', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await expect(page).toHaveURL(/\/theme2\/games\/mental-obstacle-course/)
    await expect(page.getByRole('heading', { name: 'Mental Obstacle Course' })).toBeVisible()
  })

  test('full quick course completes with results (keyboard / desktop)', async ({ page }, testInfo) => {
    test.skip(!isChromiumDesktop(testInfo.project.name), 'Words round uses typing only on desktop Chromium')

    await page.goto(MOC_QUICK('/games/mental-obstacle-course'), {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await mocStartFromIntro(page)

    const rx = page.getByTestId('moc-reaction-tap')
    await expect(rx).toBeVisible({ timeout: 15_000 })
    /* Cold dev / CPU: green can be delayed; keep margin above worst-case quick delay. */
    for (let i = 0; i < 8; i++) {
      await expect(rx).toHaveText('Tap now!', { timeout: 20_000 })
      await rx.click()
    }

    await expect(page.getByLabel('Answer')).toBeVisible({ timeout: 8000 })
    const ans = page.getByTestId('moc-arithmetic-expected')
    for (let k = 0; k < 4; k++) {
      const v = await ans.textContent()
      if (!v) break
      await page.getByLabel('Answer').fill(v.trim())
      await page.getByRole('button', { name: 'OK' }).click()
    }

    for (let k = 0; k < 6; k++) {
      await expect(page.getByTestId('moc-logic-correct')).toBeVisible({ timeout: 15_000 })
      await domClickTestId(page, 'moc-logic-correct')
    }

    await expect(page.getByLabel('Digits')).toBeVisible({ timeout: 12_000 })
    await page.getByLabel('Digits').fill('999')
    await page.getByRole('button', { name: 'Check' }).click()

    await expect(page.getByTestId('moc-typing-phrase')).toBeVisible({ timeout: 8000 })
    const phrase = (await page.getByTestId('moc-typing-phrase').textContent())?.trim() ?? ''
    await page.getByLabel('Type phrase').fill(phrase)
    await page.getByRole('button', { name: 'Done' }).click()

    for (let k = 0; k < 6; k++) {
      await expect(page.getByTestId('moc-trivia-correct')).toBeVisible({ timeout: 10_000 })
      await domClickTestId(page, 'moc-trivia-correct')
    }

    await expect(page.getByText(/Course score:/)).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('moc-radar')).toBeVisible()
    await expect(page.getByTestId('moc-domain-speed')).toBeVisible()
    await expect(page.getByTestId('moc-run-again')).toBeVisible()
  })

  test('quick course on mobile: tap logic + word timeout + tap trivia', async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo.project.name), 'Touch-specific; uses tap() for logic/trivia')

    await page.goto(MOC_QUICK('/games/mental-obstacle-course'), {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await mocStartFromIntro(page, { tap: true })

    const rx = page.getByTestId('moc-reaction-tap')
    for (let i = 0; i < 8; i++) {
      await expect(rx).toHaveText('Tap now!', { timeout: 20_000 })
      await rx.tap()
    }

    const ans = page.getByTestId('moc-arithmetic-expected')
    for (let k = 0; k < 3; k++) {
      const v = await ans.textContent()
      if (!v) break
      await page.getByLabel('Answer').fill(v.trim())
      await page.getByRole('button', { name: 'OK' }).click()
    }

    for (let k = 0; k < 6; k++) {
      await expect(page.getByTestId('moc-logic-correct')).toBeVisible({ timeout: 15_000 })
      await domClickTestId(page, 'moc-logic-correct', { tap: true })
    }

    await expect(page.getByLabel('Digits')).toBeVisible({ timeout: 12_000 })
    await page.getByLabel('Digits').fill('999')
    await page.getByRole('button', { name: 'Check' }).click()

    await expect(page.getByText(/Tap letters in order/i)).toBeVisible({ timeout: 8000 })
    /* Word-tap order is easy to flake on emulated touch; quick mode ends this round on timer. */
    await expect(page.getByTestId('moc-trivia-correct')).toBeVisible({ timeout: 20_000 })

    for (let k = 0; k < 6; k++) {
      await expect(page.getByTestId('moc-trivia-correct')).toBeVisible({ timeout: 10_000 })
      await domClickTestId(page, 'moc-trivia-correct', { tap: true })
    }

    await expect(page.getByText(/Course score:/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('moc-radar')).toBeVisible()
  })

  test('run again returns to intro', async ({ page }, testInfo) => {
    test.skip(!isChromiumDesktop(testInfo.project.name), 'Same keyboard flow as desktop full course')

    await page.goto(MOC_QUICK('/games/mental-obstacle-course'), {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await mocStartFromIntro(page)

    const rx = page.getByTestId('moc-reaction-tap')
    for (let i = 0; i < 8; i++) {
      await expect(rx).toHaveText('Tap now!', { timeout: 20_000 })
      await rx.click()
    }

    const ans = page.getByTestId('moc-arithmetic-expected')
    for (let k = 0; k < 2; k++) {
      const v = await ans.textContent()
      if (!v) break
      await page.getByLabel('Answer').fill(v.trim())
      await page.getByRole('button', { name: 'OK' }).click()
    }

    for (let k = 0; k < 6; k++) {
      await expect(page.getByTestId('moc-logic-correct')).toBeVisible({ timeout: 15_000 })
      await domClickTestId(page, 'moc-logic-correct')
    }

    await expect(page.getByLabel('Digits')).toBeVisible({ timeout: 12_000 })
    await page.getByLabel('Digits').fill('999')
    await page.getByRole('button', { name: 'Check' }).click()

    const phrase = (await page.getByTestId('moc-typing-phrase').textContent())?.trim() ?? ''
    await page.getByLabel('Type phrase').fill(phrase)
    await page.getByRole('button', { name: 'Done' }).click()

    for (let k = 0; k < 6; k++) {
      await expect(page.getByTestId('moc-trivia-correct')).toBeVisible({ timeout: 10_000 })
      await domClickTestId(page, 'moc-trivia-correct')
    }

    await expect(page.getByTestId('moc-run-again')).toBeVisible()
    await page.getByTestId('moc-run-again').click()
    await expect(page.getByTestId('moc-intro-continue')).toBeVisible()
  })

  test('theme switch preserves mental obstacle path and query', async ({ page }) => {
    await page.goto(MOC_QUICK('/games/mental-obstacle-course'), {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await expect(page).toHaveURL(/mocE2e=1/)
    await page.getByRole('link', { name: 'Theme 2' }).click()
    await expect(page).toHaveURL(/\/theme2\/games\/mental-obstacle-course/)
    await expect(page.url()).toMatch(/mocE2e=1/)
    await expect(page.getByRole('heading', { name: 'Mental Obstacle Course' })).toBeVisible()
    await page.getByRole('link', { name: 'Main' }).click()
    await expect(page).toHaveURL(/\/games\/mental-obstacle-course/)
    await expect(page.url()).toMatch(/mocE2e=1/)
  })
})
