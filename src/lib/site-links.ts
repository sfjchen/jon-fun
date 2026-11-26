/*
 * Every page the site links to from the home page, shared by the home grid and the Cmd/Ctrl+K quick-jump menu.
 */
import type { GameCardGame } from '@/components/GameCard'

const nb = '/doodles/notebook'
export const HOME_ITEMS: GameCardGame[] = [
  {
    id: 'daily-log',
    title: '1 Sentence Everyday',
    description: 'One sentence per day; history, calendar, export',
    icon: `${nb}/daily.svg`,
    href: '/games/daily-log',
    available: true,
  },
  {
    id: 'callmoves',
    title: 'CallMoves',
    description:
      'Replay earnings calls next to the stock: the 5 moments that moved price vs its sector, minute by minute',
    icon: `${nb}/callmoves.svg`,
    href: 'https://callmoves.sfjc.dev',
    available: true,
  },
  {
    id: 'veridian',
    title: 'Veridian Whiteboard',
    description: 'Draw math, analyze mistakes, Socratic chat — local-first AI whiteboard',
    icon: '/doodles/study.svg',
    href: '/veridian',
    available: true,
  },
  {
    id: 'tmr',
    title: 'Focus Chimes',
    description: 'Recurring background chimes to stay on track and keep a sense of time',
    icon: `${nb}/tmr.svg`,
    href: '/games/tmr',
    available: true,
  },
  {
    id: 'e-reader',
    title: 'Web E-Reader',
    description:
      'Import text or PDF files into a chapterized reader with typography controls, bookmarks, TTS, and local progress',
    icon: `${nb}/ereader.svg`,
    href: '/games/e-reader',
    available: true,
  },
  {
    id: '24',
    title: "24 (Jon's favorite)",
    description: '4 numbers, basic arithmetic → make 24',
    icon: `${nb}/game24.svg`,
    href: '/games/24',
    available: true,
  },
  {
    id: 'poker',
    title: "Texas Hold'em chip tracker",
    description: 'Chip tracker with multiplayer lobbies',
    icon: `${nb}/poker.svg`,
    href: '/games/poker',
    available: true,
  },
  {
    id: 'crossword',
    title: 'Crossword Together',
    description: 'Solve the daily crossword with friends on one live grid',
    icon: `${nb}/mini.svg`,
    href: '/games/crossword',
    available: true,
  },
  {
    id: 'set',
    title: 'Set',
    description: 'Race friends in a room, or clear a full deck',
    icon: `${nb}/triples.svg`,
    href: '/games/triples',
    available: true,
  },
  {
    id: 'orbs',
    title: 'Orbs',
    description: 'Twelve daily trivia questions across four categories',
    icon: `${nb}/orbs.svg`,
    href: '/games/orbs',
    available: true,
  },
  {
    id: 'jeopardy',
    title: 'Jeopardy with Friends',
    description: 'Create and play custom boards locally',
    icon: `${nb}/jeopardy.svg`,
    href: '/games/jeopardy',
    available: true,
  },
  {
    id: 'chwazi',
    title: 'Chwazi Finger Chooser',
    description: 'Touch screen to pick a winner',
    icon: `${nb}/chwazi.svg`,
    href: '/games/chwazi',
    available: true,
  },
  {
    id: 'coming-soon',
    title: 'Coming Soon',
    description: 'More brain games in development',
    icon: `${nb}/coming-soon.svg`,
    href: '#',
    available: false,
  },
]
