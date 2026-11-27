"""
Builds data/geo/world.json, the 1 data file behind the geography dailies (Outline, Border hop, Pin drop, Ballpark).
Reads 2 public-domain Natural Earth GeoJSON files: ne_50m_admin_0_countries and ne_110m_populated_places_simple
(https://github.com/nvkelso/natural-earth-vector/tree/master/geojson).

Usage: python3 scripts/build-geo.py COUNTRIES.geojson PLACES.geojson
"""

import json
import math
import sys
from collections import defaultdict

R = 6371.0088


# Names Natural Earth writes formally, and the overseas borders (French Guiana) that would link Europe to South America.
NAMES = {
    "United States of America": "United States",
    "Republic of Serbia": "Serbia",
    "United Republic of Tanzania": "Tanzania",
    "The Bahamas": "Bahamas",
    "Czechia": "Czech Republic",
}
# Territories and unrecognised states that Natural Earth lists beside the countries.
SKIP = {"ATA", "ALD", "GGY", "JEY", "IMN", "CUW", "ABW", "SXM", "CYN", "SOL", "MAC", "HKG"}
FAR = {("FRA", "BRA"), ("FRA", "SUR"), ("BRA", "FRA"), ("SUR", "FRA")}


def rings(geom, holes=False):
    """Returns every polygon of a geometry as its outer ring, or every ring when holes are wanted."""
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    return [r for p in polys for r in p] if holes else [p[0] for p in polys]


def ring_area(ring):
    """Computes the area of a ring on the sphere in square kilometres."""
    t = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        t += math.radians(x2 - x1) * (2 + math.sin(math.radians(y1)) + math.sin(math.radians(y2)))
    return abs(t) * R * R / 2


def km(a, b):
    """Measures the great-circle distance between 2 (lon, lat) points."""
    (x1, y1), (x2, y2) = a, b
    p1, p2 = math.radians(y1), math.radians(y2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(x2 - x1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def outline(parts):
    """
    Draws a country's main landmass as an SVG path inside a 100 x 100 box. Keeps the pieces that are at least 3% of
    the largest one and within 3,000 km of it, so far territories do not shrink the shape.
    """
    if max(x for r in parts for x, _ in r) - min(x for r in parts for x, _ in r) > 180:
        parts = [[(x + 360 if x < 0 else x, y) for x, y in r] for r in parts]
    sized = sorted(((ring_area(r), r) for r in parts), key=lambda s: -s[0])
    mid = lambda r: (sum(x for x, _ in r) / len(r), sum(y for _, y in r) / len(r))
    home = mid(sized[0][1])
    keep = [r for a, r in sized if a >= sized[0][0] * 0.03 and km(home, mid(r)) < 3000]
    lat0 = math.radians(sum(y for r in keep for _, y in r) / sum(len(r) for r in keep))
    flat = [[(x * math.cos(lat0), -y) for x, y in r] for r in keep]
    xs, ys = [x for r in flat for x, _ in r], [y for r in flat for _, y in r]
    k = 100 / max(max(xs) - min(xs), max(ys) - min(ys))
    ox, oy = (100 - (max(xs) - min(xs)) * k) / 2, (100 - (max(ys) - min(ys)) * k) / 2
    out = []
    for r in flat:
        pts = []
        for x, y in r:
            p = (round(((x - min(xs)) * k + ox) * 4) / 4, round(((y - min(ys)) * k + oy) * 4) / 4)
            if not pts or math.dist(p, pts[-1]) >= 0.6:
                pts.append(p)
        if len(pts) >= 4:
            out.append("M" + "L".join(f"{x:g},{y:g}" for x, y in pts) + "Z")
    return "".join(out)


def main(countries_path, places_path):
    """Writes the countries (name, label point, population, area, neighbours, outline) and the large cities."""
    feats = [
        f
        for f in json.load(open(countries_path))["features"]
        if f["properties"]["TYPE"] in ("Sovereign country", "Country") and f["properties"]["ADM0_A3"] not in SKIP
    ]
    seen = defaultdict(set)
    for f in feats:
        for r in rings(f["geometry"], True):
            for x, y in r:
                seen[(round(x, 4), round(y, 4))].add(f["properties"]["ADM0_A3"])
    shared = defaultdict(int)
    for ids in seen.values():
        for a in ids:
            for b in ids:
                if a != b:
                    shared[(a, b)] += 1
    countries = []
    for f in sorted(feats, key=lambda f: NAMES.get(f["properties"]["ADMIN"], f["properties"]["ADMIN"])):
        p, parts = f["properties"], rings(f["geometry"])
        countries.append(
            {
                "id": p["ADM0_A3"],
                "name": NAMES.get(p["ADMIN"], p["ADMIN"]),
                "lat": round(p["LABEL_Y"], 2),
                "lon": round(p["LABEL_X"], 2),
                "pop": int(p["POP_EST"]),
                "area": round(sum(ring_area(r) for r in parts)),
                "nb": sorted(b for (a, b), n in shared.items() if a == p["ADM0_A3"] and n >= 2 and (a, b) not in FAR),
                "path": outline(parts),
            }
        )
    cities = [
        {
            "name": q["name"],
            "country": q["adm0name"],
            "lat": round(q["latitude"], 3),
            "lon": round(q["longitude"], 3),
            "pop": int(q["pop_max"]),
        }
        for q in (f["properties"] for f in json.load(open(places_path))["features"])
        if q["pop_max"] >= 300000
    ]
    cities.sort(key=lambda c: c["name"])
    json.dump({"countries": countries, "cities": cities}, open("data/geo/world.json", "w"), separators=(",", ":"))
    print(len(countries), "countries,", len(cities), "cities")


main(*sys.argv[1:3])
