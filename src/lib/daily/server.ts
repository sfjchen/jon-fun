import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { archiveDay } from '@/lib/daily'
import type { GameId } from '@/lib/results'
const root = process.cwd()
export async function readJson<T>(relative: string): Promise<T> { return JSON.parse(await readFile(path.join(root, relative), 'utf8')) as T }
export async function dailyPuzzle(game: GameId, day: string): Promise<{ day: string; sourceDate: string; puzzle: unknown }> {
  if (game === 'anthropeum') {
    let data: { date: string; artifacts: unknown[] } | undefined
    try { data = await readJson(`data/anthropeum/${day}.json`) } catch {}
    // Public dated source; use a checked local snapshot when the source is offline.
    if (!data) try {
      const response = await fetch(`https://anthropeum.com/daily/${day}.json`, { signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } })
      if (response.ok) {
        const daily = await response.json() as { artifactIds: number[] }
        if (daily.artifactIds?.length !== 10) throw new Error('Invalid artifact list')
        const artifacts = await Promise.all(daily.artifactIds.map(async id => {
          if (!Number.isSafeInteger(id)) throw new Error('Invalid artifact')
          const r = await fetch(`https://anthropeum.com/artifacts/full/${id}.json`, { signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } })
          if (!r.ok) throw new Error('Artifact unavailable')
          const artifact: Record<string, unknown> & { id: number } = { id, ...await r.json() as Record<string, unknown> }
          const civilization = artifact.civilization as { file?: string } | undefined
          if (!civilization?.file || !/^[a-z0-9-]+\.geojson$/.test(civilization.file)) throw new Error('Missing origin region')
          const border = await fetch(`https://anthropeum.com/civilizations/${civilization.file.replace(/\.geojson$/, '.json')}`, { signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } })
          if (!border.ok) throw new Error('Region unavailable')
          const geo = await border.json() as { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] }
          const polygons = geo.features.flatMap(f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : f.geometry.coordinates as number[][][][])
          const points = polygons.flat(2), xs = points.map(p => p[0]!), ys = points.map(p => p[1]!)
          return { ...artifact, polygons, target: { lon: (Math.min(...xs)+Math.max(...xs))/2, lat: (Math.min(...ys)+Math.max(...ys))/2 } }
        }))
        data = { date: day, artifacts }
      }
    } catch { /* fall back to the local checked snapshot */ }
    if (!data) {
      try { data = await readJson(`data/anthropeum/${day}.json`) }
      catch { data = await readJson('data/anthropeum/2026-11-16.json') }
    }
    return { day, sourceDate: data!.date, puzzle: data }
  }
  if (game === 'krillion') {
    const { krillionForDay } = await import('@/lib/daily/krillion')
    const puzzle = await krillionForDay(day)
    return { day, sourceDate: puzzle.date, puzzle }
  }
  const kind = game === 'bee' ? 'bee' : game
  const dates = await readJson<string[]>(`public/puzzle-archives/${kind}/index.json`)
  const sourceDate = archiveDay(day, dates)
  const year = await readJson<{ date: string }[]>(`public/puzzle-archives/${kind}/${sourceDate.slice(0, 4)}.json`)
  const puzzle = year.find(p => p.date === sourceDate)
  if (!puzzle) throw new Error('Puzzle missing from archive')
  return { day, sourceDate, puzzle }
}
