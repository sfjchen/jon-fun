/**
 * Lists publisher players available in the daily collection.
 * Each entry keeps the publisher's own live game and share format.
 */
export const COLLECTION_PLAYERS = [
  { id: 'whos-more-famous', title: 'Who’s More Famous?', site: 'https://whosmorefamous.com' },
  { id: 'plain', title: 'Plain', site: 'https://playplain.app' },
  { id: 'daily-roll', title: 'Daily Roll', site: 'https://playdailyroll.com' },
  { id: 'bandle', title: 'Bandle', site: 'https://bandle.app/menu' },
  { id: 'poople', title: 'Poople', site: 'https://poople.io' },
  { id: 'perceptle', title: 'Perceptle', site: 'https://perceptle.net' },
  { id: 'contexto', title: 'Contexto', site: 'https://contexto.me' },
] as const
