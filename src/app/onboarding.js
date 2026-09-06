'use strict';

class SpeakEasySetup {
  constructor({ api, state, update, finish }) {
    Object.assign(this, { api, state, update, finish });
    this.el = document.getElementById('onboard');
    this.step = 0;
    this.voice = 'moonshine-base';
    this.error = '';
    this.busy = false;
    this.keySeen = false;
    this.testText = '';
    this.testPassed = false;
    this.poll = null;
    this.login = false;
    this.el.addEventListener('click', (e) => {
      const button = e.target.closest('[data-setup]');
      if (!button || button.disabled) return;
      this.act(button.dataset.setup, button).catch((error) => {
        this.busy = false;
        this.error = error.message;
        this.render();
      });
    });
    this.el.addEventListener('change', (e) => {
      if (e.target.id === 'setup-login') this.login = e.target.checked;
    });
  }

  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async open() {
    this.visible = true;
    this.step = 0;
    this.error = '';
    this.keySeen = false;
    this.testPassed = false;
    this.testText = '';
    this.voice = this.state().settings.model || 'moonshine-base';
    this.login = !!this.state().settings.launchAtLogin;
    document.getElementById('layout').inert = true;
    this.el.classList.add('visible');
    await this.api.setupMode('off');
    this.render();
    clearInterval(this.poll);
    this.poll = setInterval(() => this.refresh().catch(() => {}), 1800);
  }

  close() {
    this.visible = false;
    clearInterval(this.poll);
    this.el.classList.remove('visible');
    document.getElementById('layout').inert = false;
    this.api.setupMode('off');
  }

  async refresh() {
    if (!this.visible || this.refreshing) return;
    this.refreshing = true;
    try {
      const previous = this.state();
      const next = await this.api.getState();
      this.update(next);
      if ([1, 2, 3].includes(this.step) && JSON.stringify([previous.permissions, previous.shortcut, previous.engine]) !== JSON.stringify([next.permissions, next.shortcut, next.engine])) this.render();
      this.progress();
    } finally { this.refreshing = false; }
  }

  async go(step) {
    this.step = step;
    this.error = '';
    await this.api.setupMode(step === 3 ? 'shortcut' : step === 4 ? 'practice' : 'off');
    this.render(true);
  }

  async prepareVoice() {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.render();
    try {
      const s = this.state();
      if (!s.models.installed.includes(this.voice)) {
        const result = await this.api.downloadModel(this.voice);
        if (!result.ok) throw new Error('The voice download stopped. Check your connection, then try again.');
      }
      this.update(await this.api.updateSettings({ model: this.voice }));
      if (this.state().engine.state !== 'ready') this.update(await this.api.retryEngine());
      if (this.state().engine.state !== 'ready') throw new Error('Your voice is downloaded, but could not start. Try again.');
    } catch (e) { this.error = e.message; }
    this.busy = false;
    if (this.visible) this.render();
  }

  async act(action, button) {
    const s = this.state();
    if (action === 'install') {
      this.busy = true;
      this.render();
      const result = await this.api.installApp();
      this.busy = false;
      if (!result.ok) this.error = result.error;
      else this.update(await this.api.getState());
      this.render();
    } else if (action === 'start') {
      await this.go(1);
    } else if (action === 'back') {
      await this.go(Math.max(0, this.step - 1));
    } else if (action === 'mic') {
      if (['denied', 'restricted'].includes(s.permissions.mic)) await this.api.openPermSettings('microphone');
      else await this.api.requestMic();
      await this.refresh();
    } else if (action === 'access') {
      await this.api.requestAccessibility();
      await this.api.openPermSettings('accessibility');
      await this.refresh();
    } else if (action === 'permissions-next') {
      this.update(await this.api.getState());
      const p = this.state().permissions;
      if (p.mic !== 'granted' || !p.accessibility) return;
      await this.go(2);
    } else if (action === 'voice') {
      this.voice = button.dataset.voice;
      this.error = '';
      this.render();
    } else if (action === 'download') {
      await this.prepareVoice();
    } else if (action === 'voice-next') {
      if (s.settings.model !== this.voice || s.engine.state !== 'ready') return;
      await this.go(3);
      this.update(await this.api.retryShortcut());
      this.render();
    } else if (action === 'key') {
      this.keySeen = false;
      this.update(await this.api.updateSettings({ holdKey: button.dataset.key }));
      this.render();
    } else if (action === 'input') {
      await this.api.openPermSettings('input');
    } else if (action === 'keyboard') {
      await this.api.openPermSettings('keyboard');
    } else if (action === 'retry-key') {
      this.update(await this.api.retryShortcut());
      this.render();
    } else if (action === 'key-next') {
      if (!this.keySeen || !s.shortcut.ready) return;
      await this.go(4);
    } else if (action === 'finish') {
      if (!this.testPassed) return;
      const result = await this.api.completeSetup(this.login);
      if (!result.ok) { this.error = result.error; this.render(); return; }
      this.update(await this.api.getState());
      this.close();
      this.finish();
    }
  }

  progress() {
    const s = this.state();
    const progress = s.models.downloads[this.voice];
    const bar = this.el.querySelector('#setup-progress');
    const label = this.el.querySelector('#setup-progress-label');
    if (bar && progress !== undefined) {
      const pct = progress === -1 ? 100 : Math.round(progress * 100);
      bar.style.width = `${pct}%`;
      bar.parentElement.setAttribute('aria-valuenow', pct);
      if (label) label.textContent = progress === -1 ? 'Unpacking your voice…' : `Downloading your voice · ${pct}%`;
    }
  }

  push(msg) {
    if (!this.visible) return;
    if (msg.type === 'download-progress') this.progress();
    if (msg.type === 'shortcut-key' && this.step === 3 && msg.key === this.state().settings.holdKey) {
      this.el.querySelector('.keycap')?.classList.toggle('pressed', msg.down);
      if (!msg.down) { this.keySeen = true; this.render(); }
    }
    if (msg.type === 'dictation' && this.step === 4) {
      const phase = this.el.querySelector('#setup-phase');
      if (!phase) return;
      phase.textContent = ({ recording: 'Opening your microphone…', armed: 'Listening. Say your first sentence.', processing: 'Turning your voice into text…', cancelled: 'Cancelled. Hold your key to try again.' })[msg.phase] || msg.message || '';
      if (msg.phase === 'done') {
        // Wait for the OS paste to arrive. Typed sample text alone never passes setup.
        setTimeout(() => {
          if (!this.visible || this.step !== 4) return;
          const field = this.el.querySelector('#setup-test');
          this.testText = field?.value || '';
          this.testPassed = !!msg.pasted && !!msg.text?.trim() && this.testText.includes(msg.text.trim());
          this.error = this.testPassed ? '' : 'Your words were recognized, but did not land in the box. Click the box and try once more.';
          this.render();
        }, 200);
      }
    }
  }

  render(focus = false) {
    if (!this.visible) return;
    const focused = this.el.contains(document.activeElement) ? document.activeElement.id : null;
    const previousTest = this.el.querySelector('#setup-test');
    if (previousTest) this.testText = previousTest.value;
    const s = this.state();
    const mac = s.platform === 'darwin';
    const key = s.settings.holdKey;
    const keyLabel = mac ? s.holdKeys[key]?.label : s.holdKeys[key]?.winLabel;
    const keyArt = this.escape(key === 'Fn' ? 'fn' : key === 'AltRight' ? '⌥' : keyLabel);
    const voiceReady = s.settings.model === this.voice && s.engine.state === 'ready';
    const micOk = s.permissions.mic === 'granted';
    const axOk = s.permissions.accessibility;
    const steps = ['Access', 'Voice', 'Shortcut', 'Try it'];
    const wave = '<span class="voice-wave" aria-hidden="true">' + [8,16,25,39,29,49,34,22,38,24,13].map((h) => `<i style="--h:${h}px"></i>`).join('') + '</span>';
    const button = (action, label, disabled = false, cls = '') => `<button class="btn ${cls}" data-setup="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
    let content = '';
    if (this.step === 0) {
      content = `<div class="setup-welcome"><div class="eyebrow">A little app. A lot less typing.</div><h1 id="setup-title" tabindex="-1">Your voice.<br><em>Anywhere.</em></h1><p class="setup-lead">An email. A message. Your next big idea.<br>Hold a key and let the words flow.</p><div class="setup-start">${button(s.installation?.needsMove ? 'install' : 'start', this.busy ? 'Installing…' : s.installation?.needsMove ? 'Install in Applications' : 'Let’s set you up', this.busy)}<span>No account. No subscription.</span></div><div class="welcome-trust"><span class="local-dot"></span>Speech stays on this computer.</div></div><div class="setup-scene" aria-hidden="true"><div class="scene-note"><span class="note-meta">A NOTE TO YOURSELF</span><p>Less typing.<br>More <em>thinking.</em></p><div class="note-lines"><i></i><i></i></div><span class="note-cursor"></span></div><div class="scene-key"><span>hold</span><kbd>${mac ? 'fn' : 'ctrl'}</kbd></div><div class="scene-pill">${wave}<span>Your words, flowing.</span></div><div class="scene-caption">PRESS. SPEAK. RELEASE.</div></div>`;
    } else if (this.step === 1) {
      content = `<div class="setup-copy"><div class="eyebrow">01 / A little permission</div><h1 id="setup-title" tabindex="-1">Let’s make<br><em>room for your voice.</em></h1><p class="setup-lead">You decide what SpeakEasy can access. These permissions let it hear you and place your words where you’re working.</p><div class="privacy-note">${wave}<p>Only listening when you start a dictation.<br>Your microphone turns off when you stop.</p></div></div><div class="setup-panel"><div class="permission-card"><span class="permission-icon">01</span><h2>Hear your voice</h2><p>Microphone access turns speech into text, right here on your computer.</p>${micOk ? '<span class="permission-done">Microphone allowed</span>' : button('mic', ['denied', 'restricted'].includes(s.permissions.mic) ? 'Open microphone settings' : 'Allow microphone', false, 'ghost')}</div>${mac ? `<div class="permission-card"><span class="permission-icon">02</span><h2>Type where you work</h2><p>In Accessibility, switch on SpeakEasy so it can paste into your apps.</p>${axOk ? '<span class="permission-done">Accessibility allowed</span>' : button('access', 'Open Accessibility', false, 'ghost')}</div>` : ''}<p class="setup-hint">This screen checks again when you return.${s.permissions.mic === 'denied' ? ' After changing microphone access, you may need to quit and reopen SpeakEasy.' : ''}</p>${button('permissions-next', 'Continue', !micOk || !axOk)}</div>`;
    } else if (this.step === 2) {
      content = `<div class="setup-copy"><div class="eyebrow">02 / Your offline voice</div><h1 id="setup-title" tabindex="-1">Download once.<br><em>Dictate anywhere.</em></h1><p class="setup-lead">A small voice pack brings speech recognition onto your computer. After setup, dictation works without the internet.</p><div class="voice-orbit" aria-hidden="true">${wave}<span>ON YOUR COMPUTER</span></div></div><div class="setup-panel"><h2>What do you speak?</h2><div class="voice-choices">${[['moonshine-base','English','A lighter download. A fast everyday start.'],['whisper-turbo','Multiple languages','English, Spanish, Hindi, Gujarati, and more.']].map(([id,title,desc]) => `<button class="voice-choice ${this.voice === id ? 'selected' : ''}" data-setup="voice" data-voice="${id}" aria-pressed="${this.voice === id}" ${this.busy ? 'disabled' : ''}><span class="choice-dot"></span><span><strong>${title}</strong><small>${desc}</small></span></button>`).join('')}${!['moonshine-base','whisper-turbo'].includes(this.voice) ? `<div class="kept-model">Your current voice: ${this.escape(s.models.catalog[this.voice]?.label)}</div>` : ''}</div><p class="setup-hint">About ${s.models.catalog[this.voice]?.sizeMB || 240} MB to download. You can change voices in Settings.</p>${this.busy ? `<div class="voice-download"><div class="progress" role="progressbar" aria-label="Voice download" aria-valuemin="0" aria-valuemax="100"><div class="fill" id="setup-progress"></div></div><p id="setup-progress-label" role="status">${s.engine.state === 'loading' ? 'Starting your voice…' : 'Preparing your voice…'}</p></div>` : voiceReady ? '<div class="permission-done voice-ready">Your offline voice is ready</div>' : ''}${button(voiceReady ? 'voice-next' : 'download', this.busy ? 'Getting things ready…' : voiceReady ? 'Continue' : this.error ? 'Try download again' : 'Prepare my voice', this.busy)}</div>`;
    } else if (this.step === 3) {
      content = `<div class="setup-copy"><div class="eyebrow">03 / One key is all it takes</div><h1 id="setup-title" tabindex="-1">Meet your<br><em>dictation key.</em></h1><p class="setup-lead">Hold to speak. Release to write.<br>Double-tap for hands-free dictation.<br>Press Escape to cancel.</p><p class="setup-hint">Press and release your chosen key now.<br>We’ll check it before you start.</p></div><div class="setup-panel key-panel"><div class="keycap ${this.keySeen ? 'detected' : ''}" aria-hidden="true">${keyArt}<span>${this.keySeen ? 'CONNECTED' : 'PRESS & RELEASE'}</span></div><p class="key-status" role="status">${this.keySeen ? 'Got it. Your key is connected.' : s.shortcut.ready ? 'Listening for your key…' : 'Your shortcut needs permission.'}</p><div class="key-choices">${(mac ? [['Fn','Fn / Globe'],['AltRight','Right Option']] : [['CtrlRight','Right Ctrl'],['F8','F8']]).map(([id,label]) => `<button class="key-choice ${key === id ? 'selected' : ''}" data-setup="key" data-key="${id}" aria-pressed="${key === id}">${label}</button>`).join('')}</div>${!s.shortcut.ready ? `<div class="shortcut-help"><p>${this.escape(s.shortcut.error || 'Check Accessibility and Input Monitoring in System Settings.')}</p>${button(mac ? 'input' : 'retry-key', mac ? 'Open Input Monitoring' : 'Retry shortcut', false, 'ghost')}${mac ? button('retry-key','Check again',false,'ghost') : ''}</div>` : ''}${mac && key === 'Fn' ? '<details class="setup-details"><summary>Does the Globe menu appear?</summary><p>In Keyboard settings, set “Press Globe key to” to “Do Nothing”. SpeakEasy will handle the key while it is running.</p><button class="muted-link" data-setup="keyboard">Open Keyboard settings</button></details>' : ''}${button('key-next', 'Try my first dictation', !this.keySeen || !s.shortcut.ready)}</div>`;
    } else {
      content = `<div class="setup-copy"><div class="eyebrow">04 / The first of many</div><h1 id="setup-title" tabindex="-1">${this.testPassed ? 'There you are.<br><em>In your own words.</em>' : 'Think it.<br><em>Say it. Done.</em>'}</h1><p class="setup-lead">${this.testPassed ? 'Your words landed. You’re ready to dictate in the apps you already use.' : `Click the box. Hold <strong>${this.escape(keyLabel)}</strong>, wait for the sound, then say a sentence. Release to see your words.`}</p><div class="sample-sentence">TRY SAYING<span>“I have a good feeling about this.”</span></div></div><div class="setup-panel practice-panel"><label for="setup-test">Your first dictation</label><textarea id="setup-test" class="setup-test" placeholder="Your words will land here…" spellcheck="false">${this.escape(this.testText)}</textarea><p id="setup-phase" class="setup-phase" role="status">${this.testPassed ? 'Voice, shortcut, and pasting. All working.' : 'Click above, then hold your dictation key.'}</p>${this.testPassed ? `<label class="login-option"><input type="checkbox" id="setup-login" ${this.login ? 'checked' : ''}> Start SpeakEasy when I log in</label>` : ''}${button('finish', 'Start using SpeakEasy', !this.testPassed)}<p class="setup-hint">Close the window when you’re done. SpeakEasy stays in your menu bar${mac ? '' : ' or system tray'}.</p></div>`;
    }
    this.el.innerHTML = `<div class="setup-shell"><header class="setup-header"><div class="setup-wordmark"><span class="mini-mark" aria-hidden="true"><i></i><i></i><i></i></span>SpeakEasy</div>${this.step ? `<ol class="setup-steps" aria-label="Setup progress">${steps.map((label,i) => `<li ${this.step === i+1 ? 'aria-current="step"' : ''} class="${this.step > i+1 ? 'complete' : ''}"><span>${this.step > i+1 ? '✓' : i+1}</span>${label}</li>`).join('')}</ol>` : '<span class="setup-top-note">PRIVATE BY DESIGN</span>'}</header><div class="setup-body ${this.step === 0 ? 'welcome' : ''}">${content}</div>${this.error ? `<div class="setup-error" role="alert">${this.escape(this.error)}</div>` : ''}<footer class="setup-footer">${this.step > 0 ? button('back','Back',this.busy,'ghost') : '<span>Coded by The Forge</span>'}<span>Small app. Yours to keep.</span></footer></div>`;
    this.progress();
    if (focus) (this.step === 4 ? this.el.querySelector('#setup-test') : this.el.querySelector('#setup-title'))?.focus();
    else if (focused) this.el.querySelector(`#${focused}`)?.focus();
  }
}

window.SpeakEasySetup = SpeakEasySetup;
