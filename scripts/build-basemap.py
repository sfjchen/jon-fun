"""
Builds the Anthropeum basemap in public/maps/basemap from Natural Earth (public domain) GeoJSON.

Outputs world-lo.json (50m land, borders, lakes), tiles/<col>_<row>.json (10m detail clipped to
10-degree cells, loaded when zoomed in), tiles/manifest.json and labels.json (zoom-ranked names).

Usage: python scripts/build-basemap.py <natural-earth-geojson-dir>   (needs shapely 2.x)
Sources: https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
"""
import json, math, os, sys
from shapely.geometry import shape, mapping, box
from shapely.ops import polylabel, unary_union

SRC, OUT = sys.argv[1], os.path.join(os.path.dirname(__file__), '..', 'public', 'maps', 'basemap')
CELL = 10


def load(name):
    """
    Loads a Natural Earth layer's features.
    """
    with open(os.path.join(SRC, f'{name}.geojson')) as f:
        return json.load(f)['features']


def rounded(obj, dp):
    """
    Rounds every coordinate in a GeoJSON geometry mapping to dp decimals.
    """
    if isinstance(obj, (list, tuple)):
        return [rounded(o, dp) for o in obj] if obj and isinstance(obj[0], (list, tuple)) else [round(v, dp) for v in obj]
    return obj


def layer(name, tol, dp, clip=None):
    """
    Merges a layer into 1 simplified geometry (optionally clipped to a box) as rounded GeoJSON.
    """
    geoms = [shape(f['geometry']).buffer(0) if 'Polygon' in f['geometry']['type'] else shape(f['geometry'])
             for f in load(name) if f['geometry']]
    return finish(unary_union(geoms) if 'Polygon' in geoms[0].geom_type else unary_union(geoms), tol, dp, clip)


def finish(geom, tol, dp, clip=None):
    """
    Clips, simplifies and rounds a geometry, or returns None when nothing is left.
    """
    if clip is not None:
        geom = geom.intersection(clip)
    geom = geom.simplify(tol, preserve_topology=True)
    if geom.is_empty:
        return None
    m = mapping(geom)
    return {'type': m['type'], 'coordinates': rounded(m['coordinates'], dp)}


def write(path, data):
    """
    Writes compact JSON, creating folders as needed.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, separators=(',', ':'), ensure_ascii=False)


def inner(geom):
    """
    Returns the visual center of a (multi)polygon's largest part as (lon, lat).
    """
    part = max(getattr(geom, 'geoms', [geom]), key=lambda g: g.area)
    p = polylabel(part, tolerance=0.1)
    return round(p.x, 2), round(p.y, 2)


def labels():
    """
    Collects named features with the zoom (z) at which each first appears and a priority rank (r, lower first).
    """
    out = {'countries': [], 'states': [], 'places': [], 'marine': [], 'physio': [], 'islands': []}
    for f in load('ne_50m_admin_0_countries'):
        p = f['properties']
        out['countries'].append({'n': p['NAME'], 'x': round(p['LABEL_X'], 2), 'y': round(p['LABEL_Y'], 2),
                                 'z': p['MIN_LABEL'], 'r': p['LABELRANK']})
    for f in load('ne_10m_admin_1_states_provinces'):
        p = f['properties']
        if p.get('name') and p.get('min_label', 99) <= 7 and p.get('latitude') is not None:
            out['states'].append({'n': p['name'], 'x': round(p['longitude'], 2), 'y': round(p['latitude'], 2),
                                  'z': p['min_label'], 'r': p['labelrank']})
    for f in load('ne_10m_populated_places_simple'):
        p = f['properties']
        if p['min_zoom'] <= 8:
            out['places'].append({'n': p['name'], 'x': round(p['longitude'], 2), 'y': round(p['latitude'], 2),
                                  'z': p['min_zoom'], 'r': p['scalerank'], **({'c': 1} if p['adm0cap'] else {})})
    for f in load('ne_10m_geography_marine_polys'):
        p = f['properties']
        if p.get('name') and f['geometry'] and p['min_label'] <= 7:
            x, y = inner(shape(f['geometry']))
            out['marine'].append({'n': p['name'], 'x': x, 'y': y, 'z': p['min_label'], 'r': p['scalerank'],
                                  'm': p['max_label'], 'k': p['featurecla']})
    for f in load('ne_10m_geography_regions_polys'):
        p = f['properties']
        if not p.get('NAME') or not f['geometry'] or p['MIN_LABEL'] > 7:
            continue
        x, y = inner(shape(f['geometry']))
        kind = p['FEATURECLA'].lower()
        out['islands' if kind.startswith('island') else 'physio'].append(
            {'n': p['NAME'], 'x': x, 'y': y, 'z': p['MIN_LABEL'], 'r': p['SCALERANK'], 'm': p['MAX_LABEL'], 'k': kind})
    for v in out.values():
        v.sort(key=lambda l: (l['z'], l['r']))
    return out


write(os.path.join(OUT, 'world-lo.json'), {
    'land': layer('ne_50m_land', 0.02, 2),
    'borders': layer('ne_50m_admin_0_boundary_lines_land', 0.02, 2),
    'lakes': layer('ne_50m_lakes', 0.02, 2),
})
write(os.path.join(OUT, 'labels.json'), labels())
detail = {k: layer(f'ne_10m_{k}' if k != 'borders' else 'ne_10m_admin_0_boundary_lines_land', 0, 6)
          for k in ('land', 'borders', 'lakes')}
detail = {k: shape(v) for k, v in detail.items()}
cells = []
for col in range(360 // CELL):
    for row in range(180 // CELL):
        west, north = col * CELL - 180, 90 - row * CELL
        # Pads each cell slightly so neighboring tiles overlap and leave no seams.
        clip = box(west - 0.05, north - CELL - 0.05, west + CELL + 0.05, north + 0.05)
        tile = {k: finish(g, 0.004, 3, clip) for k, g in detail.items()}
        tile = {k: v for k, v in tile.items() if v}
        if tile:
            write(os.path.join(OUT, 'tiles', f'{col}_{row}.json'), tile)
            cells.append(f'{col}_{row}')
write(os.path.join(OUT, 'tiles', 'manifest.json'), {'deg': CELL, 'cells': cells})
print(f'{len(cells)} detail tiles')
