'use client'
/*
 * Renders the Anthropeum world map on Leaflet with a Natural Earth basemap built by scripts/build-basemap.py:
 * a low-detail world, 10-degree detail tiles from zoom 4, and place names that fill in as the map zooms.
 * Controls - click places the pin, drag or two-finger scroll pans, pinch or ctrl+scroll zooms around the cursor,
 * arrow keys pan and +/- zoom when the map has focus, and the toolbar zooms or resets the view.
 */
import { useEffect, useRef, useState } from 'react'
import type * as LT from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Pin } from '@/lib/artifact-scoring'

type Basemap = { land?: GeoJSON.Geometry; borders?: GeoJSON.Geometry; lakes?: GeoJSON.Geometry; coast?: GeoJSON.Geometry }
type Label = { n: string; x: number; y: number; z: number; r: number; m?: number; k?: string; c?: 1 }
type Labels = Record<'countries' | 'states' | 'places' | 'marine' | 'physio' | 'islands', Label[]>
type Manifest = { deg: number; cells: string[] }
type Candidate = Label & { cls: string; fs: number; w: number; p: number }

const BASE = '/maps/basemap', OFFSETS = [-360, 0, 360], DETAIL_ZOOM = 4, MAX_ZOOM = 8, LABEL_BIAS = 0.5
const STYLES = {
  land: { fillColor: '#f5f0e5', fillOpacity: 1, stroke: false },
  lakes: { fillColor: '#ccd8dc', fillOpacity: 1, stroke: false },
  coast: { color: '#bcb4a2', weight: 0.6, fill: false },
  borders: { color: '#bcb4a2', weight: 0.8, fill: false },
} as const

let shared: Promise<[Basemap, Candidate[], Manifest]> | null = null
const tiles = new Map<string, Promise<Basemap>>()

/*
 * Flattens every label group into 1 list ordered by display priority, with the class, font size and
 * estimated width used for collision checks (letter-spaced uppercase runs wider than mixed case).
 */
function candidates(l: Labels): Candidate[] {
  const kinds: [Label[], (x: Label) => [string, number, number, number]][] = [
    [l.physio, x => x.k === 'continent' ? ['continent', 16, 0.95, 0] : ['physio', 10, 0.72, 6]],
    [l.marine, x => x.k === 'ocean' ? ['ocean', 14, 0.85, 1] : ['sea', 11, 0.55, 6.5]],
    [l.countries, x => ['country', x.r <= 2 ? 13 : 11, 0.8, 2]],
    [l.places, x => [x.c ? 'capital' : 'place', x.c ? 12 : 11, 0.55, x.c ? 3 : 4]],
    [l.states, () => ['state', 10, 0.72, 5]],
    [l.islands, () => ['island', 10, 0.55, 7]],
  ]
  return kinds.flatMap(([list, style]) => list.map(x => {
    const [cls, fs, k, p] = style(x)
    return { ...x, cls, fs, w: x.n.length * fs * k, p: p + x.r / 20 }
  })).sort((a, b) => a.p - b.p || a.z - b.z)
}

/*
 * Loads the low-detail world, labels and detail-tile manifest once per page, retrying after a failure.
 */
function loadShared() {
  const json = <T,>(path: string) => fetch(`${BASE}/${path}`).then(r => {
    if (!r.ok) throw Error('Map unavailable')
    return r.json() as Promise<T>
  })
  return shared ??= Promise.all([json<Basemap>('world-lo.json'), json<Labels>('labels.json').then(candidates),
    json<Manifest>('tiles/manifest.json')]).catch(e => { shared = null; throw e })
}

/*
 * Draws a basemap's land, lakes and borders shifted by a longitude offset into a pane's canvas.
 */
function drawBasemap(L: typeof LT, data: Basemap, offset: number, renderer: LT.Renderer, pane: string) {
  const group = L.layerGroup()
  for (const key of ['land', 'lakes', 'coast', 'borders'] as const) {
    const geom = data[key]
    if (geom) L.geoJSON(geom, {
      style: STYLES[key], renderer, pane, interactive: false,
      coordsToLatLng: c => L.latLng(c[1]!, c[0]! + offset),
    } as LT.GeoJSONOptions).addTo(group)
  }
  return group
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)

export default function MapPicker({ pin, onChange, target, region }: { pin: Pin | null; onChange: (p: Pin) => void; target?: Pin | undefined; region?: number[][][][] | undefined }) {
  const box = useRef<HTMLDivElement>(null), mapRef = useRef<LT.Map | null>(null), lRef = useRef<typeof LT | null>(null)
  const pinLayer = useRef<LT.Layer | null>(null), onChangeRef = useRef(onChange), resetRef = useRef(() => {})
  const [ready, setReady] = useState(false), [zoom, setZoom] = useState({ z: 0, min: 0 }), [failed, setFailed] = useState(false)
  const revealing = !!(target || region)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  /*
   * Creates the map, its basemap, detail tiles, labels and gesture handlers, and tears them down on unmount.
   */
  useEffect(() => {
    let dead = false, cleanup = () => {}
    void import('leaflet').then(({ default: L }) => {
      const el = box.current
      if (dead || !el) return
      const fitZoom = () => Math.max(0, Math.log2(el.clientHeight / 256))
      const map = L.map(el, {
        zoomSnap: 0, zoomDelta: 1, minZoom: fitZoom(), maxZoom: MAX_ZOOM, worldCopyJump: true, inertia: true,
        scrollWheelZoom: false, attributionControl: false, zoomControl: false, keyboardPanDelta: 100,
        maxBounds: L.latLngBounds([-85.05, -1e5], [85.05, 1e5]), maxBoundsViscosity: 1,
      })
      map.setView([20, 10], fitZoom(), { animate: false })
      for (const [name, z] of [['anthroLo', 200], ['anthroDetail', 210], ['anthroRegion', 350], ['anthroLabels', 380]] as const) {
        const pane = map.createPane(name)
        pane.style.zIndex = String(z)
        pane.style.pointerEvents = 'none'
      }
      const loRenderer = L.canvas({ pane: 'anthroLo', padding: 0.4 }), detailRenderer = L.canvas({ pane: 'anthroDetail', padding: 0.4 })
      const labels = L.layerGroup([], { pane: 'anthroLabels' }).addTo(map), lo = L.layerGroup().addTo(map)
      const detail = new Map<string, LT.LayerGroup>()
      let data: [Basemap, Candidate[], Manifest] | null = null

      // Places labels by priority, skipping any that would sit within a small gap of one already placed, up to a cap
      // scaled to the map's area so the map stays readable.
      const relabel = () => {
        labels.clearLayers()
        if (!data) return
        const z = map.getZoom(), size = map.getSize(), placed: number[][] = []
        for (const l of data[1]) {
          if (l.z - LABEL_BIAS > z || (l.m !== undefined && z > l.m + 1)) continue
          if (placed.length >= size.x * size.y / 7000) break
          for (const off of OFFSETS) {
            const pt = map.latLngToContainerPoint([l.y, l.x + off]), dot = l.cls === 'place' || l.cls === 'capital'
            const b = dot ? [pt.x - 3, pt.y - l.fs / 2, pt.x + 6 + l.w, pt.y + l.fs / 2] : [pt.x - l.w / 2, pt.y - l.fs / 2, pt.x + l.w / 2, pt.y + l.fs / 2]
            if (b[2]! < 0 || b[0]! > size.x || b[3]! < 0 || b[1]! > size.y) continue
            if (placed.some(q => b[0]! < q[2]! + 12 && b[2]! + 12 > q[0]! && b[1]! < q[3]! + 6 && b[3]! + 6 > q[1]!)) continue
            placed.push(b)
            L.marker([l.y, l.x + off], {
              pane: 'anthroLabels', interactive: false, keyboard: false,
              icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<span class="anthro-label anthro-label-${l.cls}">${esc(l.n)}</span>` }),
            }).addTo(labels)
          }
        }
      }

      // Shows 10m detail for the visible cells from zoom 4 and hides the low-detail world once they are drawn.
      const redetail = () => {
        if (!data) return
        const manifest = data[2], cells = new Set(manifest.cells), deg = manifest.deg, b = map.getBounds(), needed = new Set<string>()
        if (map.getZoom() >= DETAIL_ZOOM) {
          for (let lon = Math.floor(b.getWest() / deg) * deg; lon < b.getEast(); lon += deg) {
            const off = Math.floor((lon + 180) / 360) * 360, col = Math.round((lon - off + 180) / deg)
            for (let lat = Math.ceil(b.getNorth() / deg) * deg; lat > b.getSouth(); lat -= deg) {
              const id = `${col}_${Math.round((90 - lat) / deg)}`
              if (cells.has(id)) needed.add(`${id}@${off}`)
            }
          }
        }
        for (const [key, layer] of detail) if (!needed.has(key)) map.removeLayer(layer)
        let pending = 0
        for (const key of needed) {
          const have = detail.get(key)
          if (have) { if (!map.hasLayer(have)) have.addTo(map); continue }
          pending++
          const [id, off] = key.split('@') as [string, string]
          let request = tiles.get(id)
          if (!request) {
            request = fetch(`${BASE}/tiles/${id}.json`).then(r => r.json() as Promise<Basemap>)
            request.catch(() => tiles.delete(id))
            tiles.set(id, request)
          }
          void request.then(t => {
            if (dead || detail.has(key)) return
            detail.set(key, drawBasemap(L, t, Number(off), detailRenderer, 'anthroDetail'))
            redetail()
          }).catch(() => {})
        }
        const showLo = !needed.size || pending > 0
        if (showLo !== map.hasLayer(lo)) { if (showLo) lo.addTo(map); else map.removeLayer(lo) }
      }

      loadShared().then(d => {
        if (dead) return
        data = d
        for (const off of OFFSETS) drawBasemap(L, d[0], off, loRenderer, 'anthroLo').addTo(lo)
        relabel()
        redetail()
      }).catch(() => { if (!dead) setFailed(true) })

      const sync = () => setZoom({ z: map.getZoom(), min: map.getMinZoom() })
      map.on('moveend zoomend', () => { relabel(); redetail(); sync() })
      map.on('click', (e: LT.LeafletMouseEvent) => {
        if (revealing) return
        const ll = e.latlng.wrap()
        onChangeRef.current({ lat: Math.max(-85, Math.min(85, ll.lat)), lon: ll.lng })
      })

      // Two-finger scroll pans; pinch arrives as ctrl+wheel (Chrome, Firefox) or gesture events (Safari).
      let gestureZoom: number | null = null
      const wheel = (e: WheelEvent) => {
        e.preventDefault()
        if (e.ctrlKey) {
          if (gestureZoom === null) map.setZoomAround(map.mouseEventToContainerPoint(e), map.getZoom() - e.deltaY * 0.01, { animate: false })
          return
        }
        const k = e.deltaMode === 1 ? 16 : 1
        map.panBy([e.deltaX * k, e.deltaY * k], { animate: false })
      }
      const gesture = (e: Event) => {
        e.preventDefault()
        const g = e as Event & { scale: number; clientX: number; clientY: number }
        if (e.type === 'gesturestart') gestureZoom = map.getZoom()
        else if (e.type === 'gestureend') gestureZoom = null
        else if (gestureZoom !== null) map.setZoomAround(map.mouseEventToContainerPoint(g as unknown as MouseEvent), gestureZoom + Math.log2(g.scale), { animate: false })
      }
      const listeners: [string, EventListener][] = [['wheel', wheel as EventListener], ['gesturestart', gesture], ['gesturechange', gesture], ['gestureend', gesture]]
      for (const [type, fn] of listeners) el.addEventListener(type, fn, { passive: false })
      // Re-homes the view the first time the container gets a size, since the map can mount before layout.
      let sized = el.clientWidth > 0 && el.clientHeight > 0
      const observer = new ResizeObserver(() => {
        map.invalidateSize({ animate: false })
        map.setMinZoom(fitZoom())
        if (!sized && el.clientWidth && el.clientHeight) { sized = true; home() }
        sync()
      })
      observer.observe(el)

      let revealBounds: LT.LatLngBounds | null = null
      if (target || region) {
        const regionPane = { pane: 'anthroRegion', interactive: false }
        let bounds = L.latLngBounds([])
        if (region) for (const off of OFFSETS) {
          const layer = L.geoJSON({ type: 'MultiPolygon', coordinates: region } as GeoJSON.MultiPolygon, {
            ...regionPane, style: { color: '#237351', weight: 1.5, fillColor: '#237351', fillOpacity: 0.35, fillRule: 'evenodd' },
            coordsToLatLng: c => L.latLng(c[1]!, c[0]! + off),
          } as LT.GeoJSONOptions).addTo(map)
          if (!off) bounds = layer.getBounds()
        }
        if (target) {
          L.circleMarker([target.lat, target.lon], { pane: 'markerPane', radius: 7, color: 'white', weight: 2, fillColor: '#236548', fillOpacity: 1 }).addTo(map)
          bounds.extend([target.lat, target.lon])
        }
        const near = target ?? (bounds.isValid() ? { lat: bounds.getCenter().lat, lon: bounds.getCenter().lng } : null)
        if (pin && near) {
          const guess = L.latLng(pin.lat, pin.lon + 360 * Math.round((near.lon - pin.lon) / 360))
          if (target) L.polyline([guess, [target.lat, target.lon]], { ...regionPane, color: '#7a1f1a', weight: 2, dashArray: '6 6' }).addTo(map)
          bounds.extend(guess)
        }
        if (bounds.isValid()) revealBounds = bounds.pad(0.3)
      }
      // Returns to the reveal framing, or to the whole world at about 2x the height-filling zoom.
      const home = () => {
        if (!el.clientWidth || !el.clientHeight) return
        map.setMinZoom(fitZoom())
        if (revealBounds) map.fitBounds(revealBounds, { maxZoom: 5, animate: false })
        else map.setView([20, 10], Math.max(fitZoom(), Math.min(2, Math.log2(el.clientWidth / 256))), { animate: false })
      }
      home()
      resetRef.current = home

      mapRef.current = map
      lRef.current = L
      setReady(true)
      sync()
      cleanup = () => {
        observer.disconnect()
        for (const [type, fn] of listeners) el.removeEventListener(type, fn)
        map.remove()
        mapRef.current = null
      }
    })
    return () => { dead = true; cleanup() }
  }, [revealing]) // eslint-disable-line react-hooks/exhaustive-deps -- the map mounts once per round; the parent remounts it on reveal

  /*
   * Draws the guess pin on the world copy nearest the view center, or near the target while revealing.
   */
  useEffect(() => {
    const map = mapRef.current, L = lRef.current
    if (!ready || !map || !L) return
    if (pinLayer.current) map.removeLayer(pinLayer.current)
    pinLayer.current = null
    if (!pin) return
    const ref = target?.lon ?? map.getCenter().lng
    pinLayer.current = L.circleMarker([pin.lat, pin.lon + 360 * Math.round((ref - pin.lon) / 360)], {
      pane: 'markerPane', radius: 7, color: 'white', weight: 2, fillColor: '#8b3e2f', fillOpacity: 1, interactive: false,
    }).addTo(map)
  }, [pin, ready, target])

  const zoomBy = (d: number) => mapRef.current?.setZoom(mapRef.current.getZoom() + d)
  const times = 2 ** (zoom.z - zoom.min)
  return <div>
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Zoom in map" data-hotkey="+ =" className="rounded border px-3 py-1" onClick={() => zoomBy(1)} disabled={zoom.z >= MAX_ZOOM}>+</button>
      <button type="button" aria-label="Zoom out map" data-hotkey="- _" className="rounded border px-3 py-1" onClick={() => zoomBy(-1)} disabled={zoom.z <= zoom.min + 0.01}>−</button>
      <button type="button" data-hotkey="0" className="text-sm underline" onClick={() => resetRef.current()}>Reset map</button>
      <span className="text-xs">{times < 10 ? times.toFixed(1) : Math.round(times)}× · drag or scroll to pan · pinch to zoom</span>
    </div>
    <div ref={box} className="anthro-leaflet" role="application" aria-label="World map. Click to place a pin; drag, scroll or use arrow keys to pan; pinch or +/- to zoom." />
    {failed && <p className="absolute inset-x-0 top-1/2 text-center text-sm">Map unavailable. Use precise coordinates below.</p>}
    <p className="text-xs text-[var(--ink-muted)]">Red: your guess{region ? ' · green: historical origin region' : target ? ' · green: origin' : ''}</p>
  </div>
}
