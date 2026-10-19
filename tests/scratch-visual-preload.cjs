// Synthetic Scratchpad for scripts/visual-check.cjs. Never packaged.
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('scratchBridge', {
  load: async () => 'Pricing idea for Legacy: bundle DSD setup with the first month.\n\nAsk Nishil about Daniela owning the vendor list.',
  save: async () => true, send: async () => ({ ok: true }), close: async () => true, onFocus() {}
});
