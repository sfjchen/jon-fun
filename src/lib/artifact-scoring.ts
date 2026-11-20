export type Pin = { lat: number; lon: number }
export type Artifact = {
  id: number
  title: string
  images: string[]
  objectDate: string
  beginYear: number
  endYear: number
  culture: string
  region?: string
  mediumClean?: string
  description?: string
  metUrl: string
  civilization?: { polity: string; file: string; snapshot: string }
  target?: Pin
  polygons?: number[][][][]
  country?: string
}
export const ARTIFACT_TIME_WINDOW = 250
export function distanceKm(a: Pin, b: Pin): number {
  const rad = Math.PI / 180,
    h =
      Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)))
}
function ringContains(pin: Pin, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!
    if (
      a[1]! > pin.lat !== b[1]! > pin.lat &&
      pin.lon < ((b[0]! - a[0]!) * (pin.lat - a[1]!)) / (b[1]! - a[1]!) + a[0]!
    )
      inside = !inside
  }
  return inside
}
/** Distance to the nearest boundary segment, rather than the nearest polygon vertex. */
export function regionDistance(pin: Pin, polygons: number[][][][]): number {
  const p = { lat: pin.lat, lon: ((((pin.lon + 180) % 360) + 360) % 360) - 180 }
  if (
    polygons.some((poly) => poly.length && ringContains(p, poly[0]!) && !poly.slice(1).some((r) => ringContains(p, r)))
  )
    return 0
  let closest = Infinity
  for (const polygon of polygons)
    for (const ring of polygon)
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i]!,
          b = ring[i + 1]!,
          dx = b[0]! - a[0]!,
          dy = b[1]! - a[1]!,
          length = dx * dx + dy * dy
        const t = length ? Math.max(0, Math.min(1, ((p.lon - a[0]!) * dx + (p.lat - a[1]!) * dy) / length)) : 0
        closest = Math.min(closest, distanceKm(p, { lon: a[0]! + t * dx, lat: a[1]! + t * dy }))
      }
  return closest
}
/** Snaps a period start to the original's 125-year steps between 3000 BCE and 1750 CE. */
export function snapYear(year: number): number {
  return Math.max(-3000, Math.min(1750, Math.round(year / 125) * 125))
}
/**
 * Scores a guess like the original's client: location decays as exp(-km/2000) from the historical region (0 km
 * inside it, 0 points with no region), time decays as exp(-years/1000) from the gap between the 250-year guess
 * and the artifact's dates. Each is worth up to 5,000.
 */
export function artifactScore(
  artifact: Artifact,
  pin: Pin,
  guessYear: number,
): { location: number; time: number; km: number; years: number; total: number } {
  const year = snapYear(guessYear),
    km = artifact.polygons?.length ? regionDistance(pin, artifact.polygons) : Infinity
  const years = Math.max(artifact.beginYear - (year + ARTIFACT_TIME_WINDOW), 0, year - artifact.endYear)
  const location = Number.isFinite(km) ? Math.round(5000 * Math.exp(-km / 2000)) : 0,
    time = Math.round(5000 * Math.exp(-years / 1000))
  return { location, time, km: Number.isFinite(km) ? Math.round(km) : 0, years, total: location + time }
}
export function historicalYear(year: number): string {
  return year <= 0 ? `${Math.abs(year) || 1} BCE` : `${year} CE`
}
