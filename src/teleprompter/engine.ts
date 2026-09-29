import type { Cue, ScriptItem } from '../core/types';
import type { Settings } from '../core/storage';
import { CueOverlay, cueLabel } from './cues';

export type PrompterState = 'idle' | 'countdown' | 'playing' | 'holding' | 'paused' | 'finished';

export interface EngineEvents {
  onState(state: PrompterState): void;
  onCountdown(n: number): void;
  onProgress(p: { progress: number; elapsed: number; remaining: number }): void;
}

interface Anchor { cue: Cue; y: number; fired: boolean }

const READ_LINE = 0.36; // fraction of viewport height where the spoken line sits
const SPEED_MULT: Partial<Record<Cue['kind'], number>> = { faster: 1.3, slower: 0.7, energy_up: 1.12, calm: 0.9 };

/**
 * Smooth scrolling teleprompter. Renders items into `stage`, animates with
 * requestAnimationFrame and fires cues as their anchors cross the reading line.
 */
export class Teleprompter {
  state: PrompterState = 'idle';
  private viewport: HTMLElement;
  private content: HTMLElement;
  private lineEls: HTMLElement[] = [];
  private lineTops: number[] = [];
  private anchors: Anchor[] = [];
  private y = 0;
  private maxY = 1;
  private vh = 0;
  private lastSec = -1;
  private lastPct = -1;
  private mult = 1;
  private elapsed = 0;
  private holdLeft = 0;
  private holdHandle: { update(t: string): void; remove(): void } | null = null;
  private raf = 0;
  private last = 0;
  private countdownTimer = 0;
  private activeIdx = -1;
  private overlay: CueOverlay;
  private ro: ResizeObserver;
  private reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(private stage: HTMLElement, private settings: Settings, private ev: EngineEvents) {
    stage.classList.add('tp-stage');
    this.viewport = document.createElement('div');
    this.viewport.className = 'tp-viewport';
    this.content = document.createElement('div');
    this.content.className = 'tp-content';
    this.viewport.appendChild(this.content);
    const cueHost = document.createElement('div');
    cueHost.className = 'cue-host';
    const line = document.createElement('div');
    line.className = 'tp-readline';
    line.setAttribute('aria-hidden', 'true');
    stage.append(this.viewport, line, cueHost);
    this.overlay = new CueOverlay(cueHost);
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this.viewport);
    this.applySettings(settings);
  }

  load(items: ScriptItem[]): void {
    this.content.textContent = '';
    this.lineEls = [];
    this.anchors = [];
    const frag = document.createDocumentFragment();
    const anchorEls: { el: HTMLElement; cue: Cue }[] = [];
    for (const it of items) {
      if (it.type === 'line') {
        const p = document.createElement('p');
        p.className = 'tp-line';
        p.textContent = it.text;
        this.lineEls.push(p);
        frag.appendChild(p);
      } else if (it.type === 'blank') {
        const g = document.createElement('div');
        g.className = 'tp-gap';
        frag.appendChild(g);
      } else {
        const a = document.createElement('span');
        a.className = 'tp-anchor';
        a.setAttribute('aria-hidden', 'true');
        anchorEls.push({ el: a, cue: it.cue });
        frag.appendChild(a);
      }
    }
    this.content.appendChild(frag);
    this.anchorEls = anchorEls;
    this.reset();
  }
  private anchorEls: { el: HTMLElement; cue: Cue }[] = [];

  applySettings(s: Settings): void {
    this.settings = s;
    const st = this.stage.style;
    st.setProperty('--tp-font', `${s.fontSize}px`);
    st.setProperty('--tp-lh', String(s.lineHeight));
    st.setProperty('--tp-width', `${s.textWidth}%`);
    st.setProperty('--tp-read', `${READ_LINE * 100}%`);
    this.stage.classList.toggle('mirror', s.mirror);
    this.overlay.apply(s);
    this.measure();
  }

  /** Recompute geometry (after resize / font changes). Keeps relative position. */
  measure(): void {
    const vh = this.viewport.clientHeight;
    if (!vh) return;
    this.vh = vh;
    const frac = this.maxY > 0 ? this.y / this.maxY : 0;
    const pad = vh * READ_LINE;
    this.content.style.paddingTop = `${pad}px`;
    this.content.style.paddingBottom = `${vh - pad}px`;
    this.lineTops = this.lineEls.map((e) => e.offsetTop + e.offsetHeight / 2);
    const prev = this.anchors;
    this.anchors = this.anchorEls.map((a, i) => ({ cue: a.cue, y: a.el.offsetTop - pad, fired: prev[i]?.fired ?? false }));
    const lastEl = this.lineEls[this.lineEls.length - 1];
    this.maxY = Math.max(1, lastEl ? lastEl.offsetTop + lastEl.offsetHeight - pad : 1);
    this.y = Math.min(this.maxY, frac * this.maxY);
    this.render();
  }

  /* -------- transport -------- */

  play(): void {
    if (this.state === 'playing' || this.state === 'holding' || this.state === 'countdown') return;
    if (this.state === 'finished') this.reset();
    if (this.y <= 0 && this.settings.countdown > 0 && this.elapsed === 0) return this.startCountdown();
    this.begin();
  }

  toggle(): void {
    if (this.state === 'playing' || this.state === 'holding') this.pause();
    else if (this.state === 'countdown') this.cancelCountdown();
    else this.play();
  }

  pause(): void {
    if (this.state !== 'playing' && this.state !== 'holding') return;
    cancelAnimationFrame(this.raf);
    this.setState('paused');
  }

  reset(): void {
    cancelAnimationFrame(this.raf);
    this.cancelCountdown(false);
    this.y = 0;
    this.elapsed = 0;
    this.lastSec = -1;
    this.mult = 1;
    this.holdLeft = 0;
    this.holdHandle?.remove();
    this.holdHandle = null;
    this.anchors.forEach((a) => (a.fired = false));
    this.overlay.clear();
    this.setState('idle');
    this.render();
  }

  /** Manual nudge (arrow keys / wheel). Re-arms cues that were skipped backwards. */
  nudge(px: number): void {
    this.y = Math.min(this.maxY, Math.max(0, this.y + px));
    this.anchors.forEach((a) => { if (a.y > this.y + 1) a.fired = false; else if (a.y < this.y - 1) a.fired = true; });
    this.render();
  }

  private startCountdown(): void {
    let n = this.settings.countdown;
    this.setState('countdown');
    this.ev.onCountdown(n);
    this.countdownTimer = window.setInterval(() => {
      n -= 1;
      this.ev.onCountdown(n);
      if (n <= 0) { this.cancelCountdown(false); this.begin(); }
    }, 1000);
  }
  private cancelCountdown(notify = true): void {
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = 0; }
    if (notify) { this.ev.onCountdown(0); this.setState('idle'); }
  }

  private begin(): void {
    this.setState(this.holdLeft > 0 ? 'holding' : 'playing');
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.elapsed += dt;
    if (this.holdLeft > 0) {
      this.holdLeft -= dt;
      this.holdHandle?.update(cueLabel({ kind: 'pause', seconds: Math.ceil(Math.max(0, this.holdLeft) * 10) / 10 }, this.settings));
      if (this.holdLeft <= 0) {
        this.holdLeft = 0;
        this.holdHandle?.remove();
        this.holdHandle = null;
        this.setState('playing');
      }
    } else {
      this.y = Math.min(this.maxY, this.y + this.pxPerSec() * this.mult * dt);
      this.fireCues();
    }
    this.render();
    if (this.y >= this.maxY - 0.5 && this.holdLeft <= 0) {
      this.y = this.maxY;
      this.setState('finished');
      this.render();
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  pxPerSec(): number {
    return this.settings.speed * this.settings.fontSize * 0.09;
  }

  private fireCues(): void {
    const lookahead = this.settings.fontSize * this.settings.lineHeight * 1.6;
    for (const a of this.anchors) {
      if (a.fired) continue;
      const isPause = a.cue.kind === 'pause';
      if (a.y > this.y + (isPause ? 0 : lookahead)) break;
      a.fired = true;
      if (isPause) {
        const secs = a.cue.seconds ?? this.settings.pause;
        if (secs > 0) {
          this.holdLeft = secs;
          this.holdHandle?.remove();
          this.holdHandle = this.overlay.show({ ...a.cue, seconds: secs }, this.settings, true);
          this.setState('holding');
        }
        break; // stop processing further cues until the pause ends
      }
      this.overlay.show(a.cue, this.settings);
      if (this.settings.cuesAdjustSpeed && SPEED_MULT[a.cue.kind]) this.mult = SPEED_MULT[a.cue.kind]!;
    }
  }

  /* -------- rendering -------- */

  private render(): void {
    const y = this.reduceMotion ? Math.round(this.y) : this.y;
    this.content.style.transform = `translate3d(0, ${-y}px, 0)`;
    // Current line = the one nearest the reading line.
    const target = this.y + this.vh * READ_LINE;
    let idx = 0;
    for (let i = 0; i < this.lineTops.length; i++) {
      if (this.lineTops[i] <= target + 4) idx = i; else break;
    }
    if (idx !== this.activeIdx) {
      this.lineEls[this.activeIdx]?.classList.remove('current');
      this.lineEls[idx]?.classList.add('current');
      this.activeIdx = idx;
    }
    // Only touch the DOM outside the scroll layer when something visible changed.
    const sec = Math.floor(this.elapsed);
    const pct = Math.round((this.y / this.maxY) * 1000);
    if (sec !== this.lastSec || pct !== this.lastPct) {
      this.lastSec = sec;
      this.lastPct = pct;
      this.ev.onProgress(this.progress());
    }
  }

  progress(): { progress: number; elapsed: number; remaining: number } {
    const progress = this.maxY > 0 ? this.y / this.maxY : 0;
    const pauses = this.anchors.reduce((t, a) => (!a.fired && a.cue.kind === 'pause' ? t + (a.cue.seconds ?? 0) : t), 0);
    const remaining = this.state === 'finished' ? 0 : (this.maxY - this.y) / (this.pxPerSec() * this.mult) + pauses + this.holdLeft;
    return { progress, elapsed: this.elapsed, remaining };
  }

  private setState(s: PrompterState): void {
    if (this.state === s) return;
    this.state = s;
    this.ev.onState(s);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.cancelCountdown(false);
    this.ro.disconnect();
    this.stage.textContent = '';
  }
}
