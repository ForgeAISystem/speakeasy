'use strict';

// Shared by the main process and renderer so existing preferences resolve alike.
(function (root) {
  const modes = {
    original: { label: 'Original', description: 'Keep the recognized transcript unchanged. No cleanup or snippets.' },
    clean: { label: 'Clean', description: 'Remove fillers and apply your dictionary and snippets. Always local.' },
    polished: { label: 'Polished', description: 'Add AI corrections and formatting with your chosen provider.' }
  };
  function mode(settings) {
    if (Object.hasOwn(modes, settings.cleanupMode)) return settings.cleanupMode;
    // Preserve v2.3 behavior until the user makes an explicit choice.
    if (['ollama', 'anthropic'].includes(settings.polishProvider)) return 'polished';
    return settings.fillerRemoval === false ? 'original' : 'clean';
  }
  function providerReady(settings) {
    return settings.polishProvider === 'ollama' ||
      (settings.polishProvider === 'anthropic' && !!settings.polishAnthropicKey?.trim());
  }
  const writing = { modes, mode, providerReady };
  if (typeof module === 'object' && module.exports) module.exports = writing;
  else root.SpeakEasyWriting = writing;
})(globalThis);
