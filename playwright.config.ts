import { defineConfig, devices } from '@playwright/test'

/** Dedicated port so E2E (End-to-End) does not fight `next dev` on :3000. Override with PLAYWRIGHT_WEB_PORT / PLAYWRIGHT_BASE_URL. */
const e2ePort = process.env.PLAYWRIGHT_WEB_PORT ?? '3001'
/** Set `PLAYWRIGHT_SKIP_WEBSERVER=1` to test against a deployed URL (no local `next dev`). */
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1'
const defaultLocalBase = `http://127.0.0.1:${e2ePort}`
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? (skipWebServer ? 'https://sfjc.dev' : defaultLocalBase)

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
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  /** Fixed-pixel viewports keep snapshot baselines deterministic; device descriptors (DPR/UA drift) cause flake. */
  projects: process.env.CI
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'visual-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
        { name: 'visual-tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 } },
        { name: 'visual-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
      ]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
        { name: 'visual-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
        { name: 'visual-tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 } },
        { name: 'visual-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
      ],
  ...(skipWebServer
    ? {}
    : {
        webServer: {
          command: `npm run dev -- -p ${e2ePort}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      }),
})
