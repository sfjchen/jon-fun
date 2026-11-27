/** Pulls, imports, or verifies one date of publisher-supplied private puzzle data. */
import { readFile } from 'node:fs/promises'
import { shiftDay, siteDay, validDay } from '@/lib/daily'
import { publisherGame } from '@/lib/publisher-editions/formats'
import {
  capturePublisherEdition,
  readPublisherEdition,
  refreshPublisherEdition,
  savePublisherEdition,
} from '@/lib/publisher-editions/local'

/** Reports each exact historical date or its acquisition failure. */
async function historical(game: ReturnType<typeof publisherGame.parse>, first: string, last: string) {
  if (!validDay(first) || !validDay(last) || first > last) throw new Error('Choose an ordered YYYY-MM-DD date range')
  let misses = 0
  for (let day = first; day <= last; day = shiftDay(day, 1)) {
    try {
      const edition = await refreshPublisherEdition(game, day)
      console.log(JSON.stringify({ game, day, editionId: edition.editionId }))
    } catch (error) {
      misses += 1
      console.error(
        JSON.stringify({ game, day, error: error instanceof Error ? error.message : 'Edition unavailable' }),
      )
    }
    if (day === last) break
  }
  if (misses) process.exitCode = 1
}

/** Reports edition identity without printing answer data or credentials. */
async function main() {
  const [command, rawGame, rawDay, input, ...extra] = process.argv.slice(2)
  if (
    !rawGame ||
    extra.length ||
    !['refresh', 'import', 'verify', 'archive', 'capture'].includes(command ?? '') ||
    ((command === 'import' || command === 'archive') && (!rawDay || !input)) ||
    ((command === 'refresh' || command === 'capture') && input)
  ) {
    throw new Error(
      'Usage: publisher-editions.ts refresh|import|verify|archive|capture GAME [SOURCE_DATE] [FILE_OR_PLAY_DAY_OR_END_DATE]',
    )
  }
  const game = publisherGame.parse(rawGame)
  const day = rawDay ?? siteDay()
  if (command === 'archive') return historical(game, day, input!)
  const result =
    command === 'import'
      ? await savePublisherEdition(game, day, JSON.parse(await readFile(input!, 'utf8')))
      : command === 'refresh'
        ? await refreshPublisherEdition(game, day)
        : command === 'capture'
          ? await capturePublisherEdition(game, day)
          : await readPublisherEdition(game, day, input)
  console.log(
    JSON.stringify({
      game,
      editionId: result.editionId,
      sourceDate: result.sourceDate,
      day: 'day' in result ? result.day : day,
    }),
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Could not load publisher edition')
  process.exitCode = 1
})
