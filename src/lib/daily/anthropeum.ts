import { readFile } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import path from 'node:path'
import { z } from 'zod'
import type { Artifact } from '@/lib/artifact-scoring'
import { supabaseAdmin } from '@/lib/supabase'
import { anthropeumDistributionSchema } from './anthropeum-stats'

const SOURCE = 'https://anthropeum.com'
const dateSchema = z.object({ date: z.string(), artifactIds: z.array(z.number().int().positive()).length(10) })
const artifactSchema = z.looseObject({
  title: z.string(),
  images: z.array(z.url()).nonempty(),
  objectDate: z.string(),
  beginYear: z.number(),
  endYear: z.number(),
  culture: z.string(),
  metUrl: z.url(),
  civilization: z
    .object({ polity: z.string(), file: z.string().regex(/^[a-z0-9-]+\.geojson$/), snapshot: z.string() })
    .nullish(),
})
const ring = z.array(z.tuple([z.number(), z.number()])).min(4)
const polygon = z.array(ring).nonempty()
const regionSchema = z.object({
  features: z
    .array(
      z.object({
        geometry: z.discriminatedUnion('type', [
          z.object({ type: z.literal('Polygon'), coordinates: polygon }),
          z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(polygon).nonempty() }),
        ]),
      }),
    )
    .nonempty(),
})

type Collection = { date: string; artifacts: Artifact[] }
const pending = new Map<string, Promise<Collection>>()
const storageEnabled = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

async function getJson(resource: string, revalidate?: number): Promise<unknown> {
  const response = await fetch(SOURCE + resource, {
    signal: AbortSignal.timeout(10000),
    ...(revalidate ? { next: { revalidate } } : { cache: 'no-store' }),
  })
  if (!response.ok) throw Error(`Anthropeum returned ${response.status}`)
  return response.json()
}

async function collection(day: string): Promise<Collection> {
  try {
    const local = JSON.parse(
      await readFile(path.join(process.cwd(), 'data/anthropeum', `${day}.json`), 'utf8'),
    ) as Collection
    if (local.date === day && local.artifacts.length === 10) return local
  } catch {}
  if (storageEnabled()) {
    const { data } = await supabaseAdmin
      .from('daily_game_content')
      .select('payload')
      .match({ game: 'anthropeum', source_day: day })
      .maybeSingle()
    if (data?.payload?.format === 'anthropeum-v1') {
      const stored = JSON.parse(gunzipSync(Buffer.from(data.payload.gzipBase64, 'base64')).toString()) as Collection
      if (stored.date === day && stored.artifacts.length === 10) return stored
    }
  }

  const daily = dateSchema.parse(await getJson(`/daily/${day}.json`))
  if (daily.date !== day || new Set(daily.artifactIds).size !== 10) throw Error('Unexpected Anthropeum collection')
  const regions = new Map<string, Promise<ReturnType<typeof regionSchema.parse>>>()
  const artifacts = await Promise.all(
    daily.artifactIds.map(async (id) => {
      const data = artifactSchema.parse(await getJson(`/artifacts/full/${id}.json`, 86400))
      const { civilization, ...details } = data
      const artifact = { ...details, id }
      if (!civilization) return artifact
      const file = civilization.file.replace(/\.geojson$/, '.json')
      let region = regions.get(file)
      if (!region) {
        region = getJson(`/civilizations/${file}`, 86400).then((value) => regionSchema.parse(value))
        regions.set(file, region)
      }
      const { features } = await region
      const polygons = features.flatMap(({ geometry }) =>
        geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates,
      )
      let west = Infinity,
        east = -Infinity,
        south = Infinity,
        north = -Infinity
      for (const [lon, lat] of polygons.flat(2)) {
        west = Math.min(west, lon)
        east = Math.max(east, lon)
        south = Math.min(south, lat)
        north = Math.max(north, lat)
      }
      return { ...artifact, civilization, polygons, target: { lon: (west + east) / 2, lat: (south + north) / 2 } }
    }),
  )
  const puzzle = { date: day, artifacts }
  if (storageEnabled()) {
    const payload = { format: 'anthropeum-v1', gzipBase64: gzipSync(JSON.stringify(puzzle)).toString('base64') }
    const { error } = await supabaseAdmin
      .from('daily_game_content')
      .upsert({ game: 'anthropeum', source_day: day, payload }, { ignoreDuplicates: true })
    if (error) console.warn('Anthropeum snapshot storage unavailable', day)
  }
  return puzzle
}

export function anthropeumPuzzle(day: string): Promise<Collection> {
  let request = pending.get(day)
  if (!request) {
    request = collection(day)
      .catch(() => {
        throw Error(
          `The original Anthropeum collection for ${day} is unavailable. Try again shortly or choose another date.`,
        )
      })
      .finally(() => pending.delete(day))
    pending.set(day, request)
  }
  return request
}

async function fetchDistribution(day: string) {
  return anthropeumDistributionSchema.parse(await getJson(`/api/distribution/${day}`, 60))
}

export async function anthropeumDistribution(day: string) {
  try {
    return await fetchDistribution(day)
  } catch (error) {
    if (storageEnabled()) {
      const { data } = await supabaseAdmin
        .from('daily_game_content')
        .select('payload')
        .match({ game: 'anthropeum-dist', source_day: day })
        .maybeSingle()
      const stored = anthropeumDistributionSchema.safeParse(data?.payload)
      if (stored.success) return stored.data
    }
    throw error
  }
}

export async function captureAnthropeumDistribution(day: string) {
  const payload = await fetchDistribution(day)
  if (storageEnabled() && payload.totalPlayers) {
    const { error } = await supabaseAdmin
      .from('daily_game_content')
      .upsert({ game: 'anthropeum-dist', source_day: day, payload })
    if (error) throw Error('Could not save Anthropeum player statistics')
  }
  return payload.totalPlayers
}
