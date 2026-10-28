/**
 * Ships a built-in Connections puzzle so the library always has something to play,
 * even when the public shelf is empty. Played locally and never recorded to the database.
 */

import { CONNECTIONS_SCHEMA_VERSION, type ConnectionsPuzzle } from '@/lib/connections'

export const SAMPLE_PUZZLE: ConnectionsPuzzle = {
  id: 'sample',
  version: CONNECTIONS_SCHEMA_VERSION,
  slug: 'sample',
  title: 'Sample Puzzle',
  description: 'A built-in starter puzzle.',
  tags: ['sample'],
  groups: [
    { category: 'Fruits', difficulty: 'yellow', words: ['APPLE', 'MANGO', 'GRAPE', 'PEAR'] },
    { category: 'Card games', difficulty: 'green', words: ['POKER', 'BRIDGE', 'HEARTS', 'RUMMY'] },
    { category: 'Things with keys', difficulty: 'blue', words: ['PIANO', 'MAP', 'LOCK', 'KEYBOARD'] },
    { category: '___ fish', difficulty: 'purple', words: ['SWORD', 'STAR', 'CAT', 'JELLY'] },
  ],
  authorDisplay: 'sfjc',
  authorFingerprint: '',
  createdAt: '2026-10-28T00:00:00.000Z',
  updatedAt: '2026-10-28T00:00:00.000Z',
}
