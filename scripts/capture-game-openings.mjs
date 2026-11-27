// Desktop and mobile references for private comparison against the original games.
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
const sources = {
  kabloom: 'https://kabloom.io/play/daily',
  orbs: 'https://dailyorbs.com',
  chainle: 'https://chainle.io',
  headcount: 'https://headcountgame.com',
  crowdict: 'https://crowdict.com',
  famous: 'https://whosmorefamous.com',
  plain: 'https://playplain.app',
  'daily-roll': 'https://playdailyroll.com',
  poople: 'https://poople.io',
  perceptle: 'https://perceptle.net',
  travle: 'https://travle.earth',
  worldle: 'https://worldle.teuteuf.fr',
  maptap: 'https://maptap.gg',
  contexto: 'https://contexto.me',
  fermi: 'https://fermi.gg',
  krillion: 'https://krillion.io',
  anthropeum: 'https://anthropeum.com',
}
const browser = await chromium.launch()
async function capture(game, url, width, height) {
  const folder = '.publisher-editions/references/' + game + '/' + new Date().toISOString().slice(0, 10)
  await mkdir(folder, { recursive: true })
  const name = width < 500 ? 'phone' : 'desktop'
  const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500 })
  try {
    await page.route('**/*', (r) => (['GET', 'HEAD'].includes(r.request().method()) ? r.continue() : r.abort()))
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    if (!response?.ok()) throw new Error('HTTP ' + response?.status())
    await page.waitForFunction(() => document.body?.innerText.trim().length > 30, null, { timeout: 12000 })
    await page.evaluate(() => document.fonts.ready)
    const details = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      text: document.body.innerText,
      stylesheets: [...document.styleSheets].map((sheet) => {
        try {
          return { url: sheet.href, css: [...sheet.cssRules].map((rule) => rule.cssText).join('\n') }
        } catch {
          return { url: sheet.href, css: null }
        }
      }),
      images: [...document.images]
        .filter((img) => img.currentSrc)
        .map((img) => ({ url: img.currentSrc, alt: img.alt })),
      controls: [...document.querySelectorAll('button,input,select')]
        .map((el) => ({
          label: el.getAttribute('aria-label') || el.innerText || el.placeholder,
          disabled: el.disabled,
          bounds: el.getBoundingClientRect().toJSON(),
          color: getComputedStyle(el).color,
          background: getComputedStyle(el).backgroundColor,
          font: getComputedStyle(el).font,
        }))
        .filter((el) => el.bounds.width && el.bounds.height),
    }))
    await page.screenshot({ path: folder + '/' + name + '.png', timeout: 15000 })
    await writeFile(folder + '/' + name + '.json', JSON.stringify(details, null, 2))
    console.log(game, name, details.title)
  } catch (error) {
    console.error(game, name, error.message.split('\n')[0])
    process.exitCode = 1
  } finally {
    await page.close()
  }
}
try {
  const jobs = Object.entries(sources).flatMap(([game, url]) => [
    [game, url, 1440, 900],
    [game, url, 390, 844],
  ])
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (jobs.length) await capture(...jobs.shift())
    }),
  )
} finally {
  await browser.close()
}
