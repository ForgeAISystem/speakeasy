'use strict';

// Terminal mode. Harsh talks to Claude Code all day: in a terminal a stray
// final period, curly quotes, or a pasted newline (which presses Return and
// sends the prompt) all break the command. Words land as typed text instead:
// straight quotes, no trailing period, and every new line becomes Shift+Return
// (see injector.js), so nothing ever sends on its own.

const TERMINAL_APPS = /^(?:terminal|iterm2?|warp|ghostty|kitty|alacritty|wezterm(?:-gui)?|hyper|tabby|rio)$/i;
// Claude Code sets the terminal title to its task ("✳ Fix the build"), which
// also marks an editor's terminal tab when the editor shows it.
const CLAUDE_CODE_TITLE = /\bclaude code\b|^\s*✳/i;

function isTerminal({ app = '', title = '' } = {}) {
  return TERMINAL_APPS.test(String(app).trim()) || CLAUDE_CODE_TITLE.test(String(title));
}

function active(settings, context) {
  return settings.terminalMode !== false && isTerminal(context);
}

function format(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/…/g, '...')
    .split('\n')
    // A lone final period goes; an ellipsis stays.
    .map((line) => line.replace(/(?<!\.)\.[ \t]*$/, '').replace(/[ \t]+$/, ''))
    .join('\n');
}

module.exports = { isTerminal, active, format, TERMINAL_APPS };
