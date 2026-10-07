"""Build the Pinball page's photos, clips and showcase video from the raw phone footage.

Source: C:/Users/jakub/Desktop/PinballImages (iPhone photos, .mov clips, and the user's own
edited .mp4 exports). Every output is
  - resized for the web (photos: 1800px full-screen + 640px thumbnail; clips: 720px wide,
    H.264, no audio - several have voices in the background),
  - stripped of ALL metadata: the phone embeds GPS coordinates of where each shot was taken,
    and some of these were taken at home. Checked after writing, not just requested,
  - the older clips are trimmed/cropped so nobody else's face appears: IMG_3995 stops before
    the camera turns to two teammates, IMG_4451 stops before the camera swings up, workingon
    it3 is cropped below the person at the next table. The showcase video is different: the
    owner said faces don't matter there, so it is simply the best footage - the 4K
    Shortshowcase, cut to four steady shots and cropped to the site's 4:5 frame.


Dates come from each file's own capture metadata. The user's edited .mp4 exports carry none,
so those show no date rather than a guessed one.

Writes site/assets/media/pinball/* and site/js/pinball-media.js (window.PINBALL_MEDIA).

Run: python tools/make_pinball_media.py            (everything)
     python tools/make_pinball_media.py --showcase  (only the showcase video)
     python tools/make_pinball_media.py --only=tl-bench,tl-firstgame   (those items, then the timeline)
     python tools/make_pinball_media.py --timeline  (only the timeline, from the items already built)
"""
import datetime
import json
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import ExifTags, Image, ImageOps

SRC = "C:/Users/jakub/Desktop/PinballImages"
SITE = os.path.join(os.path.dirname(__file__), "..", "site")
OUT = os.path.join(SITE, "assets", "media", "pinball")
URL = "assets/media/pinball"

PHOTO_FULL, PHOTO_THUMB = 1800, 640
VIDEO_W_PORTRAIT, VIDEO_W_LANDSCAPE = 720, 1280
UNDATED = {"date": None}  # an edited export or a screenshot: no trustworthy capture date

# (id, source file, where it appears, caption, options)
#   where: a chapter group ("Flippers"...), "real:<group>" for the clip that plays beside that
#          chapter's CAD model, or None (only used by the timeline)
#   photo options: crop=(left, top, right, bottom) as fractions of the upright image
#   clip options: start/end seconds, crop="w:h:x:y" in the upright full-size frame, vf=extra filter
#   either: date=None when the file's metadata can't be trusted for one
MEDIA = [
    ("hero-table", "6.jpeg", None, "Finished, from above", {}),
    ("box-layout", "image00001.jpeg", "Structure", "Playfield layout drawn out on the MDF", {"crop": (0, 0, 1, 0.78)}),
    ("box-side-art", "3.jpeg", "Structure", "Painted cabinet side", {}),
    ("box-playfield-art", "image00023.jpeg", "Structure", "Playfield art done", {}),
    ("box-finished", "IMG_4442.mov", "Structure", "The finished table", {}),
    # the lower half, twice as close: the flippers and the display (the hero shows the whole table)
    ("flip-real", "ShortGame.mov", "real:Flippers", "The flippers in a real game, up close", {"start": 0.3, "end": 10.8, "vf": "crop=iw/2:ih/2:iw/4:trunc(ih*0.39/2)*2"}),
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
    # only on the timeline
    ("tl-vise", "image00019.jpeg", None, "Fitting the steel shaft through a flipper", {}),
    ("tl-paint", "image00017.jpeg", None, "The playfield painted black, then sprayed with stars", {}),
    ("tl-cutplan", "image00020.jpeg", None, "WhatToCUT.png: the playfield drawing, laser cuts marked in red", {"crop": (0, 0.03, 1, 0.8)}),
    ("tl-target-house", "image00027.jpeg", None, "A target in its painted housing", {}),
    ("tl-targets", "image00021.jpeg", None, "Targets fixed onto the black playfield", {"crop": (0, 0.2, 1, 1)}),
    ("tl-front", "image00055.jpeg", None, "The front: aliens, the score display and the plunger", {}),
    ("tl-side", "image00058.jpeg", None, "The side panel, lettered", {}),
    ("tl-displays", "image00064.jpeg", None, "The two score displays, four MAX7219 modules each, wired up", {}),
    ("tl-flippers", "image00066.jpeg", None, "The flippers in place", {}),
    ("tl-bench", "IMG_3734.mov", None, "The first test board: an Arduino and its wiring on a sheet of MDF", {"start": 1.5, "end": 8.4}),
    ("tl-firstgame", "FirstTestOnBoard (2).mov", None, "The first test on the real playfield", {"start": 32.0, "end": 41.0}),
]

# The showcase video: one real video (30 fps, no scrubbing) shown in the Pinball hero, the
# finale and, smaller, on the Home card. Source: the 4K Shortshowcase (3840x2160 filmed
# sideways, 25 Mbit/s) - "Shortshowcase - Copy.mov" is byte-for-byte "Shortshowcase.mov". The
# camera is handheld, so it is cut into four steady shots, each cropped to a 4:5 window
# (2160 x 2700 px of the 2160 x 3840 upright frame) - only the top edge moves between shots.
SHOWCASE_SRC = "Shortshowcase - Copy.mov"
SHOWCASE_SIZE = (720, 900)  # hero + finale
HOME_SIZE = (544, 680)  # the Home card (4:5 again; H.264 needs even sizes)
CROP_W, CROP_H = 2160, 2700
#        start s, end s, crop top y   (source seconds)
SHOTS = [
    (6.75, 8.75, 700),  # the machine starts a game: START GAME (the camera has settled by 6.75)
    (21.5, 31.6, 1140),  # a game in progress: the table, the player's hands, +10
    (35.0, 40.7, 300),  # up close: the flippers, the ball, the display
    (42.0, 51.5, 900),  # the table again - then the cabinet is opened on the electronics
]

# What the machine's display shows, read off the 4K footage every 0.1-0.5 s (source seconds,
# first frame showing that text; the LEDs are legible at this resolution once turned 180 degrees).
# The strings are the ones pinball.ino prints. The first entry of every shot is the state on
# screen when it starts.
DISPLAY = [
    (6.75, "START", "GAME"),
    (21.5, "SCORE", "0 B:3"),  # START GAME -> TAKE BALL -> this happened in the seconds cut out between shots
    (28.0, "SCORE", "10 B:3"),
    (35.0, "SCORE", "10 B:3"),
    (42.0, "SCORE", "10 B:3"),
]

# What happens, for the finale's callouts (source seconds; the text lives in js/finale.js)
EVENTS = [
    (6.8, "start"),  # START GAME is on the display (it appears just before the shot starts)
    (21.5, "play"),  # the game screen, ball in play
    (27.5, "flip"),  # the ball meets the left flipper
    (28.0, "hit"),  # the score goes 0 -> 10
    (35.0, "close"),  # the close-up on the flippers
    (50.6, "open"),  # a hand lifts the back panel: the electronics
]

# The build, 28 Feb -> 15 Jun, one card per day, every card a picture:
#   ("photos", [MEDIA ids, all taken that day - the first one leads], caption)      photos / clips
#   ("model", date, caption, source file, .glb in site/assets/models)                a 3D part
#   ("drawing", date, caption, source file)                                          the playfield outline
# A model/drawing card is dated by the FreeCAD file's own CreationDate (Document.xml in the .FCStd);
# a photo by its capture date. The model shown is the part as last saved - these files kept
# growing after the day they were created (the box was finished on 5 Jun).
TIMELINE = [
    ("model", "2026-02-28", "A finger-jointed box in FreeCAD: the file that grew into the cabinet", "boxProjectFinger.FCStd",
     "box-finger-joints-boxprojectfinger.glb"),
    ("model", "2026-04-11", "The flipper lever, drawn in FreeCAD", "RucickaNova.FCStd", "flipper-lever-rucickanova.glb"),
    ("drawing", "2026-04-23", "The playfield redrawn in FreeCAD", "SketchMiddleNew.FCStd"),
    ("photos", ["box-layout"], "The playfield drawn out on the MDF"),
    ("photos", ["tl-bench"], "The first test board: an Arduino and its wiring on a sheet of MDF"),
    ("photos", ["target-housing-early"], "First printed part: a target housing"),
    ("model", "2026-05-04", "The flipper drive, rebuilt as one assembly after five redesigns", "AdapterArmsV1.FCStd",
     "flipper-solenoid-assembly-adapterarmsv1.glb"),
    ("photos", ["target-print"], "Printing target holders"),
    ("photos", ["flip-on-shaft", "tl-vise", "tl-paint"], "Flippers on their shafts, and the playfield painted"),
    ("photos", ["tl-cutplan"], "The cut plan for the laser"),
    ("photos", ["target-holder", "tl-target-house", "tl-targets"], "Targets going into the painted playfield"),
    ("photos", ["tl-firstgame"], "The first test on the real playfield"),
    ("model", "2026-05-20", "A holder for the RFID reader that starts a game", "RFIDHolder.FCStd", "rfid-holder-rfidholder.glb"),
    ("model", "2026-05-25", "A platform that shoots the ball into play", "BallLoadingShootPlatform.FCStd",
     "ball-shoot-platform-ballloadingshootplatform.glb"),
    ("photos", ["hero-table", "tl-front", "tl-side"], "Finished: painted, lettered, playable"),
    ("photos", ["load-under", "tl-displays", "tl-flippers"], "The last wiring: reload, displays, flippers"),
    ("photos", ["showcase"], "Showcase day"),
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
    subprocess.run(["ffmpeg", "-v", "error", "-y", *_trim(opts), "-i", src, "-vf", ",".join(_filters(src, opts, opts.get("width"))),
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


def edit_time(t):
    """Source seconds -> seconds in the cut video."""
    done = 0.0
    for a, b, _ in SHOTS:
        if a - 1e-6 <= t <= b + 1e-6:
            return round(done + t - a, 3)
        done += b - a
    raise SystemExit(f"{t}s is not inside any shot of SHOTS")


def build_showcase(src):
    """The four shots, cropped and joined, encoded twice from the same near-lossless cuts (so
    neither output is a re-encode of the other): the hero/finale video and the smaller Home loop.
    One 4K input at a time: joining four 4K decoders in one filter graph buffers every frame of
    the shots still waiting their turn and runs out of memory."""
    common = ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p", "-an",
              "-map_metadata", "-1", "-map_chapters", "-1", "-movflags", "+faststart"]
    hero, home = os.path.join(OUT, "showcase.mp4"), os.path.join(OUT, "home-loop.mp4")
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for i, (a, b, y) in enumerate(SHOTS):
            assert 0 <= y <= 3840 - CROP_H, f"shot {i}: crop top {y} leaves the frame"
            part = os.path.join(tmp, f"shot{i}.mkv").replace("\\", "/")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(a), "-to", str(b), "-i", src, "-vf",
                            f"crop={CROP_W}:{CROP_H}:0:{y},setsar=1,fps=30,scale={SHOWCASE_SIZE[0]}:{SHOWCASE_SIZE[1]}:flags=lanczos",
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "6", "-pix_fmt", "yuv420p", "-an", part], check=True)
            parts.append(part)
        listing = os.path.join(tmp, "shots.txt")
        with open(listing, "w", encoding="utf8") as fh:
            fh.write("".join(f"file '{part}'\n" for part in parts))
        for path, size, crf, gop in ((hero, SHOWCASE_SIZE, 25, 30), (home, HOME_SIZE, 27, 60)):
            scale = [] if size == SHOWCASE_SIZE else ["-vf", f"scale={size[0]}:{size[1]}:flags=lanczos"]
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listing, *scale, *common,
                            "-crf", str(crf), "-g", str(gop), "-keyint_min", str(gop), path], check=True)
    for path in (hero, home):  # a still to show while the video loads
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "0.5", "-i", path, "-frames:v", "1", "-q:v", "3",
                        path.replace(".mp4", ".jpg")], check=True)
    out = next(s for s in probe(hero)["streams"] if s["codec_type"] == "video")
    display = []
    for t, top, bottom in DISPLAY:
        state = {"t": edit_time(t), "top": top, "bottom": bottom}
        if not display or (display[-1]["top"], display[-1]["bottom"]) != (top, bottom):  # repeats add nothing
            display.append(state)
    cuts, at = [], 0.0
    for a, b, _ in SHOTS[:-1]:
        at += b - a
        cuts.append(round(at, 3))
    return {"src": f"{URL}/showcase.mp4", "poster": f"{URL}/showcase.jpg", "w": out["width"], "h": out["height"],
            "duration": round(float(probe(hero)["format"]["duration"]), 2), "display": display,
            "events": [{"t": edit_time(t), "kind": kind} for t, kind in EVENTS], "cuts": cuts,
            "home": {"src": f"{URL}/home-loop.mp4", "poster": f"{URL}/home-loop.jpg", "w": HOME_SIZE[0], "h": HOME_SIZE[1]}}


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


def build_timeline(by_id):
    """TIMELINE -> manifest entries, each with its day number counted from the first card."""
    entries = []
    for kind, *rest in TIMELINE:
        if kind in ("model", "drawing"):
            iso, caption, source, *model = rest
            when = datetime.date.fromisoformat(iso)
            entry = {"kind": kind, "caption": caption, "source": source, "iso": iso,
                     "date": f"{when.day} {when.strftime('%b')}", "when": when}
            if kind == "model":
                if not os.path.exists(os.path.join(SITE, "assets", "models", model[0])):
                    raise SystemExit(f"timeline model {model[0]}: not in site/assets/models")
                entry["model"] = model[0]
            entries.append(entry)
        else:
            ids, caption = rest
            missing = [i for i in ids if i not in by_id]
            if missing:
                raise SystemExit(f"timeline card {ids}: {missing} not built yet (run the full build or --only {','.join(missing)})")
            items = [by_id[i] for i in ids]
            days = {it["iso"] for it in items}
            if len(days) != 1 or None in days:  # a card is one day: every photo on it must share that date
                raise SystemExit(f"timeline card {ids}: photos from {sorted(map(str, days))}")
            entries.append({"kind": "photos", "items": items, "caption": caption, "iso": items[0]["iso"],
                            "date": items[0]["date"], "when": datetime.date.fromisoformat(items[0]["iso"])})
    if [e["when"] for e in entries] != sorted(e["when"] for e in entries):
        raise SystemExit("timeline entries are out of date order")
    first = entries[0]["when"]
    return [{**{k: v for k, v in e.items() if k != "when"}, "day": (e["when"] - first).days} for e in entries]


def build_item(mid, name, caption, opts):
    src = os.path.join(SRC, name)
    item = build_clip(mid, src, opts) if name.lower().endswith((".mov", ".mp4")) else build_photo(mid, src, opts)
    item.update(id=mid, caption=caption)
    return item


def rebuild_partial(ids):
    """python tools/make_pinball_media.py --only tl-bench,tl-firstgame   (or --timeline for none)
    Rebuild just these MEDIA items, then regenerate the timeline from TIMELINE - seconds instead of
    the full build's minutes. Everything else is read back from the last full build's manifest."""
    path = os.path.join(SITE, "js", "pinball-media.js")
    text = open(path, encoding="utf8").read()
    manifest = json.loads(text[text.index("{"): text.rindex("}") + 1])
    by_id = {}

    def collect(v):
        if isinstance(v, dict):
            if "id" in v and "kind" in v:
                by_id[v["id"]] = v
            for x in v.values():
                collect(x)
        elif isinstance(v, list):
            for x in v:
                collect(x)

    collect(manifest)
    media = {m[0]: m for m in MEDIA}
    for mid in ids:
        if mid not in media:
            raise SystemExit(f"unknown media id {mid!r}")
        _, name, where, caption, opts = media[mid]
        if not os.path.exists(os.path.join(SRC, name)):
            raise SystemExit(f"source file missing: {os.path.join(SRC, name)}")
        for old in (f"{mid}.mp4", f"{mid}.jpg", f"{mid}-thumb.jpg"):
            if os.path.exists(os.path.join(OUT, old)):
                os.remove(os.path.join(OUT, old))
        item = build_item(mid, name, caption, opts)
        by_id[mid] = item
        if where and where.startswith("real:"):
            manifest["real"][where[5:]] = item
        elif where:
            manifest[where] = [item if x.get("id") == mid else x for x in manifest.get(where, [])]
        for f in (f"{mid}.mp4", f"{mid}.jpg", f"{mid}-thumb.jpg"):
            if os.path.exists(os.path.join(OUT, f)):
                check_clean(os.path.join(OUT, f))
    manifest["timeline"] = build_timeline(by_id)
    write_manifest(manifest)
    print(f"rebuilt {list(ids) or 'nothing'}; timeline: " + ", ".join(f"{m['kind']} day {m['day']} {m['date']}" for m in manifest["timeline"]))


def write_manifest(manifest):
    with open(os.path.join(SITE, "js", "pinball-media.js"), "w", encoding="utf8") as fh:
        fh.write("/* Generated by tools/make_pinball_media.py from the raw phone footage. Do not hand-edit. */\n")
        fh.write("window.PINBALL_MEDIA = " + json.dumps(manifest, indent=1) + ";\n")


def rebuild_showcase_only():
    """python tools/make_pinball_media.py --showcase: redo just the video and its manifest entry
    (minutes faster than the full build when only SHOTS / DISPLAY / EVENTS changed)."""
    path = os.path.join(SITE, "js", "pinball-media.js")
    text = open(path, encoding="utf8").read()
    manifest = json.loads(text[text.index("{"): text.rindex("}") + 1])
    src = os.path.join(SRC, SHOWCASE_SRC)
    if not os.path.exists(src):
        raise SystemExit(f"source file missing: {src}")
    for name in ("showcase.mp4", "showcase.jpg", "home-loop.mp4", "home-loop.jpg"):
        if os.path.exists(os.path.join(OUT, name)):
            os.remove(os.path.join(OUT, name))
    manifest["showcase"] = build_showcase(src)
    for name in ("showcase.mp4", "showcase.jpg", "home-loop.mp4", "home-loop.jpg"):
        check_clean(os.path.join(OUT, name))
    write_manifest(manifest)
    sc = manifest["showcase"]
    print(f"showcase rebuilt: {sc['duration']} s, cuts {sc['cuts']}, events {[(e['t'], e['kind']) for e in sc['events']]}")
    print("  display:", [(d["t"], d["top"], d["bottom"]) for d in sc["display"]])


if __name__ == "__main__":
    partial = [a for a in sys.argv[1:] if a.startswith("--only=") or a == "--timeline"]
    if partial:
        rebuild_partial([i for i in partial[0].partition("=")[2].split(",") if i])
        raise SystemExit(0)
    if "--showcase" in sys.argv:
        rebuild_showcase_only()
        raise SystemExit(0)
    missing = sorted({name for _, name, *_ in MEDIA if not os.path.exists(os.path.join(SRC, name))}
                     | ({SHOWCASE_SRC} if not os.path.exists(os.path.join(SRC, SHOWCASE_SRC)) else set()))
    if missing:  # before anything is deleted: a renamed or removed source must not leave the site without its media
        raise SystemExit(f"source files missing from {SRC}: {missing}")
    os.makedirs(OUT, exist_ok=True)
    for stale in os.listdir(OUT):  # everything here is rebuilt below - an item dropped from MEDIA leaves nothing behind
        path = os.path.join(OUT, stale)
        shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)

    manifest = {"real": {}}
    by_id = {}
    for mid, name, where, caption, opts in MEDIA:
        item = build_item(mid, name, caption, opts)
        by_id[mid] = item
        if where and where.startswith("real:"):
            manifest["real"][where[5:]] = item
        elif where:
            manifest.setdefault(where, []).append(item)

    manifest["showcase"] = build_showcase(os.path.join(SRC, SHOWCASE_SRC))

    manifest["timeline"] = build_timeline(by_id)

    written = sorted(os.path.join(root, f) for root, _, files in os.walk(OUT) for f in files)
    for f in written:
        check_clean(f)
    write_manifest(manifest)

    total = sum(os.path.getsize(f) for f in written)
    print(f"{len(MEDIA)} items + the showcase video, {len(written)} files, {total / 1e6:.1f} MB, metadata checked clean")
    sc = manifest["showcase"]
    for name in ("showcase", "home-loop"):
        print(f"  {name}.mp4: {os.path.getsize(os.path.join(OUT, name + '.mp4')) / 1e6:.1f} MB")
    print(f"  showcase: {sc['duration']} s, {sc['w']}x{sc['h']}, cuts at {sc['cuts']}, events {[(e['t'], e['kind']) for e in sc['events']]}")
    print("  timeline:", ", ".join(f"day {m['day']} {m['date']}" for m in manifest["timeline"]))
