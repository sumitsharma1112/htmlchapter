import type { ScriptItem } from '../core/types';
import type { Settings } from '../core/storage';
import { formatTime } from '../core/parser';
import { Teleprompter } from '../teleprompter/engine';
import type { PrompterState } from '../teleprompter/engine';
import { h } from './dom';

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
  const playBtn = h('button', { class: 'btn primary', type: 'button', 'aria-label': 'Play' }, '▶ Play');
  let tp: Teleprompter;

  const set = (patch: Partial<Settings>) => {
    s = { ...s, ...patch };
    tp.applySettings(s);
    root.dataset.theme = s.theme;
    o.onSettings(s);
    syncTweaks();
  };

  const slider = (label: string, key: 'speed' | 'fontSize' | 'lineHeight' | 'textWidth', min: number, max: number, step: number) => {
    const out = h('output', {}, String(s[key]));
    const input = h('input', {
      type: 'range', min: String(min), max: String(max), step: String(step), value: String(s[key]), 'aria-label': label,
      on: { input: (e) => set({ [key]: parseFloat((e.target as HTMLInputElement).value) } as Partial<Settings>) },
    });
    return { row: h('label', { class: 'tweak' }, h('span', {}, label), input, out), input, out, key };
  };
  const sliders = [
    slider('Speed', 'speed', 1, 20, 0.5),
    slider('Font size', 'fontSize', 24, 160, 2),
    slider('Line spacing', 'lineHeight', 1, 2.4, 0.05),
    slider('Text width', 'textWidth', 40, 100, 2),
  ];
  const syncTweaks = () => sliders.forEach((t) => { t.input.value = String(s[t.key]); t.out.textContent = String(Math.round(s[t.key] * 100) / 100); });

  const mirrorBtn = h('button', { class: 'btn', type: 'button', 'aria-pressed': String(s.mirror), on: { click: () => { set({ mirror: !s.mirror }); mirrorBtn.setAttribute('aria-pressed', String(s.mirror)); } } }, '⇋ Mirror');
  const themeBtn = h('button', { class: 'btn', type: 'button', on: { click: () => set({ theme: s.theme === 'dark' ? 'light' : 'dark' }) } }, '◐ Theme');
  const fsBtn = h('button', { class: 'btn', type: 'button', on: { click: () => toggleFs() } }, '⛶ Full screen');
  const tweaks = h('div', { class: 'tweaks', hidden: true, id: 'tweaks' }, ...sliders.map((t) => t.row), h('div', { class: 'tweak-btns' }, mirrorBtn, themeBtn, fsBtn));
  const tweakToggle = h('button', { class: 'btn', type: 'button', 'aria-controls': 'tweaks', 'aria-expanded': 'false', 'aria-label': 'Display settings', on: { click: () => {
    tweaks.hidden = !tweaks.hidden;
    tweakToggle.setAttribute('aria-expanded', String(!tweaks.hidden));
  } } }, 'Aa');

  const exit = () => {
    document.removeEventListener('keydown', onKey, true);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    tp.destroy();
    root.remove();
    o.onExit();
  };
  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void root.requestFullscreen?.().catch(() => undefined);
  };

  const labels: Record<PrompterState, string> = { idle: '▶ Play', countdown: '✕ Cancel', playing: '❚❚ Pause', holding: '❚❚ Pause', paused: '▶ Resume', finished: '↺ Restart' };
  tp = new Teleprompter(stage, s, {
    onState: (st) => {
      playBtn.textContent = labels[st];
      playBtn.setAttribute('aria-label', labels[st].slice(2));
      root.dataset.state = st;
      if (st === 'playing') scheduleHide(); else showControls();
      if (st !== 'countdown') count.textContent = '';
    },
    onCountdown: (n) => { count.textContent = n > 0 ? String(n) : ''; },
    onProgress: ({ progress: p, elapsed, remaining }) => {
      (progress.firstElementChild as HTMLElement).style.transform = `scaleX(${p})`;
      progress.setAttribute('aria-valuenow', String(Math.round(p * 100)));
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

  playBtn.addEventListener('click', () => (tp.state === 'finished' ? (tp.reset(), tp.play()) : tp.toggle()));
  const resetBtn = h('button', { class: 'btn', type: 'button', on: { click: () => tp.reset() } }, '↺ Reset');
  const exitBtn = h('button', { class: 'btn', type: 'button', on: { click: exit } }, '✕ Exit');
  stage.addEventListener('click', () => { tp.state === 'finished' ? tp.reset() : tp.toggle(); });
  root.addEventListener('pointermove', activity);
  root.addEventListener('pointerdown', activity);

  const lineStep = () => s.fontSize * s.lineHeight;
  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' && (e.key === ' ' || e.key.startsWith('Arrow'))) return; // let sliders work
    const k = e.key;
    let handled = true;
    if (k === ' ' || k === 'k') tp.state === 'finished' ? tp.reset() : tp.toggle();
    else if (k === 'Escape') { if (!document.fullscreenElement) exit(); }
    else if (k === 'r' || k === 'R') tp.reset();
    else if (k === 'ArrowUp' || k === '+' || k === '=') set({ speed: Math.min(20, s.speed + 0.5) });
    else if (k === 'ArrowDown' || k === '-' || k === '_') set({ speed: Math.max(1, s.speed - 0.5) });
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
  const bar = h('div', { class: 'tp-bar' }, exitBtn, resetBtn, playBtn, tweakToggle, times);
  root.append(progress, stage, count, tweaks, bar, help);
  document.body.append(root);
  tp.measure();
  playBtn.focus();
}
