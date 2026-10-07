# Portfolio structure and Lost & Found preparation

Prepared and implemented 1 October 2026. Status: main Lost & Found case study built and linked from Home.
The original planning sections below document the direction. The implementation notes and guided-demo behavior supersede the earlier firmware-timed preview.

## The direction

Keep the portfolio's current blue drafting-paper background, yellow accent, technical labels, large typography and physical prototypes. Make the Lost & Found case study feel like opening a machine and understanding its decisions.

The memorable moment is a visitor scanning a sample RFID card and seeing how the reader, Arduino, display, feedback and servo respond. Real footage sits next to that explanation so a visitor can distinguish the demonstration from the physical build.

Keep two reading speeds: the heading, hero footage and demo communicate the project quickly; the timeline, component details and code reward a longer visit. Important facts remain visible without interaction.

## Website structure

| Page | Purpose | Proposed structure |
| --- | --- | --- |
| Home | Explain Jakub's work and lead into real projects | Current introduction / short project footage / selected work / tools and capabilities / internship contact |
| Pinball | Existing detailed hardware case study | Keep the current hero, dated build timeline, mechanism chapters, models, code and showcase |
| Lost & Found locker | New RFID and electronics case study | Hero / try the locker / build timeline / component explorer / real walkthrough / reflection / next project |
| Web | Separate web design work | Selected web projects and short case studies, using their own available evidence |
| About | Introduce the maker and internship goals | Background / practical capabilities / role and collaboration / CV / contact |
| Shot dispenser | Later, a distinct project | Own case study if desired; its tubing, cup, pump, photos and footage never appear as locker assets |

The completed scope is the Lost & Found page and its Home project card, now using the finished-prototype photo. Other page redesigns can be planned separately. Contact details, CV and external links should be confirmed before publication; existing placeholders are outside this case-study pass.

## Lost & Found page, in reading order

### 1. A real prototype from the first screen

Heading: **Lost & Found locker**

Suggested introduction: "Built for a festival Lost & Found station, this Arduino prototype uses RFID tags to identify items and respond to claims with a display, LEDs, a buzzer and a servo-controlled lock. Explore how the components work together, then watch the real demonstration."

Labels: Fusion challenge / prototype / Arduino Uno / RFID / I2C LCD / servo.

Primary link: **Try a claim**. Secondary link: **Watch the build work**.

Use `access-granted.mp4` as the short hero loop, with `locker-finished-front.webp` as the fallback. Keep the full vertical frame: the reader, green LED and hand opening the front door need to remain visible. Pair the video with concise text rather than putting the text on top of the LCD.

Motion: the heading and technical labels enter once; a fine drafting line draws around the media. Pause video when offscreen or when the user pauses it. Reduced motion starts with the poster.

### 2. Try the locker

Heading: **One scan. A visible decision.**

One focal scene: a diagrammatic locker with a reader, LCD, two status LEDs and a hinged door. A small set of sample cards sits alongside it. The visitor can click, tap or drag a card to scan it.

Display the input-to-output explanation under the machine:

`RFID tag -> reader -> Arduino checks the item owner -> LCD + LEDs + buzzer + servo`

Default guided task: **Collect my item** (scan → open → take → close). Second task: **Store a found item** (staff card → item tag → description → open → put inside → close). Unknown and recognised non-owner cards remain available in the optional card drawer.

The current state also appears as readable text. Highlight the relevant component and the real source excerpt together. Keep a **Reset demo** button and an obvious **Continue the story** link; trying every scenario is optional.

Label: **Browser demonstration based on the archived Arduino sketch. Sample item data.**

Motion: a short scan pulse, an animated signal along the schematic, status feedback, then the door rotating around its hinge. These actions are sequential so the causal relationship is clear. Sound is optional and starts only after an explicit Sound on action.

Do not render a hypothetical polished enclosure as an original CAD asset. A simplified illustration is a teaching diagram; photos show what was actually built.

### 3. From sketch to prototype

Heading: **How I built it**

Use a compact timeline of actual stages, in the same visual family as Pinball:

| Stage | Main evidence | What the visitor learns |
| --- | --- | --- |
| Festival problem and first concept | `concept-sketch.webp`, Milestone 1 | Why tags, descriptions and a lock were chosen |
| Test the outputs | `early-led-buzzer-test.webp`, `early-lcd-test.webp`, `early-servo-test.webp` | Validate individual components before combining them |
| Read RFID tags | `locker-rfid-reader.webp` | The reader provides a unique identifier to the sketch |
| Connect the electronics | `locker-wiring-lcd-rfid.webp`, `locker-arduino-wiring.webp` | Arduino, display, reader and feedback share one system |
| Fit the enclosure | `locker-cardboard-front.webp`, `locker-inside.webp` | Cardboard was a practical prototype enclosure |
| Demonstrate the black-painted build | `locker-finished-front.webp`, prepared clips | Registration, matching and rejection in the physical prototype |

Use stage numbers rather than invented build dates. Milestone PDFs have document creation metadata spanning November 2024 to January 2025; the exported long demo contains January 2025 creation metadata. Neither establishes the exact date of each photographed build step.

Implemented as six selectable stages with thumbnail buttons, a next-stage control and a full-photo dialog. Mobile selections bring the updated photo into view. Stage numbers communicate the sequence without invented dates.

Caption historical diagrams as **Early component test**. They are not a verified final wiring specification.

### 4. Explore what is inside

Heading: **The parts behind the response**

Present a simplified system diagram beside the real wiring photo. Switch between **System view** and **Inside the prototype**. Numbered hotspots connect the diagram to component cards, their photo/video evidence and code.

| Hotspot | Role | Evidence | Code connection |
| --- | --- | --- | --- |
| RFID reader | Read the scanned tag's UID | `locker-rfid-reader.webp` | `getRFIDTag()` |
| Arduino Uno | Compare identifiers and select the response | `locker-arduino-wiring.webp` | personal-tag test and `itemOwners` match |
| LCD | Explain the current state to a person | Hero/demos, LCD test diagram | `lcd.print(...)`, `autoListDescriptions()` |
| Red / green LEDs | Visible denial / successful unlock feedback | Success and rejection clips | `flashRedLed()`, `handleLocker()` |
| Buzzer | Audible feedback in the sketch | Wiring photo and component test | `tone(...)` |
| Servo | Set the lock actuator position | Early servo test and source | `lockerServo.write(0/90)` |
| Enclosure | Support the interface and contain electronics | Cardboard and finished photos | Physical construction; no firmware excerpt needed |

The breadboard photograph is useful for placement, but tracing every hidden jumper would invent wiring. Build a verified pin table from the sketch, and a conceptual signal diagram; do not label an unverified wire trace as exact.

Code appears in a narrow readable panel with a plain-language explanation above it. The default excerpt is short. **Read more** expands it; **Download sketch** opens the unchanged archive. Syntax highlighting and an animated line marker can show which action the browser demo is explaining.

Use the code source rather than the laptop screenshot for readable code. Keep `locker-code-reference.webp` in the prepared archive as process evidence only.

### 5. Watch it work

Heading: **The prototype, in action**

Main video: `walkthrough.mp4` with `walkthrough.en.vtt`; captioned review/export: `walkthrough-captioned.mp4`.

The 43.5-second edited montage tells the full short story. It combines two recordings, so call it an **Edited demonstration**, not one continuous take.

Chapter controls: Prototype / Staff access / Register / Description / Store / Claim / Reject / Inside. The controls seek to the start of each chapter; they never simulate new hardware footage. Highlight the chapter currently playing and show its description nearby.

An optional details row explains what the sketch does behind the observed action. Keep reconstructed events clearly labeled; do not present a fabricated serial log as text printed by the archived program.

### 6. What this prototype taught me

Heading: **Working prototype. Next iteration.**

Suggested copy: "The build brought RFID input, LCD messages and physical feedback together in one Arduino prototype. The next iteration would improve the enclosure, registration flow and how item records survive a restart."

| Shown or present | Prototype constraint | A credible next step |
| --- | --- | --- |
| Tag scan, green feedback and a hand opening the door | The footage demonstrates the response; it does not show an automatically swinging door | Improve and document the physical latch |
| Staff description entry through Serial Monitor | A laptop is part of the registration workflow | Dedicated staff interface |
| Arrays for up to ten item records | Records are kept in RAM; the code has no persistence or capacity guard | Add storage, capacity handling and reset recovery |
| Known personal tags and owner comparison | New registrations are assigned to one hardcoded owner | Explicit pairing during registration |
| LCD descriptions cycle in the saved sketch | Early reports proposed browsing buttons; final sketch automatically cycles | Choose and implement a consistent browsing interaction |
| Servo timing and LED feedback | Blocking delays pause other work during an unlock | Nonblocking state machine |

These are engineering reflections, not claims that the festival system was deployed. No test counts, usability metrics, CAD iteration counts or fabricated results should be added.

Finish with the same next-project treatment as Pinball and a contact link.

## Guided demo behavior

| Action | LCD / feedback | Physical illustration | Source / timing |
| --- | --- | --- | --- |
| Reset | Locker Ready | Closed visual starting state | Deterministic browser reset |
| Scan a matching owner card | Item ID + green feedback | Lock position changes; visitor can open illustrated door | Owner comparison, `handleLocker()` |
| Complete collection | Remove the matched item from the sample list | Close and relock illustration | Array shift, decrement `itemCount` |
| Scan an unknown card | Access Denied + red flashes | Door remains closed | `flashRedLed()`; three 500 ms on/off cycles |
| Scan a known card with no owned item | No Items Found | Door remains closed | Known-person branch |
| Scan a known card with an empty list | No Items, then Locker Ready | Door remains closed | Empty-list branch |
| Scan staff card | Master Mode On | Registration state | Master-card branch |
| Scan item and add a sample description | Register Item, then Item Registered | Unlock for placement | Description is entered through Serial Monitor in the real footage |
| Leave items unclaimed | Cycle descriptions | Idle | `autoListDescriptions()`; 3 seconds per item |

Sample items should have neutral labels, such as Wallet and Backpack, and stay local to the browser. The simulation is explanatory; it does not read real cards or change the archived firmware.

The real sketch holds its unlock position for 8 seconds. The default browser demo now explicitly adds teaching safeguards requested during review: no time limit for physical steps, no closing before collection/deposit, no repeated transfer, and no scanning during an unfinished transaction. Opening, item transfer and closing are separate guarded transition states. The latch stays released until closing finishes. Duplicate item tags, blank descriptions and capacity overflow are browser guards, not original firmware features. Raw eight-second source behavior remains separately covered by engine tests with `guided: false`.

The saved firmware starts the servo at 0 degrees and `handleLocker()` later writes 0 then 90. Exact initial latch position cannot be inferred from these angles without inspecting its mounting. Resetting the browser diagram to a clear closed state is a presentation choice, not proof of the physical startup lock state.

Do not modify the archived sketch as part of building the website. It includes blocking input, hardcoded owners, unbounded registrations, duplicated unreachable statements and a first-scan handling edge case. Display excerpts with their context; label it an archived demonstration sketch.

## Visual and motion decisions

- Retain current tokens: blue `#08205a`, deep blue `#061849`, white ink, yellow `#ffd60a`. Green and red indicate actual system states rather than replacing the portfolio's accent palette.
- Keep Archivo headings, Instrument Sans body text and IBM Plex Mono labels. Use a monospace treatment for LCD/status text, with readable contrast rather than a heavy glow.
- Use one prominent interactive scene. Timeline scrubbing, hotspots, chapter seeking and media enlargement support it.
- Reveal component connections as their section enters view; keep explanations readable throughout the animation.
- Favor short, deliberate transitions over constant movement. Do not apply decorative distortion to LCDs, circuit diagrams or code.
- Retain native scrolling and simple anchor navigation. A pinned scene must not block access to the next section.
- Touch interactions have buttons; no hover-only details and no drag-only controls.
- Respect reduced motion, keyboard focus, readable status text, video pause, and user-triggered optional sound. Status is communicated by words as well as color.

## Technical build route

Keep the existing plain HTML/CSS/JS structure, vendored GSAP/ScrollTrigger and existing media/lightbox patterns. The locker assets do not require a framework migration or a new external design platform.

Proposed additions when building:

- `site/lost-and-found.html`: replace the current placeholder with the approved story.
- `site/css/locker.css`: page layout, component explorer and demo machine.
- `site/js/locker-data.js`: content mapped from the prepared manifest.
- `site/js/locker-demo.js`: deterministic state machine and accessible controls.
- `site/js/locker-story.js`: timeline, hotspots and chapter-video synchronization.
- Reuse the existing lightbox only after checking it supports the prepared vertical clips and caption tracks.
- Use inline SVG for the conceptual machine and signal diagram; use original CAD models only if actual locker CAD is provided.

Performance: load a poster first, start the hero only when visible, lazy-load build images and non-hero videos, pause offscreen media, avoid running several autoplay clips simultaneously, and avoid a frame-sequence download for ordinary video. The captioned export is a review/download asset; the clean video with a toggleable VTT track is preferable for the actual page.

## Evidence and assets

- Media originals: `~/Desktop/FestivalProject/Locker`.
- Separate project: `~/Desktop/FestivalProject/Shot`.
- Written evidence: four milestone PDFs and Final Assignment in `~/Desktop/KdG/fablab/Fusion challange`.
- Authoritative saved sketch: `fusion_project_final/fusion_project_final.ino` in that folder.
- Prepared asset manifest: `site/assets/media/lost-and-found/manifest.json`.
- Exact archived copy: `site/assets/code/lost-and-found.ino`.
- Code excerpts with source line numbers: `site/assets/media/lost-and-found/code-excerpts.json`.
- Edit decisions and caption timing: `media-edit-plan.md` and the manifest.
- Rebuild script: `tools/prepare_locker_media.py`.

No locker CAD model, production enclosure, deployed multi-station system, cloud database or app was found. Reports mentioned future possibilities; those belong in future-work copy.

## Inspiration translated into this project

These references inform the structure; the proposed interactions above are our own plan rather than claims that every reference implements them.

- [Allie Katz: Face-Locked Chocolate Box](https://katzcreates.com/portfolio/chocolatebox): closely related physical input, embedded logic and a servo-controlled enclosure. Borrow the connection between mechanical design, programming and finished-build evidence.
- [Aman Shah: Tinkerly](https://aman-shah.vercel.app/work/tinkerly): links hardware geometry, circuits, firmware and assembly. Borrow connected views so a component selection has a meaningful effect on the explanation.
- [Ayush Shetty: portfolio case study](https://ayushetty.me/projects/portfolio): describes interactive galleries and motion alongside performance and reduced-motion handling. Borrow selective interaction and clear technical storytelling.
- [Michelle Kim: MIT fabrication final project](https://fab.cba.mit.edu/classes/863.24/people/MichelleKim/final.html): documents the actual materials, fabrication, integration and problems. Borrow candid development evidence and reflection.

## Build sequence and readiness

### Main case study implemented

The full page is available at `/lost-and-found.html`. It includes real hero footage with a pause control, sticky section navigation, the guided locker, six-stage photo story, real-hardware explorer, enlarged-photo dialog, nine chapter-controlled video moments with default English captions, engineering reflection and a Pinball next-project link. Home now links to it with the finished-prototype image and a Try the locker action.

The same tested demo markup is reused from `/previews/locker-demo.html`, mounted into the page before importing `locker-demo.js`. Its conceptual model has detailed enclosure surfaces, hinges, a door back, shelf, reader and LCD details, an exposed latch/close-up and an exploded Arduino electronics view. Card scanning, door motion and item transfers animate sequentially. Idle rendering is cached to avoid repeated DOM updates.

Implementation files: `site/lost-and-found.html`, `site/css/locker.css`, `site/js/locker-story.js`, `site/previews/locker-demo.html`, `site/css/locker-demo.css`, `site/js/locker-demo.js`, and `site/js/locker-engine.js`. `site/css/locker-lab.css` is generated by `node tools/scope_locker_css.mjs` to scope the reusable demo's styles. A native dialog handles real-photo enlargement. The page reads chapter timings from the prepared manifest; the clean video uses the VTT track and links to the burned-in version. The wallet-placement → keys-take-closure edit is disclosed alongside the video.

Fidelity boundaries remain displayed: conceptual geometry, illustrative seeded descriptions and exposed latch position, closed 90° browser startup despite original setup writing 0°, simplified firmware startup quirks, guided physical safeguards and extra input validation. The original has no physical sensors and removes a record after its timer regardless of collection. It is not measured CAD or a production-security simulation. No archived firmware was changed.

Verification: `node --test tests/locker-engine.test.mjs tests/locker-guided.test.mjs tests/locker-case-study.test.mjs` — 42 passed. Browser checks are documented in `interactive-preview-checks.md`.

1. Review this content structure and the captioned walkthrough.
2. Lay out the page using approved copy, real assets and existing portfolio tokens.
3. Integrate the prepared locker state machine with matching, denied, no-match, empty and registration scenarios.
4. Connect component hotspots to evidence and source excerpts.
5. Add the build timeline and chapter-controlled video.
6. Tune animation, focus behavior, reduced motion, mobile layouts and media loading.
7. Verify all scenarios, caption seeking, reset, video controls and source attribution, then update the Home project card.

Preparation is sufficient to start the page. Optional additions that would improve it later: a close-up of the latch moving, a cleaner front photo, a wiring schematic drawn from inspected hardware, and a brief first-person account of the hardest problem. None is required to proceed with the documented prototype.
