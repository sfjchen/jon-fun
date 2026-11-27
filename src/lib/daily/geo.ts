/** Makes a geography daily's puzzle for a date from the bundled Natural Earth data. */
import world from '../../../data/geo/world.json'
import { GEO, type GeoGame, type World } from '@/lib/geo-games'

/**
 * Returns the puzzle of a geography game for a day. The same date always gives the same puzzle.
 */
export function geoPuzzle<G extends GeoGame>(game: G, day: string): ReturnType<(typeof GEO)[G]['puzzle']> {
  return GEO[game].puzzle(world as World, day) as ReturnType<(typeof GEO)[G]['puzzle']>
}
