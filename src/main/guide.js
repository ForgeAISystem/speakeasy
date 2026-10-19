'use strict';

const G = require('../shared/guides');

// Runs one walkthrough at a time. App events come in through onEvent(); a step
// finishes only when its check matches something the user really did.
class GuideRunner {
  /**
   * deps: store { guide(), saveGuide(data) }, onState(view), precheck(name) ->
   * Promise<boolean>, now(), timers { setTimeout, clearTimeout }.
   */
  constructor(deps) {
    this.d = { now: () => Date.now(), timers: { setTimeout, clearTimeout }, precheck: async () => false, ...deps };
    this.active = null;
    this.timer = null;
  }

  progress() {
    const p = this.d.store.guide() || {};
    return { seenVersion: p.seenVersion, steps: p.steps || {}, challenges: p.challenges || {} };
  }

  _save(p) { this.d.store.saveGuide(p); }

  markSeen(version) {
    const p = this.progress();
    p.seenVersion = version;
    this._save(p);
  }

  /** Learn tab data: every guide with its progress. */
  summary() {
    const p = this.progress();
    return G.GUIDES.map((g) => {
      const all = G.steps(g);
      const best = p.challenges[g.id];
      return { id: g.id, version: g.version, title: g.title, tagline: g.tagline, whatsNew: g.whatsNew,
        totalSteps: all.length, doneSteps: all.filter((s) => p.steps[s.id]).length,
        challenge: { title: g.challenge.title, intro: g.challenge.intro, tasks: g.challenge.tasks.length, best: best || null } };
    });
  }

  async start(id, mode = 'lesson') {
    const guide = G.byId(id);
    if (!guide) return null;
    this.d.timers.clearTimeout(this.timer);
    const p = this.progress();
    const all = G.steps(guide);
    let index = mode === 'lesson' ? all.findIndex((s) => !p.steps[s.id]) : 0;
    if (index < 0) index = 0; // everything done: replay from the top
    this.active = { id, mode, index, status: 'waiting', done: [], startedAt: this.d.now(), finished: null };
    await this._autoComplete();
    this._emit();
    return this.view();
  }

  stop() {
    this.d.timers.clearTimeout(this.timer);
    this.active = null;
    this._emit();
  }

  _guide() { return this.active && G.byId(this.active.id); }
  _steps() { return G.steps(this._guide()); }

  // Steps already true (for example the emoji fix was applied earlier) finish on their own.
  async _autoComplete() {
    const a = this.active;
    if (!a || a.mode !== 'lesson') return;
    const step = this._steps()[a.index];
    if (step && step.doneIf && await this.d.precheck(step.doneIf) && this.active === a && this._steps()[a.index]?.id === step.id) this._complete(step);
  }

  onEvent(ev) {
    const a = this.active;
    if (!a || a.finished) return false;
    if (a.mode === 'challenge') {
      const g = this._guide();
      let hit = false;
      for (const task of g.challenge.tasks) {
        if (!a.done.includes(task.id) && G.matches(task.check, ev)) { a.done.push(task.id); hit = true; }
      }
      if (!hit) return false;
      if (a.done.length === g.challenge.tasks.length) this._finishChallenge();
      this._emit();
      return true;
    }
    const step = this._steps()[a.index];
    if (!step || a.status === 'done' || !G.matches(step.check, ev)) return false;
    this._complete(step);
    return true;
  }

  _complete(step) {
    const a = this.active;
    const p = this.progress();
    p.steps[step.id] = true;
    this._save(p);
    a.status = 'done';
    this._emit();
    this.timer = this.d.timers.setTimeout(() => this.next(), 1100);
  }

  next() {
    const a = this.active;
    if (!a || a.mode !== 'lesson') return;
    this.d.timers.clearTimeout(this.timer);
    if (a.index + 1 >= this._steps().length) {
      a.finished = { lesson: true };
      a.status = 'done';
    } else {
      a.index += 1;
      a.status = 'waiting';
      this._autoComplete();
    }
    this._emit();
  }

  back() {
    const a = this.active;
    if (!a || a.mode !== 'lesson' || a.index === 0) return;
    this.d.timers.clearTimeout(this.timer);
    a.index -= 1;
    a.status = 'waiting';
    a.finished = null;
    this._emit();
  }

  _finishChallenge() {
    const a = this.active;
    const g = this._guide();
    const seconds = Math.max(1, Math.round((this.d.now() - a.startedAt) / 1000));
    const level = G.level(g.challenge, seconds);
    const p = this.progress();
    const best = p.challenges[g.id];
    const record = !best || seconds < best.seconds;
    if (record) p.challenges[g.id] = { seconds, level, at: this.d.now() };
    this._save(p);
    a.finished = { seconds, level, record, best: record ? seconds : best.seconds };
  }

  view() {
    const a = this.active;
    if (!a) return { active: false };
    const g = this._guide();
    const base = { active: true, id: g.id, title: g.title, mode: a.mode, startedAt: a.startedAt, finished: a.finished, status: a.status };
    if (a.mode === 'challenge') {
      return { ...base, challenge: g.challenge.title, intro: g.challenge.intro,
        tasks: g.challenge.tasks.map((t) => ({ id: t.id, goal: t.goal, done: a.done.includes(t.id) })) };
    }
    const all = this._steps();
    const step = all[a.index];
    // What to suggest after the last step: this guide's challenge.
    return { ...base, index: a.index, total: all.length, lesson: step.lesson,
      step: { id: step.id, do: step.do, hint: step.hint, action: step.action || null },
      next: a.finished ? { challenge: g.challenge.title } : null };
  }

  _emit() { this.d.onState && this.d.onState(this.view()); }
}

/** Turns the app's push messages into guide events. Returns null for noise. */
function toGuideEvent(type, msg) {
  if (type === 'pad') {
    if (msg.phase === 'open') return { type: 'pad-open' };
    if (msg.phase === 'plan') return { type: 'plan', steps: (msg.steps || []).length, wake: !!msg.wake, via: msg.via };
    if (msg.phase === 'camera') return { type: 'camera', on: !!msg.on };
    if (msg.phase === 'set') return { type: 'pad-set', key: msg.key };
    if (msg.phase === 'voice-step') return { type: 'voice-step', do: msg.do, ok: !!msg.ok };
    if (msg.phase === 'peek') return { type: 'pad-peek' };
    if (msg.phase === 'starter') return { type: 'pad-starter', goal: msg.goal };
    if (msg.phase === 'tip') return { type: 'pad-tip', region: msg.region };
    if (msg.phase === 'layout-restore') return { type: 'layout-restore', ok: !!msg.ok, source: msg.source };
    if (msg.phase === 'hit' || msg.phase === 'saved') return null;
    if (msg.phase === 'results') return { type: 'history-search', found: msg.count > 0, wake: !!msg.wake };
    if (msg.phase === 'history-paste') return { type: 'history-paste', ok: !!msg.ok };
    if (msg.key && msg.source === 'save') return { type: 'pad-save', key: msg.key, ok: !!msg.ok };
    if (msg.key && msg.source !== 'voice') return { type: 'pad', key: msg.key, ok: !!msg.ok, source: msg.source };
    return null;
  }
  if (type === 'dictation' && (msg.phase === 'done' || msg.phase === 'cancelled')) {
    return { type: 'dictation', phase: msg.phase, words: msg.words || 0, text: msg.text || '', handsFree: !!msg.handsFree, terminal: !!msg.terminal };
  }
  if (type === 'rewrite') return { type: 'rewrite', ok: !!msg.ok, via: msg.via, transform: msg.transform };
  if (type === 'undo') return { type: 'undo', ok: !!msg.ok, kind: msg.kind };
  if (type === 'globe') return { type: 'globe', fixed: !!msg.fixed };
  return null;
}

module.exports = { GuideRunner, toGuideEvent };
