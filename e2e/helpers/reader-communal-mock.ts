import type { Page } from '@playwright/test'

import type { ReaderPublication, ReaderPublicationSummary } from '../../src/lib/reader/types'

function toSummary(publication: ReaderPublication): ReaderPublicationSummary {
  return {
    id: publication.id,
    title: publication.title,
    sourceType: publication.sourceType,
    chapterCount: publication.chapters.length,
    totalWords: publication.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
    updatedAt: publication.updatedAt,
    firstChapterId: publication.chapters[0]?.id ?? '',
  }
}

function communalPathId(url: URL): string | null {
  const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
  const idx = parts.indexOf('communal')
  if (idx < 0) return null
  return idx < parts.length - 1 ? (parts[idx + 1] ?? null) : null
}

function isCommunalListPath(url: URL): boolean {
  const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
  return parts.length > 0 && parts[parts.length - 1] === 'communal'
}

/**
 * In-memory stand-in for Supabase-backed communal library so E2E (End-to-End) does not require service keys.
 * Intercepts `/api/reader/communal` and `/api/reader/communal/:id`.
 */
export function installReaderCommunalMock(page: Page): void {
  const store = new Map<string, ReaderPublication>()

  void page.route(/\/api\/reader\/communal/i, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const method = req.method()
    const pathId = communalPathId(url)
    const listPath = isCommunalListPath(url)

    if (method === 'GET' && listPath) {
      if (url.searchParams.get('export') === '1') {
        const full = [...store.values()].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(full),
        })
      }
      const list = [...store.values()]
        .map(toSummary)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) })
    }

    if (method === 'GET' && pathId && !listPath) {
      const pub = store.get(pathId)
      if (!pub) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'not_found' }),
        })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pub) })
    }

    if (method === 'POST' && listPath) {
      try {
        const pub = JSON.parse(req.postData() || 'null') as ReaderPublication
        if (!pub?.id) throw new Error('missing id')
        store.set(pub.id, pub)
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      } catch {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'bad_json' }),
        })
      }
    }

    if (method === 'DELETE' && pathId && !listPath) {
      store.delete(pathId)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    }

    return route.continue()
  })
}
