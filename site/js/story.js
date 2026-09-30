/* Pinball page: the build told as one continuous story, not a filtered gallery. Each chapter
   is a mechanism (Structure, Flippers, Loading, Targets, Slide & small parts, Brackets),
   alternating sides, connected by an animated path. Every model just idles in place until
   clicked - click opens it full-screen with real orbit + zoom controls (site/js/lightbox.js).
   Reads window.PINBALL_PARTS (tools/make_pinball_models.py) for the 3D/photo content, and
   embeds short, real excerpts from the actual Arduino sketch (site/assets/code/pinball.ino)
   for the three chapters an Arduino actually drives. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parts = window.PINBALL_PARTS || [];
  const root = $('#story-chapters');
  if (!root || !parts.length) return;

  const byGroup = {};
  parts.forEach((p) => (byGroup[p.group] = byGroup[p.group] || []).push(p));

  // ---------- the story, in build order, with a short, real code excerpt where a mechanism is
  // actually Arduino-driven (Structure/Slide/Brackets are not). Each chapter's hero is the first
  // of its group in tools/make_pinball_models.py's PARTS list - order that list to change it. ----------
  const CHAPTERS = [
    {
      group: 'Structure',
      title: 'The idea, and the box',
      blurb: "Everything starts with the cabinet: 6mm laser-cut MDF, finger-jointed, sloped from front to back so the ball rolls toward the flippers. Every panel began as a flat FreeCAD sketch before the laser ever touched it.",
      tags: ['FreeCAD', 'Laser cutter', '6mm MDF'],
    },
    {
      group: 'Flippers',
      title: 'The shooting mechanism',
      blurb: "Two solenoids fire the flippers through a steel rod filed to a D-profile. The drive adapter alone went through five redesigns before I rebuilt it as a different assembly entirely.",
      tags: ['Arduino', 'Solenoid', 'PWM'],
      code: {
        file: 'pinball.ino',
        label: 'handleLeftFlipper()',
        note: 'A short full-power kick, then a lower held PWM while the button stays down, capped by a safety timeout so the solenoid can’t overheat.',
        snippet: `if (!leftFlipperWasPressed) {
  leftFlipperWasPressed = true;
  analogWrite(leftFlipperOut, 255);   // full-power kick
  delay(flipperFullPulseMs);          // 80 ms
}

unsigned long holdStart = millis();
while (digitalRead(leftButtonPin) == LOW) {
  analogWrite(leftFlipperOut, flipperHoldPWM);   // held at 120/255
  if (millis() - holdStart >= maxHoldTimeMs) {   // 1500 ms safety cutoff
    analogWrite(leftFlipperOut, 0);
    break;
  }
}`,
      },
    },
    {
      group: 'Ball loading',
      title: 'The loading mechanism',
      blurb: "An HC-SR04 distance sensor watches the drain. When something sits under 26mm away for the first time, that's a lost ball - the Arduino fires the reload solenoid and prepares the next one, no manual reset.",
      tags: ['Arduino', 'HC-SR04', 'Solenoid'],
      code: {
        file: 'pinball.ino',
        label: 'handleLostBall()',
        note: 'A 10-second cooldown stops one ball from being counted twice while it settles near the sensor.',
        snippet: `int distance = readDistanceMm();
bool ballDetected = distance > 0 && distance < lostBallDistanceMm; // 26 mm

if (!ballWasDetected && ballDetected) {
  lastLostDetectionTime = millis();
  ballsLeft--;
  if (ballsLeft > 0) {
    showMatrixText("BALL", "LOST");
    delay(reloadDelayMs);
    pulseOutput(reloadOut, reloadPulseMs);   // fire the reload solenoid
  } else {
    showMatrixText("GAME", "OVER");
    gameActive = false;
  }
}`,
      },
    },
    {
      group: 'Targets',
      title: 'The target mechanism',
      blurb: "Two scoring inputs, wired low and high. A hit closes the circuit, the Arduino adds the points and the score screen updates on the dot-matrix displays.",
      tags: ['Arduino', 'MAX7219', 'Scoring'],
      code: {
        file: 'pinball.ino',
        label: 'handleTargets()',
        note: 'Edge-triggered (HIGH → LOW) so a held contact only scores once.',
        snippet: `if (lastLowTargetState == HIGH && lowTargetState == LOW) {
  score += lowTargetPoints;    // 10
  showMatrixText("+10", "POINTS");
}
if (lastHighTargetState == HIGH && highTargetState == LOW) {
  score += highTargetPoints;   // 50
  showMatrixText("+50", "POINTS");
}`,
      },
    },
    {
      group: 'Slide & small parts',
      title: 'Slide and barriers',
      blurb: "The slide and the barriers shape how the ball actually moves around the playfield - printed in halves and glued where a part was too big for the printer bed.",
      tags: ['3D printed', 'PLA'],
    },
    {
      group: 'Brackets',
      title: 'Holding it together',
      blurb: "Plain corner brackets, holding the box square. Every seam of the cabinet is both glued and screwed - each bracket is printed with holes so a screw bites into both panels on top of the glue joint, the least glamorous parts and some of the most necessary.",
      tags: ['3D printed'],
    },
  ];

  // ---------- helpers ----------
  const EXPAND_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4"/></svg>';
  const CODE_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 5 2 8l3 3M11 5l3 3-3 3M9.5 3.5l-3 9"/></svg>';

  // `measured`: draw its dimensions - chapter heroes only; a thumbnail is too small to carry
  // labels, and gets them full-screen instead
  function stageContent(part, { interactive = false, measured = false } = {}) {
    if (part.kind === 'model') {
      const mv = document.createElement('model-viewer');
      mv.setAttribute('src', part.model);
      mv.setAttribute('loading', 'lazy');
      mv.setAttribute('shadow-intensity', '0.8');
      // directional studio light (tools/make_studio_env.py) - the built-in environments light
      // evenly from every side, which washes pale CAD parts out into flat silhouettes
      mv.setAttribute('environment-image', 'assets/env/studio.hdr');
      mv.setAttribute('tone-mapping', 'aces');
      mv.setAttribute('exposure', '1.3');
      mv.setAttribute('alt', `3D model of ${part.label}`);
      if (!reduceMotion) {
        mv.setAttribute('auto-rotate', '');
        mv.setAttribute('rotation-per-second', '16deg');
      }
      if (interactive) {
        mv.setAttribute('camera-controls', '');
        mv.setAttribute('interaction-prompt', 'none');
      }
      if (measured && window.attachDimensions) {
        window.attachDimensions.frame(mv, true);
        window.attachDimensions(mv, part.dims);
      }
      return mv;
    }
    if (part.kind === 'playfield') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'pf');
      svg.setAttribute('aria-hidden', 'true');
      requestAnimationFrame(() => {
        const field = window.buildPlayfield(svg);
        if (window.gsap && window.ScrollTrigger && !reduceMotion) {
          gsap.set([...field.outlines, ...field.holes], { strokeDashoffset: 1 });
          const trigger = { trigger: svg, start: 'top 85%', once: true };
          gsap.to(field.outlines, { strokeDashoffset: 0, duration: 1.3, stagger: 0.04, ease: 'power2.inOut', scrollTrigger: trigger });
          gsap.to(field.holes, { strokeDashoffset: 0, duration: 0.5, stagger: 0.02, delay: 0.5, scrollTrigger: trigger });
        }
      });
      return svg;
    }
    if (part.kind === 'placeholder') {
      const div = document.createElement('div');
      div.className = 'ph-slot';
      div.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM4 4l16 16M20 4 4 20"/></svg><span>Never exported</span>';
      return div;
    }
    const img = document.createElement('img');
    img.src = part.image;
    img.loading = 'lazy';
    img.alt = part.label;
    return img;
  }

  function openable(part) {
    return part.kind === 'model'; // photos/placeholders/playfield have nothing extra to show full-screen
  }

  root.innerHTML = '';
  CHAPTERS.forEach((ch, i) => {
    const items = byGroup[ch.group] || [];
    if (!items.length) return;
    const [hero, ...rest] = items;

    const section = document.createElement('article');
    section.className = 'chapter reveal';
    section.id = 'chapter-' + ch.group.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const visual = document.createElement('div');
    visual.className = 'chapter-visual';
    const stage = document.createElement('div');
    stage.className = 'chapter-stage' + (hero.kind === 'placeholder' ? ' is-empty' : '');
    stage.appendChild(stageContent(hero, { measured: true }));
    if (openable(hero)) {
      const expand = document.createElement('span');
      expand.className = 'chapter-expand';
      expand.innerHTML = EXPAND_ICON + 'view in 3d';
      stage.appendChild(expand);
      stage.addEventListener('click', () => window.openLightbox(hero));
    }
    visual.appendChild(stage);

    if (rest.length) {
      const sat = document.createElement('div');
      sat.className = 'satellites';
      rest.forEach((p) => {
        const s = document.createElement('div');
        s.className = 'satellite';
        s.title = p.label;
        s.appendChild(stageContent(p));
        if (openable(p)) s.addEventListener('click', () => window.openLightbox(p));
        sat.appendChild(s);
      });
      visual.appendChild(sat);
    }

    const text = document.createElement('div');
    text.className = 'chapter-text';
    const codeHtml = ch.code ? `<button type="button" class="chapter-code">${CODE_ICON}View the code</button>` : '';
    text.innerHTML = `
      <p class="chapter-num">${String(i + 1).padStart(2, '0')} <span>/ ${CHAPTERS.length}</span></p>
      <h3>${ch.title}</h3>
      <p class="chapter-blurb">${ch.blurb}</p>
      <ul class="chapter-tags">${ch.tags.map((t) => `<li>${t}</li>`).join('')}</ul>
      ${codeHtml}
    `;

    const workshop = (window.PINBALL_MEDIA || {})[ch.group];
    if (workshop && workshop.length && window.buildMediaStrip) text.appendChild(window.buildMediaStrip(workshop));

    section.append(visual, text);
    root.appendChild(section);

    if (ch.code) {
      const btn = section.querySelector('.chapter-code');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.openCodePanel(ch.code);
      });
    }
  });

  // ---------- scroll reveal ----------
  if (window.gsap && window.ScrollTrigger && !reduceMotion) {
    $$('.chapter.reveal').forEach((el) => {
      gsap.fromTo(el, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    });
  }

  // ---------- one continuous path, image to image, filling as you scroll the whole story ----------
  // Not a decorative shape dropped in the gap: it's built from each chapter's REAL stage
  // position, so it actually zigzags left-stage -> right-stage -> left-stage down the page.
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'story-connector');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('class', 'connector-path');
  const nodes = document.createElementNS(NS, 'g');
  svg.append(path, nodes);
  root.style.position = 'relative';
  root.prepend(svg);

  let trigger = null;

  function rebuildConnector() {
    const stages = $$('.chapter-stage', root);
    if (stages.length < 2) return;
    const box = root.getBoundingClientRect();
    const h = root.scrollHeight;
    svg.setAttribute('viewBox', `0 0 ${box.width} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    const points = stages.map((s) => {
      const r = s.getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
    });

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const midY = (a.y + b.y) / 2;
      d += ` C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
    }
    path.setAttribute('d', d);

    nodes.innerHTML = '';
    points.forEach((p) => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('class', 'connector-node');
      c.setAttribute('cx', p.x);
      c.setAttribute('cy', p.y);
      c.setAttribute('r', reduceMotion || !window.ScrollTrigger ? 5 : 0);
      nodes.appendChild(c);
    });

    const len = path.getTotalLength();
    if (reduceMotion || !(window.gsap && window.ScrollTrigger)) {
      path.style.strokeDasharray = 'none';
      return;
    }
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);

    if (trigger) trigger.kill();
    trigger = ScrollTrigger.create({
      trigger: root,
      start: 'top 72%',
      end: 'bottom 55%',
      scrub: 0.5,
      onUpdate(self) {
        path.style.strokeDashoffset = String(len * (1 - self.progress));
        const circles = nodes.children;
        for (let i = 0; i < circles.length; i++) {
          const at = i / (circles.length - 1);
          circles[i].setAttribute('r', self.progress >= at - 0.015 ? 5 : 0);
        }
      },
    });
  }

  rebuildConnector();
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      rebuildConnector();
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }, 200);
  });
  // model-viewer loads async and can nudge stage heights slightly after first layout
  setTimeout(() => {
    rebuildConnector();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }, 1200);
})();
