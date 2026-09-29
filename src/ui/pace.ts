import { h } from './dom';
import { icon } from './icons';

export const PACE_MIN = 40;
export const PACE_MAX = 300;

/** Plain-language name for a words-per-minute value. */
export function paceLabel(wpm: number): string {
  if (wpm < 90) return 'Very slow';
  if (wpm < 120) return 'Slow';
  if (wpm < 160) return 'Natural';
  if (wpm < 200) return 'Brisk';
  return 'Fast';
}

const pct = (v: number) => ((v - PACE_MIN) / (PACE_MAX - PACE_MIN)) * 100;

/** Tortoise ⇄ rabbit speed bar. Tap either animal to nudge; the readout gives wpm and a plain-language name. */
export function paceControl(value: number, onInput: (v: number) => void, extra?: HTMLElement): { el: HTMLElement; set(v: number): void } {
  const read = h('output', { class: 'pace-read', 'aria-live': 'off' });
  const range = h('input', { class: 'pace-range', type: 'range', min: String(PACE_MIN), max: String(PACE_MAX), step: '5', 'aria-label': 'Scroll speed, words per minute' });
  const slow = h('button', { class: 'pace-end', type: 'button', 'aria-label': 'Slower', title: 'Slower', on: { click: () => bump(-10) } }, icon('tortoise', 26));
  const fast = h('button', { class: 'pace-end', type: 'button', 'aria-label': 'Faster', title: 'Faster', on: { click: () => bump(10) } }, icon('rabbit', 26));
  const ticks = h('div', { class: 'pace-ticks', 'aria-hidden': 'true' }, ...[90, 120, 160, 200].map((t) => { const i = h('i'); i.style.left = `${pct(t)}%`; return i; }));

  const paint = (v: number) => {
    range.value = String(v);
    range.style.setProperty('--fill', `${pct(v)}%`);
    read.textContent = `${Math.round(v)} wpm · ${paceLabel(v)}`;
    range.setAttribute('aria-valuetext', `${Math.round(v)} words per minute, ${paceLabel(v)}`);
    slow.classList.toggle('on', pct(v) < 33);
    fast.classList.toggle('on', pct(v) > 67);
  };
  const bump = (d: number) => { const v = Math.min(PACE_MAX, Math.max(PACE_MIN, parseFloat(range.value) + d)); paint(v); onInput(v); };
  range.addEventListener('input', () => { const v = parseFloat(range.value); paint(v); onInput(v); });
  paint(value);

  const el = h('div', { class: 'pace' }, slow, h('div', { class: 'pace-track' }, range, ticks), fast, read, extra);
  return { el, set: paint };
}
