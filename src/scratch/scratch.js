'use strict';
// Scratchpad: a parking spot for half-formed thoughts. Dictation lands here
// while it has focus; Send pastes it into the app you came from.
const bridge = window.scratchBridge;
const text = document.getElementById('text');
const saved = document.getElementById('saved');
const send = document.getElementById('send');
let timer;

function sync() { send.disabled = !text.value.trim(); }
function persist() {
  clearTimeout(timer);
  saved.textContent = '';
  timer = setTimeout(async () => { await bridge.save(text.value); saved.textContent = 'Saved'; }, 400);
  sync();
}

bridge.load().then((value) => { text.value = value || ''; sync(); text.focus(); });
bridge.onFocus(() => { text.focus(); text.selectionStart = text.selectionEnd = text.value.length; });
text.addEventListener('input', persist);
send.addEventListener('click', async () => {
  if (!text.value.trim()) return;
  const value = text.value;
  const res = await bridge.send(value);
  if (res && res.ok) { text.value = ''; await bridge.save(''); sync(); }
});
document.getElementById('clear').addEventListener('click', async () => { text.value = ''; await bridge.save(''); sync(); text.focus(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); bridge.close(); }
  else if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); send.click(); }
});
