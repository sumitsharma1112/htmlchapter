import { CUE_META } from '../core/cueMeta';
import type { Cue } from '../core/types';
import type { Settings } from '../core/storage';

/** Text shown for a cue (pure — unit testable). */
export function cueLabel(cue: Cue, s: Pick<Settings, 'cueIcons' | 'cueText'>): string {
  const m = CUE_META[cue.kind];
  const parts: string[] = [];
  if (s.cueIcons) parts.push(m.icon);
  if (s.cueText || !s.cueIcons) {
    parts.push(cue.kind === 'pause' && cue.seconds !== undefined ? `PAUSE ${cue.seconds}s` : m.label);
  }
  return parts.join(' ');
}

/**
 * Small peripheral-vision overlay pinned to a screen edge. It lives at the
 * top/bottom margin, never over the reading line.
 */
export class CueOverlay {
  private chips = new Set<HTMLElement>();
  constructor(private host: HTMLElement) {
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
  }

  apply(s: Settings): void {
    const [v, h] = s.cuePosition.split('-');
    this.host.dataset.v = v;
    this.host.dataset.h = h;
    this.host.style.setProperty('--cue-size', `${s.cueSize}px`);
    this.host.style.setProperty('--cue-opacity', String(s.cueOpacity));
  }

  /** Show a transient chip. Returns a handle so a pause can keep it until done. */
  show(cue: Cue, s: Settings, sticky = false): { update(text: string): void; remove(): void } {
    const el = document.createElement('div');
    el.className = `cue-chip cue-${cue.kind}`;
    el.textContent = cueLabel(cue, s);
    this.host.appendChild(el);
    this.chips.add(el);
    while (this.chips.size > 3) this.drop(this.chips.values().next().value as HTMLElement);
    requestAnimationFrame(() => el.classList.add('in'));
    let timer = 0;
    if (!sticky) timer = window.setTimeout(() => this.drop(el), s.cueDuration * 1000);
    return {
      update: (t) => { el.textContent = t; },
      remove: () => { window.clearTimeout(timer); this.drop(el); },
    };
  }

  private drop(el: HTMLElement): void {
    if (!this.chips.delete(el)) return;
    el.classList.remove('in');
    el.classList.add('out');
    window.setTimeout(() => el.remove(), 250);
  }

  clear(): void {
    [...this.chips].forEach((c) => c.remove());
    this.chips.clear();
  }
}
