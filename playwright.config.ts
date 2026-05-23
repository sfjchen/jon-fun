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
  /**
   * Visual suite runs ~60 next-dev compilations per viewport-project — at viewport count >1 the
   * dev server can intermittently hiccup. One automatic retry locally absorbs that without
   * masking real regressions. CI keeps 2 retries (existing convention).
   */
  retries: process.env.CI ? 2 : 1,
  /** Keep worker count low; next dev + mobile emulation can OOM/SIGKILL with many workers. Override via PLAYWRIGHT_WORKERS. */
  workers: Number(process.env.PLAYWRIGHT_WORKERS ?? '1'),
  reporter: 'html',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
    /**
     * `maxDiffPixelRatio: 0.05` (5%) is the pragmatic middle-ground for theme2: the cream-paper
     * UI uses Google Fonts (Patrick Hand cursive) via `@import` with `display=swap`, so per-run
     * font-load timing causes 3-5px baseline shifts on body text. Real bugs (invisible text,
     * broken layouts, color regressions) change >5% of pixels, so this still catches them while
     * tolerating the residual cursive-font variance in `next dev`. Tighten if/when fonts are
     * preloaded or migrated to `next/font/google`.
     */
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
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
  /**
   * Fixed-pixel viewports keep snapshot baselines deterministic; device descriptors (DPR/UA drift)
   * cause flake. theme2 visual specs are restricted to `visual-*` projects via `testMatch` so the
   * default `chromium` / `Mobile Chrome` projects (no `*-chromium-darwin` baselines) don't run them.
   */
  projects: process.env.CI
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /theme2-(visual|connections-states|modals)\.spec\.ts$/ },
        { name: 'visual-desktop', testMatch: /theme2-(visual|connections-states|modals)\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
        { name: 'visual-tablet', testMatch: /theme2-(visual|connections-states|modals)\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 } },
        { name: 'visual-mobile', testMatch: /theme2-(visual|connections-states|modals)\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
      ]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /theme2-(visual|connections-states|modals)\.spec\.ts$/ },
        { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] }, testIgnore: /theme2-(visual|connections-states|modals)\.spec\.ts$/ },
        { name: 'visual-desktop', testMatch: /theme2-(visual|connections-states|modals)\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
        { name: 'visual-tablet', testMatch: /theme2-(visual|connections-states|modals)\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 } },
        { name: 'visual-mobile', testMatch: /theme2-(visual|connections-states|modals)\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
      ],
  ...(skipWebServer
    ? {}
    : {
        webServer: {
          command: `npm run dev -- -p ${e2ePort}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          /** Cold start of `next dev` after `.next` cache eviction can take 4+ minutes. */
          timeout: 300_000,
          stdout: 'pipe',
          stderr: 'pipe',
          /** Hide Next.js dev tools indicator so visual-regression snapshots don't flake on it. */
          env: { PLAYWRIGHT_HIDE_NEXT_INDICATOR: '1' },
        },
      }),
})
