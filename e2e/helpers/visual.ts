/**
 * Visual-regression + accessibility helpers for theme2 stress tests.
 *
 * `gotoStable` deflakes screenshots by:
 *  - waiting for networkidle + DOM ready
 *  - killing animations/transitions/caret blink
 *  - awaiting font load (document.fonts.ready) — Patrick Hand / Charter swap is the #1 flake source here
 */
import { expect, type Page, type Locator } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * CSS injected into every snapshotted page to remove the top sources of pixel flake:
 *  - CSS animations + transitions + scroll behavior (mid-frame captures)
 *  - Blinking text caret
 *  - Next.js dev-tools indicator overlay (only visible in `next dev`, hidden in production builds —
 *    but visual tests run under dev, so it would otherwise vary between runs)
 */
const STABILIZE_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
}
html, body { scroll-behavior: auto !important; }
[data-nextjs-toast], [data-nextjs-dialog-overlay], [data-nextjs-dev-tools-button], nextjs-portal { display: none !important; }
`

type FontFaceSet = { ready: Promise<unknown>; check?: (font: string) => boolean }

/**
 * Theme2 imports `Patrick Hand`, `Charter`, `Lora`, `Caveat` via Google Fonts CSS `@import` with
 * `display=swap` — fallback cursive renders first, real font swaps in later, causing layout-shift
 * flake on snapshots. We explicitly poll `document.fonts.check` for each.
 */
const REQUIRED_FONTS = ['1em "Patrick Hand"', '1em "Lora"', '1em "Charter"', '1em "Caveat"']

/**
 * Robust page-ready helper for visual snapshots. Flake sources we explicitly fight:
 *  1. Late-loaded webfonts re-laying out text → wait for `document.fonts.ready` PLUS explicit
 *     `fonts.check()` per family. Some Google fonts arrive after the initial `fonts.ready` resolves
 *     because the @import CSS itself loads lazily.
 *  2. Mid-animation captures → CSS overrides force `0s` durations.
 *  3. Next.js dev-tools indicator inconsistency → CSS hide + next.config `devIndicators: false`
 *     when `PLAYWRIGHT_HIDE_NEXT_INDICATOR=1` (set by playwright.config webServer env).
 */
export async function gotoStable(page: Page, url: string, opts: { waitFor?: string } = {}) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({ content: STABILIZE_CSS })
  await page.waitForLoadState('networkidle').catch(() => undefined)
  if (opts.waitFor) await page.waitForSelector(opts.waitFor, { state: 'visible' }).catch(() => undefined)
  /** Wait for fonts.ready (covers `next/font`) AND poll for Google `display=swap` arrivals. */
  await page.evaluate(async (required: string[]) => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (!fonts) return
    await fonts.ready
    if (!fonts.check) return
    const deadline = Date.now() + 5_000
    while (Date.now() < deadline) {
      if (required.every((f) => fonts.check!(f))) return
      await new Promise((r) => setTimeout(r, 50))
    }
  }, REQUIRED_FONTS)
  /** Two animation frames after fonts ready — first frame may still be mid-layout. */
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
}

export async function snap(
  page: Page,
  name: string,
  opts: { mask?: Locator[]; fullPage?: boolean } = {},
) {
  const screenshotOpts: {
    fullPage: boolean
    animations: 'disabled'
    caret: 'hide'
    mask?: Locator[]
  } = {
    fullPage: opts.fullPage ?? true,
    animations: 'disabled',
    caret: 'hide',
  }
  if (opts.mask) screenshotOpts.mask = opts.mask
  await expect(page).toHaveScreenshot(name, screenshotOpts)
}

/**
 * Run axe-core against the current page and surface only color-contrast failures.
 * Other a11y rules would generate noise across an existing codebase; we narrow to the visual bug class we care about.
 */
export async function assertNoLowContrast(page: Page) {
  const results = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze()
  if (results.violations.length === 0) return
  const summary = results.violations
    .flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} — ${n.failureSummary?.split('\n')[0] ?? ''}`))
    .join('\n')
  throw new Error(`Color-contrast violations on ${page.url()}:\n${summary}`)
}
