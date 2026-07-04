'use strict';

const { dictionary, snippets, settings } = require('./store');

const FILLERS = /\b(?:um+|uh+|uhm+|erm+|er|mmm+|hmm+)\b[,.]?\s*/gi;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// \b only works against \w edges; terms like "C++" or ".NET" need conditional
// boundaries or they never match.
function wordPattern(term) {
  const prefix = /^\w/.test(term) ? '\\b' : '(?<=^|\\s)';
  const suffix = /\w$/.test(term) ? '\\b' : '(?=$|\\s|[.,!?;:])';
  return `${prefix}${escapeRegex(term)}${suffix}`;
}

function removeFillers(text) {
  let out = text.replace(FILLERS, '');
  out = out.replace(/\s{2,}/g, ' ');
  out = out.replace(/\s+([,.!?;:])/g, '$1');
  out = out.replace(/([,.!?])\1+/g, '$1');
  out = out.trim();
  if (out) out = out[0].toUpperCase() + out.slice(1);
  return out;
}

function applyDictionary(text) {
  let out = text;
  for (const entry of dictionary().data) {
    if (!entry.word) continue;
    // Function replacement: entry.word may contain $ metacharacters
    if (entry.misspelling) {
      const re = new RegExp(wordPattern(entry.misspelling), 'gi');
      out = out.replace(re, () => entry.word);
    } else {
      // Plain vocabulary entry: enforce the saved casing when the word appears
      const re = new RegExp(wordPattern(entry.word), 'gi');
      out = out.replace(re, () => entry.word);
    }
  }
  return out;
}

function applySnippets(text) {
  let out = text;
  for (const s of snippets().data) {
    if (!s.trigger || !s.expansion) continue;
    // Whole dictation is just the trigger (allow trailing punctuation)
    const whole = new RegExp(`^\\s*${escapeRegex(s.trigger)}\\s*[.!?]?\\s*$`, 'i');
    if (whole.test(out)) return s.expansion;
    // Trigger inside a longer sentence: whole-word match
    const inline = new RegExp(wordPattern(s.trigger), 'gi');
    out = out.replace(inline, () => s.expansion);
  }
  return out;
}

const POLISH_SYSTEM_PROMPT = `You clean up dictated speech into polished written text.
Rules:
- Remove filler words and false starts.
- Apply self-corrections: if the speaker changes their mind ("let's do 2pm, actually 3pm", "scratch that"), keep only the final intent.
- Fix punctuation, capitalization, and obvious transcription errors.
- If the speaker dictates a list, format it as a list.
- Never add new information, never answer questions in the text, never comment.
- Preserve the speaker's tone and wording otherwise.
Return ONLY the cleaned text, nothing else.`;

async function polishWithOllama(text, cfg) {
  const res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.polishOllamaModel || 'llama3.2',
      stream: false,
      messages: [
        { role: 'system', content: POLISH_SYSTEM_PROMPT },
        { role: 'user', content: text }
      ]
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = await res.json();
  const out = data.message && data.message.content ? data.message.content.trim() : '';
  return out || text;
}

async function polishWithAnthropic(text, cfg) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.polishAnthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: cfg.polishAnthropicModel || 'claude-haiku-4-5',
      max_tokens: 2048,
      system: POLISH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }]
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  const out = data.content && data.content[0] ? data.content[0].text.trim() : '';
  return out || text;
}

/**
 * Full cleanup pipeline. Rule-based steps always run fast and locally.
 * LLM polish is optional and falls back to the rule-based result on any failure.
 */
async function cleanup(rawText) {
  const cfg = settings();
  let text = rawText.trim();
  if (!text) return { text: '', polished: false };

  if (cfg.fillerRemoval) text = removeFillers(text);
  text = applyDictionary(text);
  text = applySnippets(text);

  let polished = false;
  if (cfg.polishProvider === 'ollama') {
    try { text = await polishWithOllama(text, cfg); polished = true; } catch (e) { console.error('[polish]', e.message); }
  } else if (cfg.polishProvider === 'anthropic' && cfg.polishAnthropicKey) {
    try { text = await polishWithAnthropic(text, cfg); polished = true; } catch (e) { console.error('[polish]', e.message); }
  }

  return { text, polished };
}

module.exports = { cleanup, removeFillers, applyDictionary, applySnippets };
