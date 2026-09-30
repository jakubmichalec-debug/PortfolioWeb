"""Preview helpers: STL -> PNG (numpy + PIL painter's algorithm), AI (PDF-compatible) -> PNG."""
import re
import struct

import numpy as np
from PIL import Image, ImageDraw


def read_stl(path):
    """Return (n, 3, 3) float array of triangles; empty array for header-only files."""
    data = open(path, "rb").read()
    if len(data) >= 84:
        n = struct.unpack("<I", data[80:84])[0]
        if 84 + n * 50 == len(data):
            dt = np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])
            arr = np.frombuffer(data[84:], dtype=dt)
            return arr["v"].astype(float)
    txt = data.decode("utf8", "ignore")
    vs = re.findall(r"vertex\s+(\S+)\s+(\S+)\s+(\S+)", txt)
    if not vs:
        return np.zeros((0, 3, 3))
    return np.array(vs, dtype=float).reshape(-1, 3, 3)


def _rot_z(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def _rot_x(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def geometry_key(tris):
    """Rounded, order-independent fingerprint of the triangle data (ignores STL header text)."""
    if len(tris) == 0:
        return "empty"
    r = np.round(tris, 3).reshape(len(tris), 9)
    r = r[np.lexsort(r.T[::-1])]
    return str(hash(r.tobytes())) + f":{len(tris)}"


def render_stl(tris, size=200, az=-35, el=35):
    """Shaded 3/4 view of a triangle mesh on a light background."""
    ss = 2
    big = size * ss
    img = Image.new("RGB", (big, big), (246, 247, 249))
    if len(tris) == 0:
        return img.resize((size, size))
    c = (tris.reshape(-1, 3).max(0) + tris.reshape(-1, 3).min(0)) / 2
    t = (tris - c) @ (_rot_x(np.radians(-(90 - el))) @ _rot_z(np.radians(az))).T
    # screen coords: x right, -z up ; depth = y (larger = farther)
    sx, sy, depth = t[..., 0], -t[..., 2], t[..., 1]
    span = max(sx.max() - sx.min(), sy.max() - sy.min(), 1e-6)
    scale = big * 0.86 / span
    ox = big / 2 - (sx.max() + sx.min()) / 2 * scale
    oy = big / 2 - (sy.max() + sy.min()) / 2 * scale
    n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    nl = np.linalg.norm(n, axis=1)
    nl[nl == 0] = 1
    n = n / nl[:, None]
    light = np.array([-0.45, -0.55, 0.70])
    light /= np.linalg.norm(light)
    shade = 0.30 + 0.70 * np.abs(n @ light)
    order = np.argsort(-depth.mean(axis=1))
    d = ImageDraw.Draw(img)
    base = np.array([86, 118, 158])
    for i in order:
        pts = [(sx[i, k] * scale + ox, sy[i, k] * scale + oy) for k in range(3)]
        col = tuple(int(x) for x in np.clip(base * shade[i] * 1.25, 0, 255))
        d.polygon(pts, fill=col, outline=col)
    return img.resize((size, size), Image.LANCZOS)


def montage(images, size=200):
    """1 image -> full tile; 2-4 images -> 2x2 grid."""
    canvas = Image.new("RGB", (size, size), (246, 247, 249))
    if len(images) == 1:
        canvas.paste(images[0].resize((size, size)), (0, 0))
        return canvas
    half = size // 2
    for i, im in enumerate(images[:4]):
        canvas.paste(im.resize((half, half), Image.LANCZOS), ((i % 2) * half, (i // 2) * half))
    d = ImageDraw.Draw(canvas)
    d.line([(half, 0), (half, size)], fill=(215, 218, 224))
    d.line([(0, half), (size, half)], fill=(215, 218, 224))
    return canvas


def render_ai(path, size=200):
    """Render a PDF-compatible .ai (laser-cut outline) to a square PNG; None if it can't be read."""
    try:
        import pdfplumber

        with pdfplumber.open(path) as pdf:
            im = pdf.pages[0].to_image(resolution=110).original.convert("RGB")
    except Exception:
        return None
    im.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2))
    return canvas


def render_svg(path, size=200):
    """Draw every path/shape of a laser-cut SVG as dark outlines on white; None if unreadable/empty."""
    try:
        from svgelements import SVG, Close, Move, Path, Shape

        svg = SVG.parse(path)
        lines = []
        for e in svg.elements():
            if not isinstance(e, Shape):
                continue
            p = Path(e)
            cur = []
            for seg in p:
                if isinstance(seg, Move):
                    if len(cur) > 1:
                        lines.append(cur)
                    cur = [(seg.end.x, seg.end.y)]
                elif isinstance(seg, Close):
                    cur.append((seg.end.x, seg.end.y))
                else:
                    pts = seg.npoint(np.linspace(0, 1, 24))
                    cur.extend((float(a), float(b)) for a, b in pts)
            if len(cur) > 1:
                lines.append(cur)
        allp = np.array([pt for ln in lines for pt in ln], dtype=float)
        if len(allp) < 2 or not np.isfinite(allp).all():
            return None
        lo, hi = allp.min(0), allp.max(0)
        w, h = hi[0] - lo[0], hi[1] - lo[1]
        if max(w, h) / max(min(w, h), 1e-6) > 40:  # a hairline strip / stray far-off shape: not a useful preview
            return None
        span = max(w, h, 1e-6)
        ss = 2
        big = size * ss
        scale = big * 0.88 / span
        off = (np.array([big, big]) - (hi - lo) * scale) / 2
        img = Image.new("RGB", (big, big), (255, 255, 255))
        d = ImageDraw.Draw(img)
        for ln in lines:
            pts = [tuple((np.array(pt) - lo) * scale + off) for pt in ln]
            d.line(pts, fill=(45, 55, 72), width=3)
        return img.resize((size, size), Image.LANCZOS)
    except Exception:
        return None
