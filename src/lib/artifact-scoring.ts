export type Pin = { lat: number; lon: number }
export type Artifact = { id: number; title: string; images: string[]; objectDate: string; beginYear: number; endYear: number; culture: string; region?: string; mediumClean?: string; description?: string; metUrl: string; civilization?: { polity: string; file: string; snapshot: string }; target?: Pin; polygons?: number[][][][]; country?: string }
export function distanceKm(a: Pin, b: Pin): number {
  const rad = Math.PI / 180
  const x = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(Math.min(1, x)))
}
export function artifactScore(artifact: Artifact, pin: Pin, year: number): { location: number; time: number; km: number; years: number; total: number } {
  const insideRing = (ring: number[][]) => {
    let inside = false
    for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const a=ring[i]!, b=ring[j]!
      if ((a[1]!>pin.lat)!==(b[1]!>pin.lat) && pin.lon < (b[0]!-a[0]!)*(pin.lat-a[1]!)/(b[1]!-a[1]!)+a[0]!) inside=!inside
    }
    return inside
  }
  const inside = artifact.polygons?.some(poly => insideRing(poly[0]!) && !poly.slice(1).some(insideRing))
  const km = inside ? 0 : artifact.polygons?.length ? Math.min(...artifact.polygons.flat(2).map(point => distanceKm(pin, {lon:point[0]!,lat:point[1]!}))) : distanceKm(pin, artifact.target ?? { lat:0,lon:0 })
  const years = Math.max(artifact.beginYear - year, 0, year - artifact.endYear)
  const location = Math.round(500 * Math.exp(-km / 1500))
  const time = Math.round(500 * Math.exp(-years / 300))
  return { location, time, km: Math.round(km), years, total: location + time }
}
