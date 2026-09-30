"""Assemble the pinball cabinet's 5 laser-cut panels into their real, built shape - not a
flat exploded grid. The individually-exported SVGs disagree with each other about units
(some are FreeCAD-native and declare "Xmm" directly, one has that mm width silently
re-expressed as CSS pixels by svgelements' own parser, two others are Illustrator exports
with no physical unit at all - their raw numbers are points), so unit-correcting each one
by eye and trusting the result would be guesswork. What isn't guesswork is the FreeCAD
document's own Placement data for each panel's sketch: a real rotation + position, straight
from Document.xml inside the .FCStd, that's how the machine was actually built.

Bottom, Front and Back use their real finger-jointed outlines (unit-corrected per the above).
The two side panels don't use their exported SVGs at all - SideLeft's file is fragmented
into 35 disjoint pieces and SideRight's declared/measured dimensions never reconciled under
any unit fix - so instead their real profile (finger joints and all) is read straight out of
each sketch's own <Property name="Geometry"> in Document.xml: 33 line segments that chain
into one closed loop with no gaps, confirmed to correctly slope from 316mm at the back edge
to 206mm at the front (a genuinely sloped cabinet, matching Front's and Back's own panel
heights independently). Both side sketches carry identical local geometry - it's the same
panel design mirrored by Placement, not two different shapes.

Two things in the raw data are corrected before the panels meet - both proven, not assumed
(tools/check_box_joints.py re-runs the proof):
  - SVG's Y axis points DOWN, the sketch frame each Placement was authored for points up.
    Left unflipped, Back and Front come out upside down: their fingers miss the side panels'
    notches by exactly 6mm and their straight top edge lands on the floor.
  - Placement rotations are right, but positions drift a few mm between the independently
    drawn sketches. A finger-jointed panel is cut to the box's OUTER size along every edge,
    fingers included - and all five agree exactly (bottom 900x612, sides 900x316, back
    612x316, front 612x206) - so each panel is snapped, by translation only, flush against
    that shared outer envelope.
With both, all 8 joints interlock exactly: sampled every 0.5mm along each one, precisely one
panel has material at every point - no overlap, no gap.
"""
import re
import sys
import zipfile

import numpy as np

sys.path.insert(0, __import__("os").path.dirname(__file__))
from svg_extrude import _ear_clip, extrude  # noqa: E402

FCSTD = "C:/Users/jakub/Desktop/KdG/fablab/boxProjectFinger.FCStd"
SVG_DIR = "C:/Users/jakub/Desktop/KdG/fablab/"
PANEL_FILES = {
    "Bottom": "boxProjectFinger-BottomSketch.svg",
    "Front": "boxProjectFinger-FrontFingerSketch002.svg",
    "Back": "boxProjectFinger-BackSketch004.svg",
}
PT_TO_MM = 25.4 / 72  # Bottom, Front: Illustrator export, no declared physical unit -> points
PX_TO_MM = 25.4 / 96  # Back: declares width="...mm" but svgelements re-expresses it as CSS px
THICKNESS = 6.0  # mm, MDF (matches the build report)


def _read_placements():
    """(sketch name, owning Body name) -> {"sketch": {...}, "body": {...} or None} of the raw
    Px/Py/Pz/Q0-3/A/Ox/Oy/Oz attributes on each <PropertyPlacement>, straight from the FCStd's
    own Document.xml - no coordinates guessed, only ever what FreeCAD itself recorded."""
    xml = zipfile.ZipFile(FCSTD).read("Document.xml").decode("utf8")

    def props(name, extensions_tag=False):
        pat = rf'<Object name="{re.escape(name)}"(?: Extensions="True")?>(.*?)</Object>\s*(?=<Object|\Z)' if not extensions_tag else rf'<Object name="{re.escape(name)}" Extensions="True">(.*?)</Object>\s*(?=<Object|\Z)'
        m = re.search(pat, xml, re.S)
        if not m:
            return None
        seg = m.group(1)
        pm = re.search(r'<Property name="Placement"[^>]*>\s*<PropertyPlacement\s+([^/]+)/>', seg, re.S)
        if not pm:
            return None
        return {k: float(v) for k, v in re.findall(r'(\w+)="([-\d.eE]+)"', pm.group(1))}

    return {
        "Bottom": {"sketch": props("Sketch"), "body": props("Body", True)},
        "Front": {"sketch": props("Sketch002"), "body": props("Body002", True)},
        "Back": {"sketch": props("Sketch004"), "body": props("Body004", True)},
        "SideLeft": {"sketch": props("Sketch001"), "body": props("Body001", True)},
        "SideRight": {"sketch": props("Sketch005"), "body": props("Body005", True)},
    }


def _sketch_geometry_loop(xml_object_data, sketch_name):
    """The sketch's real user-drawn profile as a closed 2D polygon (local mm), read from its
    own <Property name="Geometry"> - NOT the 2-segment axis-reference GeometryList that sits
    alongside it in the same object (easy to grab by mistake if you don't scope this tight)."""
    m = re.search(rf'<Object name="{re.escape(sketch_name)}"[^>]*>(.*?)</Object>\s*(?=<Object|\Z)', xml_object_data, re.S)
    prop = re.search(r'<Property name="Geometry"[^>]*>(.*?)</Property>', m.group(1), re.S)
    segs = re.findall(r'<LineSegment StartX="([-\d.]+)" StartY="([-\d.]+)"[^>]*EndX="([-\d.]+)" EndY="([-\d.]+)"', prop.group(1))
    segs = [tuple(float(v) for v in s) for s in segs]
    if not segs:
        raise ValueError(f"{sketch_name}: no LineSegment geometry found")

    chain = [segs[0][:2], segs[0][2:]]
    remaining = segs[1:]
    while remaining:
        tail = chain[-1]
        for i, s in enumerate(remaining):
            a, b = s[:2], s[2:]
            if np.allclose(a, tail, atol=1e-6):
                chain.append(b)
                remaining.pop(i)
                break
            if np.allclose(b, tail, atol=1e-6):
                chain.append(a)
                remaining.pop(i)
                break
        else:
            raise ValueError(f"{sketch_name}: {len(segs)} segments don't chain into one closed loop ({len(remaining)} left over)")
    if not np.allclose(chain[0], chain[-1], atol=1e-6):
        raise ValueError(f"{sketch_name}: chained segments don't close (start != end)")
    return np.array(chain[:-1])


def _rodrigues(axis, angle):
    ax = np.array(axis, dtype=float)
    n = np.linalg.norm(ax)
    if n < 1e-12 or abs(angle) < 1e-12:
        return np.eye(3)
    ax = ax / n
    K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
    return np.eye(3) + np.sin(angle) * K + (1 - np.cos(angle)) * (K @ K)


def _extrude_loop(pts2d, thickness):
    tri_idx, pts = _ear_clip(pts2d)
    tris = []
    for i0, i1, i2 in tri_idx:
        a, b, c = pts[i0], pts[i1], pts[i2]
        tris.append([[a[0], a[1], 0], [c[0], c[1], 0], [b[0], b[1], 0]])
        tris.append([[a[0], a[1], thickness], [b[0], b[1], thickness], [c[0], c[1], thickness]])
    n = len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        a0, b0 = [a[0], a[1], 0], [b[0], b[1], 0]
        a1, b1 = [a[0], a[1], thickness], [b[0], b[1], thickness]
        tris.extend([[a0, b0, b1], [a0, b1, a1]])
    return np.array(tris, dtype=float)


def _to_global(local_tris, placement):
    sk, bp = placement["sketch"], placement["body"]
    R = _rodrigues((sk["Ox"], sk["Oy"], sk["Oz"]), sk["A"])
    flat = local_tris.reshape(-1, 3)
    g = (R @ flat.T).T + np.array([sk["Px"], sk["Py"], sk["Pz"]])
    if bp:
        g = g + np.array([bp["Px"], bp["Py"], bp["Pz"]])
    return g.reshape(-1, 3, 3)


def assembled_box_triangles():
    """Returns {panel name: (N, 3, 3) triangles}, in CAD mm, all 5 panels in one shared frame:
    the box's outer envelope spans X 0 -> length (back -> front), Y 0 -> width (SideLeft ->
    SideRight) and Z 0 -> height. Concatenate the values for the assembled hero part, or hand
    each one to glb_export.write_glb separately to isolate a single panel."""
    placements = _read_placements()
    parts = {}
    for name, unit in [("Bottom", PT_TO_MM), ("Front", PT_TO_MM), ("Back", PX_TO_MM)]:
        local = extrude(SVG_DIR + PANEL_FILES[name], THICKNESS / unit) * unit
        local[..., 1] *= -1  # SVG is Y-down, the sketch frame is Y-up (see module docstring)
        local = local[:, [0, 2, 1]]  # a mirror reverses winding - swap two vertices back
        parts[name] = _to_global(local, placements[name])

    xml = zipfile.ZipFile(FCSTD).read("Document.xml").decode("utf8")
    od = xml[xml.index("<ObjectData"):]
    side_loop = _sketch_geometry_loop(od, "Sketch001")  # Sketch005 (SideRight) is identical
    side_shape = _extrude_loop(side_loop, THICKNESS)
    parts["SideLeft"] = _to_global(side_shape, placements["SideLeft"])
    parts["SideRight"] = _to_global(side_shape, placements["SideRight"])

    length = np.ptp(parts["SideLeft"][..., 0])
    width = np.ptp(parts["Bottom"][..., 1])
    corner = {
        "Bottom": (0, 0, 0),
        "Front": (length - THICKNESS, 0, 0),
        "Back": (0, 0, 0),
        "SideLeft": (0, 0, 0),
        "SideRight": (0, width - THICKNESS, 0),
    }
    for name, tris in parts.items():
        parts[name] = tris + (np.array(corner[name]) - tris.reshape(-1, 3).min(0))
    return parts


def box_dimensions(parts):
    """The box's real outer measurements in mm, read off the assembled panels themselves."""
    def extent(name, axis):
        return float(np.ptp(parts[name][..., axis]))

    return {
        "length": extent("SideLeft", 0),
        "width": extent("Bottom", 1),
        "height_back": extent("Back", 2),
        "height_front": extent("Front", 2),
    }


def dimension_lines(parts, offset=70.0):
    """Drafting-style dimension lines for the assembled box, in CAD mm. Each measurement
    (group) has a candidate line on every edge that could carry it; each candidate is the
    measured edge (a -> b), that edge pushed out to where its dimension line is drawn
    (a2 -> b2), and the outward normals of the faces meeting at that edge. A viewer shows,
    per group, the candidate FURTHEST from the camera among those with a face turned toward
    it - for a height that's an outline (silhouette) corner, not the corner nearest the eye,
    so the measurements spread around the box instead of piling up at one corner."""
    d = box_dimensions(parts)
    length, width, h_back, h_front = d["length"], d["width"], d["height_back"], d["height_front"]
    o, s = offset, offset * 0.4  # out from the edge; a little sideways so corner lines don't meet
    k = offset / np.sqrt(2)  # diagonal: straight out of a vertical corner
    left, right, back, front = (0, -1, 0), (0, 1, 0), (-1, 0, 0), (1, 0, 0)

    def line(group, value, a, b, off, *faces):
        return {
            "group": group, "value": value, "a": a, "b": b,
            "a2": tuple(np.add(a, off)), "b2": tuple(np.add(b, off)), "faces": faces,
        }

    return [
        line("length", length, (0, 0, 0), (length, 0, 0), (0, -s, -o), left),
        line("length", length, (0, width, 0), (length, width, 0), (0, s, -o), right),
        line("width", width, (0, 0, 0), (0, width, 0), (-s, 0, -o), back),
        line("width", width, (length, 0, 0), (length, width, 0), (s, 0, -o), front),
        line("height_back", h_back, (0, 0, 0), (0, 0, h_back), (-k, -k, 0), back, left),
        line("height_back", h_back, (0, width, 0), (0, width, h_back), (-k, k, 0), back, right),
        line("height_front", h_front, (length, 0, 0), (length, 0, h_front), (k, -k, 0), front, left),
        line("height_front", h_front, (length, width, 0), (length, width, h_front), (k, k, 0), front, right),
    ]
