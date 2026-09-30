"""Write site/assets/env/studio.hdr: a small procedural lighting environment for the 3D viewers.

model-viewer's built-in environments ("neutral", "legacy") light a model evenly from every
side, which is flattering for a product shot but flattens a pale CAD part: every face comes
out the same brightness, so edges and roundings disappear. This is a studio setup instead -
one big soft key light high at the front-left, a dimmer cool fill from the back-right (tinted
toward the page's blueprint blue), a soft sky and a dark floor - so faces turned toward the key
read bright and faces turned away fall into shade.

Equirectangular, Radiance RGBE, written uncompressed (three.js' loader reads flat scanlines).
Directions follow three.js' equirect mapping: u = atan2(z, x) / 2pi + 0.5, v = asin(y) / pi + 0.5,
top row = straight up; model-viewer's default camera sits on +z looking toward -z.

Run: python tools/make_studio_env.py
"""
import os

import numpy as np

OUT = os.path.join(os.path.dirname(__file__), "..", "site", "assets", "env", "studio.hdr")
W, H = 128, 64


def unit(v):
    v = np.asarray(v, dtype=float)
    return v / np.linalg.norm(v)


LIGHTS = [  # (direction the light sits in, angular radius in degrees, RGB intensity)
    (unit([-0.55, 0.75, 0.6]), 28.0, np.array([9.0, 8.7, 8.2])),  # key: high, front-left, faintly warm
    (unit([0.8, 0.25, -0.5]), 35.0, np.array([0.9, 1.15, 1.6])),  # fill: low, back-right, blueprint blue
]
SKY = np.array([0.20, 0.23, 0.30])
FLOOR = np.array([0.03, 0.035, 0.05])


def radiance():
    u = (np.arange(W) + 0.5) / W
    v = 1 - (np.arange(H) + 0.5) / H  # row 0 is the top of the sphere
    phi = (u - 0.5) * 2 * np.pi
    lat = (v - 0.5) * np.pi
    uu, ll = np.meshgrid(phi, lat)
    d = np.stack([np.cos(ll) * np.cos(uu), np.sin(ll), np.cos(ll) * np.sin(uu)], axis=-1)

    horizon = np.clip(d[..., 1:2] * 4 + 0.5, 0, 1)  # soft blend from floor to sky over ~15deg
    img = FLOOR * (1 - horizon) + SKY * horizon
    for direction, radius, rgb in LIGHTS:
        angle = np.degrees(np.arccos(np.clip(d @ direction, -1, 1)))
        falloff = np.clip(1 - angle / radius, 0, 1) ** 1.5  # soft-edged box, not a hard disc
        img = img + falloff[..., None] * rgb
    return img


def write_rgbe(path, img):
    peak = img.max(axis=-1)
    mantissa, exponent = np.frexp(peak)
    scale = np.where(peak > 1e-32, mantissa * 256.0 / np.where(peak > 1e-32, peak, 1), 0)
    rgbe = np.zeros(img.shape[:2] + (4,), dtype=np.uint8)
    rgbe[..., :3] = np.clip(img * scale[..., None], 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.where(peak > 1e-32, exponent + 128, 0).astype(np.uint8)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n")
        f.write(f"-Y {H} +X {W}\n".encode())
        f.write(rgbe.tobytes())


if __name__ == "__main__":
    write_rgbe(OUT, radiance())
    print(os.path.normpath(OUT), os.path.getsize(OUT), "bytes")
