/* Pinball page hero: the finished table playing, from the first moment. The <video> starts
   itself (autoplay, muted, inline - it's in the HTML, so the browser begins fetching it while
   the page is still parsing); this only adds what a video that never stops needs: a pause /
   play button, and pausing while it is scrolled out of view. With "reduce motion" it doesn't
   play on its own at all - the first frame stays up and the button starts it. */
(() => {
  'use strict';

  const video = document.querySelector('.hero-video');
  const toggle = document.querySelector('.hero-toggle');
  if (!video) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let userPaused = false;

  const sync = () => {
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', String(video.paused));
    toggle.setAttribute('aria-label', video.paused ? 'Play the video' : 'Pause the video');
  };

  if (reduceMotion) {
    video.removeAttribute('autoplay');
    video.pause();
    userPaused = true;
  }
  sync();
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);

  if (toggle) {
    toggle.addEventListener('click', () => {
      userPaused = !video.paused; // pausing it is a choice that off-screen playback must respect
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    });
  }

  // a phone in low-power mode can refuse to autoplay: show the button as "play"
  video.play && !reduceMotion && video.play().catch(sync);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!userPaused) video.play().catch(() => {});
      } else video.pause();
    }, { threshold: 0.25 }).observe(video);
  }
})();
