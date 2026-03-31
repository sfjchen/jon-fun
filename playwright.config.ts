import { defineConfig, devices } from '@playwright/test'

/** Dedicated port so E2E (End-to-End) does not fight `next dev` on :3000. Override with PLAYWRIGHT_WEB_PORT / PLAYWRIGHT_BASE_URL. */
const e2ePort = process.env.PLAYWRIGHT_WEB_PORT ?? '3001'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${e2ePort}`

export default defineConfig({
  testDir: './e2e',
  /** Mental Obstacle Course: use `?mocE2e=1` for short timers + stable test IDs (see `MOC_E2E_QUERY`). */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /** Keep worker count low; next dev + mobile emulation can OOM/SIGKILL with many workers. Override via PLAYWRIGHT_WORKERS. */
  workers: Number(process.env.PLAYWRIGHT_WORKERS ?? '1'),
  reporter: 'html',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: process.env.CI
    ? [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
      ],
  webServer: {
    command: `npm run dev -- -p ${e2ePort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
