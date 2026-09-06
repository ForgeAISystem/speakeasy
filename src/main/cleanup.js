'use strict';

const { dictionary, snippets, settings } = require('./store');
const writing = require('../shared/writing');

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
  out = out.replace(/[ \t]{2,}/g, ' ');
  out = out.replace(/[ \t]+([,.!?;:])/g, '$1');
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
- Keep the speaker's own language: if they dictated in Spanish, Hindi, or Gujarati, return the cleaned text in that same language. Never translate.
Return ONLY the cleaned text, nothing else.`;

const ORGANIZE_SYSTEM_PROMPT = `You turn a rambling, spoken stream of consciousness into clear, organized written text.
The speaker dictated their raw thoughts out loud and asked you to organize them.
Rules:
- Restructure into a logical flow: group related ideas, order them sensibly, drop repetition and dead ends.
- Use short paragraphs, and bullet points or numbered steps when the content is a list or a sequence.
- Remove filler, false starts, and tangents that go nowhere. Keep every real idea the speaker expressed.
- Do NOT invent facts, opinions, or details the speaker did not say. Do not answer questions posed in the text.
- Keep it tight and readable. Preserve the speaker's voice and intent.
- Keep the speaker's own language: if they dictated in Spanish, Hindi, or Gujarati, organize and return the text in that same language. Never translate.
Return ONLY the organized text, nothing else.`;

// Spoken commands that ask for the organize pass. Matched at the very start or
// very end of a dictation (people say it before or after their thoughts), then
// stripped so the command itself never lands in the output.
const ORGANIZE_TRIGGERS = [
  'organi[sz]e my thoughts',
  'organi[sz]e these thoughts',
  'organi[sz]e this',
  'clean up my thoughts',
  'clean this up',
  'tidy (?:this|these) up',
  'help me organi[sz]e (?:my|these) thoughts'
];

function detectOrganize(text) {
  const alt = ORGANIZE_TRIGGERS.join('|');
  // leading: "organize my thoughts, ..." / trailing: "... clean this up."
  const lead = new RegExp(`^\\s*(?:${alt})\\s*[,.:;-]?\\s*`, 'i');
  const trail = new RegExp(`\\s*[,.:;-]?\\s*(?:${alt})\\s*[.!?]?\\s*$`, 'i');
  let stripped = text;
  let triggered = false;
  if (lead.test(stripped)) { stripped = stripped.replace(lead, ''); triggered = true; }
  if (trail.test(stripped)) { stripped = stripped.replace(trail, ''); triggered = true; }
  return { triggered, text: stripped.trim() };
}

async function llmWithOllama(text, cfg, systemPrompt) {
  const res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.polishOllamaModel || 'llama3.2',
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ]
    }),
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = await res.json();
  const out = data.message && data.message.content ? data.message.content.trim() : '';
  return out || text;
}

async function llmWithAnthropic(text, cfg, systemPrompt) {
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
      system: systemPrompt,
      messages: [{ role: 'user', content: text }]
    }),
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  const out = data.content && data.content[0] ? data.content[0].text.trim() : '';
  return out || text;
}

// Run a system prompt through whichever provider is configured. Returns the
// original text unchanged if no provider is set or the call fails.
async function runLLM(text, cfg, systemPrompt) {
  if (cfg.polishProvider === 'ollama') {
    return { text: await llmWithOllama(text, cfg, systemPrompt), used: true };
  }
  if (cfg.polishProvider === 'anthropic' && cfg.polishAnthropicKey) {
    return { text: await llmWithAnthropic(text, cfg, systemPrompt), used: true };
  }
  return { text, used: false };
}

/**
 * Full cleanup pipeline. Rule-based steps always run fast and locally.
 * LLM polish/organize is optional and falls back to the rule-based result on
 * any failure. Returns { text, polished, organized, providerMissing }.
 * - "organize my thoughts" (spoken) triggers a stronger restructuring pass.
 */
async function cleanup(rawText) {
  const cfg = settings();
  let text = rawText.trim();
  if (!text) return { text: '', polished: false, organized: false };

  const cleanupMode = writing.mode(cfg);
  if (cleanupMode === 'original') return { text: rawText, cleanupMode, polished: false, organized: false };
  const canUseAI = cleanupMode === 'polished' && writing.providerReady(cfg);

  // Detect the spoken organize command before other cleanup mangles it.
  let wantsOrganize = false;
  if (canUseAI && cfg.organizeOnCommand !== false) {
    const det = detectOrganize(text);
    if (det.triggered) { wantsOrganize = true; text = det.text; }
  }

  const localFallback = applySnippets(applyDictionary(removeFillers(rawText.trim())));
  text = removeFillers(text);
  text = applyDictionary(text);

  let polished = false;
  let organized = false;
  let providerMissing = false;
  let fallbackReason = cleanupMode === 'polished' && !canUseAI ? 'missing-provider' : undefined;

  if (wantsOrganize) {
    try {
      const r = await runLLM(text, cfg, ORGANIZE_SYSTEM_PROMPT);
      text = r.text;
      organized = r.used;
      providerMissing = !r.used; // asked to organize but no AI provider configured
    } catch (e) { console.error('[organize]', e.message); fallbackReason = 'provider-unavailable'; }
  } else if (canUseAI) {
    try {
      const r = await runLLM(text, cfg, POLISH_SYSTEM_PROMPT);
      text = r.text;
      polished = r.used;
    } catch (e) { console.error('[polish]', e.message); fallbackReason = 'provider-unavailable'; }
  }

  // Keep the full spoken request on failures. Expand saved text only after AI
  // editing, so signatures, URLs, and multiline snippets keep their exact bytes.
  text = fallbackReason ? localFallback : applySnippets(applyDictionary(text));
  return { text, polished, organized, providerMissing, wantsOrganize, cleanupMode, fallbackReason };
}

module.exports = { cleanup, removeFillers, applyDictionary, applySnippets, detectOrganize };
