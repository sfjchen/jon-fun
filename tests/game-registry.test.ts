/** Checks that every registered daily game has the pieces the type system cannot require (docs/GAME-PLAYBOOK.md). */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { GAME_KEYS } from '../src/lib/game-keys'
import { PLAY_IDS, PUBLISHER_PLAY, playUrl } from '../src/lib/publisher-play'
import { GAMES, GAME_IDS, RETIRED_IDS, type GameId } from '../src/lib/results'

test('every daily game is listed, routed, themed, drawn and has keyboard shortcuts', () => {
  const ids = Object.keys(GAMES) as GameId[]
  assert.deepEqual([...GAME_IDS].sort(), [...ids].sort(), 'GAME_IDS lists every game in GAMES exactly once')
  // Only the ownDailyHeader list counts, since the theme chain below it names some of the same routes.
  const source = readFileSync('src/components/PageShell.tsx', 'utf8')
  const shell = source.split('const ownDailyHeader')[1]!.split(']')[0]!
  // The routes named in the gameTheme chain. A game is themed when its url starts with one of them.
  const themed = source
    .split('const gameTheme')[1]!
    .split('undefined')[0]!
    .match(/'\/[^']+'/g)!
  for (const id of ids) {
    const { url } = GAMES[id]
    assert.ok(existsSync(`src/app${url}/page.tsx`), `${id} has a page at ${url}`)
    assert.ok(shell.includes(`'${url}'`), `${id} is in PageShell's ownDailyHeader list`)
    assert.ok(
      themed.some((route) => url.startsWith(route.slice(1, -1))),
      `${id} has a theme in PageShell's gameTheme chain`,
    )
    assert.ok(existsSync(`public/doodles/notebook/${id}.svg`), `${id} has an icon`)
    assert.ok(GAME_KEYS[id].length > 0, `${id} lists its keys`)
  }
})

test('every publisher daily has a page that keeps its retired game, whose old route redirects there', () => {
  const config = readFileSync('next.config.mjs', 'utf8')
  assert.deepEqual(PLAY_IDS.map((id) => PUBLISHER_PLAY[id].retired).sort(), [...RETIRED_IDS].sort())
  for (const id of PLAY_IDS) {
    const url = playUrl(id)
    assert.ok(existsSync(`src/app${url}/page.tsx`), `${id} has a page at ${url}`)
    assert.ok(!GAME_IDS.some((g) => GAMES[g].url === url), `${id} does not take a ranked game's route`)
    const old = PUBLISHER_PLAY[id].retired
    const redirect = `{ source: '/games/${old}', destination: '${url}', permanent: true }`
    assert.ok(config.includes(redirect), `/games/${old} redirects to ${url}`)
  }
})
