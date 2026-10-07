# CLAUDE.md

Portfolio site for Jakub Michalec's interactive-prototyping internship search (KdG, Multimedia and Creative Technologies). Plain HTML, CSS and JS in `site/`, no build step. `README.md` has the tools table. Look: dark blue blueprint grid, yellow `#ffd60a` accent, Archivo + IBM Plex Mono + Instrument Sans. The internship fair is 2026-10-15.

## Run and test
- `python tools/dev_server.py` serves `site/` on http://localhost:5173 (`.claude/launch.json` has the same command). It sends no-cache headers and answers Range requests, which videos need for seeking.
- `node --test tests/locker-engine.test.mjs tests/locker-guided.test.mjs tests/locker-case-study.test.mjs tests/locker-pacing.test.mjs` (Node 20+, nothing to install).
- GitHub Pages redeploys the site from `main` on every push that touches `site/**`, so a push to `main` is a publish. Commit and push only when the author asks. Commits use the repo's GitHub no-reply identity; never put a personal or school email address in a commit or on the site.

## Conventions that are easy to miss
- After editing anything in `site/css` or `site/js`, run `python tools/bump_cache_version.py` (one `?v=N` on every CSS and JS tag of every page). `js/locker-story.js` reads its own `?v=` and passes it on to the markup and modules it loads.
- Lost & Found page: `site/lost-and-found.html` + `css/locker.css` (page) + `js/locker-story.js`, which fetches `previews/locker-demo.html` (also a standalone page), mounts it into `#locker-lab` and imports `js/locker-demo.js` (UI), `js/locker-engine.js` (state machine of the Arduino sketch) and `js/locker-pacing.js` (quick feedback and skipping; presentation only, it never changes what the sketch does).
- Edit `css/locker-demo.css`, then run `node tools/scope_locker_css.mjs`. `css/locker-lab.css` is generated; never edit it.
- The lab shows one task switch, the machine and one guide with a single main button. Everything else (other cards, sound, hardware and code, caveats) sits in collapsed `<details>`. Keep it that way: put new things inside a disclosure, not next to the main button. A test fails if the script uses an element id the markup does not have.
- `site/assets/code/lost-and-found.ino` is an archive. Never modify it: a test and `python tools/prepare_locker_media.py --verify` check its SHA-256, and `.gitattributes` stores it byte-for-byte.
- Web media is silent, with all metadata and GPS stripped. The raw footage, photos and FreeCAD sources are not in this repo, so the scripts in `tools/` that read them (`make_pinball_media.py`, `make_pinball_models.py`, `prepare_locker_media.py` and so on) only run on the author's PC. Their generated output is committed.
- `make_pinball_media.py` modes: `--showcase` (the video only), `--only=id1,id2` (those items, then the timeline), `--timeline`.
- `tmp/` holds raw review images and is git-ignored. Never publish it.

## Open questions for the author (ask before changing)
- The RFID reader pins in the Pinball wiring diagram (SS D10, MISO D12, RST D9) are placeholders until the real wiring is confirmed. The RFID code panel is labelled a reconstruction.
- `site/index.html` still has placeholder contact details (`your@email.com`), `#` social links, no profile photo and no CV file.
