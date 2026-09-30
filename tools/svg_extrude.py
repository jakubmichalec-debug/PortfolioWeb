"""Turn a laser-cut SVG outline into a solid 3D slab of a given thickness.

These files only ever recorded a flat cut path (that's what a laser cutter needs), but the
real part is a physical panel with real thickness (6mm MDF, per the build report). This
recovers that missing dimension: parse the SVG's closed loop(s), keep the largest (the panel
boundary; small secondary loops are minor details like a mounting hole, dropped for clarity),
ear-clip it into a flat triangle fan, then extrude that fan into top/bottom caps + side walls.

Coordinates come out as (x, y, z) with z the extrusion axis, in the SVG's own units (mm, same
convention FreeCAD/the STL exports use), so a caller can pass the result straight to
glb_export.write_glb next to real STL triangles - both are already in "CAD Z-up millimetres".
"""
import numpy as np


def svg_closed_loops(path):
    """List of (N,2) arrays, one per closed subpath, largest-area first. [] if unreadable."""
    from svgelements import SVG, Close, Move, Path, Shape

    svg = SVG.parse(path)
    loops = []
    for e in svg.elements():
        if not isinstance(e, Shape):
            continue
        cur = []
        for seg in Path(e):
            if isinstance(seg, Move):
                if len(cur) > 2:
                    loops.append(cur)
                cur = [(seg.end.x, seg.end.y)]
            elif isinstance(seg, Close):
                cur.append((seg.end.x, seg.end.y))
            else:
                pts = seg.npoint(np.linspace(0, 1, 16))
                cur.extend((float(a), float(b)) for a, b in pts)
        if len(cur) > 2:
            loops.append(cur)
    out = []
    for loop in loops:
        pts = np.array(loop, dtype=float)
        if np.allclose(pts[0], pts[-1]):
            pts = pts[:-1]
        if len(pts) >= 3 and np.isfinite(pts).all():
            out.append(pts)
    out.sort(key=lambda p: -abs(_signed_area(p)))
    return out


def _signed_area(pts):
    x, y = pts[:, 0], pts[:, 1]
    return 0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y)


def _dedupe(pts, eps=1e-6):
    """Drop points that sit right on top of their predecessor - near-zero-length edges
    from SVG curve sampling turn into zero-area 'ears' that stall the clipper below."""
    keep = [pts[0]]
    for p in pts[1:]:
        if np.linalg.norm(p - keep[-1]) > eps:
            keep.append(p)
    if len(keep) > 1 and np.linalg.norm(keep[0] - keep[-1]) <= eps:
        keep.pop()
    return np.array(keep)


def _ear_clip(pts):
    """pts: (N,2) simple polygon, either winding. Returns index triples, CCW-consistent."""
    pts = _dedupe(pts)
    if len(pts) < 3:
        return [], pts
    if _signed_area(pts) < 0:
        pts = pts[::-1]
    idx = list(range(len(pts)))
    tris = []
    guard = 0
    while len(idx) > 3 and guard < 20000:
        guard += 1
        n = len(idx)
        clipped = False
        for i in range(n):
            i0, i1, i2 = idx[(i - 1) % n], idx[i], idx[(i + 1) % n]
            a, b, c = pts[i0], pts[i1], pts[i2]
            cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if cross <= 1e-9:
                continue
            ok = True
            for j in idx:
                if j in (i0, i1, i2):
                    continue
                if _point_in_tri(pts[j], a, b, c):
                    ok = False
                    break
            if ok:
                tris.append((i0, i1, i2))
                idx.pop(i)
                clipped = True
                break
        if not clipped:
            break
    if len(idx) == 3:
        tris.append(tuple(idx))
    return tris, pts


def _point_in_tri(p, a, b, c):
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
    d1, d2, d3 = sign(p, a, b), sign(p, b, c), sign(p, c, a)
    neg, pos = (d1 < 0 or d2 < 0 or d3 < 0), (d1 > 0 or d2 > 0 or d3 > 0)
    return not (neg and pos)


def extrude(path, thickness):
    """SVG file -> (M, 3, 3) triangle array, or None if it has no usable closed loop."""
    loops = svg_closed_loops(path)
    if not loops:
        return None
    pts = loops[0]
    tri_idx, pts = _ear_clip(pts)
    if not tri_idx:
        return None
    tris = []
    for i0, i1, i2 in tri_idx:
        a, b, c = pts[i0], pts[i1], pts[i2]
        tris.append([[a[0], a[1], 0], [c[0], c[1], 0], [b[0], b[1], 0]])  # bottom, facing down
        tris.append([[a[0], a[1], thickness], [b[0], b[1], thickness], [c[0], c[1], thickness]])  # top, facing up
    n = len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        a0, b0 = [a[0], a[1], 0], [b[0], b[1], 0]
        a1, b1 = [a[0], a[1], thickness], [b[0], b[1], thickness]
        tris.append([a0, b0, b1])
        tris.append([a0, b1, a1])
    return np.array(tris, dtype=float)
