/* Drafting-style dimension lines on a <model-viewer>. Anchors come either from the parts
   manifest (the box: tools/assemble_box.py measures its sloped top off the real assembled
   panels) or, for every other model, from the model's own bounding box once it has loaded -
   its real overall width, depth and height. Every anchor is a hotspot model-viewer re-projects
   each frame; this joins them up in an SVG overlay the way a technical drawing would -
   extension lines off the object, a dimension line with 45deg ticks, broken around its value.

   Each measurement comes with a candidate line on every edge that could carry it. Per
   measurement, the one shown is the candidate FURTHEST from the camera among those with a face
   turned toward it: for a height that's an outline corner rather than the corner nearest the
   eye, so the measurements spread around the model instead of piling up in one spot - and
   they hand over from edge to edge as it rotates. */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const ANCHORS = ['a', 'b', 'a2', 'b2'];
  const EXT_GAP = 3; // px between the object and its extension line
  const EXT_OVER = 6; // px an extension line runs past the dimension line
  const TICK = 3.5;
  const LABEL_PAD = 5;
  let uid = 0;

  const f = (n) => n.toFixed(1);
  const mid = (p, q) => p.map((v, i) => (v + q[i]) / 2);
  const add = (p, q) => p.map((v, i) => v + q[i]);
  const mm = (metres) => {
    const v = metres * 1000;
    return v < 10 ? Math.round(v * 10) / 10 : Math.round(v); // a 2.5mm washer shouldn't read "3"
  };

  // Overall size of any model, in the same shape as the manifest's hand-set lines: width (x),
  // depth (z) and height (y) of its bounding box, with a candidate on every edge that can carry
  // each - bottom edges for the two footprint sizes, all four vertical corners for the height.
  function boundingBoxLines(mv) {
    const c = mv.getBoundingBoxCenter();
    const s = mv.getDimensions();
    const x0 = c.x - s.x / 2;
    const x1 = c.x + s.x / 2;
    const y0 = c.y - s.y / 2;
    const y1 = c.y + s.y / 2;
    const z0 = c.z - s.z / 2;
    const z1 = c.z + s.z / 2;
    const o = Math.max(s.x, s.y, s.z) * 0.08; // out from the edge, relative to the model's size
    const sd = o * 0.4;
    const k = o / Math.SQRT2;
    const line = (group, size, a, b, off, ...faces) => ({ group, value: mm(size), a, b, a2: add(a, off), b2: add(b, off), faces });
    return [
      line('x', s.x, [x0, y0, z1], [x1, y0, z1], [0, -o, sd], [0, 0, 1]),
      line('x', s.x, [x0, y0, z0], [x1, y0, z0], [0, -o, -sd], [0, 0, -1]),
      line('z', s.z, [x1, y0, z0], [x1, y0, z1], [sd, -o, 0], [1, 0, 0]),
      line('z', s.z, [x0, y0, z0], [x0, y0, z1], [-sd, -o, 0], [-1, 0, 0]),
      line('y', s.y, [x0, y0, z1], [x0, y1, z1], [-k, 0, k], [-1, 0, 0], [0, 0, 1]),
      line('y', s.y, [x1, y0, z1], [x1, y1, z1], [k, 0, k], [1, 0, 0], [0, 0, 1]),
      line('y', s.y, [x0, y0, z0], [x0, y1, z0], [-k, 0, -k], [-1, 0, 0], [0, 0, -1]),
      line('y', s.y, [x1, y0, z0], [x1, y1, z0], [k, 0, -k], [1, 0, 0], [0, 0, -1]),
    ];
  }

  function extension(p, q) {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    if (len < EXT_GAP + 2) return ''; // edge seen end-on: no room for one
    const ux = dx / len;
    const uy = dy / len;
    return `M${f(p[0] + ux * EXT_GAP)} ${f(p[1] + uy * EXT_GAP)}L${f(q[0] + ux * EXT_OVER)} ${f(q[1] + uy * EXT_OVER)}`;
  }

  // `dims`: the manifest's hand-set lines, or nothing to measure the model's bounding box
  window.attachDimensions = (mv, dims) => {
    const id = ++uid;
    const added = [];
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'measure');
    svg.setAttribute('aria-hidden', 'true');

    function hotspot(slot, position, normal) {
      const el = document.createElement('span');
      el.className = 'measure-pt';
      el.slot = slot;
      el.dataset.position = position.join(' ');
      if (normal) el.dataset.normal = normal.join(' ');
      added.push(el);
    }

    let lines = null; // built on the first frame the model is loaded - its bounding box needs it
    const groups = new Map();

    const build = () => (dims || boundingBoxLines(mv)).map((d, i) => {
      const slot = (k) => `hotspot-dim${id}-${i}-${k}`;
      ANCHORS.forEach((k) => hotspot(slot(k), d[k]));
      // one probe per face meeting at the edge, sat on the edge itself: model-viewer reports
      // whether each faces the camera, which is exactly "is this edge in view"
      d.faces.forEach((n, j) => hotspot(slot(`f${j}`), mid(d.a, d.b), n));

      const label = document.createElement('span');
      label.className = 'measure-label';
      label.setAttribute('aria-hidden', 'true'); // bare numbers scattered over a canvas mean nothing read aloud
      label.slot = slot('label');
      label.dataset.position = mid(d.a2, d.b2).join(' ');
      label.innerHTML = `${d.value}<small>mm</small>`;
      added.push(label);

      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'measure-set');
      g.innerHTML = '<path class="measure-ext"/><path class="measure-line" pathLength="1"/><path class="measure-tick"/>';
      svg.appendChild(g);
      const [ext, line, tick] = g.children;
      const l = { group: d.group, faces: d.faces.length, slot, label, g, ext, line, tick, w: 0, h: 0 };
      groups.set(l.group, [...(groups.get(l.group) || []), l]);
      return l;
    });

    function choose(candidates) {
      let best = null;
      let bestDepth = -Infinity;
      for (const l of candidates) {
        let inView = false;
        for (let j = 0; j < l.faces; j++) {
          const q = mv.queryHotspot(l.slot(`f${j}`));
          if (q && q.facingCamera) inView = true;
        }
        const qa = mv.queryHotspot(l.slot('a'));
        const qb = mv.queryHotspot(l.slot('b'));
        if (!inView || !qa || !qb) continue;
        const depth = qa.canvasPosition.z + qb.canvasPosition.z; // projected depth: bigger is further
        if (depth > bestDepth) {
          bestDepth = depth;
          best = l;
        }
      }
      return best;
    }

    function draw(l) {
      const pts = ANCHORS.map((k) => mv.queryHotspot(l.slot(k)));
      if (!pts.every(Boolean)) return false;
      const [A, B, A2, B2] = pts.map((p) => [p.canvasPosition.x, p.canvasPosition.y]);
      const dx = B2[0] - A2[0];
      const dy = B2[1] - A2[1];
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;

      // break the dimension line around its value, like a drafted dimension
      if (!l.w) {
        l.w = l.label.offsetWidth;
        l.h = l.label.offsetHeight;
      }
      const half = Math.max(0, Math.min(len / 2 - 4, (l.w / 2) * Math.abs(ux) + (l.h / 2) * Math.abs(uy) + LABEL_PAD));
      const mx = (A2[0] + B2[0]) / 2;
      const my = (A2[1] + B2[1]) / 2;
      l.line.setAttribute('d',
        `M${f(A2[0])} ${f(A2[1])}L${f(mx - ux * half)} ${f(my - uy * half)}` +
        `M${f(B2[0])} ${f(B2[1])}L${f(mx + ux * half)} ${f(my + uy * half)}`);

      // 45deg architectural ticks where the dimension line meets its extension lines
      const tx = (ux - uy) * TICK;
      const ty = (uy + ux) * TICK;
      l.tick.setAttribute('d',
        `M${f(A2[0] - tx)} ${f(A2[1] - ty)}L${f(A2[0] + tx)} ${f(A2[1] + ty)}` +
        `M${f(B2[0] - tx)} ${f(B2[1] - ty)}L${f(B2[0] + tx)} ${f(B2[1] + ty)}`);

      l.ext.setAttribute('d', extension(A, A2) + extension(B, B2));
      return true;
    }

    // label widths are cached (reading them every frame would force layout); re-measure once
    // the web fonts have landed, since the fallback font sets them slightly differently
    if (document.fonts) document.fonts.ready.then(() => lines && lines.forEach((l) => (l.w = 0)));

    let raf = 0;
    let drawn = false;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      // `loaded` drops to false as soon as src changes (a microtask after the attribute - always
      // before this first frame) and comes back once the new model is in, so lines attached
      // straight after a src swap measure the new model, never the old one. model-viewer's
      // 'load' event is no substitute: it waits on a render, which a hidden tab never runs.
      if (!mv.loaded) return;
      if (!lines) {
        lines = build();
        mv.append(...added, svg);
        return; // model-viewer registers the new hotspots before the next frame
      }
      const r = mv.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) return; // off screen: nothing to redraw
      groups.forEach((candidates) => {
        const shown = choose(candidates);
        candidates.forEach((l) => {
          const on = l === shown && draw(l);
          l.g.classList.toggle('on', on);
          l.label.classList.toggle('on', on);
        });
      });
      if (!drawn) {
        drawn = true;
        requestAnimationFrame(() => svg.classList.add('drawn')); // one frame later, so the draw-in transitions
      }
    };
    raf = requestAnimationFrame(frame);

    return {
      detach() {
        cancelAnimationFrame(raf);
        added.forEach((el) => el.remove());
        svg.remove();
      },
    };
  };

  // Room for the lines: model-viewer's default 105% framing fills the frame edge to edge,
  // leaving nowhere for the lines and labels that sit outside the model. Pulling the camera
  // back needs the distance limit raised too - left alone, model-viewer quietly clamps the
  // 125% back down to its default.
  window.attachDimensions.frame = (mv, on) => {
    if (on) {
      mv.setAttribute('camera-orbit', '0deg 75deg 125%');
      mv.setAttribute('max-camera-orbit', 'auto auto 160%');
    } else {
      mv.removeAttribute('camera-orbit');
      mv.removeAttribute('max-camera-orbit');
    }
  };
})();
