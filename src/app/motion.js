'use strict';

// Event-driven depth. No idle render loop, timers, or global mouse tracking.
(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = true, surface = null, frame = null, point = null;
  function reset() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (surface) { surface.style.removeProperty('--mx'); surface.style.removeProperty('--my'); }
    surface = null;
  }
  function sync() {
    document.documentElement.dataset.motion = enabled && !preference.matches ? 'on' : 'off';
    if (!enabled || preference.matches) reset();
  }
  document.addEventListener('pointermove', (event) => {
    if (!enabled || preference.matches || document.hidden || event.pointerType === 'touch') return;
    const next = event.target.closest('[data-parallax]');
    if (!next) { reset(); return; }
    if (next !== surface) { reset(); surface = next; }
    point = { x: event.clientX, y: event.clientY };
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (!surface?.isConnected) { reset(); return; }
      const box = surface.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const clamp = (n) => Math.max(-1, Math.min(1, n));
      surface.style.setProperty('--mx', clamp((point.x - box.left) / box.width * 2 - 1).toFixed(3));
      surface.style.setProperty('--my', clamp((point.y - box.top) / box.height * 2 - 1).toFixed(3));
    });
  }, { passive: true });
  document.addEventListener('pointerout', (event) => {
    if (surface && !surface.contains(event.relatedTarget)) reset();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  window.addEventListener('blur', reset);
  preference.addEventListener('change', sync);
  window.SpeakEasyMotion = { setEnabled(value) { enabled = value !== false; sync(); } };
  sync();
})();
