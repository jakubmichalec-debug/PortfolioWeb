"""Minimal, dependency-free glTF 2.0 binary (.glb) writer for CAD-sourced meshes.

Takes one or more named triangle sets (Z-up CAD millimetres, the FreeCAD/STL convention)
and writes a single .glb: one mesh + node per part, laid out left-to-right with a small
gap so multi-piece components read as "a kit of parts" rather than overlapping geometry.

No indices are written (each STL triangle already has 3 unique vertices, so an index
buffer would only add bytes, never save any). Normals are recomputed per corner with a crease
angle (see _smooth_normals): curved surfaces shade smoothly, real edges stay sharp.
"""
import json
import struct

import numpy as np

# CAD is Z-up millimetres; glTF is Y-up metres. Rotate -90 deg about X, then scale by 1/1000.
_MM_TO_M = 0.001


def _cad_to_gltf(pts):
    x, y, z = pts[..., 0], pts[..., 1], pts[..., 2]
    return np.stack([x, z, -y], axis=-1) * _MM_TO_M


def single_part_frame(tris):
    """(point, direction) functions mapping CAD-mm coordinates into the model space of a
    single-part write_glb export of `tris` - Y-up metres, re-centred exactly the way
    write_glb's node translation re-centres a lone part - for anchoring annotations such as
    model-viewer hotspots onto the exported model."""
    conv = _cad_to_gltf(np.asarray(tris, dtype=float).reshape(-1, 3))
    centre = (conv.min(0) + conv.max(0)) / 2

    def point(p):
        return (_cad_to_gltf(np.asarray(p, dtype=float)) - centre).tolist()

    def direction(v):
        return (_cad_to_gltf(np.asarray(v, dtype=float)) / _MM_TO_M).tolist()

    return point, direction


CREASE_DEG = 40.0  # neighbouring faces meeting at less than this shade as one smooth surface


def _corner_angles(tris):
    """Interior angle at each triangle corner, flattened in the same order as tris.reshape(-1, 3)."""
    def angle(u, v):
        cos = np.einsum("ij,ij->i", u, v) / (np.linalg.norm(u, axis=1) * np.linalg.norm(v, axis=1) + 1e-30)
        return np.arccos(np.clip(cos, -1, 1))

    p0, p1, p2 = tris[:, 0], tris[:, 1], tris[:, 2]
    return np.stack([angle(p1 - p0, p2 - p0), angle(p2 - p1, p0 - p1), angle(p0 - p2, p1 - p2)], axis=1).ravel()


def _smooth_normals(tris, crease_deg=CREASE_DEG):
    """Per-corner normals, CAD-viewer style: each corner averages the normals of the faces
    around its vertex that meet its own face at under `crease_deg`, so tessellated curves -
    fillets, holes, rounded ends - shade as the smooth surfaces they are, while real edges
    (a 90deg corner, a finger joint) stay sharp. Each face counts by the angle it spans at the
    vertex, not its area: CAD exports are full of long thin triangles that would otherwise
    drag a normal toward whichever side happens to be split into more pieces."""
    face = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    length = np.linalg.norm(face, axis=1, keepdims=True)
    unit = face / np.where(length < 1e-12, 1, length)
    corner_angle = _corner_angles(tris)

    # weld corners that sit on the same point (to a micron) into one shared vertex
    key = np.round(tris.reshape(-1, 3) / 1e-6).astype(np.int64)
    _, vid = np.unique(key, axis=0, return_inverse=True)
    vid = vid.ravel()
    fid = np.repeat(np.arange(len(tris)), 3)

    cos_crease = np.cos(np.radians(crease_deg))
    out = np.repeat(unit, 3, axis=0)  # fallback: the flat face normal
    order = np.argsort(vid, kind="stable")
    starts = np.flatnonzero(np.r_[True, vid[order][1:] != vid[order][:-1]])
    ends = np.r_[starts[1:], len(order)]
    for s, e in zip(starts, ends):
        if e - s < 2:
            continue
        corners = order[s:e]
        faces = fid[corners]
        together = (unit[faces] @ unit[faces].T) > cos_crease  # which neighbours blend with which
        summed = together.astype(float) @ (unit[faces] * corner_angle[corners][:, None])
        norm = np.linalg.norm(summed, axis=1, keepdims=True)
        ok = norm[:, 0] > 1e-12
        out[corners[ok]] = summed[ok] / norm[ok]
    return out


def write_glb(parts, out_path, base_color=(0.86, 0.88, 0.92, 1.0), metallic=0.12, roughness=0.5):
    """parts: list of (name, triangles) with triangles a float (N, 3, 3) array in CAD mm.
    Empty/degenerate parts are skipped. Raises ValueError if nothing usable remains."""
    usable = [(name, tris) for name, tris in parts if tris is not None and len(tris) > 0]
    if not usable:
        raise ValueError("no usable triangles for " + out_path)

    converted = [(name, _cad_to_gltf(tris)) for name, tris in usable]

    # lay multiple parts out as a "kit of parts" on the ground plane (gltf X/Z), grid-packed
    # so the group's overall silhouette stays roughly square instead of one long thin strip
    # (a plain left-to-right line reads badly once parts differ a lot in size, e.g. box panels).
    gap = 0.006
    bboxes = []
    for name, tris in converted:
        flat = tris.reshape(-1, 3)
        bboxes.append((name, tris, flat.min(0), flat.max(0)))
    cell_w = max(hi[0] - lo[0] for _, _, lo, hi in bboxes) + gap
    cell_d = max(hi[2] - lo[2] for _, _, lo, hi in bboxes) + gap
    cols = max(1, round(len(bboxes) ** 0.5))
    rows = -(-len(bboxes) // cols)
    grid_w, grid_d = cols * cell_w, rows * cell_d
    placements = []
    for i, (name, tris, lo, hi) in enumerate(bboxes):
        col, row = i % cols, i // cols
        cx = col * cell_w + cell_w / 2 - grid_w / 2
        cz = row * cell_d + cell_d / 2 - grid_d / 2
        ox = cx - (lo[0] + hi[0]) / 2
        oz = cz - (lo[2] + hi[2]) / 2
        oy = -(lo[1] + hi[1]) / 2
        placements.append((name, tris, ox, oy, oz))

    buffer = bytearray()
    accessors, buffer_views, meshes, nodes = [], [], [], []

    def add_view(data_bytes):
        offset = len(buffer)
        buffer.extend(data_bytes)
        while len(buffer) % 4:
            buffer.append(0)
        buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data_bytes)})
        return len(buffer_views) - 1

    for name, tris, ox, oy, oz in placements:
        flat = tris.reshape(-1, 3).astype("<f4")
        normals = _smooth_normals(tris).astype("<f4")
        pos_view = add_view(flat.tobytes())
        nrm_view = add_view(normals.tobytes())
        accessors.append({
            "bufferView": pos_view, "componentType": 5126, "count": len(flat), "type": "VEC3",
            "min": flat.min(0).tolist(), "max": flat.max(0).tolist(),
        })
        pos_acc = len(accessors) - 1
        accessors.append({"bufferView": nrm_view, "componentType": 5126, "count": len(normals), "type": "VEC3"})
        nrm_acc = len(accessors) - 1
        meshes.append({
            "name": name,
            "primitives": [{"attributes": {"POSITION": pos_acc, "NORMAL": nrm_acc}, "material": 0}],
        })
        nodes.append({"name": name, "mesh": len(meshes) - 1, "translation": [ox, oy, oz]})

    gltf = {
        "asset": {"version": "2.0", "generator": "portfolio glb_export.py"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": [{
            "pbrMetallicRoughness": {"baseColorFactor": list(base_color), "metallicFactor": metallic, "roughnessFactor": roughness},
            "doubleSided": True,
        }],
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(buffer)}],
    }

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    while len(json_bytes) % 4:
        json_bytes += b" "
    bin_bytes = bytes(buffer)
    while len(bin_bytes) % 4:
        bin_bytes += b"\x00"

    with open(out_path, "wb") as f:
        total_len = 12 + (8 + len(json_bytes)) + (8 + len(bin_bytes))
        f.write(struct.pack("<III", 0x46546C67, 2, total_len))
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        f.write(struct.pack("<II", len(bin_bytes), 0x004E4942))
        f.write(bin_bytes)
    return total_len
