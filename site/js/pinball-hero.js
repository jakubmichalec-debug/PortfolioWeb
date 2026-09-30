/* Pinball page hero: "the drawing comes to life". The playfield drawing traces itself on load;
   scrolling then pins the stage and a scan line sweeps down it - above the line the drawing
   has become the real table (FullShowcase1, frame by frame with the scroll), below it the
   drawing is still waiting. Beside it, the machine's own display runs startGame()'s real
   sequence: START GAME, TAKE BALL, then the score screen the footage shows. */
(() => {
  'use strict';

  const media = window.PINBALL_MEDIA || {};
  const film = media.films && media.films.hero;
  const track = document.querySelector('[data-film="hero"]');
  if (!track || !film || !window.ScrollFilm) return;

  const stage = track.querySelector('.film-stage');
  const canvas = stage.querySelector('.film-canvas');
  const frameLabel = stage.querySelector('.film-frame');
  const field = window.buildPlayfield(stage.querySelector('.film-pf'));
  const player = window.ScrollFilm(canvas, film, { focusY: 0.55 });
  const matrix = window.DotMatrix(track.querySelector('.dotmatrix'));
  player.load(); // first thing on the page: start right away

  const pad = (n) => String(n).padStart(3, '0');
  const setFrame = () => {
    if (frameLabel) frameLabel.textContent = `Frame ${pad(player.frame + 1)} / ${pad(player.count)}`;
  };

  // scroll budget, as fractions of the pinned scroll
  const SWEEP = [0.05, 0.42]; // scan line top -> bottom
  const PLAY = [0.42, 1]; // footage plays
  const BOOT = [ // startGame(), pinball.ino - the text is the sketch's
    [0.3, 'START', 'GAME'],
    [0.39, 'TAKE', 'BALL'],
    [0.48, film.display[0] ? film.display[0].top : 'SCORE', film.display[0] ? film.display[0].bottom : '0 B:3'],
  ];

  const animated = window.filmScene(track, (p) => {
    const sweep = window.clamp01((p - SWEEP[0]) / (SWEEP[1] - SWEEP[0]));
    stage.style.setProperty('--sweep', sweep.toFixed(4));
    stage.classList.toggle('is-sweeping', sweep > 0 && sweep < 1);
    stage.classList.toggle('is-live', sweep >= 0.55);
    stage.classList.toggle('is-scrolled', p > 0.02);
    player.seek(window.clamp01((p - PLAY[0]) / (PLAY[1] - PLAY[0])));
    setFrame();
    let text = null;
    BOOT.forEach(([at, top, bottom]) => {
      if (p >= at) text = [top, bottom];
    });
    if (text) matrix.show(text[0], text[1]);
    else matrix.clear();
  });

  if (!animated) {
    // reduced motion / no GSAP: the finished state, still
    stage.style.setProperty('--sweep', '1');
    stage.classList.add('is-live', 'is-scrolled');
    player.seek(1);
    setFrame();
    matrix.show(BOOT[2][1], BOOT[2][2]);
    return;
  }

  gsap.set([...field.outlines, ...field.holes], { strokeDashoffset: 1 });
  gsap
    .timeline({ delay: 0.25 })
    .to(field.outlines, { strokeDashoffset: 0, duration: 1.6, stagger: 0.05, ease: 'power2.inOut' }, 0)
    .to(field.holes, { strokeDashoffset: 0, duration: 0.6, stagger: 0.02 }, 0.9);
})();
