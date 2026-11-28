/**
 * The publisher dailies that sfjc.dev links to from a page of its own, played and scored on the publisher's site, and
 * the sfjc.dev game each one replaced on 2026-11-28.
 */
import type { RetiredId } from '@/lib/results'

export type PlayId = 'worldle' | 'travle' | 'maptap' | 'fermi'
export const PUBLISHER_PLAY: Record<PlayId, { title: string; site: string; about: string; retired: RetiredId }> = {
  worldle: {
    title: 'Worldle',
    site: 'https://worldle.teuteuf.fr',
    about: 'Name the country from its outline in 6 guesses, with the distance and direction after each miss.',
    retired: 'outline',
  },
  travle: {
    title: 'Travle',
    site: 'https://travle.earth',
    about: 'Link 2 countries through their neighbours in as few guesses as you can, with optional hints.',
    retired: 'hop',
  },
  maptap: {
    title: 'MapTap',
    site: 'https://maptap.gg',
    about: 'Tap where each of the day’s places is on the map. Closer taps score more.',
    retired: 'pin',
  },
  fermi: {
    title: 'Fermi',
    site: 'https://fermi.gg',
    about: '3 estimation questions a day, each scored by how many times off your answer is.',
    retired: 'ballpark',
  },
}
export const PLAY_IDS = Object.keys(PUBLISHER_PLAY) as PlayId[]

/**
 * Returns the page on this site for a publisher daily.
 */
export function playUrl(id: PlayId): string {
  return `/games/${id}`
}
