import type { ScriptItem } from '../core/types';
import type { Settings } from '../core/storage';
import { formatTime } from '../core/parser';
import { Teleprompter } from '../teleprompter/engine';
import type { PrompterState } from '../teleprompter/engine';
import { Recorder, describeMediaError } from '../recording/recorder';
import type { RecordMode } from '../recording/recorder';
import { h, toast } from './dom';
import { ic, icon, setBtn } from './icons';
import { showRecordingResult } from './recordingResult';

export interface PrompterOptions {
  title: string;
  items: ScriptItem[];
  settings: Settings;
  onSettings(s: Settings): void;
  onExit(): void;
}

/** Full-screen teleprompter with keyboard, click/tap controls and quick tweaks. */
export function openPrompter(o: PrompterOptions): void {
  let s = { ...o.settings };
  const root = h('div', { class: 'prompter', role: 'dialog', 'aria-label': `Teleprompter: ${o.title}` });
  root.dataset.theme = s.theme;
  const stage = h('div', { class: 'stage' });
  const progress = h('div', { class: 'tp-progress', role: 'progressbar', 'aria-label': 'Progress', 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i'));
  const count = h('div', { class: 'tp-count', 'aria-live': 'assertive' });
  const times = h('span', { class: 'tp-times' }, '0:00 · −0:00');
  const playBtn = h('button', { class: 'btn primary', type: 'button', 'aria-label': 'Play' }, ...ic('play', 'Play'));
  let tp: Teleprompter;

  const set = (patch: Partial<Settings>) => {
    s = { ...s, ...patch };
    tp.applySettings(s);
    root.dataset.theme = s.theme;
    o.onSettings(s);
    syncTweaks();
  };

  const slider = (label: string, key: 'speed' | 'fontSize' | 'lineHeight' | 'textWidth' | 'camOpacity', min: number, max: number, step: number) => {
    const out = h('output', {}, String(s[key]));
    const input = h('input', {
      type: 'range', min: String(min), max: String(max), step: String(step), value: String(s[key]), 'aria-label': label,
      on: { input: (e) => set({ [key]: parseFloat((e.target as HTMLInputElement).value) } as Partial<Settings>) },
    });
    return { row: h('label', { class: 'tweak' }, h('span', {}, label), input, out), input, out, key };
  };
  const sliders = [
    slider('Speed (wpm)', 'speed', 40, 300, 5),
    slider('Font size', 'fontSize', 24, 160, 2),
    slider('Line spacing', 'lineHeight', 1, 2.4, 0.05),
    slider('Text width', 'textWidth', 40, 100, 2),
    slider('Camera dim', 'camOpacity', 0.1, 0.9, 0.05),
  ];
  const syncTweaks = () => sliders.forEach((t) => { t.input.value = String(s[t.key]); t.out.textContent = String(Math.round(s[t.key] * 100) / 100); });

  const mirrorBtn = h('button', { class: 'btn', type: 'button', 'aria-pressed': String(s.mirror), on: { click: () => { set({ mirror: !s.mirror }); mirrorBtn.setAttribute('aria-pressed', String(s.mirror)); } } }, ...ic('mirror', 'Mirror'));
  const themeBtn = h('button', { class: 'btn', type: 'button', on: { click: () => set({ theme: s.theme === 'dark' ? 'light' : 'dark' }) } }, ...ic('contrast', 'Theme'));
  const fsBtn = h('button', { class: 'btn', type: 'button', on: { click: () => toggleFs() } }, ...ic('maximize', 'Full screen'));
  const tweaks = h('div', { class: 'tweaks', hidden: true, id: 'tweaks' }, ...sliders.map((t) => t.row), h('div', { class: 'tweak-btns' }, mirrorBtn, themeBtn, fsBtn));
  const tweakToggle = h('button', { class: 'btn', type: 'button', 'aria-controls': 'tweaks', 'aria-expanded': 'false', 'aria-label': 'Display settings', on: { click: () => {
    tweaks.hidden = !tweaks.hidden;
    tweakToggle.setAttribute('aria-expanded', String(!tweaks.hidden));
  } } }, ...ic('type', 'Aa'));

  const exit = () => {
    exited = true;
    window.removeEventListener('beforeunload', warnUnload);
    void releaseWake();
    document.removeEventListener('keydown', onKey, true);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    void stopRecording().finally(() => { rec.close(); clearInterval(badgeTimer); });
    tp.destroy();
    root.remove();
    o.onExit();
  };
  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void root.requestFullscreen?.().catch(() => undefined);
  };

  /* ---------- audio / selfie-video recording ---------- */
  const rec = new Recorder();
  const camVideo = h('video', { class: 'cam-bg', playsInline: true, autoplay: true, hidden: true, 'aria-hidden': 'true' });
  camVideo.muted = true;
  const badge = h('div', { class: 'rec-badge', hidden: true, 'aria-live': 'polite' });
  const recBtn = h('button', { class: 'btn', type: 'button', on: { click: () => void cycleMode() } });
  const flipBtn = h('button', { class: 'btn', type: 'button', 'aria-label': 'Switch camera', on: { click: () => void flipCamera() } }, ...ic('flip', 'Flip'));
  const stopBtn = h('button', { class: 'btn danger-solid', type: 'button', hidden: true, on: { click: () => { tp.pause(); void stopRecording(); } } }, ...ic('stop', 'Stop rec'));
  let armed = false;
  let takeActive = false;
  let exited = false;
  let busy = false;
  let badgeTimer = 0;
  const MODE_LABEL: Record<RecordMode, [Parameters<typeof icon>[0], string]> = { off: ['rec', 'Rec: Off'], video: ['video', 'Video'], audio: ['mic', 'Audio'] };

  function updateBadge() {
    if (rec.recording) { badge.hidden = false; badge.classList.add('live'); badge.textContent = `REC ${formatTime(rec.seconds)}`; }
    else if (armed) { badge.hidden = false; badge.classList.remove('live'); badge.textContent = s.recordMode === 'video' ? 'Camera ready' : 'Mic ready'; }
    else badge.hidden = true;
  }
  function syncRecUi() {
    setBtn(recBtn, MODE_LABEL[s.recordMode][0], MODE_LABEL[s.recordMode][1]);
    recBtn.setAttribute('aria-label', `Recording mode: ${s.recordMode}. Activate to change.`);
    recBtn.disabled = rec.recording;
    flipBtn.hidden = s.recordMode !== 'video';
    flipBtn.disabled = rec.recording;
    stopBtn.hidden = !rec.recording;
    camVideo.classList.toggle('front', s.facing === 'user');
    root.style.setProperty('--cam-opacity', String(s.camOpacity));
    root.classList.toggle('has-cam', s.recordMode === 'video' && armed);
    updateBadge();
  }
  function disarm() {
    rec.close();
    armed = false;
    camVideo.srcObject = null;
    camVideo.hidden = true;
    syncRecUi();
  }
  /** Ask for camera/mic permission and show the live preview. */
  async function arm(): Promise<boolean> {
    if (s.recordMode === 'off') { disarm(); return true; }
    try {
      const stream = await rec.open(s.recordMode, s.facing);
      armed = true;
      if (s.recordMode === 'video') {
        camVideo.srcObject = stream;
        camVideo.hidden = false;
        await camVideo.play().catch(() => undefined);
      } else { camVideo.srcObject = null; camVideo.hidden = true; }
      syncRecUi();
      return true;
    } catch (e) {
      disarm();
      toast(describeMediaError(e));
      return false;
    }
  }
  async function cycleMode() {
    if (busy || rec.recording) return;
    busy = true;
    const order: RecordMode[] = ['off', 'video', 'audio'];
    set({ recordMode: order[(order.indexOf(s.recordMode) + 1) % 3] });
    await arm();
    busy = false;
  }
  async function flipCamera() {
    if (busy || rec.recording) return;
    busy = true;
    set({ facing: s.facing === 'user' ? 'environment' : 'user' });
    await arm();
    busy = false;
  }
  function beginTake() {
    if (!takeActive || rec.recording || !armed) return;
    try {
      rec.start();
      clearInterval(badgeTimer);
      badgeTimer = window.setInterval(updateBadge, 500);
      syncRecUi();
    } catch (e) { takeActive = false; toast(describeMediaError(e)); }
  }
  async function stopRecording() {
    takeActive = false;
    if (!rec.recording) return;
    clearInterval(badgeTimer);
    const r = await rec.stop();
    syncRecUi();
    if (!r) return toast('Nothing was recorded');
    if (r.seconds < 3) { URL.revokeObjectURL(r.url); return toast('Take discarded (shorter than 3 seconds)'); }
    showRecordingResult(r, o.title, exited ? undefined : () => { tp.reset(); void act(); });
  }
  /** Play/pause; the first play of a take opens the devices, then starts recording when scrolling begins. */
  async function act() {
    if (busy) return;
    busy = true;
    try {
      if (tp.state === 'finished') tp.reset();
      if (tp.state === 'idle') {
        if (s.recordMode !== 'off' && !armed && !(await arm())) return;
        takeActive = s.recordMode !== 'off';
        tp.play();
      } else tp.toggle();
    } finally { busy = false; }
  }

  const labels: Record<PrompterState, [Parameters<typeof icon>[0], string]> = { idle: ['play', 'Play'], countdown: ['x', 'Cancel'], playing: ['pause', 'Pause'], holding: ['pause', 'Pause'], paused: ['play', 'Resume'], finished: ['reset', 'Restart'] };
  tp = new Teleprompter(stage, s, {
    onState: (st) => {
      setBtn(playBtn, labels[st][0], labels[st][1]);
      playBtn.setAttribute('aria-label', labels[st][1]);
      root.dataset.state = st;
      if (st === 'playing') scheduleHide(); else showControls();
      if (st !== 'countdown') count.textContent = '';
      if (st === 'playing') beginTake();
      if (st === 'finished' && rec.recording) window.setTimeout(() => { if (tp.state === 'finished') void stopRecording(); }, 1200);
      if (st === 'idle' && rec.recording) void stopRecording();
    },
    onCountdown: (n) => {
      count.textContent = n > 0 ? String(n) : '';
      count.classList.remove('pop');
      void count.offsetWidth; // retrigger the pop animation each second
      if (n > 0) count.classList.add('pop');
    },
    onProgress: ({ progress: p, elapsed, remaining }) => {
      (progress.firstElementChild as HTMLElement).style.transform = `scaleX(${p})`;
      const pc = String(Math.round(p * 100));
      if (progress.getAttribute('aria-valuenow') !== pc) progress.setAttribute('aria-valuenow', pc);
      times.textContent = `${formatTime(elapsed)} elapsed · ${formatTime(remaining)} left`;
    },
  });
  tp.load(o.items);

  let hideTimer = 0;
  const showControls = () => { root.classList.remove('idle-ui'); clearTimeout(hideTimer); };
  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => { if (tweaks.hidden && tp.state === 'playing') root.classList.add('idle-ui'); }, 3000);
  };
  const activity = () => { showControls(); if (tp.state === 'playing') scheduleHide(); };

  playBtn.addEventListener('click', () => void act());
  const resetBtn = h('button', { class: 'btn', type: 'button', on: { click: () => tp.reset() } }, ...ic('reset', 'Reset'));
  const exitBtn = h('button', { class: 'btn', type: 'button', on: { click: exit } }, ...ic('x', 'Exit'));
  stage.addEventListener('click', () => void act());
  root.addEventListener('pointermove', activity);
  root.addEventListener('pointerdown', activity);

  const lineStep = () => s.fontSize * s.lineHeight;
  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' && (e.key === ' ' || e.key.startsWith('Arrow'))) return; // let sliders work
    const k = e.key;
    let handled = true;
    if (k === ' ' || k === 'k') void act();
    else if (k === 'Escape') { if (!document.fullscreenElement) exit(); }
    else if (k === 'r' || k === 'R') tp.reset();
    else if (k === 'ArrowUp' || k === '+' || k === '=') set({ speed: Math.min(300, s.speed + 10) });
    else if (k === 'ArrowDown' || k === '-' || k === '_') set({ speed: Math.max(40, s.speed - 10) });
    else if (k === 'ArrowLeft' || k === 'PageUp') tp.nudge(-lineStep() * (k === 'PageUp' ? 4 : 1));
    else if (k === 'ArrowRight' || k === 'PageDown') tp.nudge(lineStep() * (k === 'PageDown' ? 4 : 1));
    else if (k === '[') set({ fontSize: Math.max(24, s.fontSize - 4) });
    else if (k === ']') set({ fontSize: Math.min(160, s.fontSize + 4) });
    else if (k === 'm' || k === 'M') { set({ mirror: !s.mirror }); mirrorBtn.setAttribute('aria-pressed', String(s.mirror)); }
    else if (k === 'f' || k === 'F') toggleFs();
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); activity(); }
  }
  document.addEventListener('keydown', onKey, true);

  const help = h('p', { class: 'tp-help' }, 'Space play/pause · ↑↓ speed · ←→ nudge · [ ] font · M mirror · F full screen · R reset · Esc exit');
  const bar = h('div', { class: 'tp-bar' },
    h('div', { class: 'tp-group' }, exitBtn, resetBtn, playBtn),
    h('div', { class: 'tp-group' }, recBtn, flipBtn, stopBtn, tweakToggle),
    times);
  root.append(camVideo, progress, stage, count, badge, tweaks, bar, help);
  document.body.append(root);
  // keep the screen awake while prompting, and warn before losing a take
  let wake: { release(): Promise<void> } | null = null;
  const requestWake = async () => { try { wake = (await (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen')) ?? null; } catch { /* unsupported */ } };
  async function releaseWake() { try { await wake?.release(); } catch { /* ignore */ } wake = null; document.removeEventListener('visibilitychange', onVis); }
  const onVis = () => { if (document.visibilityState === 'visible' && !exited) void requestWake(); };
  const warnUnload = (e: BeforeUnloadEvent) => { if (rec.recording) { e.preventDefault(); e.returnValue = ''; } };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('beforeunload', warnUnload);
  void requestWake();

  syncRecUi();
  tp.measure();
  playBtn.focus();
  if (s.recordMode !== 'off') void arm(); // preview appears straight away (needs a permission tap on first use)
}
