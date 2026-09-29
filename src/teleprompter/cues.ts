import { CUE_META } from '../core/cueMeta';
import type { Cue } from '../core/types';
import type { CuePosition, Settings } from '../core/storage';

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

export interface CueGeometry {
  /** y of the reading line inside the stage (px). */
  readY: number;
  /** Room the current line may take ABOVE the reading line (it can sit up to a line-pitch higher). */
  above: number;
  /** Room the current line may take BELOW the reading line. */
  below: number;
  vh: number;
  /** Stage width, so the longest label ("↑ MORE ENERGY") fits on one line. */
  vw?: number;
}
export interface CuePlan { edge: 'top' | 'bottom'; size: number; max: number }

const GAP = 12, K = 1.75, CHIP_PAD = 4, TOP_PAD = 16, BOT_PAD = 8, MIN_SIZE = 12, STACK_GAP = 6;

/**
 * Pure layout rule: choose the edge, font size and stack depth so cues can never reach
 * the line being read. Falls back to the roomier edge, then shrinks the chip.
 */
export function planCues(g: CueGeometry, prefer: 'top' | 'bottom', size: number): CuePlan {
  const top = g.readY - g.above - GAP - TOP_PAD;
  const bottom = g.vh - g.readY - g.below - GAP - BOT_PAD;
  const minH = MIN_SIZE * K + CHIP_PAD;
  let edge = prefer;
  let avail = prefer === 'top' ? top : bottom;
  const other = prefer === 'top' ? bottom : top;
  if (avail < minH && other > avail) { edge = prefer === 'top' ? 'bottom' : 'top'; avail = other; }
  const fit = Math.max(MIN_SIZE, Math.floor((avail - CHIP_PAD) / K));
  const byWidth = g.vw ? Math.max(MIN_SIZE, Math.floor((g.vw - 32) / 10.8)) : size;
  const s = Math.min(size, fit, byWidth);
  const h = s * K + CHIP_PAD;
  const max = Math.min(3, Math.max(1, Math.floor((avail + STACK_GAP) / (h + STACK_GAP))));
  return { edge, size: s, max };
}

/**
 * Small peripheral-vision overlay pinned to a screen edge. It lives at the
 * top/bottom margin, never over the reading line.
 */
export class CueOverlay {
  private chips = new Set<HTMLElement>();
  private geo: CueGeometry | null = null;
  private cfg: Settings | null = null;
  private max = 3;
  private lastKey = '';
  constructor(private host: HTMLElement) {
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
  }

  apply(s: Settings): void {
    this.cfg = s;
    this.host.style.setProperty('--cue-opacity', String(s.cueOpacity));
    this.layout();
  }

  setGeometry(g: CueGeometry): void {
    this.geo = g;
    this.layout();
  }

  private layout(): void {
    const s = this.cfg;
    if (!s) return;
    const [v, h] = s.cuePosition.split('-') as ['top' | 'bottom', string];
    const plan = this.geo ? planCues(this.geo, v, s.cueSize) : { edge: v, size: s.cueSize, max: 3 };
    const key = `${plan.edge}|${h}|${plan.size}|${plan.max}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.max = plan.max;
    this.host.dataset.v = plan.edge;
    this.host.dataset.h = h;
    this.host.style.setProperty('--cue-size', `${plan.size}px`);
    while (this.chips.size > this.max) this.drop(this.chips.values().next().value as HTMLElement);
  }

  /** Show a transient chip. Returns a handle so a pause can keep it until done. */
  show(cue: Cue, s: Settings, sticky = false): { update(text: string): void; remove(): void } {
    const el = document.createElement('div');
    el.className = `cue-chip cue-${cue.kind}`;
    el.textContent = cueLabel(cue, s);
    this.host.appendChild(el);
    this.chips.add(el);
    while (this.chips.size > this.max) this.drop(this.chips.values().next().value as HTMLElement);
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
