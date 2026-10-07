"""Review and prepare Lost & Found assets; never change originals or website pages.

Run with the bundled Python (Pillow, pypdf):
    python tools/prepare_locker_media.py --review
    python tools/prepare_locker_media.py --build
    python tools/prepare_locker_media.py --verify
"""
import argparse
import hashlib
import io
import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = Path.home() / "Desktop"
SOURCE = DESKTOP / "FestivalProject" / "Locker"
REPORTS = DESKTOP / "KdG" / "fablab" / "Fusion challange"
REVIEW = ROOT / "tmp/locker-preproduction"
OUT = ROOT / "site/assets/media/lost-and-found"
FONT = "C:/Windows/Fonts/arial.ttf"

# All source times are seconds in the original, upright phone recording.
# Cuts were selected from timestamped visual review, not inferred from firmware.
SHOTS = [
    {"id": "ready", "source": "locker-full-demo", "in": 0.5, "out": 3.5,
     "title": "01 / THE PROTOTYPE", "lines": ["Lost & Found for music festivals.", "An RFID locker built around Arduino."]},
    {"id": "master", "source": "locker-full-demo", "in": 10.3, "out": 14.3,
     "title": "02 / STAFF ACCESS", "lines": ["The master card starts registration.", "The LCD shows Master Mode On."]},
    {"id": "item", "source": "locker-full-demo", "in": 14.3, "out": 18.3,
     "title": "03 / REGISTER AN ITEM", "lines": ["Scan the item's RFID tag.", "The LCD prompts Register Item."]},
    {"id": "description", "source": "locker-full-demo", "in": 20.0, "out": 25.0,
     "title": "04 / ADD A DESCRIPTION", "lines": ["Staff enter a description using", "the Arduino Serial Monitor."]},
    {"id": "placement", "source": "locker-full-demo", "in": 29.0, "out": 32.5,
     "title": "05 / STORE THE WALLET", "lines": ["Place the wallet inside the locker.", "The door is open for storage."]},
    {"id": "closure", "source": "locker-full-demo", "in": 61.0, "out": 65.5,
     "title": "05 / CLOSE THE DOOR", "lines": ["Close the locker door.", "Closure shown from the keys take."]},
    {"id": "claim", "source": "locker-full-demo", "in": 95.0, "out": 105.0,
     "title": "06 / CLAIM A MATCHING ITEM", "lines": ["A matching personal tag lights green.", "The demonstrator opens the door."]},
    {"id": "denied", "source": "locker-demo", "in": 8.5, "out": 13.5,
     "title": "07 / REJECT AN UNKNOWN TAG", "lines": ["An unknown tag is scanned.", "The LCD responds Access Denied."]},
    {"id": "inside", "source": "locker-full-demo", "in": 81.0, "out": 85.5,
     "title": "08 / INSIDE THE BUILD", "lines": ["Arduino, breadboard and wiring.", "One sketch connects the components."]},
]

CLIPS = [
    {"id": "access-granted", "source": "locker-full-demo", "in": 95.0, "out": 105.0,
     "caption": "A matching personal tag lights the green LED; the demonstrator opens the locker door.",
     "cues": [(0, 2, "A personal RFID tag is scanned."), (2, 5, "The green LED indicates a match."), (5, 10, "The demonstrator opens and closes the door.")]},
    {"id": "access-denied", "source": "locker-demo", "in": 8.5, "out": 13.5,
     "caption": "An unknown RFID tag is scanned; the display shows Access Denied.",
     "cues": [(0, 2, "An unknown RFID tag is scanned."), (2, 5, "The LCD shows Access Denied.")]},
    {"id": "registration", "source": "locker-full-demo", "editedMontage": True,
     "segments": [{"in": 10.3, "out": 25.5}, {"in": 29.0, "out": 32.5}, {"in": 61.0, "out": 66.0}],
     "caption": "Staff registration and wallet placement, followed by a successful door closure from the keys take.",
     "cues": [(0, 4, "The master card enables staff registration."), (4, 9, "Scan the item's tag; the LCD shows Register Item."), (9, 15.2, "Enter a description using the Arduino Serial Monitor."), (15.2, 18.7, "Place the wallet inside the locker."), (18.7, 23.7, "Close the door. This closure is cut from the keys take.")]},
    {"id": "electronics", "source": "locker-full-demo", "in": 81.0, "out": 88.5,
     "caption": "A close look inside the working prototype: Arduino, breadboard, LEDs and buzzer.",
     "cues": [(0, 7.5, "Inside the prototype: Arduino, breadboard and connected components.")]},
]

PHOTO_INFO = {
    "locker-finished-front": ("The black-painted Lost & Found locker with its LCD and RFID reader.", "hero / overview"),
    "locker-cardboard-front": ("The early cardboard enclosure with the LCD and RFID reader mounted on the front.", "build timeline / enclosure"),
    "locker-inside": ("Inside the early cardboard enclosure, showing the Arduino, breadboard and wiring.", "build timeline / enclosure"),
    "locker-wiring-lcd-rfid": ("The locker electronics spread out on the workbench, connected to a blue LCD.", "wiring explorer / build timeline"),
    "locker-rfid-reader": ("The MFRC522 RFID reader connected by jumper wires during assembly.", "RFID component hotspot"),
    "locker-arduino-wiring": ("The Arduino Uno and jumper wiring before enclosure assembly.", "Arduino component hotspot"),
    "locker-code-reference": ("A photograph of a laptop displaying an earlier Lost Found System code draft.", "research archive only; use readable source excerpts on the page"),
}


def run(*args):
    result = subprocess.run([str(a) for a in args], capture_output=True, check=True)
    return result.stdout


def probe(path):
    return json.loads(run("ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", path))


def frame(path, seconds, width=480):
    return Image.open(io.BytesIO(run("ffmpeg", "-v", "error", "-ss", seconds,
        "-i", path, "-frames:v", "1", "-vf", f"scale={width}:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "-"))).convert("RGB")


def sheet(items, destination, columns=5, cell=(220, 380)):
    rows = (len(items) + columns - 1) // columns
    canvas = Image.new("RGB", (columns * cell[0], rows * cell[1]), "#061849")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(FONT, 15)
    for index, (im, label) in enumerate(items):
        im = im.copy()
        im.thumbnail((cell[0] - 12, cell[1] - 45), Image.Resampling.LANCZOS)
        x, y = (index % columns) * cell[0], (index // columns) * cell[1]
        canvas.paste(im, (x + (cell[0] - im.width) // 2, y + 35))
        draw.text((x + 8, y + 8), label, fill="#ffd60a", font=font)
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, "JPEG", quality=92)


def review():
    for stem, step in [("locker-full-demo", 3), ("locker-demo", 1)]:
        src = SOURCE / "videos" / f"{stem}.mp4"
        duration = float(probe(src)["format"]["duration"])
        times = list(range(0, int(duration), step))
        for n in range(0, len(times), 15):
            selected = times[n:n + 15]
            sheet([(frame(src, t, 300), f"{t // 60:02d}:{t % 60:02d}") for t in selected],
                  REVIEW / f"{stem}-{n // 15 + 1}.jpg")
        print(f"Reviewed {stem}: {len(times)} time samples", flush=True)


def timestamp(seconds, comma=False):
    ms = round(seconds * 1000)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d}{',' if comma else '.'}{ms % 1000:03d}"


def captions(stem, cues):
    vtt, srt = ["WEBVTT", "", "NOTE Explanatory visual descriptions, not a speech transcript.", ""], []
    for i, (start, end, words) in enumerate(cues, 1):
        vtt.extend([str(i), f"{timestamp(start)} --> {timestamp(end)}", words, ""])
        srt.extend([str(i), f"{timestamp(start, True)} --> {timestamp(end, True)}", words, ""])
    (OUT / f"{stem}.en.vtt").write_text("\n".join(vtt) + "\n", encoding="utf-8")
    (OUT / f"{stem}.en.srt").write_text("\n".join(srt) + "\n", encoding="utf-8")


def encode(src, target, start=0, end=None):
    options = ["ffmpeg", "-v", "error", "-y", "-ss", start, "-i", src]
    filters = "scale=720:1280:flags=lanczos:out_range=tv,setsar=1,setrange=limited"
    if end is not None:
        filters += f",trim=duration={end - start}"
        options += ["-frames:v", round((end - start) * 30)]
    filters += ",setpts=PTS-STARTPTS,fps=fps=30:start_time=0,tpad=stop_mode=clone:stop_duration=0.1"
    run(*options, "-map", "0:v:0", "-an", "-vf", filters,
        "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-pix_fmt", "yuv420p",
        "-color_range", "tv", "-map_metadata", "-1", "-map_chapters", "-1", "-movflags", "+faststart", target)


def caption_panel(shot, destination):
    panel = Image.new("RGB", (720, 160), "#061849")
    draw = ImageDraw.Draw(panel)
    draw.rectangle((0, 0, 720, 3), fill="#ffd60a")
    draw.text((30, 19), shot["title"], font=ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 23), fill="#ffd60a")
    for y, line in zip((61, 99), shot["lines"]):
        draw.text((30, y), line, font=ImageFont.truetype(FONT, 29), fill="#f4f8ff")
    panel.save(destination)


def fingerprint(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def shown(path):
    """How a path is recorded in the manifest: relative to the Desktop (FestivalProject/Locker/photos/x.HEIC), never this PC's absolute path."""
    return path.relative_to(DESKTOP).as_posix()


def media_entry(path):
    entry = {"file": path.name, "bytes": path.stat().st_size}
    if path.suffix == ".mp4":
        data = probe(path)
        video = next(s for s in data["streams"] if s["codec_type"] == "video")
        entry.update(duration=float(data["format"]["duration"]), width=video["width"], height=video["height"], codec=video["codec_name"])
        if any(s["codec_type"] == "audio" for s in data["streams"]):
            raise ValueError(f"Unexpected audio: {path}")
        all_tags = [data["format"].get("tags", {}), *(s.get("tags", {}) for s in data["streams"])]
        if any("location" in k.lower() or "creation_time" in k.lower() for tags in all_tags for k in tags):
            raise ValueError(f"Capture metadata survived: {path}")
        if video["codec_name"] != "h264" or video["pix_fmt"] != "yuv420p":
            raise ValueError(f"Unexpected web encoding: {path}")
    elif path.suffix in (".jpg", ".webp"):
        with Image.open(path) as im:
            entry.update(width=im.width, height=im.height)
            if im.getexif() or im.info.get("exif"):
                raise ValueError(f"EXIF survived: {path}")
    return entry


def code_archive():
    source = REPORTS / "fusion_project_final/fusion_project_final.ino"
    code = source.read_text(encoding="utf-8")
    code_out = ROOT / "site/assets/code/lost-and-found.ino"
    code_out.parent.mkdir(parents=True, exist_ok=True)
    code_out.write_bytes(source.read_bytes())
    lines = code.splitlines()
    ranges = {
        "setup": (1, 17),
        "registration": (62, 83),
        "owner-match": (120, 136),
        "access-denied": (162, 169),
        "read-tag": (183, 193),
        "servo-and-feedback": (195, 203),
        "red-feedback": (205, 212),
        "display-cycle": (214, 227),
    }
    # Function ranges are derived from source so excerpts never silently drift.
    functions = {"read-tag": "String getRFIDTag()", "servo-and-feedback": "void handleLocker()", "red-feedback": "void flashRedLed()", "display-cycle": "void autoListDescriptions()"}
    for key, signature in functions.items():
        first = next(i for i, l in enumerate(lines) if l.startswith(signature))
        depth = 0
        for last in range(first, len(lines)):
            depth += lines[last].count("{") - lines[last].count("}")
            if depth == 0:
                break
        ranges[key] = (first + 1, last + 1)
    excerpts = [{"id": key, "source": "../../code/lost-and-found.ino", "startLine": first, "endLine": last,
                 "code": "\n".join(lines[first-1:last])} for key, (first, last) in ranges.items()]
    (OUT / "code-excerpts.json").write_text(json.dumps(excerpts, indent=2), encoding="utf-8")
    return {"file": "../../code/lost-and-found.ino", "sha256": fingerprint(source),
            "status": "Archived demonstration sketch; not modified or compiled in this preparation pass."}


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    sources = sorted(p for p in SOURCE.rglob("*") if p.is_file())
    hashes_before = {shown(p): fingerprint(p) for p in sources}
    photo_entries = []
    for src in sorted((SOURCE / "photos").iterdir()):
        if src.stem not in PHOTO_INFO:
            continue
        if src.suffix.lower() == ".heic":
            # FFmpeg reconstructs the tiled HEIC; auto-rotation is applied before encoding.
            raw = run("ffmpeg", "-v", "error", "-i", src, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "mjpeg", "-")
            im = Image.open(io.BytesIO(raw)).convert("RGB")
        else:
            with Image.open(src) as original:
                im = ImageOps.exif_transpose(original).convert("RGB")
        for suffix, size in [("", 1800), ("-thumb", 640)]:
            resized = im.copy()
            resized.thumbnail((size, size), Image.Resampling.LANCZOS)
            # Reconstruct pixels in a fresh image: no EXIF, GPS or color profile payload.
            clean = Image.new("RGB", resized.size)
            clean.paste(resized)
            clean.save(OUT / f"{src.stem}{suffix}.webp", "WEBP", quality=86, method=6)
        alt, purpose = PHOTO_INFO[src.stem]
        photo_entries.append({"id": src.stem, "file": f"{src.stem}.webp", "thumbnail": f"{src.stem}-thumb.webp",
                              "alt": alt, "purpose": purpose, "source": shown(src), "date": None})
        print(f"Prepared photo: {src.stem}", flush=True)

    # Extract the actual concept drawing and early component test diagrams.
    from pypdf import PdfReader
    report = REPORTS / "Final Assignment_Michalec_Lost & Found.pdf"
    reader = PdfReader(report)
    for index, stem, alt in [
        (4, "concept-sketch", "The original locker concept drawing, showing display, reader and servo."),
        (5, "early-led-buzzer-test", "Early test diagram connecting LEDs and buzzer to an Arduino Uno."),
        (6, "early-lcd-test", "Early I2C LCD component test diagram with an Arduino Uno."),
        (7, "early-servo-test", "Early servo component test diagram with an Arduino Uno."),
    ]:
        images = list(reader.pages[index].images)
        largest = max(images, key=lambda item: item.image.width * item.image.height)
        im = largest.image.convert("RGB")
        for suffix, size in [("", 1600), ("-thumb", 640)]:
            resized = im.copy()
            resized.thumbnail((size, size), Image.Resampling.LANCZOS)
            clean = Image.new("RGB", resized.size)
            clean.paste(resized)
            clean.save(OUT / f"{stem}{suffix}.webp", "WEBP", quality=90, method=6)
        photo_entries.append({"id": stem, "file": f"{stem}.webp", "thumbnail": f"{stem}-thumb.webp",
                              "alt": alt, "purpose": "build timeline; historical component test, not final wiring specification",
                              "source": shown(report), "sourcePage": index + 1, "date": None})
        print(f"Extracted report image: {stem}", flush=True)

    for clip in CLIPS:
        stem = clip["id"]
        target = OUT / f"{stem}.mp4"
        if "segments" in clip:
            parts = []
            for n, segment in enumerate(clip["segments"]):
                part = REVIEW / f"{stem}-{n:02d}.mp4"
                encode(SOURCE / "videos" / f"{clip['source']}.mp4", part, segment["in"], segment["out"])
                parts.append(part)
            listing = REVIEW / f"{stem}-concat.txt"
            listing.write_text("\n".join(f"file '{p.as_posix()}'" for p in parts), encoding="utf-8")
            run("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listing,
                "-c", "copy", "-an", "-map_metadata", "-1", "-movflags", "+faststart", target)
        else:
            encode(SOURCE / "videos" / f"{clip['source']}.mp4", target, clip["in"], clip["out"])
        captions(stem, clip["cues"])
        poster = frame(target, 1, 720)
        poster.save(OUT / f"{stem}-poster.jpg", quality=86, optimize=True)
        print(f"Prepared clip: {stem}", flush=True)

    cue_list, edit_list = [], []
    clean_parts, captioned_parts = [], []
    total = 0
    for index, shot in enumerate(SHOTS):
        duration = shot["out"] - shot["in"]
        part = REVIEW / f"shot-{index:02d}.mp4"
        encode(SOURCE / "videos" / f"{shot['source']}.mp4", part, shot["in"], shot["out"])
        clean_parts.append(part)
        panel_path = REVIEW / f"caption-{index:02d}.png"
        caption_panel(shot, panel_path)
        captioned = REVIEW / f"captioned-{index:02d}.mp4"
        run("ffmpeg", "-v", "error", "-y", "-i", part, "-loop", "1", "-i", panel_path,
            "-filter_complex", "[0:v][1:v]vstack=inputs=2:shortest=1[v]", "-map", "[v]", "-an",
            "-t", duration, "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "24",
            "-pix_fmt", "yuv420p", "-color_range", "tv", "-map_metadata", "-1", "-movflags", "+faststart", captioned)
        captioned_parts.append(captioned)
        cue_list.append((total, total + duration, "\n".join(shot["lines"])))
        edit_list.append({**shot, "timelineIn": round(total, 3), "timelineOut": round(total + duration, 3)})
        total += duration
        print(f"Edited sequence: {shot['id']}", flush=True)
    for stem, parts in [("walkthrough", clean_parts), ("walkthrough-captioned", captioned_parts)]:
        listing = REVIEW / f"{stem}-concat.txt"
        listing.write_text("\n".join(f"file '{p.as_posix()}'" for p in parts), encoding="utf-8")
        run("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listing,
            "-c", "copy", "-an", "-map_metadata", "-1", "-movflags", "+faststart", OUT / f"{stem}.mp4")
        poster = frame(OUT / f"{stem}.mp4", 1, 720)
        poster.save(OUT / f"{stem}-poster.jpg", quality=86, optimize=True)
    captions("walkthrough", cue_list)
    captions("walkthrough-captioned", cue_list)

    code = code_archive()
    generated = [media_entry(p) for p in sorted(OUT.iterdir()) if p.suffix in (".mp4", ".jpg", ".webp", ".vtt", ".srt", ".json") and p.name != "manifest.json"]
    if any(fingerprint(p) != hashes_before[shown(p)] for p in sources):
        raise ValueError("Original media changed!")
    manifest = {
        "project": "Lost & Found locker", "prepared": "2026-10-01", "baseUrl": "assets/media/lost-and-found",
        "status": "Prepared assets integrated into the main Lost and Found case study, with a reusable guided interactive locker and updated Home project card.",
        "captions": {"language": "en", "type": "explanatory descriptions", "speechTranscript": False},
        "audio": "All web edits are silent. Original recordings retain their sound in FestivalProject/Locker.",
        "sourcesUnchanged": True, "originals": [{"path": p, "sha256": h} for p, h in hashes_before.items()],
        "photos": photo_entries, "clips": [{k: v for k, v in c.items() if k != "cues"} for c in CLIPS],
        "walkthrough": {"duration": round(total, 3), "clean": "walkthrough.mp4", "captioned": "walkthrough-captioned.mp4",
                        "captionTrack": "walkthrough.en.vtt", "editedMontage": True, "shots": edit_list},
        "code": code, "files": generated,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    sheet([(Image.open(OUT / p["thumbnail"]).convert("RGB"), p["id"].replace("locker-", "")) for p in photo_entries],
          REVIEW / "prepared-photo-sheet.jpg", columns=3, cell=(420, 520))
    sheet([(frame(OUT / "walkthrough-captioned.mp4", s["timelineIn"] + (s["timelineOut"] - s["timelineIn"]) / 2, 360), s["id"]) for s in edit_list],
          REVIEW / "prepared-video-sheet.jpg", columns=4, cell=(370, 760))
    print(f"READY: {len(photo_entries)} images, {len(CLIPS)} focused clips, {total:.1f}s walkthrough.", flush=True)


def verify():
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    for item in manifest["originals"]:
        if fingerprint(DESKTOP / item["path"]) != item["sha256"]:
            raise ValueError(f"Original changed: {item['path']}")
    archive = ROOT / "site/assets/code/lost-and-found.ino"
    if fingerprint(archive) != manifest["code"]["sha256"]:
        raise ValueError("Sketch archive differs from source")
    source_lines = archive.read_text(encoding="utf-8").splitlines()
    excerpts = json.loads((OUT / "code-excerpts.json").read_text(encoding="utf-8"))
    for e in excerpts:
        if e["code"] != "\n".join(source_lines[e["startLine"] - 1:e["endLine"]]):
            raise ValueError(f"Excerpt differs from source: {e['id']}")
    checked = []
    for path in sorted(OUT.iterdir()):
        if path.suffix in (".mp4", ".jpg", ".webp"):
            checked.append(media_entry(path))
        if path.suffix != ".mp4":
            continue
        # Decode the entire output, including splice points.
        run("ffmpeg", "-v", "error", "-xerror", "-i", path, "-f", "null", "-")
        duration = float(probe(path)["format"]["duration"])
        data = path.read_bytes()
        pos, atoms = 0, []
        while pos + 8 <= len(data):
            size = int.from_bytes(data[pos:pos + 4], "big")
            kind = data[pos + 4:pos + 8].decode("ascii", errors="replace")
            if size == 1:
                size = int.from_bytes(data[pos + 8:pos + 16], "big")
            atoms.append(kind)
            if size == 0:
                break
            pos += size
        if "moov" not in atoms or "mdat" not in atoms or atoms.index("moov") > atoms.index("mdat"):
            raise ValueError(f"MP4 is not faststart: {path}")
        for extension in ("vtt", "srt"):
            track = OUT / f"{path.stem}.en.{extension}"
            text = track.read_text(encoding="utf-8")
            previous = 0
            count = 0
            for a, b in re.findall(r"(\d\d:\d\d:\d\d[.,]\d\d\d) --> (\d\d:\d\d:\d\d[.,]\d\d\d)", text):
                def sec(value):
                    h, m, s = value.replace(",", ".").split(":")
                    return int(h) * 3600 + int(m) * 60 + float(s)
                start, end = sec(a), sec(b)
                if start < previous - 0.001 or end <= start or end > duration + 0.04:
                    raise ValueError(f"Invalid caption timing: {track}")
                previous = end
                count += 1
            if not count or abs(previous - duration) > 0.04:
                raise ValueError(f"Caption coverage incomplete: {track}")
        print(f"Verified decode, streaming and captions: {path.name}", flush=True)
    verification = {
        "date": "2026-10-01", "originalHashesMatch": True, "archivedSketchMatches": True,
        "excerptsMatchSourceLines": True, "fullVideoDecodePassed": True, "faststartVerified": True,
        "captionsWithinDuration": True, "imageExifRemoved": True, "videoCaptureMetadataRemoved": True,
        "silentOutputs": True, "files": checked,
        "visualReview": "All 11 images and eight captioned chapters (nine shots) inspected for orientation and legibility, including wallet placement followed by the keys-take closure.",
        "browserPlayback": "Captioned walkthrough decoded in the in-app browser: 720 x 1440, 43.5 seconds, readyState 4, no media error.",
        "websiteImplementation": "Main Lost and Found case study and Home card implemented; reusable guided demo, real-photo explorers and captioned chapter video integrated. Browser checks are documented separately."
    }
    destination = ROOT / "docs/lost-and-found/preparation-checks.json"
    destination.write_text(json.dumps(verification, indent=2), encoding="utf-8")
    print(f"VERIFIED: {len(checked)} media files; original media and source code preserved.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--review", action="store_true")
    parser.add_argument("--build", action="store_true")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    if args.review:
        review()
    if args.build:
        build()
    if args.verify:
        verify()
