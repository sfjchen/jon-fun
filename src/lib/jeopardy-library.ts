// Server-only: read curated Jeopardy boards bundled in /data/jeopardy.
// Behind passcode gate via the API routes. NOT exposed to the client directly.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { normalizeBoard } from '@/lib/jeopardy-ops'
import type { JeopardyBoard } from '@/lib/jeopardy'

const DATA_DIR = path.join(process.cwd(), 'data', 'jeopardy')
const FILE_RE = /^[a-z0-9._-]+\.jeopardy\.json$/i

export const DEFAULT_LIBRARY_PASSCODE = '1234'

export function checkPasscode(input: string | null | undefined): boolean {
  const expected = (process.env.JEOPARDY_LIBRARY_PASSCODE || DEFAULT_LIBRARY_PASSCODE).trim()
  if (!expected) return false
  return (input || '').trim() === expected
}

export interface LibraryEntry {
  filename: string
  title: string
  categories: number
  rows: number
}

export async function listLibrary(): Promise<LibraryEntry[]> {
  let names: string[] = []
  try {
    names = await fs.readdir(DATA_DIR)
  } catch {
    return []
  }
  const jsons = names.filter((n) => FILE_RE.test(n)).sort()
  const out: LibraryEntry[] = []
  for (const filename of jsons) {
    try {
      const board = await readLibraryBoard(filename)
      if (!board) continue
      out.push({
        filename,
        title: board.title || filename.replace(/\.jeopardy\.json$/, ''),
        categories: board.categories.length,
        rows: board.categories[0]?.clues.length ?? 0,
      })
    } catch {
      // skip unreadable / malformed
    }
  }
  return out
}

export async function readLibraryBoard(filename: string): Promise<JeopardyBoard | null> {
  if (!FILE_RE.test(filename)) return null
  const full = path.join(DATA_DIR, filename)
  // Defensive: confine to DATA_DIR (block path traversal).
  if (!full.startsWith(DATA_DIR + path.sep) && full !== DATA_DIR) return null
  try {
    const text = await fs.readFile(full, 'utf-8')
    const parsed = JSON.parse(text)
    return normalizeBoard(parsed, filename.replace(/\.jeopardy\.json$/, ''))
  } catch {
    return null
  }
}
