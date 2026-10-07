/* Two shared overlays for the Pinball story page: a full-screen 3D viewer (real orbit +
   zoom, unlike the idling inline previews) and a code-excerpt panel. Both close on Escape,
   backdrop click, or the close button, and share the same open/close plumbing. */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  let activeClose = null;

  function wire(overlay, onClose) {
    const close = () => {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      activeClose = null;
      onClose && onClose();
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    return close;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeClose) activeClose();
  });

  function open(overlay, close) {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    activeClose = close;
  }

  // ---------------- 3D lightbox ----------------
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-hidden', 'true');
  lb.setAttribute('aria-label', '3D model viewer');
  lb.innerHTML = `
    <div class="lightbox-stage">
      <button type="button" class="lightbox-close" data-close aria-label="Close">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13"/></svg>
      </button>
      <model-viewer id="lightbox-mv" camera-controls auto-rotate rotation-per-second="10deg"
        shadow-intensity="0.9" environment-image="assets/env/studio.hdr" tone-mapping="aces" exposure="1.3"
        interaction-prompt="none"></model-viewer>
    </div>
    <div class="lightbox-bar">
      <span id="lightbox-name"></span>
      <span class="lightbox-tools">
        <button type="button" class="lightbox-dims" id="lightbox-dims" aria-pressed="true" hidden>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4.5v7M14 4.5v7M2.5 8h11M4.5 6.2 2.5 8l2 1.8M11.5 6.2l2 1.8-2 1.8"/></svg>Dimensions
        </button>
        <span class="lightbox-hint">drag to rotate &middot; scroll to zoom</span>
      </span>
    </div>
    <div class="lightbox-parts" id="lightbox-parts" hidden></div>`;
  document.body.appendChild(lb);
  const mv = $('#lightbox-mv');
  const dimsBtn = $('#lightbox-dims');

  // Every piece shown gets dimension lines (dimensions.js): a whole assembly uses its hand-set
  // lines when the manifest has them (the box's sloped top), anything else - including a
  // single isolated piece - its own bounding box. The toggle's choice carries over.
  let current = null;
  let dims = null;
  let dimsWanted = true;

  function syncDims() {
    if (dims) {
      dims.detach();
      dims = null;
    }
    const canDim = Boolean(current && window.attachDimensions);
    dimsBtn.hidden = !canDim;
    dimsBtn.setAttribute('aria-pressed', String(dimsWanted));
    if (canDim && dimsWanted) dims = window.attachDimensions(mv, current.whole ? current.part.dims : undefined);
  }

  dimsBtn.addEventListener('click', () => {
    dimsWanted = !dimsWanted;
    syncDims();
  });

  const lbClose = wire(lb, () => {
    current = null;
    syncDims();
    mv.removeAttribute('src');
  });

  // A part with subparts (an assembly, e.g. the solenoid adapter) shows a chip per piece -
  // click one and the SAME lightbox swaps to just that piece, so "click on one part of the
  // build and it opens alone" happens without needing to raycast the live 3D view itself.
  window.openLightbox = (part) => {
    const showPiece = (label, model, isWhole) => {
      current = { part, whole: isWhole };
      // room for the dimension lines whether or not they're toggled on, so switching them
      // never moves the camera out from under whatever angle the viewer has turned it to
      if (window.attachDimensions) window.attachDimensions.frame(mv, true);
      mv.setAttribute('src', model);
      syncDims();

      $('#lightbox-name').textContent = isWhole ? `${part.label} · ${part.how}` : `${part.label} — ${label}`;
      $$chips().forEach((c) => c.classList.toggle('on', c.dataset.label === (isWhole ? '' : label)));
    };
    const $chipsBox = $('#lightbox-parts');
    const $$chips = () => Array.from($chipsBox.querySelectorAll('.lightbox-part-chip'));

    if (part.subparts && part.subparts.length) {
      $chipsBox.hidden = false;
      $chipsBox.innerHTML = '';
      const whole = document.createElement('button');
      whole.type = 'button';
      whole.className = 'lightbox-part-chip on';
      whole.textContent = 'Whole assembly';
      whole.dataset.label = '';
      whole.addEventListener('click', () => showPiece('', part.model, true));
      $chipsBox.appendChild(whole);
      part.subparts.forEach((sp) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'lightbox-part-chip';
        chip.textContent = sp.label;
        chip.dataset.label = sp.label;
        chip.addEventListener('click', () => showPiece(sp.label, sp.model, false));
        $chipsBox.appendChild(chip);
      });
    } else {
      $chipsBox.hidden = true;
      $chipsBox.innerHTML = '';
    }
    showPiece('', part.model, true);
    open(lb, lbClose);
  };

  // ---------------- photo / clip viewer ----------------
  // Opened from a set (a chapter's workshop strip, or the hero) so the arrows and arrow keys
  // step through the rest of that set without closing.
  const mb = document.createElement('div');
  mb.className = 'lightbox mediabox';
  mb.setAttribute('role', 'dialog');
  mb.setAttribute('aria-modal', 'true');
  mb.setAttribute('aria-hidden', 'true');
  mb.setAttribute('aria-label', 'Photo and clip viewer');
  mb.innerHTML = `
    <div class="mediabox-stage">
      <button type="button" class="lightbox-close" data-close aria-label="Close">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13"/></svg>
      </button>
      <div class="mediabox-frame" id="mediabox-frame"></div>
      <button type="button" class="mediabox-nav mediabox-prev" aria-label="Previous">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>
      </button>
      <button type="button" class="mediabox-nav mediabox-next" aria-label="Next">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>
      </button>
    </div>
    <div class="lightbox-bar">
      <span class="mediabox-caption" id="mediabox-caption"></span>
      <span class="lightbox-hint" id="mediabox-count"></span>
    </div>`;
  document.body.appendChild(mb);
  const mbFrame = $('#mediabox-frame');
  const mbPrev = mb.querySelector('.mediabox-prev');
  const mbNext = mb.querySelector('.mediabox-next');
  const mbClose = wire(mb, () => (mbFrame.innerHTML = '')); // also stops a clip that's still playing
  let mbSet = [];
  let mbAt = 0;

  function showMedia(i) {
    mbAt = (i + mbSet.length) % mbSet.length;
    const item = mbSet[mbAt];
    let el;
    if (item.kind === 'video') {
      el = document.createElement('video');
      ['muted', 'loop', 'playsinline', 'controls', 'autoplay'].forEach((a) => el.setAttribute(a, ''));
      el.muted = true;
      el.poster = item.poster;
      el.src = item.src;
    } else {
      el = document.createElement('img');
      el.src = item.src;
      el.alt = item.caption;
    }
    el.width = item.w;
    el.height = item.h;
    mbFrame.replaceChildren(el);
    const caption = [item.caption];
    if (item.date) {
      const time = document.createElement('time');
      time.textContent = item.date;
      caption.unshift(time, ' ');
    }
    $('#mediabox-caption').replaceChildren(...caption);
    const many = mbSet.length > 1;
    $('#mediabox-count').textContent = many ? `${mbAt + 1} / ${mbSet.length}` : '';
    mbPrev.hidden = !many;
    mbNext.hidden = !many;
  }

  mbPrev.addEventListener('click', () => showMedia(mbAt - 1));
  mbNext.addEventListener('click', () => showMedia(mbAt + 1));
  document.addEventListener('keydown', (e) => {
    if (!mb.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') showMedia(mbAt - 1);
    if (e.key === 'ArrowRight') showMedia(mbAt + 1);
  });

  window.openMedia = (items, i) => {
    mbSet = items;
    showMedia(i);
    open(mb, mbClose);
  };

  // ---------------- code panel ----------------
  const cp = document.createElement('div');
  cp.className = 'lightbox';
  cp.setAttribute('role', 'dialog');
  cp.setAttribute('aria-modal', 'true');
  cp.setAttribute('aria-hidden', 'true');
  cp.setAttribute('aria-label', 'Code excerpt');
  cp.innerHTML = `
    <div class="codepanel-stage">
      <button type="button" class="lightbox-close" data-close aria-label="Close">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13"/></svg>
      </button>
      <p class="codepanel-badge" id="codepanel-badge" hidden>Reconstruction · not the original code</p>
      <h4 id="codepanel-label"></h4>
      <p class="codepanel-note" id="codepanel-note"></p>
      <p class="codepanel-file"><span id="codepanel-file"></span><a id="codepanel-link" target="_blank" rel="noopener">view full source ↗</a></p>
      <pre><code id="codepanel-code"></code></pre>
    </div>`;
  document.body.appendChild(cp);
  const cpClose = wire(cp);

  // One pass over the source, so a later rule never re-matches markup an earlier one inserted
  // (colouring strings after comments used to wrap the "cm" in <span class="cm"> itself).
  const TOKEN = /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*")|(^#\w+)|\b(void|int|bool|const|unsigned|long|char|if|else|while|for|return|break|true|false|HIGH|LOW|OUTPUT|INPUT|INPUT_PULLUP)\b|\b(\d+)\b/gm;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function highlight(src) {
    let out = '';
    let last = 0;
    src.replace(TOKEN, (m, cm, str, pre, kw, nm, at) => {
      const cls = cm ? 'cm' : str ? 'str' : pre || kw ? 'kw' : 'nm';
      out += `${esc(src.slice(last, at))}<span class="${cls}">${esc(m)}</span>`;
      last = at + m.length;
      return m;
    });
    return out + esc(src.slice(last));
  }

  // `reconstruction`: code written to show how something worked, not taken from the real
  // sketch - badged as such, and with no "full source" link, because there is no source file
  window.openCodePanel = (code) => {
    const recon = Boolean(code.reconstruction);
    cp.classList.toggle('is-reconstruction', recon);
    $('#codepanel-badge').hidden = !recon;
    $('#codepanel-label').textContent = code.label;
    $('#codepanel-note').textContent = code.note || '';
    $('#codepanel-file').textContent = recon ? 'Written for this page' : code.file;
    const link = $('#codepanel-link');
    link.hidden = recon;
    if (recon) link.removeAttribute('href');
    else link.href = 'assets/code/' + code.file;
    $('#codepanel-code').innerHTML = highlight(code.snippet.trim());
    open(cp, cpClose);
  };
})();
