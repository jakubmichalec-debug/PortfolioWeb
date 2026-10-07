# Lost & Found media package

Prepared 1 October 2026. Original files stay in FestivalProject/Locker. The Shot folder is a separate project.

## Deliverables

| Asset | Length / size | Intended use |
| --- | --- | --- |
| `walkthrough.mp4` | 43.5 s, 720 x 1280 | Main chapter-controlled page video |
| `walkthrough-captioned.mp4` | 43.5 s, 720 x 1440 | Review/export with permanently visible English explanation |
| `access-granted.mp4` | 10 s, 720 x 1280 | Hero loop, matching-card proof |
| `access-denied.mp4` | 5 s, 720 x 1280 | Unknown-card proof |
| `registration.mp4` | 23.7 s, 720 x 1280 | Staff workflow detail |
| `electronics.mp4` | 7.5 s, 720 x 1280 | Inside-the-prototype detail |
| Four focused clip posters + two walkthrough posters | JPEG | Immediate display before playback |
| English `.vtt` and `.srt` for every video | Timed text | Toggleable browser captions and reusable editor subtitles |
| Seven source photos | WebP, max 1800 px + 640 px thumbnails | Build evidence and component detail |
| Concept drawing and three component test images | WebP, max 1600 px + 640 px thumbnails | Historical concept/test evidence |
| `manifest.json` | Asset, source, hash and edit mapping | Connect assets to the later website |
| `code-excerpts.json` + unchanged sketch archive | Readable source excerpts | Demonstrate the real code |

All videos are H.264, 30 fps, yuv420p, with the MP4 index at the front for streaming. Auto-rotation follows the source display matrix. The clean edit retains the full portrait frame; no LCD or reader cropping is introduced. The captioned export adds a blue footer below the image so the explanation never covers the hardware.

The web edits are silent. The originals retain their audio. Captions describe visible actions and documented context; they are **not speech transcripts**, and do not claim an audible buzzer was verified by listening. No synthetic sound, generated narration or music has been added.

Original capture metadata is stripped from derivatives. Original files and duplicate recordings are retained and their SHA-256 hashes are checked by the builder.

## Walkthrough edit decisions

Two unique source clips are used: `locker-full-demo.mp4` (120.19 s) and `locker-demo.mp4` (20.05 s). The short recording contributes the clear Access Denied sequence. This is an edited montage.

| Edited time | Source | Original time | Caption / chapter |
| --- | --- | --- | --- |
| 00:00-00:03 | Full demo | 00:00.5-00:03.5 | Lost & Found for music festivals / Arduino prototype |
| 00:03-00:07 | Full demo | 00:10.3-00:14.3 | Master card starts registration / Master Mode On |
| 00:07-00:11 | Full demo | 00:14.3-00:18.3 | Scan the item tag / Register Item |
| 00:11-00:16 | Full demo | 00:20-00:25 | Add a description through Serial Monitor |
| 00:16-00:19.5 | Full demo | 00:29-00:32.5 | Put the wallet inside; cut before the failed closure |
| 00:19.5-00:24 | Full demo | 01:01-01:05.5 | Successful closure taken from the keys demonstration |
| 00:24-00:34 | Full demo | 01:35-01:45 | Personal tag / green feedback / demonstrator opens door |
| 00:34-00:39 | Short demo | 00:08.5-00:13.5 | Unknown tag / Access Denied |
| 00:39-00:43.5 | Full demo | 01:21-01:25.5 | Arduino, breadboard and wiring inside |

Long waits, repeated demonstrations and camera travel are removed. Display text was checked from extracted full-size frames; the display is overexposed in some shots, so the explanatory track helps without replacing or altering the actual LCD image.

At the user's request, the wallet placement cuts directly to the successful closure from the keys take. The failed wallet-take closure is removed. The caption identifies the keys-take closure rather than presenting it as an uninterrupted wallet take. The focused `registration.mp4` uses the same selection: 10.3-25.5 s, 29-32.5 s, and 61-66 s of the full recording (23.7 seconds total).

Keep the wording "the demonstrator opens the door." The clip proves access feedback and a hand-operated door; it does not show a motor automatically swinging the door open.

## Photo use

Use `locker-finished-front.webp` for the project's overview. It shows the black-painted build. Use `locker-cardboard-front.webp` and `locker-inside.webp` for the earlier enclosure stage. The workbench, RFID and Arduino photographs support the component story.

Use the laptop/code photo only as an archive reference. It is a photographed earlier draft; the legible code panel should use the saved `.ino` file instead.

The extracted test diagrams belong to early test stages. They must not be presented as a validated final circuit schematic or installation instructions.

## Reproduce and verify

Run `tools/prepare_locker_media.py --review` to generate timestamped source contact sheets, `--build` to regenerate derivatives and the manifest, or `--verify` to check the prepared outputs. The script requires FFmpeg/FFprobe, Pillow and pypdf. The bundled Python used for this preparation is:

`~/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`

The builder verifies web encoding, absence of an audio stream, stripped capture metadata, stripped image EXIF and unchanged originals. The prepared contact sheets support a visual check of photo orientation and the captioned montage. Caption tracks must remain synchronized if any later cut changes duration.

Final checks passed: all six videos fully decoded, MP4 streaming index precedes video data, all twelve caption tracks stay within their video duration, all original media hashes match, and the sketch archive/excerpts match the source. The captioned walkthrough also played in the in-app browser at 720 x 1440 for 43.5 seconds with no media error. All eleven image assets and eight captioned montage chapters were visually reviewed. Results are saved in `preparation-checks.json`.
