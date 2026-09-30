"""Build every 3D asset for the Pinball page's parts gallery, from the 32 rows marked
'Used' in pinball-parts-inventory.xlsx.

Treatments, chosen by what geometry actually exists (never faked):
  - real 3D-printed parts (have an .stl)          -> a real .glb; a part with more than one
                                                     real body (e.g. a target's holder + its
                                                     insert pieces) is shown BUILT TOGETHER as
                                                     one assembled hero .glb, with each body
                                                     also written out on its own so the gallery
                                                     can offer a click-to-isolate button per
                                                     piece (see write_subparts) - this only
                                                     works because every multi-body part here
                                                     was confirmed (by bbox inspection, not
                                                     assumed) to already export all its bodies
                                                     into one shared coordinate space
  - laser-cut wood/MDF panels (.svg outline only) -> the outline extruded to its real
                                                     thickness (6mm MDF, per the build report);
                                                     the box is the multi-panel case here, and
                                                     gets the same assembled+isolate treatment
                                                     (see assemble_box.py for why it needs real
                                                     placement data instead of shared-space STLs)
  - no exported geometry at all (FCStd source only) -> an honest "never exported" placeholder card

Writes site/assets/models/*.glb and site/js/pinball-parts.js (the manifest the gallery reads).
"""
import json
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from assemble_box import assembled_box_triangles, dimension_lines  # noqa: E402
from glb_export import single_part_frame, write_glb  # noqa: E402
from helpers import read_stl  # noqa: E402
from svg_extrude import extrude  # noqa: E402


def _split_words(name):
    """"InsideTopTarget" -> "Inside Top Target" - chip/label CSS renders these uppercase
    regardless of source casing, so a PascalCase part name needs its word breaks restored or
    it reads as one solid blob ("INSIDETOPTARGET")."""
    words = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+", name)
    return " ".join(words) if words else name


def _stl_stem(base):
    """"AdapterArmsV1-Base+Holder.stl" -> "Base Holder" - the part's own name, stripped of the
    component-file prefix FreeCAD's per-body STL export puts in front of every filename."""
    stem = base[:-4]
    stem = stem.split("-", 1)[1] if "-" in stem else stem
    stem = stem.replace("Triang;e", "Triangle")  # stray typo in the exported filename itself
    return _split_words(stem)


def write_subparts(comp, ver, named_triangles, color):
    """Write one glb per (name, triangles) pair plus a concatenated hero glb - for any part
    made of multiple smaller pieces whose exports already share one coordinate space (real
    per-project assemblies, not grid-packed apart like the old "kit of parts" treatment), so
    the gallery can show it built together with click-to-isolate buttons per piece, same as
    the solenoid adapter. Returns (hero_model_path, hero_bytes, subparts_manifest)."""
    slg = slug(comp, ver)
    hero_tris = np.concatenate([t for _, t in named_triangles], axis=0)
    hero_out = f"{MODELS_OUT}/{slg}.glb"
    hero_size = write_glb([("Assembly", hero_tris)], hero_out, **color)
    sub_manifest = []
    for name, tris in named_triangles:
        sub_slug = slug(comp, f"{ver}-{name}")
        sub_out = f"{MODELS_OUT}/{sub_slug}.glb"
        sub_size = write_glb([(name, tris)], sub_out, **color)
        sub_manifest.append({"label": name, "model": f"assets/models/{sub_slug}.glb", "bytes": sub_size})
    return f"assets/models/{slg}.glb", hero_size, sub_manifest

SRC = "C:/Users/jakub/Desktop/KdG/fablab"
SITE = "C:/Users/jakub/Desktop/PORTFOLIO/site"
MODELS_OUT = SITE + "/assets/models"
os.makedirs(MODELS_OUT, exist_ok=True)

WOOD_COLOR = dict(base_color=(0.74, 0.61, 0.45, 1.0), metallic=0.0, roughness=0.85)
PLA_COLOR = dict(base_color=(0.86, 0.88, 0.92, 1.0), metallic=0.12, roughness=0.5)
MDF_THICKNESS_MM = 6.0

# ---------------------------------------------------------------- reuse the validated ROWS + file matcher
_src = open(os.path.join(os.path.dirname(__file__), "build_inventory.py"), encoding="utf8").read()
_src = _src.replace("sys.path.insert(0, os.path.dirname(__file__))", f"sys.path.insert(0, {os.path.dirname(__file__)!r})")
_ns = {"__name__": "rowbuild"}
exec(compile(_src[: _src.index("# ---------------------------------------------------------------- geometry fingerprints")], "build_inventory.py", "exec"), _ns)
BY_KEY = {(r["comp"], r["ver"]): r for r in _ns["ROWS"]}

GROUP_LABEL = {
    "Box & playfield (wood)": "Structure",
    "Walls & lanes (wood)": "Walls & guides",
    "Flippers & drive": "Flippers",
    "Targets": "Targets",
    "Ball loading": "Ball loading",
    "Slide, barrier & small parts": "Slide & small parts",
    "Brackets": "Brackets",
}


def slug(comp, ver):
    s = re.sub(r"[^a-z0-9]+", "-", f"{comp}-{ver}".lower()).strip("-")
    return re.sub(r"-+", "-", s)


# (comp, ver, short label for the card, made-how tag)
PARTS = [
    ("Box (finger joints)", "boxProjectFinger", "Box", "Laser cut, 6mm MDF"),
    ("Playfield plate", "SketchMiddleNew", "Playfield", "Laser cut + engraved"),  # special-cased, no glb here
    # Walls & guides group (curved inner/outer, loading wall, top triangle wall, flipper-side
    # walls) removed from the gallery on request - still real, laser-cut MDF, still "Used" in
    # the spreadsheet, just not shown on the site.
    ("Flipper lever", "RucickaNova", "Flipper", "3D printed"),
    ("Flipper solenoid assembly", "AdapterArmsV1", "Solenoid arm R", "3D printed"),
    # "Flipper solenoid assembly / AdapterRucickyL" ("Solenoid arm L") removed from the
    # gallery on request - still real, still "Used" in the spreadsheet, just not shown.
    ("Solenoid adapter (mini)", "AdapterSolenoidMini", "Mini adapter", "3D printed"),
    # "Solenoid bracket (big)" and "Arm-solenoid connector" removed from the gallery on
    # request - still real, still "Used" in the spreadsheet, just not shown.
    # "Hit target (top)" versions V2, V3, V5 removed from the gallery on request (V2/V5 were
    # never-exported placeholders anyway; V4 is the one real, exported version and stays).
    ("Hit target (top)", "V4", "Top target v4", "3D printed"),
    ("Hit target (mid)", "V2", "Mid target", "3D printed"),
    ("Hit target (corner)", "V1", "Corner target", "3D printed"),
    ("Hit target (slide)", "V1", "Slide target", "3D printed"),
    # "Loading system diagram" (LoadingAll.png, a flat drawing, not a model) removed from the
    # page on request - still "Used" in the spreadsheet, just not shown.
    ("Loading hook", "HookV3", "Loading hook", "3D printed"),
    ("Ball shoot platform", "BallLoadingShootPlatform", "Shoot platform", "3D printed"),
    ("RFID holder", "RFIDHolder", "RFID holder", "3D printed"),
    ("Slide", "SlideV1", "Slide", "3D printed, glued"),
    ("Barrier ('Zabrana')", "ZabranaV1", "Barrier", "3D printed"),
    ("Limiter ('Obmedzovac')", "Obmedzovac", "Limiter", "3D printed"),
    ("Washer ('Podlozka')", "Podlozka", "Washer", "3D printed"),
    ("L bracket (large)", "V1", "L bracket, large", "3D printed"),
    ("L bracket (small)", "V1", "L bracket, small", "3D printed"),
]

NO_GEOMETRY = {("Hit target (top)", "V5")}  # V2 has a thumbnail too but let's check both at build time

# STL exports that aren't a physical piece of the finished part. SlideV1-Body is the whole
# slide as one piece (same footprint as Left + Right together) - it was printed as those two
# halves and glued, so showing Body as well stacked the same slide twice. Left out on request.
SKIP_STL = {"SlideV1-Body.stl"}

manifest = []
warnings = []

for comp, ver, label, how in PARTS:
    row = BY_KEY[(comp, ver)]
    item = {"comp": comp, "ver": ver, "label": label, "how": how, "group": GROUP_LABEL[row["group"]]}
    slg = slug(comp, ver)

    if comp == "Playfield plate":
        item["kind"] = "playfield"  # the Pinball page reuses the Home hero's animated line-art for this one
        manifest.append(item)
        continue

    if comp == "Box (finger joints)":
        # assembled as the real finger-jointed box (every joint proven to interlock - see
        # assemble_box.py and tools/check_box_joints.py). Each panel is real, named geometry,
        # so it gets the same click-to-isolate treatment as any other multi-piece part below.
        box = assembled_box_triangles()
        panels = [(_split_words(name), tris) for name, tris in box.items()]
        model, size, sub_manifest = write_subparts(comp, ver, panels, WOOD_COLOR)
        # dimension lines, anchored in the hero glb's own model space so they sit exactly on
        # its edges - the values are the box's real outer size, measured off the same panels
        point, direction = single_part_frame(np.concatenate([t for _, t in panels]))
        dims = [
            {
                "group": d["group"],
                "value": round(d["value"]),
                **{k: [round(c, 5) for c in point(d[k])] for k in ("a", "b", "a2", "b2")},
                "faces": [[round(c, 5) for c in direction(n)] for n in d["faces"]],
            }
            for d in dimension_lines(box)
        ]
        item.update(kind="model", model=model, parts=len(panels), bytes=size, material="wood", subparts=sub_manifest, dims=dims)
        manifest.append(item)
        continue

    stl_files = [a for a in row["files"] if a["ext"] == ".stl" and a["base"] not in SKIP_STL]
    svg_files = [a for a in row["files"] if a["ext"] == ".svg"]

    if stl_files:
        parts, empty = [], []
        for a in sorted(stl_files, key=lambda x: x["base"]):
            tris = read_stl(a["path"])
            (parts if len(tris) else empty).append((a["base"], tris))
        if empty:
            warnings.append(f"{comp}/{ver}: skipped empty STL(s) {[n for n,_ in empty]}")
        if not parts:
            warnings.append(f"{comp}/{ver}: every STL was empty, falling back to thumbnail")
        elif len(parts) == 1:
            base, tris = parts[0]
            out = f"{MODELS_OUT}/{slg}.glb"
            size = write_glb([(base, tris)], out, **PLA_COLOR)
            item.update(kind="model", model=f"assets/models/{slg}.glb", parts=1, bytes=size)
            manifest.append(item)
            continue
        else:
            # more than one real body: per-project bbox checks confirmed these STL exports
            # already share one coordinate space (adjoining/stacking ranges, not each piece
            # independently centered at its own local origin) - same situation as the
            # solenoid adapter - so build it together with per-piece isolate buttons instead
            # of the old grid-packed "kit of parts" treatment.
            named = [(_stl_stem(base), tris) for base, tris in parts]
            model, size, sub_manifest = write_subparts(comp, ver, named, PLA_COLOR)
            item.update(kind="model", model=model, parts=len(parts), bytes=size, subparts=sub_manifest)
            manifest.append(item)
            continue

    if svg_files:
        svg_files = sorted(svg_files, key=lambda a: -a["size"])
        chosen = [svg_files[0]] if len(svg_files) == 1 else svg_files  # box: use every panel; single-panel walls: just the one
        tri_parts = []
        for a in chosen:
            tris = extrude(a["path"], MDF_THICKNESS_MM)
            if tris is not None and len(tris):
                tri_parts.append((a["base"].rsplit(".", 1)[0], tris))
        if tri_parts:
            out = f"{MODELS_OUT}/{slg}.glb"
            size = write_glb(tri_parts, out, **WOOD_COLOR)
            item.update(kind="model", model=f"assets/models/{slg}.glb", parts=len(tri_parts), bytes=size, material="wood")
            manifest.append(item)
            continue
        warnings.append(f"{comp}/{ver}: SVG extrusion produced nothing, falling back to thumbnail")

    # last resort: nothing was ever exported for 3D or laser cutting, only a FreeCAD source
    # file. Its embedded thumbnail exists but is genuinely unusable here (UI tooltips baked
    # into one, a stray wireframe close-up in the other) - a clean, honest placeholder reads
    # better than dressing up a bad screenshot, and says the true thing: never exported.
    warnings.append(f"{comp}/{ver}: no exported geometry (FreeCAD source only) - placeholder card")
    item.update(kind="placeholder")
    manifest.append(item)

with open(f"{SITE}/js/pinball-parts.js", "w", encoding="utf8") as f:
    f.write("/* Generated by tools/make_pinball_models.py from pinball-parts-inventory.xlsx. Do not hand-edit. */\n")
    f.write("window.PINBALL_PARTS = " + json.dumps(manifest, indent=1) + ";\n")

kinds = {}
for m in manifest:
    kinds[m["kind"]] = kinds.get(m["kind"], 0) + 1
total_kb = sum(m.get("bytes", 0) for m in manifest) / 1024
print(f"{len(manifest)} parts -> {kinds}, total glb size {total_kb:.0f} KB")
if warnings:
    print("\nWARNINGS:")
    for w in warnings:
        print(" -", w)
