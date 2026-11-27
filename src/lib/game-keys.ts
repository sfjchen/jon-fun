/**
 * Lists every daily game's keyboard shortcuts, as shown in its "How to play" panel. A game cannot be added without
 * a row here, and the playbook (`docs/GAME-PLAYBOOK.md`) sets which key does what, so games stay alike.
 */

import type { GameId } from '@/lib/results'

/** One shortcut: the keys as printed, separated by spaces, and what they do. */
export type KeyRow = [keys: string, does: string]

/** Quick jump, which every page answers to. */
export const JUMP_KEY: KeyRow = ['Ctrl/⌘ K', 'Jump to any game or page']

/** The keys of the shared daily header (`DayNav`), listed after the game's own. */
export const SHARED_KEYS: KeyRow[] = [
  ['?', 'How to play and keys (outside a text square)'],
  ['← → T', 'Previous day, next day, today (click the date first)'],
  JUMP_KEY,
]

/** The squares, clues and entries of a crossword grid, shared by the Mini and the full-size crossword. */
const GRID_KEYS: KeyRow[] = [
  ['A-Z', 'Fill the square'],
  ['← ↑ → ↓', 'Move 1 square, and the word turns to follow'],
  ['Space', 'Switch Across and Down'],
  ['Tab Enter ]', 'Next clue'],
  ['Shift+Tab [', 'Previous clue'],
  ['Home End', 'Start or end of the word'],
  ['⌫ Del', 'Erase'],
  ['Esc', 'Rebus (several letters in 1 square), and Esc again to close it'],
]

export const GAME_KEYS: Record<GameId, KeyRow[]> = {
  connections: [
    ['1234 QWER ASDF ZXCV', 'Pick the tile in that spot'],
    ['← ↑ → ↓', 'Walk the tiles'],
    ['Enter', 'Submit 4 tiles'],
    ['Space', 'Shuffle'],
    ['⌫ Esc', 'Deselect all'],
    ['S', 'Share the result'],
  ],
  fivefold: [
    ['A-Z', 'Type a letter'],
    ['Enter', 'Submit the guess'],
    ['⌫', 'Erase'],
    ['S', 'Copy the result'],
  ],
  mini: [
    ...GRID_KEYS,
    ['Shift+Esc', 'Pause'],
    ['Alt+S Alt+W Alt+P', 'Check the square, word or puzzle'],
    ['Alt+Shift+S W P', 'Reveal the square, word or puzzle'],
  ],
  bee: [
    ['A-Z', 'Type a letter'],
    ['Enter', 'Submit the word'],
    ['⌫', 'Erase'],
    ['Space', 'Shuffle'],
  ],
  crossword: GRID_KEYS,
  headcount: [
    ['Tab', 'Move between controls'],
    ['← → ↑ ↓', 'Adjust a slider or choose an option'],
    ['Enter Space', 'Activate the focused button'],
  ],
  chainle: [
    ['Enter', 'Submit the word'],
    ['S', 'Copy the result'],
  ],
  orbs: [
    ['1 2 3 4', 'Open that puzzle'],
    ['1 2 3', 'Pick that answer for the first open clue'],
    ['1 Q A', 'Matching: pick that clue'],
    ['2 W S', 'Matching: pick that match'],
    ['← ↑ → ↓', 'Walk the tiles'],
    ['Enter', 'Check a typed answer, or play again'],
    ['Esc', 'Back to the puzzles'],
  ],
  krillion: [
    ['Enter Space', 'Start the dive, next prompt'],
    ['Enter', 'Submit the answer'],
    ['S', 'Copy the result'],
    ['← →', 'Page through the answer review'],
  ],
  anthropeum: [
    ['Enter Space', 'Start, lock in the guess, next artifact'],
    ['F', 'Expand the photo'],
    ['N', 'Next photo'],
    ['← → Z', 'In the expanded photo: step photos, zoom'],
    ['H', 'Hints'],
    ['+ - 0', 'Map: zoom in, zoom out, reset'],
    ['S', 'Share the result'],
  ],
}
