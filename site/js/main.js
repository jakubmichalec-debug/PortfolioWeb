/* Portfolio of Jakub Michalec. Vanilla JS + GSAP.
   Every effect is an enhancement: with no GSAP, or with "reduce motion" on, the page is plain and complete. */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const canAnimate = !reduceMotion && !!(window.gsap && window.ScrollTrigger);

  if (canAnimate) {
    gsap.registerPlugin(ScrollTrigger);
  } else {
    doc.classList.remove('anim');
    doc.classList.add('still');
  }

  /* ---------- playfield line art (data from tools/make_playfield_js.py) ---------- */
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function buildPlayfield(svg) {
    const data = window.PLAYFIELD;
    if (!svg || !data) return { svg, outlines: [], holes: [] };
    svg.setAttribute('viewBox', data.viewBox);
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', data.transform);
    const make = (tag, attrs) => {
      const el = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      el.setAttribute('pathLength', '1');
      g.appendChild(el);
      return el;
    };
    const outlines = data.paths.map((d) => make('path', { d }));
    const holes = (data.circles || []).map(([cx, cy, r]) => make('circle', { cx, cy, r }));
    svg.appendChild(g);
    return { svg, outlines, holes };
  }

  /* ---------- navigation, progress bar ---------- */
  function initNav() {
    const bar = $('.nav');
    if (!bar) return;
    const onScroll = () => bar.classList.toggle('is-scrolled', window.scrollY > 24);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const toggle = $('.nav-toggle');
    if (toggle) {
      const setOpen = (open) => {
        bar.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
      };
      toggle.addEventListener('click', () => setOpen(!bar.classList.contains('open')));
      $$('.nav-links a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
      addEventListener('keydown', (e) => e.key === 'Escape' && setOpen(false));
    }
  }

  function initProgress() {
    const bar = $('.progress');
    if (!bar) return;
    const update = () => {
      const max = doc.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  }

  /* ---------- the dimension lines around the photo read the frame's real size in CSS millimetres ---------- */
  function initDims() {
    const frame = $('.photo-frame');
    if (!frame) return;
    const PX_TO_MM = 25.4 / 96;
    const write = () => {
      const r = frame.getBoundingClientRect();
      const x = $('.dim--x span');
      const y = $('.dim--y span');
      if (x) x.textContent = `${Math.round(r.width * PX_TO_MM)} MM`;
      if (y) y.textContent = `${Math.round(r.height * PX_TO_MM)} MM`;
    };
    write();
    addEventListener('resize', write);
  }

  /* ---------- page-load sequence ---------- */
  function intro(field) {
    const nav = $('.nav');
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    if (nav) tl.to(nav, { opacity: 1, duration: 0.6 }, 0);
    if (!$('.hero')) return;

    tl.to('.sheet', { clipPath: 'inset(0 0% 0 0)', duration: 1.0, ease: 'power4.inOut' }, 0)
      .to('.zones i', { opacity: 1, duration: 0.4, stagger: 0.03 }, 0.55)
      .to(field.outlines, { strokeDashoffset: 0, duration: 1.5, stagger: 0.05, ease: 'power2.inOut' }, 0.3)
      .to(field.holes, { strokeDashoffset: 0, duration: 0.6, stagger: 0.02 }, 1.25)
      .fromTo('.hero .eyebrow', { y: 12 }, { y: 0, opacity: 1, duration: 0.7 }, 0.7)
      .fromTo('.h1 .wi', { yPercent: 115, opacity: 1 }, { yPercent: 0, duration: 0.95, stagger: 0.07, ease: 'power4.out' }, 0.75)
      .to('.redline--under path', { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, 1.55)
      .to('.redline--loop path', { strokeDashoffset: 0, duration: 1.0, ease: 'power2.inOut' }, 1.85)
      .fromTo('.lede', { y: 16 }, { y: 0, opacity: 1, duration: 0.8 }, 1.05)
      .fromTo('.hero .cta > *', { y: 16 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.1 }, 1.2)
      .fromTo('.tick', { scale: 0, opacity: 1 }, { scale: 1, duration: 0.5, stagger: 0.06, ease: 'back.out(2.4)' }, 0.95)
      .to('.dim', { opacity: 1, duration: 0.6 }, 1.25)
      .to('.photo-frame', { clipPath: 'inset(0 0 0% 0)', duration: 0.95, ease: 'power3.inOut' }, 1.05)
      .to('.photo figcaption', { opacity: 1, duration: 0.6 }, 1.7)
      .fromTo('.titleblock', { y: 14 }, { y: 0, opacity: 1, duration: 0.8 }, 1.6);
  }

  /* ---------- scroll: reveals, icon drawing, project cards, hero parallax ---------- */
  function initScroll(fields) {
    $$('.reveal').forEach((el) => {
      gsap.fromTo(
        el,
        { y: 34, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.95, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }
      );
    });

    $$('.icon').forEach((icon) => {
      gsap.to($$('.d', icon), {
        strokeDashoffset: 0,
        duration: 1.2,
        stagger: 0.1,
        ease: 'power2.inOut',
        scrollTrigger: { trigger: icon, start: 'top 90%', once: true },
      });
    });

    fields
      .filter((f) => f.svg.closest('.project'))
      .forEach((f) => {
        const trigger = { trigger: f.svg, start: 'top 85%', once: true };
        gsap.to(f.outlines, { strokeDashoffset: 0, duration: 1.4, stagger: 0.04, ease: 'power2.inOut', scrollTrigger: trigger });
        gsap.to(f.holes, { strokeDashoffset: 0, duration: 0.6, stagger: 0.02, delay: 0.6, scrollTrigger: trigger });
      });

    const sheetField = $('.sheet .pf');
    if (sheetField) {
      gsap.to(sheetField, {
        y: 90,
        ease: 'none',
        scrollTrigger: { trigger: '.sheet', start: 'top top', end: 'bottom top', scrub: true },
      });
    }

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  /* ---------- pointer effects (desktop only) ---------- */
  function initTilt() {
    if (!finePointer) return;
    $$('[data-tilt]').forEach((card) => {
      gsap.set(card, { transformPerspective: 900 });
      const rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3' });
      const ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3' });
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 5);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 5);
      });
      card.addEventListener('pointerleave', () => {
        rx(0);
        ry(0);
      });
    });
  }

  function initMagnetic() {
    if (!finePointer) return;
    $$('[data-magnetic]').forEach((el) => {
      const qx = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3' });
      const qy = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        qx((e.clientX - (r.left + r.width / 2)) * 0.22);
        qy((e.clientY - (r.top + r.height / 2)) * 0.32);
      });
      el.addEventListener('pointerleave', () => {
        qx(0);
        qy(0);
      });
    });
  }

  /* drafting crosshair that reads out millimetres while it is over the sheet */
  function initCrosshair() {
    const el = $('.xhair');
    if (!el || !finePointer || reduceMotion || !window.gsap) return;
    doc.classList.add('has-xhair');
    const xTo = gsap.quickTo(el, 'x', { duration: 0.1, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.1, ease: 'power3' });
    const coords = $('.coords', el);
    const sheet = $('.sheet');
    const PX_TO_MM = 25.4 / 96;

    addEventListener(
      'pointermove',
      (e) => {
        xTo(e.clientX);
        yTo(e.clientY);
        el.classList.add('on');
        if (!sheet) return;
        const r = sheet.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        el.classList.toggle('show-coords', inside);
        if (inside) {
          coords.textContent = `X ${((e.clientX - r.left) * PX_TO_MM).toFixed(1)}  Y ${((e.clientY - r.top) * PX_TO_MM).toFixed(1)} MM`;
        }
      },
      { passive: true }
    );
    document.addEventListener('pointerleave', () => el.classList.remove('on'));
    document.addEventListener('pointerover', (e) => el.classList.toggle('hot', !!e.target.closest('a, button, [data-tilt]')));
    addEventListener('pointerdown', () => el.classList.add('down'));
    addEventListener('pointerup', () => el.classList.remove('down'));
  }

  /* ---------- smooth scroll ---------- */
  function initSmoothScroll() {
    if (reduceMotion || !window.Lenis) return;
    const lenis = new Lenis({ lerp: 0.1 });
    window.lenis = lenis; // reused by gallery.js so its own jump-links scroll the same way, with their own offset
    if (canAnimate) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => {
        lenis.raf(t);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const target = a.getAttribute('href') === '#' ? null : $(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -(parseInt(getComputedStyle(doc).getPropertyValue('--nav-h'), 10) || 64) });
      });
    });
  }

  window.buildPlayfield = buildPlayfield; // reused by gallery.js for the Pinball page's playfield card

  /* ---------- go ---------- */
  initNav();
  initProgress();
  initDims();
  const fields = $$('[data-playfield]').map(buildPlayfield);

  if (canAnimate) {
    try {
      const heroField = fields.find((f) => f.svg.closest('.sheet')) || { outlines: [], holes: [] };
      intro(heroField);
      initScroll(fields);
      initTilt();
      initMagnetic();
    } catch (err) {
      console.error('Animation setup failed, falling back to the plain page.', err);
      doc.classList.remove('anim');
      doc.classList.add('still');
    }
  }
  initCrosshair();
  initSmoothScroll();
})();
