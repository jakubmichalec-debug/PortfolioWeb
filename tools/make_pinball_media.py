"""Build the Pinball page's photos, clips and scroll films from the raw phone footage.

Source: C:/Users/jakub/Desktop/PinballImages (iPhone photos, .mov clips, and the user's own
edited .mp4 exports). Every output is
  - resized for the web (photos: 1800px full-screen + 640px thumbnail; clips: 720px wide,
    H.264, no audio - several have voices in the background; films: WebP frame sequences),
  - stripped of ALL metadata: the phone embeds GPS coordinates of where each shot was taken,
    and some of these were taken at home. Checked after writing, not just requested,
  - trimmed/cropped so nobody else's face appears (the teammates never agreed to be on this
    portfolio): IMG_3995 stops before the camera turns to two of them, IMG_4451 stops before
    the camera swings up, workingon it3 is cropped below the person at the next table. The
    showcase clips with faces (IMG_9333, Shortshowcase) are not used at all. FullShowcase1
    only ever shows the player's hands and a torso at the far end - checked frame by frame.

Dates come from each file's own capture metadata. The user's edited .mp4 exports carry none,
so those show no date rather than a guessed one.

Writes site/assets/media/pinball/* and site/js/pinball-media.js (window.PINBALL_MEDIA).

Run: python tools/make_pinball_media.py
"""
import datetime
import json
import os
import shutil
import subprocess

from PIL import ExifTags, Image, ImageOps

SRC = "C:/Users/jakub/Desktop/PinballImages"
SITE = os.path.join(os.path.dirname(__file__), "..", "site")
OUT = os.path.join(SITE, "assets", "media", "pinball")
URL = "assets/media/pinball"

PHOTO_FULL, PHOTO_THUMB = 1800, 640
VIDEO_W_PORTRAIT, VIDEO_W_LANDSCAPE = 720, 1280
UNDATED = {"date": None}  # an edited export or a screenshot: no trustworthy capture date
UPRIGHT = "hflip,vflip"  # FullShowcase1 is filmed from the far end; turned round, the flippers sit at the
#                          bottom like the CAD drawing and the score display reads the right way up

# (id, source file, where it appears, caption, options)
#   where: a chapter group ("Flippers"...), "hero", "home", "real:<group>" for the clip that
#          plays beside that chapter's CAD model, or None (only used by the timeline)
#   photo options: crop=(left, top, right, bottom) as fractions of the upright image
#   clip options: start/end seconds, crop="w:h:x:y" in the upright full-size frame, vf=extra filter
#   either: date=None when the file's metadata can't be trusted for one
MEDIA = [
    ("hero-table", "6.jpeg", None, "Finished, from above", {}),
    ("home-loop", "FullShowcase1.mp4", "home", "The finished table in play", {"start": 12.4, "end": 20.2, "vf": UPRIGHT, **UNDATED}),
    ("box-layout", "image00001.jpeg", "Structure", "Playfield layout drawn out on the MDF", {"crop": (0, 0, 1, 0.78)}),
    ("box-side-art", "3.jpeg", "Structure", "Painted cabinet side", {}),
    ("box-playfield-art", "image00023.jpeg", "Structure", "Playfield art done", {}),
    ("box-finished", "IMG_4442.mov", "Structure", "The finished table", {}),
    ("flip-real", "ShortGame.mov", "real:Flippers", "The flippers in a real game", {"start": 0.3, "end": 11.3}),
    ("flip-shaft", "IMG_3995.mov", "Flippers", "Filing the D-profile into the shaft", {"end": 8.7}),
    ("flip-on-shaft", "1.jpeg", "Flippers", "Flipper on its shaft", {}),
    ("flip-drive-test", "IMG_4069.mov", "Flippers", "Wiring test on the flipper drive", {"start": 0.5, "end": 7.5}),
    ("load-real", "LoadingWorking.mp4", "real:Ball loading", "The loading system at work, from inside", {"start": 0.5, "end": 8.5, **UNDATED}),
    ("load-bench", "IMG_3987.mov", "Ball loading", "Testing the loading mechanism on the bench", {"start": 1, "end": 12}),
    ("load-under", "image00065.jpeg", "Ball loading", "Underneath: the reload mechanism and the wooden balls", {}),
    ("load-lane", "IMG_4451.mov", "Ball loading", "The first ball shot into play", {"start": 0.3, "end": 5.0}),
    ("target-real", "WorkingTesst.mp4", "real:Targets", "The score display, up close", {"start": 27.8, "end": 30.6, **UNDATED}),
    ("target-print", "2.jpeg", "Targets", "Printing a target holder", {}),
    ("target-holder", "4.jpeg", "Targets", "Target in its holder", {}),
    ("target-score", "image00063.jpeg", "Targets", "Score display, between the flipper buttons", {}),
    ("target-housing-early", "image00010.jpeg", "Targets", "First print of the target housing", {}),
    ("slide-table", "image00061.jpeg", "Slide & small parts", "The slide on the table", {}),
    ("slide-walls", "image00030.jpeg", "Slide & small parts", "Barrier walls and their printed brackets", {}),
    ("bracket-wall", "image00024.jpeg", "Brackets", "Brackets holding the walls", {}),
    ("brain-board", "workingon it.png", "Electronics", "The test board: every sensor, button and solenoid wired up on one sheet of MDF", {"crop": (0.09, 0.09, 0.91, 0.91), **UNDATED}),
    ("brain-drive", "workingon it2.png", "Electronics", "Solenoid drivers and the flipper mount on the test board", {"crop": (0.09, 0.09, 0.91, 0.91), **UNDATED}),
    ("brain-bench", "workingon it3.png", "Electronics", "The whole bench mid-test", {"crop": (0.09, 0.22, 0.91, 0.91), **UNDATED}),
    ("brain-lcd", "image00003.jpeg", "Electronics", "An early test rig, still with an LCD", UNDATED),
    ("brain-code", "WhatsApp Video 2026-09-27 at 13.23.27.mp4", "Electronics", "From the wiring to the sketch running on the laptop", {"start": 9.5, "end": 17.0, **UNDATED}),
    ("showcase", "image00005.jpeg", None, "Showcase day", {}),
]

# Scroll films: frame sequences scrubbed by scrolling (a scrubbed <video> stutters on iPhones).
# (id, source, start s, end s, frames per second of footage, options)
FILMS = [
    ("hero", "FullShowcase1.mp4", 2.4, 6.8, 10, {"vf": UPRIGHT}),  # ends while the display still reads SCORE 0 B:3
    ("finale", "FullShowcase1.mp4", 6.4, 29.0, 6, {"vf": UPRIGHT}),  # ball lost -> reload -> next ball -> +10
]

# What the machine's two dot-matrix displays show in FullShowcase1, read off the footage every
# 0.1 s (source seconds, first frame showing the new text). The strings are the ones pinball.ino
# prints: showGameScreen(), handleLostBall(), handleTargets(). BALL LOST -> RE LOAD is 3.0 s, the
# sketch's reloadDelayMs.
DISPLAY = {
    "FullShowcase1.mp4": [
        (0.0, "SCORE", "0 B:3"),
        (6.9, "BALL", "LOST"),
        (9.9, "RE", "LOAD"),
        (12.1, "SCORE", "0 B:2"),
        (20.5, "+10", "POINTS"),
        (21.0, "SCORE", "10 B:2"),
        (29.1, "BALL", "LOST"),
    ],
}

# The build in dated moments, 24 Apr -> 15 Jun (ids from MEDIA; caption overrides optional)
TIMELINE = [
    ("box-layout", "The playfield drawn out on the MDF"),
    ("target-housing-early", "First printed part: a target housing"),
    ("target-print", "Printing target holders"),
    ("load-bench", "The loading mechanism on the test bench"),
    ("flip-on-shaft", "A flipper on its D-profile shaft"),
    ("target-holder", "Painted playfield, targets going in"),
    ("hero-table", "Finished"),
    ("load-under", "Final wiring underneath"),
    ("showcase", "Showcase day"),
]

_TAG = {v: k for k, v in ExifTags.TAGS.items()}


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def photo_when(im):
    exif = im.getexif()
    raw = exif.get_ifd(0x8769).get(_TAG["DateTimeOriginal"]) or exif.get(_TAG["DateTime"])
    return datetime.datetime.strptime(raw, "%Y:%m:%d %H:%M:%S")


def clip_when(path):
    tags = probe(path)["format"].get("tags", {})
    raw = tags.get("com.apple.quicktime.creationdate") or tags["creation_time"]
    return datetime.datetime.fromisoformat(raw[:19])


def dated(item, when):
    item["date"] = f"{when.day} {when.strftime('%b')}" if when else None
    item["iso"] = when.date().isoformat() if when else None


def build_photo(mid, src, opts):
    im = Image.open(src)
    when = photo_when(im) if opts.get("date", "auto") == "auto" else None
    icc = im.info.get("icc_profile")  # colour profile (Display P3 on an iPhone) - not personal data, keep it
    im = ImageOps.exif_transpose(im).convert("RGB")
    if "crop" in opts:
        l, t, r, b = opts["crop"]
        im = im.crop((round(l * im.width), round(t * im.height), round(r * im.width), round(b * im.height)))
    item = {"kind": "photo"}
    dated(item, when)
    for suffix, edge, quality in (("", PHOTO_FULL, 82), ("-thumb", PHOTO_THUMB, 78)):
        copy = im.copy()
        copy.thumbnail((edge, edge), Image.LANCZOS)
        name = f"{mid}{suffix}.jpg"
        copy.save(os.path.join(OUT, name), "JPEG", quality=quality, optimize=True, progressive=True, icc_profile=icc)
        item["src" if not suffix else "thumb"] = f"{URL}/{name}"
        if not suffix:
            item["w"], item["h"] = copy.size
    return item


def _filters(src, opts, width=None):
    video = next(s for s in probe(src)["streams"] if s["codec_type"] == "video")
    rotated = any(abs(sd.get("rotation", 0)) == 90 for sd in video.get("side_data_list", []))
    portrait = (video["height"] > video["width"]) != rotated
    filters = []
    if "crop" in opts:
        filters.append(f"crop={opts['crop']}")
    if "vf" in opts:
        filters.append(opts["vf"])
    target = width or (VIDEO_W_PORTRAIT if portrait else VIDEO_W_LANDSCAPE)
    filters.append(f"scale='min({target},iw)':-2")  # never upscale an already-small export
    return filters


def _trim(opts):
    trim = []
    if "start" in opts:
        trim += ["-ss", str(opts["start"])]
    if "end" in opts:
        trim += ["-to", str(opts["end"])]
    return trim


def build_clip(mid, src, opts):
    when = clip_when(src) if opts.get("date", "auto") == "auto" else None
    mp4 = os.path.join(OUT, f"{mid}.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *_trim(opts), "-i", src, "-vf", ",".join(_filters(src, opts)),
                    "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-profile:v", "high", "-pix_fmt", "yuv420p",
                    "-an", "-map_metadata", "-1", "-map_metadata:s:v", "-1", "-map_chapters", "-1",
                    "-movflags", "+faststart", mp4], check=True)
    poster = os.path.join(OUT, f"{mid}.jpg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "0.3", "-i", mp4, "-frames:v", "1", "-q:v", "3", poster], check=True)
    out = next(s for s in probe(mp4)["streams"] if s["codec_type"] == "video")
    item = {"kind": "video", "src": f"{URL}/{mid}.mp4", "poster": f"{URL}/{mid}.jpg",
            "w": out["width"], "h": out["height"], "duration": round(float(probe(mp4)["format"]["duration"]), 1)}
    dated(item, when)
    return item


def build_film(fid, src, start, end, fps, opts):
    folder = os.path.join(OUT, f"film-{fid}")
    os.makedirs(folder)
    vf = ",".join([f"fps={fps}", *_filters(src, opts)])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-to", str(end), "-i", src, "-vf", vf,
                    "-c:v", "libwebp", "-quality", "62", "-compression_level", "6", "-an", "-map_metadata", "-1",
                    os.path.join(folder, "%04d.webp")], check=True)
    frames = sorted(os.listdir(folder))
    w, h = Image.open(os.path.join(folder, frames[0])).size
    display = [
        {"t": round((t - start) / (end - start), 4), "top": top, "bottom": bottom}
        for t, top, bottom in DISPLAY.get(os.path.basename(src), [])
        if t < end
    ]
    # the state already showing when the film starts
    before = [d for d in display if d["t"] <= 0]
    display = ([{**before[-1], "t": 0}] if before else []) + [d for d in display if d["t"] > 0]
    return {"dir": f"{URL}/film-{fid}/", "count": len(frames), "ext": "webp", "w": w, "h": h,
            "seconds": round(end - start, 2), "display": display}


def check_clean(path):
    """Fail loudly if anything identifying survived: EXIF/GPS in an image, tags or audio in a clip."""
    if path.endswith((".jpg", ".webp")):
        exif = Image.open(path).getexif()
        if len(exif):
            raise RuntimeError(f"{path}: metadata survived ({len(exif)} EXIF tags)")
    else:
        info = probe(path)
        tags = {**info["format"].get("tags", {}), **{k: v for s in info["streams"] for k, v in s.get("tags", {}).items()}}
        leaked = [k for k in tags if "location" in k.lower() or "gps" in k.lower() or k.startswith("com.apple")]
        if leaked:
            raise RuntimeError(f"{path}: metadata survived {leaked}")
        if any(s["codec_type"] == "audio" for s in info["streams"]):
            raise RuntimeError(f"{path}: audio track survived")


if __name__ == "__main__":
    missing = sorted({name for _, name, *_ in MEDIA + FILMS if not os.path.exists(os.path.join(SRC, name))})
    if missing:  # before anything is deleted: a renamed or removed source must not leave the site without its media
        raise SystemExit(f"source files missing from {SRC}: {missing}")
    os.makedirs(OUT, exist_ok=True)
    for stale in os.listdir(OUT):  # everything here is rebuilt below - an item dropped from MEDIA leaves nothing behind
        path = os.path.join(OUT, stale)
        shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)

    manifest = {"real": {}, "films": {}}
    by_id = {}
    for mid, name, where, caption, opts in MEDIA:
        src = os.path.join(SRC, name)
        item = build_clip(mid, src, opts) if name.lower().endswith((".mov", ".mp4")) else build_photo(mid, src, opts)
        item.update(id=mid, caption=caption)
        by_id[mid] = item
        if where and where.startswith("real:"):
            manifest["real"][where[5:]] = item
        elif where:
            manifest.setdefault(where, []).append(item)

    for fid, name, start, end, fps, opts in FILMS:
        manifest["films"][fid] = build_film(fid, os.path.join(SRC, name), start, end, fps, opts)

    first = min(datetime.date.fromisoformat(by_id[mid]["iso"]) for mid, _ in TIMELINE)
    manifest["timeline"] = [
        {**by_id[mid], "caption": caption, "day": (datetime.date.fromisoformat(by_id[mid]["iso"]) - first).days}
        for mid, caption in TIMELINE
    ]

    written = sorted(os.path.join(root, f) for root, _, files in os.walk(OUT) for f in files)
    for f in written:
        check_clean(f)
    with open(os.path.join(SITE, "js", "pinball-media.js"), "w", encoding="utf8") as fh:
        fh.write("/* Generated by tools/make_pinball_media.py from the raw phone footage. Do not hand-edit. */\n")
        fh.write("window.PINBALL_MEDIA = " + json.dumps(manifest, indent=1) + ";\n")

    total = sum(os.path.getsize(f) for f in written)
    print(f"{len(MEDIA)} items, {len(FILMS)} films, {len(written)} files, {total / 1e6:.1f} MB, metadata checked clean")
    for fid, film in manifest["films"].items():
        size = sum(os.path.getsize(os.path.join(OUT, f"film-{fid}", f)) for f in os.listdir(os.path.join(OUT, f"film-{fid}")))
        print(f"  film {fid}: {film['count']} frames {film['w']}x{film['h']}, {size / 1e6:.1f} MB, display states {len(film['display'])}")
    print("  timeline:", ", ".join(f"day {m['day']} {m['date']}" for m in manifest["timeline"]))
