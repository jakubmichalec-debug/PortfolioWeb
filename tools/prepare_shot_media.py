"""Prepare the Shot Dispenser media for the site. Originals are never changed.

Sources (on the author's PC, not in the repo):
  ~/Desktop/FestivalProject/Shot           phone photos and the demo video
  ~/Desktop/KdG/ShotDispenser/Shot Dispenser.docx   the project report (sketch, Tinkercad tests, photos)

Output: site/assets/media/shot-dispenser/. Everything is silent, with metadata and GPS stripped.
Needs Pillow, plus ffmpeg on the PATH.

    python tools/prepare_shot_media.py
"""
import io
import subprocess
import zipfile
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = Path.home() / "Desktop"
SHOT = DESKTOP / "FestivalProject" / "Shot"
REPORT = DESKTOP / "KdG" / "ShotDispenser" / "Shot Dispenser.docx"
OUT = ROOT / "site/assets/media/shot-dispenser"


def clean(im):
    """Rebuild the pixels in a fresh image: no EXIF, GPS or colour-profile payload survives."""
    im = im.convert("RGB")
    fresh = Image.new("RGB", im.size)
    fresh.paste(im)
    return fresh


def save(im, name, size=1400, quality=86):
    im = clean(im)
    im.thumbnail((size, size), Image.Resampling.LANCZOS)
    im.save(OUT / f"{name}.webp", "WEBP", quality=quality, method=6)
    print(f"{name}.webp  {im.size[0]}x{im.size[1]}")


def frac(im, left=0.0, top=0.0, right=1.0, bottom=1.0):
    w, h = im.size
    return im.crop((int(w * left), int(h * top), int(w * right), int(h * bottom)))


def heic(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "2", "-"],
                         check=True, capture_output=True).stdout
    return Image.open(io.BytesIO(raw))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = zipfile.ZipFile(REPORT)

    def doc(number, ext="png"):
        return Image.open(io.BytesIO(report.read(f"word/media/image{number}.{ext}")))

    # Real photos. The front photo is cropped below a bystander; the phone's "inside" photo cannot be
    # cropped that way, so the report's own inside photo (nobody in it) is used instead.
    save(frac(ImageOps.exif_transpose(Image.open(SHOT / "photos/shot-dispenser-front.jpg")), top=0.2), "front")
    save(heic(SHOT / "photos/shot-dispenser-rfid-front.HEIC"), "front-empty")
    save(doc(20, "jpeg"), "inside")
    save(doc(21, "jpeg").rotate(-90, expand=True), "front-finished")   # the report stores it on its side
    save(doc(19, "jpeg"), "leds")

    # The report's concept sketch and Tinkercad component tests. Three screenshots also show code; keep the circuit.
    save(doc(1), "sketch")
    save(frac(doc(3), right=0.54), "test-leds")
    save(doc(4), "test-lcd")
    save(doc(7), "test-pump")
    save(doc(8), "test-water-sensor")
    save(frac(doc(10), right=0.41), "test-buzzer")
    save(frac(doc(11), right=0.52), "test-reader")
    save(doc(12), "setup")

    # The demo: one take, upright, silent, no capture metadata.
    video = OUT / "demo.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SHOT / "videos/shot-dispenser-demo.mp4"),
                    "-vf", "scale=720:-2", "-an", "-map_metadata", "-1", "-c:v", "libx264", "-preset", "slow", "-crf", "26",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(video)], check=True)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", "8", "-i", str(video), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "2", "-"],
                         check=True, capture_output=True).stdout
    poster = clean(Image.open(io.BytesIO(raw)))
    poster.save(OUT / "demo-poster.jpg", quality=84, optimize=True)
    print(f"demo.mp4  {video.stat().st_size / 1e6:.2f} MB, poster {poster.size}")


if __name__ == "__main__":
    main()
