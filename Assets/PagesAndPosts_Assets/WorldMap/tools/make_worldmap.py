"""Makes the blog's world map files from Natural Earth outlines (public domain).

Input : world-atlas countries-110m.json and countries-50m.json (npm package "world-atlas" 2.0.2,
        which is Natural Earth data) + extra_shapes.json (Aksai Chin, Shaksam Valley, Arunachal Pradesh, lon/lat)
        + split_shapes.json (places taken out of a country: Tibet out of China).
Output: ../world-light.svg     footer map   (110m outlines + a dot for every place too small for them)
        ../world-detailed.svg  pop-up map   (50m outlines, wiggles under ~2 km smoothed away)
        ../countries/<Name>.svg one file per country (50m, full detail), for your collection

Every shape is already projected (Natural Earth projection, the same frame for all files), so the
files line up exactly and the browser only has to draw them.
Each shape carries:  data-n  the place's name (as Natural Earth writes it)
                     data-bb its biggest piece's box  "x1 y1 x2 y2"   (where the map flies to)
                     data-ball the box around all its pieces
Usage:  python3 make_worldmap.py <folder with countries-110m.json and countries-50m.json>
"""
import json, math, os, re, sys, unicodedata

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
VB = (-272, -141, 544, 276)          # x, y, width, height of every file's frame (whole world)

# places drawn as ONE place: the first name is the place, the others are part of it (no shapes or files of
# their own). India follows Sri Aurobindo's map.
GROUPS = {"India": ["India", "Pakistan", "Bangladesh", "Nepal", "Bhutan", "Sri Lanka", "Myanmar",
                    "Siachen Glacier", "Aksai Chin", "Shaksam Valley", "Arunachal Pradesh"]}
MEMBER = {m: head for head, ms in GROUPS.items() for m in ms if m != head}


def proj(lon, lat):
    """Natural Earth projection (lon/lat in degrees -> x/y, 100 units = 1 radian)."""
    l, q = math.radians(lon), math.radians(lat)
    q2 = q * q; q4 = q2 * q2
    x = l * (0.8707 - 0.131979 * q2 + q4 * (-0.013791 + q4 * (0.003971 * q2 - 0.001529 * q4))) * 100
    y = -q * (1.007226 + q2 * (0.015085 + q4 * (-0.044475 + 0.028874 * q2 - 0.005916 * q4))) * 100
    return x, y


def rdp(pts, eps):
    """Ramer-Douglas-Peucker: drop points that stray less than eps from the line."""
    if eps <= 0 or len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    best, bi = 0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        d = math.hypot(p[0] - a[0], p[1] - a[1]) if L == 0 else abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / L
        if d > best:
            best, bi = d, i
    if best > eps:
        return rdp(pts[:bi + 1], eps)[:-1] + rdp(pts[bi:], eps)
    return [a, b]


def num(v, dec):
    s = "%.*f" % (dec, v)
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def cnum(v, dec):
    """an integer number of 1/10^dec units -> shortest text: 12.3, .5, -.05"""
    s = ("%%.%df" % dec) % (v / 10 ** dec) if dec else str(v)
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    if s.startswith("0.") and len(s) > 2:
        s = s[1:]
    elif s.startswith("-0.") and len(s) > 3:
        s = "-" + s[2:]
    return "0" if s in ("-0", "") else s


def sep(nxt):
    """a space is only needed before a number that doesn't start with "-" (and the dot case is handled
    by always using a space - simple and safe)"""
    return "" if nxt.startswith("-") else " "


def ring_to_xy(raw):
    """lon/lat ring -> projected points; rings crossing the 180 degree line are kept in one piece."""
    lons = [p[0] for p in raw]
    jump = any(abs(raw[i][0] - raw[i - 1][0]) > 180 and abs(raw[i][1]) < 89 for i in range(1, len(raw)))
    polar = min(p[1] for p in raw) < -60
    if jump and not polar:
        east = sum(1 for l in lons if l > 0) > len(lons) / 2
        raw = [((l + 360) if east and l < 0 else (l - 360) if (not east and l > 0) else l, q) for l, q in raw]
    return [proj(l, q) for l, q in raw]


def load(fn):
    t = json.load(open(fn))
    tf = t["transform"]
    arcs = []
    for a in t["arcs"]:
        x = y = 0; o = []
        for p in a:
            x += p[0]; y += p[1]
            o.append((x * tf["scale"][0] + tf["translate"][0], y * tf["scale"][1] + tf["translate"][1]))
        arcs.append(o)
    places = []
    for g in t["objects"]["countries"]["geometries"]:
        if "arcs" not in g:
            continue
        polys = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
        pieces = []
        for pl in polys:
            rings = []
            for r in pl:
                raw = []
                for k, ai in enumerate(r):
                    a = arcs[~ai][::-1] if ai < 0 else arcs[ai]
                    raw += a[1:] if k else a
                rings.append(raw)
            pieces.append(rings)
        places.append({"name": g["properties"]["name"], "raw": pieces})
    return places


def project(place, gather=False):
    """lon/lat -> map points. gather=True (single-country files): pieces on the far side of the 180 degree
    line are moved next to the country's biggest piece (Russia's Chukotka tip, Fiji's eastern islands)."""
    raw = place["raw"]
    if gather and len(raw) > 1:
        def ext(rings):
            ls = [p[0] for p in rings[0]]; qs = [p[1] for p in rings[0]]
            return (max(ls) - min(ls)) * (max(qs) - min(qs)), sum(ls) / len(ls)
        main = max(raw, key=lambda r: ext(r)[0]); mc = ext(main)[1]
        moved = []
        for rings in raw:
            c = ext(rings)[1]
            shift = 360 if c - mc < -180 else (-360 if c - mc > 180 else 0)
            moved.append([[(l + shift, q) for l, q in r] for r in rings] if shift else rings)
        raw = moved
    if gather:
        # pieces that themselves straddle the 180 degree line (Wrangel Island) go to the country's side
        mc = sum(p[0] for p in max(raw, key=lambda r: len(r[0]))[0]) / len(max(raw, key=lambda r: len(r[0]))[0])
        raw = [[[((l + 360) if mc > 0 and l < -90 else (l - 360) if mc < 0 and l > 90 else l, q) for l, q in r] for r in rings] for rings in raw]
    place["pieces"] = [[ring_to_xy(r) for r in rings] for rings in raw]
    return place


def extra_places():
    d = json.load(open(os.path.join(HERE, "extra_shapes.json")))
    names = {"aksaichin": "Aksai Chin", "shaksamvalley": "Shaksam Valley", "arunachalpradesh": "Arunachal Pradesh"}
    return [{"name": names.get(k, k), "raw": [[pts]]} for k, pts in d.items()]


def split_out(places):
    """split_shapes.json: places taken out of a country (Tibet out of China). The new place is the outline cut
    to the country's own border (so the coast and the borders with the neighbours stay the same), and the
    country keeps the rest."""
    try:
        from shapely.geometry import Polygon
        from shapely.ops import unary_union
    except ImportError:
        print("shapely not installed: split_shapes.json is not used (pip install shapely)")
        return places
    d = json.load(open(os.path.join(HERE, "split_shapes.json")))
    def geom(raw):
        gs = []
        for rings in raw:
            g = Polygon(rings[0], rings[1:])
            gs.append(g if g.is_valid else g.buffer(0))
        return unary_union(gs)
    def raw_of(g):
        gs = [g] if g.geom_type == "Polygon" else [q for q in getattr(g, "geoms", []) if q.geom_type == "Polygon"]
        return [[list(q.exterior.coords)] + [list(r.coords) for r in q.interiors] for q in gs if q.area > 1e-4]
    by = {p["name"]: p for p in places}
    for country, news in d.items():
        if country.startswith("_") or country not in by:
            continue
        cg = geom(by[country]["raw"])
        for name, ring in news.items():
            ng = Polygon(ring).buffer(0).intersection(cg)
            places.append({"name": name, "raw": raw_of(ng)})
            cg = cg.difference(ng.buffer(1e-6))
            print("split", name, "out of", country)
        by[country]["raw"] = raw_of(cg)
    return places


def cut_groups(places):
    """A group's members and extra shapes win over their neighbours: the world map draws Aksai Chin and
    Shaksam Valley inside China, so China gets them cut out. Without this China lies underneath India's
    top, and shows through when India is dimmed or hovered (the top of India seems to vanish)."""
    try:
        from shapely.geometry import Polygon, MultiPolygon
        from shapely.ops import unary_union
    except ImportError:
        print("shapely not installed: groups are not cut out of their neighbours (pip install shapely)")
        return places
    def geom(p):
        gs = []
        for rings in p["raw"]:
            g = Polygon(rings[0], rings[1:])
            gs.append(g if g.is_valid else g.buffer(0))
        return unary_union(gs)
    for head, members in GROUPS.items():
        grp = unary_union([geom(p) for p in places if p["name"] in members]).buffer(1e-6)
        for p in places:
            if p["name"] in members:
                continue
            g = geom(p)
            if not g.intersects(grp) or g.intersection(grp).area < 1e-3:   # a shared border is not an overlap
                continue
            d = g.difference(grp)
            d = [d] if d.geom_type == "Polygon" else [q for q in getattr(d, "geoms", []) if q.geom_type == "Polygon"]
            p["raw"] = [[list(q.exterior.coords)] + [list(r.coords) for r in q.interiors] for q in d if q.area > 1e-6]
            print("cut", head, "out of", p["name"])
    return places


def box(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return [min(xs), min(ys), max(xs), max(ys)]


def path_of(place, dec, eps):
    d, best, allb = "", None, None
    for rings in place["pieces"]:
        b = box(rings[0])
        area = (b[2] - b[0]) * (b[3] - b[1])
        if best is None or area > best[0]:
            best = (area, b)
        allb = b if allb is None else [min(allb[0], b[0]), min(allb[1], b[1]), max(allb[2], b[2]), max(allb[3], b[3])]
        for r in rings:
            # rounded points, then written as small steps from the previous point ("l" = relative line),
            # which keeps the precision and makes the file much smaller
            k = 10 ** dec
            pts, last = [], None
            for x, y in rdp(r, eps):
                s = (round(x * k), round(y * k))
                if s != last:
                    pts.append(s); last = s
            if len(pts) < 3:
                continue
            d += "M" + cnum(pts[0][0], dec) + sep(cnum(pts[0][1], dec)) + cnum(pts[0][1], dec) + "l"
            prev, first = pts[0], True
            for p in pts[1:]:
                a, b = cnum(p[0] - prev[0], dec), cnum(p[1] - prev[1], dec)
                d += ("" if first else sep(a)) + a + sep(b) + b
                prev, first = p, False
            d += "Z"
    return d, best[1], allb


def union(a, b):
    return b if a is None else [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]


def emit(places, dec, eps, with_ball=True):
    """shapes for a file: ordinary places as <path>, a group as one <g> holding its parts' paths."""
    by = {p["name"]: p for p in places}
    out = []
    for p in places:
        if p["name"] in MEMBER:
            continue
        if p["name"] in GROUPS:
            parts, ball = [], None
            for m in GROUPS[p["name"]]:
                if m in by:
                    d, b, a = path_of(by[m], dec, eps)
                    ball = union(ball, a)
                    parts.append('<path d="%s"/>' % d)
            out.append('<g data-n="%s" data-bb="%s"%s>%s</g>' % (esc(p["name"]), bbs(ball), (' data-ball="%s"' % bbs(ball)) if with_ball else "", "".join(parts)))
            continue
        d, b, a = path_of(p, dec, eps)
        out.append('<path data-n="%s" data-bb="%s"%s d="%s"/>' % (esc(p["name"]), bbs(b), (' data-ball="%s"' % bbs(a)) if with_ball else "", d))
    return out


def bbs(b):
    return " ".join(num(v, 2) for v in b)


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def head(vb, fill="#138808"):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" fill="%s" fill-rule="evenodd">'
            % (" ".join(num(v, 2) for v in vb), fill))


def safe_name(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")


def main():
    extra = extra_places()
    light = cut_groups(split_out(load(os.path.join(SRC, "countries-110m.json"))) + extra_places())
    light = [p for p in light if p["name"] not in {e["name"] for e in extra}]   # the extras are added back below
    detail = cut_groups(split_out(load(os.path.join(SRC, "countries-50m.json"))) + extra)
    detail = [p for p in detail if p["name"] not in {e["name"] for e in extra}]
    os.makedirs(os.path.join(OUT, "countries"), exist_ok=True)

    # ---- detailed (pop-up): 50m, 2 decimals, wiggles under 0.03 units (~2 km) smoothed
    out = [head(VB), "<title>World map (Natural Earth, public domain)</title>"]
    for p in detail + extra:
        project(p)
    for p in light:
        project(p)
    out += emit(detail + extra, 2, 0.03)
    out.append("</svg>")
    open(os.path.join(OUT, "world-detailed.svg"), "w").write("\n".join(out))

    # ---- light (footer): 110m, 1 decimal; places missing from 110m get a dot at their biggest piece
    have = {p["name"] for p in light}
    out = [head(VB, "#f8ecc6"), "<title>World map, light (Natural Earth, public domain)</title>"]
    extra_light = [p for p in detail if p["name"] in MEMBER and p["name"] not in have] + extra   # e.g. Siachen
    out += emit(light + extra_light, 1, 0, with_ball=False)
    for p in detail:
        if p["name"] in have or p["name"] in MEMBER:
            continue
        d, b, a = path_of(p, 2, 0)
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        out.append('<circle class="dot" data-n="%s" cx="%s" cy="%s" r="3.2"/>' % (esc(p["name"]), num(cx, 1), num(cy, 1)))
    out.append("</svg>")
    open(os.path.join(OUT, "world-light.svg"), "w").write("\n".join(out))

    # ---- one file per place (50m, full detail), framed on the place with a little margin
    allp = detail + extra
    for p in allp:
        project(p, gather=True)
    by = {p["name"]: p for p in allp}
    n = 0
    for p in allp:
        if p["name"] in MEMBER:
            continue                              # part of a group: drawn inside the group's file
        parts = [by[m] for m in GROUPS.get(p["name"], [p["name"]]) if m in by]
        ds, a = [], None
        for q in parts:
            d, b, aa = path_of(q, 3, 0)
            ds.append('<path d="%s"/>' % d)
            a = union(a, aa)
        m = max(a[2] - a[0], a[3] - a[1]) * 0.06 + 0.5
        vb = (a[0] - m, a[1] - m, a[2] - a[0] + 2 * m, a[3] - a[1] + 2 * m)
        svg = head(vb) + '<title>%s</title><g data-n="%s">%s</g></svg>' % (esc(p["name"]), esc(p["name"]), "".join(ds))
        open(os.path.join(OUT, "countries", safe_name(p["name"]) + ".svg"), "w").write(svg)
        n += 1
    print("done:", n, "places (groups count once)")


if __name__ == "__main__":
    main()
