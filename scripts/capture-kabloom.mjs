// Capture only the edition presented by the free daily player. Publisher module exports
// are build-specific, so a changed bundle requires review before accepting new data.
import { chromium } from 'playwright'
import { savePublisherEdition } from '../src/lib/publisher-editions/local.ts'

const url = 'https://kabloom.io/play/daily'
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ timezoneId: 'America/New_York' })
  await page.route('**/*', (route) => (route.request().method() === 'GET' ? route.continue() : route.abort()))
  await page.goto(url)
  await page.getByText('Wake the volcano', { exact: true }).first().waitFor()
  const edition = await page.evaluate(async () => {
    const dictionaryUrl = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => /^https:\/\/kabloom\.io\/assets\/refused-[\w-]+\.js$/.test(url))
    if (!dictionaryUrl) throw new Error('Publisher dictionary build needs review')
    const dictionary = await import(dictionaryUrl)
    if (!['u', 'o', 'p', 'f'].every((key) => typeof dictionary[key] === 'function'))
      throw new Error('Publisher dictionary API changed')
    await dictionary.u(undefined, ['film', 'music', 'game', 'tv'])
    const deck = dictionary.o({ deck: 'anything' })
    let day
    for (const button of document.querySelectorAll('button')) {
      const key = Object.keys(button).find((key) => key.startsWith('__reactFiber'))
      for (let fiber = button[key]; fiber; fiber = fiber.return) {
        if (fiber.memoizedProps?.mode === 'daily' && fiber.memoizedProps.day?.questions) {
          day = fiber.memoizedProps.day
          break
        }
      }
      if (day) break
    }
    if (!day || !Number.isSafeInteger(day.n)) throw new Error('Missing rendered edition ID')
    const date = new Date(Date.UTC(2026, 9, 26 + day.n - 1)).toISOString().slice(0, 10)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
    if (today !== date) throw new Error('Edition ID does not match the current publisher day')
    const answerMap = new Map()
    const rounds = day.questions.map((question) => {
      if (question.seconds !== 25) throw new Error('Publisher clock changed')
      const accepted = new Set()
      for (const id of question.accept) {
        const item = deck.byId[id]
        if (!item) throw new Error('Incomplete answer dictionary for ' + id)
        const canonical = dictionary.p(deck, item) || id
        const previous = answerMap.get(canonical)
        const names = new Set(previous?.aliases)
        for (const equivalent of dictionary.f(deck, item)) {
          names.add(equivalent.name)
          for (const alias of equivalent.aliases ?? []) names.add(alias)
        }
        const label = deck.byId[canonical]?.name ?? item.name
        names.delete(label)
        answerMap.set(canonical, { id: canonical, label, aliases: [...names] })
        accepted.add(canonical)
      }
      return { prompt: question.text, accepted: [...accepted], publisherQuestion: question }
    })
    const themeLabel = [...document.querySelectorAll('*')].find(
      (el) => el.children.length === 0 && el.textContent.trim().toLowerCase() === "today's theme",
    )
    return {
      format: 'publisher-edition/v1',
      game: 'kabloom',
      sourceDate: date,
      editionId: day.n,
      sourceUrl: location.href,
      payload: {
        category: themeLabel?.nextElementSibling?.textContent?.trim() || day.start,
        readingMs: 2000,
        answerMs: 25000,
        rounds,
        answers: [...answerMap.values()],
        publisherDay: day,
      },
    }
  })
  await savePublisherEdition('kabloom', edition.sourceDate, edition)
  console.log('Archived Kabloom', edition.editionId, edition.sourceDate, edition.payload.answers.length, 'answers')
} finally {
  await browser.close()
}
