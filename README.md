# Jakub Michalec - internship portfolio

Portfolio site for an interactive-prototyping internship (KdG, Multimedia and Creative Technologies): a playable pinball machine, an RFID lost-and-found locker, and the CAD, code and wiring behind them.

Plain HTML, CSS and JS with no build step. [GSAP](https://gsap.com) with ScrollTrigger and [Lenis](https://lenis.darkroom.engineering) are vendored in `site/js/vendor/`; the 3D parts use [`<model-viewer>`](https://modelviewer.dev), loaded from a CDN.

Pages: `index.html`, `pinball.html`, `lost-and-found.html`, `web.html`, `about.html`.

## Run it

From the repo root:

```bash
python tools/dev_server.py
```

then open http://localhost:5173. On Windows, `open-site.bat` does both. The dev server sends no-cache headers and answers HTTP Range requests (a browser needs them to seek in a video). After editing anything in `site/css` or `site/js`, run `python tools/bump_cache_version.py` to bump the `?v=` on every stylesheet and script tag.

## Test

The Lost and found demo has plain Node tests (Node 20+, nothing to install):

```bash
node --test tests/locker-engine.test.mjs tests/locker-guided.test.mjs tests/locker-case-study.test.mjs tests/locker-pacing.test.mjs
```

## Tools

`tools/` turns the raw project files into what the site serves. The generated output is committed, so the site runs without any of it. The source files (FreeCAD projects, raw phone photos and clips, the assignment PDF) are not in this repo; the paths to them are set near the top of each script.

| Script | What it does |
|---|---|
| `make_pinball_models.py` | Builds the `.glb` models in `site/assets/models/` and `site/js/pinball-parts.js` for the parts marked "Used" in `pinball-parts-inventory.xlsx`. Uses `glb_export.py`, `svg_extrude.py` and `assemble_box.py` |
| `make_pinball_media.py` | Resizes the photos and clips, cuts and crops the 4K showcase footage into the hero/finale video and the Home loop, and writes `site/assets/media/pinball/` and `site/js/pinball-media.js`. Strips all metadata (EXIF, GPS, audio) and checks that none survived |
| `build_inventory.py` | Builds `pinball-parts-inventory.xlsx`, the catalogue of every part (thumbnails from `tools/fcstd_thumbnails/`) |
| `make_playfield_js.py` | Turns the FreeCAD playfield drawing into `site/js/playfield-data.js` |
| `make_studio_env.py` | Writes the lighting used by the 3D viewers, `site/assets/env/studio.hdr` |
| `check_box_joints.py` | Checks that the assembled box's finger joints interlock with no overlap or gap |
| `extract_lf_photos.py` | Pulls the Lost and found prototype photos out of the assignment PDF |
| `prepare_locker_media.py` | Prepares the Lost and found photos and clips (silent, metadata stripped) and `manifest.json` in `site/assets/media/lost-and-found/`; `--verify` re-checks the originals and the archived sketch |
| `scope_locker_css.mjs` | Regenerates `site/css/locker-lab.css` from `locker-demo.css`, so the demo's styles stay inside the case study (Node, no install) |
| `bump_cache_version.py` | Stamps one `?v=N` on every CSS and JS tag of every page; run it after editing `site/css` or `site/js` |

Needs Python 3 with Pillow, NumPy, openpyxl and pypdfium2, plus `ffmpeg` and `ffprobe` on the PATH for the media script.
