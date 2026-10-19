'use strict';
// The faster-way tip: one line after a window was moved by hand.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tipEl = document.getElementById('tip');
window.padBridge.onTip((tip) => {
  const fast = tip.key ? `Next time: ${esc(tip.opener)}, then <kbd>${esc(tip.key)}</kbd>.` : 'Next time';
  const say = tip.say ? (tip.key ? ` Or say “<b>${esc(tip.say)}</b>”.` : ` say “<b>${esc(tip.say)}</b>”.`) : '';
  document.getElementById('text').innerHTML = fast + say;
  tipEl.classList.remove('in');
  void tipEl.offsetWidth;
  tipEl.classList.add('in');
});
