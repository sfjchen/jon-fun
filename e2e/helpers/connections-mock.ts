import type { Page } from '@playwright/test'

import type { ConnectionsGroup, ConnectionsPuzzle, ConnectionsPuzzleSummary } from '../../src/lib/connections'
import { CONNECTIONS_SCHEMA_VERSION } from '../../src/lib/connections'

/** Stable id/slug for deterministic E2E (End-to-End) play + library tests. */
export const CONNECTIONS_E2E_ID = 'a0000000-0000-4000-8000-000000000001'
export const CONNECTIONS_E2E_SLUG = 'e2e-demo-puzzle'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function seedPuzzle(): ConnectionsPuzzle {
  const now = new Date().toISOString()
  const groups: ConnectionsGroup[] = [
    {
      category: 'Inner planets',
      difficulty: 'yellow',
      words: ['Mercury', 'Venus', 'Earth', 'Mars'],
    },
    {
      category: 'Chess pieces',
      difficulty: 'green',
      words: ['King', 'Queen', 'Rook', 'Knight'],
    },
    {
      category: 'Seasons',
      difficulty: 'blue',
      words: ['Spring', 'Summer', 'Fall', 'Winter'],
    },
    {
      category: 'Cardinal directions',
      difficulty: 'purple',
      words: ['North', 'South', 'East', 'West'],
    },
  ]
  return {
    id: CONNECTIONS_E2E_ID,
    version: CONNECTIONS_SCHEMA_VERSION,
    slug: CONNECTIONS_E2E_SLUG,
    title: 'E2E Demo Puzzle',
    description: 'Playwright fixture puzzle',
    tags: ['e2e', 'fixture'],
    groups,
    authorDisplay: 'E2E Bot',
    authorFingerprint: 'b0000000-0000-4000-8000-000000000002',
    createdAt: now,
    updatedAt: now,
  }
}

type Stored = {
  puzzle: ConnectionsPuzzle
  play_count: number
  solve_count: number
  total_mistakes: number
}

function toSummary(s: Stored): ConnectionsPuzzleSummary {
  const p = s.puzzle
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    tags: p.tags,
    authorDisplay: p.authorDisplay,
    groups: p.groups,
    playCount: s.play_count,
    solveCount: s.solve_count,
    totalMistakes: s.total_mistakes,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

function parsePuzzlesPath(pathname: string): { list: boolean; id: string | null; record: boolean } {
  const parts = pathname.replace(/\/$/, '').split('/').filter(Boolean)
  const idx = parts.indexOf('puzzles')
  if (idx < 0) return { list: false, id: null, record: false }
  const id = parts[idx + 1] ?? null
  const record = id !== null && parts[idx + 2] === 'record'
  return { list: id === null, id, record }
}

/**
 * In-memory `/api/connections/*` so E2E does not require Supabase service keys.
 * Seeds {@link CONNECTIONS_E2E_SLUG} by default.
 */
export function installConnectionsApiMock(page: Page): void {
  const store = new Map<string, Stored>()
  const seed = seedPuzzle()
  store.set(seed.id, { puzzle: seed, play_count: 3, solve_count: 2, total_mistakes: 5 })

  void page.route(/\/api\/connections\/puzzles/i, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const method = req.method()
    const { list, id: pathId, record } = parsePuzzlesPath(url.pathname)

    const findStored = (key: string | null): Stored | null => {
      if (!key) return null
      if (UUID_RE.test(key)) {
        return store.get(key) ?? null
      }
      for (const s of store.values()) {
        if (s.puzzle.slug === key) return s
      }
      return null
    }

    if (list && method === 'GET') {
      const sort = url.searchParams.get('sort') ?? 'newest'
      const arr = [...store.values()]
      if (sort === 'plays') {
        arr.sort((a, b) => b.play_count - a.play_count || b.puzzle.updatedAt.localeCompare(a.puzzle.updatedAt))
      } else if (sort === 'solve_rate') {
        arr.sort((a, b) => {
          const ra = a.play_count > 0 ? a.solve_count / a.play_count : 0
          const rb = b.play_count > 0 ? b.solve_count / b.play_count : 0
          return rb - ra || b.play_count - a.play_count
        })
      } else {
        arr.sort((a, b) => new Date(b.puzzle.updatedAt).getTime() - new Date(a.puzzle.updatedAt).getTime())
      }
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 200))
      const summaries = arr.slice(0, limit).map(toSummary)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(summaries) })
    }

    if (list && method === 'POST') {
      try {
        const body = JSON.parse(req.postData() || 'null') as ConnectionsPuzzle
        if (!body?.id) throw new Error('id required')
        for (const s of store.values()) {
          if (s.puzzle.slug === body.slug) {
            return route.fulfill({
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'slug_exists' }),
            })
          }
        }
        store.set(body.id, {
          puzzle: { ...body, version: CONNECTIONS_SCHEMA_VERSION },
          play_count: 0,
          solve_count: 0,
          total_mistakes: 0,
        })
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, id: body.id, slug: body.slug }),
        })
      } catch {
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'bad_json' }) })
      }
    }

    if (!list && pathId && !record && method === 'GET') {
      const s = findStored(pathId)
      if (!s) {
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s.puzzle) })
    }

    if (!list && pathId && !record && method === 'PATCH') {
      try {
        const body = JSON.parse(req.postData() || 'null') as ConnectionsPuzzle & { authorFingerprint?: string }
        const s = findStored(pathId)
        if (!s) {
          return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) })
        }
        const fp = typeof body.authorFingerprint === 'string' ? body.authorFingerprint : ''
        if (!fp || fp !== s.puzzle.authorFingerprint) {
          return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'forbidden' }) })
        }
        const merged: ConnectionsPuzzle = {
          ...s.puzzle,
          ...body,
          id: s.puzzle.id,
          version: CONNECTIONS_SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
        }
        s.puzzle = merged
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      } catch {
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'bad_json' }) })
      }
    }

    if (!list && pathId && !record && method === 'DELETE') {
      try {
        const body = JSON.parse(req.postData() || '{}') as { authorFingerprint?: string }
        const s = findStored(pathId)
        if (!s) {
          return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) })
        }
        const fp = typeof body.authorFingerprint === 'string' ? body.authorFingerprint : ''
        if (!fp || fp !== s.puzzle.authorFingerprint) {
          return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'forbidden' }) })
        }
        store.delete(s.puzzle.id)
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      } catch {
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'bad_json' }) })
      }
    }

    if (!list && pathId && record && method === 'POST') {
      try {
        const body = JSON.parse(req.postData() || 'null') as { solved?: boolean; mistakes?: number }
        const s = findStored(pathId)
        if (!s) {
          return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) })
        }
        const mistakes = typeof body.mistakes === 'number' && Number.isFinite(body.mistakes) ? Math.floor(body.mistakes) : 0
        const clamped = Math.max(0, Math.min(4, mistakes))
        s.play_count += 1
        if (body.solved === true) s.solve_count += 1
        s.total_mistakes += clamped
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      } catch {
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'bad_json' }) })
      }
    }

    return route.continue()
  })
}
