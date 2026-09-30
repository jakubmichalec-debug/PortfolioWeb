"""Prove the assembled box (assemble_box.py) is put together right: every one of its 8
finger joints must interlock exactly. Samples each joint every 0.5mm along its length, down
the middle of the 6x6mm strip two panels share, and counts points where BOTH panels have
material (overlap) or NEITHER does (gap). A correct assembly scores 0 overlap and 0 gap on
every joint - the only exception is the 6mm corner cube at the foot of each vertical joint,
which belongs to the bottom panel (a third panel) and so reads as "neither" for that pair.

Run: python tools/check_box_joints.py
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from assemble_box import THICKNESS, assembled_box_triangles, box_dimensions  # noqa: E402


def face_2d(tris, axis, which):
    """The panel's outer-face triangles (all 3 vertices on its max/min plane along `axis`),
    projected onto the other two axes."""
    level = tris[..., axis].max() if which == "max" else tris[..., axis].min()
    on = np.all(np.abs(tris[..., axis] - level) < 1e-6, axis=1)
    return tris[on][:, :, [i for i in range(3) if i != axis]]


def covers(tris2d, p):
    a, b, c = tris2d[:, 0], tris2d[:, 1], tris2d[:, 2]

    def side(o, q):
        return (o[:, 0] - p[0]) * (q[:, 1] - p[1]) - (o[:, 1] - p[1]) * (q[:, 0] - p[0])

    d1, d2, d3 = side(a, b), side(b, c), side(c, a)
    neg = (d1 < -1e-9) | (d2 < -1e-9) | (d3 < -1e-9)
    pos = (d1 > 1e-9) | (d2 > 1e-9) | (d3 > 1e-9)
    return bool(np.any(~(neg & pos)))


def main():
    parts = assembled_box_triangles()
    dims = box_dimensions(parts)
    L, W, Hb, Hf = dims["length"], dims["width"], dims["height_back"], dims["height_front"]
    print(f"outer size: {L:.2f} x {W:.2f} mm, {Hb:.2f} tall at the back, {Hf:.2f} at the front")

    faces = {  # (outer-face triangles in 2D, which 3D axes those 2D coordinates are)
        "Bottom": (face_2d(parts["Bottom"], 2, "max"), (0, 1)),
        "SideLeft": (face_2d(parts["SideLeft"], 1, "min"), (0, 2)),
        "SideRight": (face_2d(parts["SideRight"], 1, "max"), (0, 2)),
        "Back": (face_2d(parts["Back"], 0, "min"), (1, 2)),
        "Front": (face_2d(parts["Front"], 0, "max"), (1, 2)),
    }

    def has(name, p):
        tris2d, (i, j) = faces[name]
        return covers(tris2d, (p[i], p[j]))

    h = THICKNESS / 2
    joints = [
        ("Bottom", "SideLeft", lambda u: (u, h, h), L),
        ("Bottom", "SideRight", lambda u: (u, W - h, h), L),
        ("Bottom", "Back", lambda u: (h, u, h), W),
        ("Bottom", "Front", lambda u: (L - h, u, h), W),
        ("SideLeft", "Back", lambda u: (h, h, u), Hb),
        ("SideRight", "Back", lambda u: (h, W - h, u), Hb),
        ("SideLeft", "Front", lambda u: (L - h, h, u), Hf),
        ("SideRight", "Front", lambda u: (L - h, W - h, u), Hf),
    ]
    ok = True
    for a, b, at, span in joints:
        overlap, gap = [], []
        for u in np.arange(0.25, span, 0.5):
            pa, pb = has(a, at(u)), has(b, at(u))
            if pa and pb:
                overlap.append(u)
            elif not (pa or pb) and not (a != "Bottom" and u < THICKNESS):
                gap.append(u)
        good = not overlap and not gap
        ok &= good
        print(f"  {a:9} + {b:9}  overlap {len(overlap) * 0.5:5.1f}mm  gap {len(gap) * 0.5:5.1f}mm  {'OK' if good else 'FAIL'}")
    print("all joints interlock exactly" if ok else "ASSEMBLY IS WRONG")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
