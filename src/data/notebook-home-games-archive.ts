import type { GameCardGame } from '@/components/GameCard'

const nb = '/doodles/notebook'

/**
 * Notebook (Theme 1) home grid entries removed from the live list.
 * Pear Navigator stays off `/` by default: treat it as a case-study / demo route, not a primary home-grid card.
 * To restore it on `/`: spread or splice `NOTEBOOK_HOME_GAMES_ARCHIVED` into `items` in `src/app/page.tsx` (e.g. after daily-log).
 * App routes `/games/pear-navigator` and `/games/pear-navigator/results` are unchanged.
 */
export const NOTEBOOK_HOME_GAMES_ARCHIVED: GameCardGame[] = [
  {
    id: 'pear-navigator',
    title: 'Pear Navigator',
    description: 'Step-by-step guides for Procreate, Figma',
    icon: `${nb}/pear.svg`,
    href: '/games/pear-navigator',
    available: true,
  },
]
