import type { PauseDefaults } from './types';
import { DEFAULT_PAUSES } from './types';

/** Minimal Storage surface so the store can be unit-tested without a DOM. */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StoredScript {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
}

const SCRIPTS_KEY = 'reelprompt.scripts.v1';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class ScriptStore {
  constructor(private kv: KV) {}

  list(): StoredScript[] {
    try {
      const raw = this.kv.getItem(SCRIPTS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return (arr as StoredScript[])
        .filter((s) => s && typeof s.id === 'string' && typeof s.content === 'string')
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  private write(all: StoredScript[]): void {
    try {
      this.kv.setItem(SCRIPTS_KEY, JSON.stringify(all));
    } catch {
      /* storage full / blocked — in-memory state still works for this session */
    }
  }

  get(id: string): StoredScript | undefined {
    return this.list().find((s) => s.id === id);
  }

  create(name: string, content = ''): StoredScript {
    const s: StoredScript = { id: uid(), name: name.trim() || 'Untitled script', content, updatedAt: Date.now() };
    this.write([s, ...this.list()]);
    return s;
  }

  update(id: string, patch: Partial<Pick<StoredScript, 'name' | 'content'>>): StoredScript | undefined {
    const all = this.list();
    const s = all.find((x) => x.id === id);
    if (!s) return undefined;
    if (patch.name !== undefined) s.name = patch.name.trim() || 'Untitled script';
    if (patch.content !== undefined) s.content = patch.content;
    s.updatedAt = Date.now();
    this.write(all);
    return s;
  }

  rename(id: string, name: string) {
    return this.update(id, { name });
  }

  duplicate(id: string): StoredScript | undefined {
    const s = this.get(id);
    return s ? this.create(`${s.name} (copy)`, s.content) : undefined;
  }

  remove(id: string): void {
    this.write(this.list().filter((s) => s.id !== id));
  }
}

/* ---------------- Settings ---------------- */

export type CuePosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface Settings extends PauseDefaults {
  fontSize: number; // px
  lineHeight: number;
  textWidth: number; // % of viewport
  speed: number; // 1-20
  mirror: boolean;
  theme: 'dark' | 'light';
  countdown: number; // seconds
  cuesAdjustSpeed: boolean;
  cuePosition: CuePosition;
  cueSize: number; // px
  cueOpacity: number; // 0.3-1
  cueDuration: number; // seconds
  cueIcons: boolean;
  cueText: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_PAUSES,
  fontSize: 56,
  lineHeight: 1.45,
  textWidth: 86,
  speed: 8,
  mirror: false,
  theme: 'dark',
  countdown: 3,
  cuesAdjustSpeed: true,
  cuePosition: 'top-center',
  cueSize: 22,
  cueOpacity: 0.9,
  cueDuration: 2.5,
  cueIcons: true,
  cueText: true,
};

const SETTINGS_KEY = 'reelprompt.settings.v1';
const PROMPT_KEY = 'reelprompt.prompt.v1';
const CURRENT_KEY = 'reelprompt.current.v1';

const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

export function sanitizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const r = raw ?? {};
  const d = DEFAULT_SETTINGS;
  const positions: CuePosition[] = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
  return {
    pause: num(r.pause, 0, 60, d.pause),
    longPause: num(r.longPause, 0, 60, d.longPause),
    fontSize: num(r.fontSize, 20, 200, d.fontSize),
    lineHeight: num(r.lineHeight, 1, 2.6, d.lineHeight),
    textWidth: num(r.textWidth, 30, 100, d.textWidth),
    speed: num(r.speed, 1, 20, d.speed),
    mirror: typeof r.mirror === 'boolean' ? r.mirror : d.mirror,
    theme: r.theme === 'light' ? 'light' : 'dark',
    countdown: num(r.countdown, 0, 10, d.countdown),
    cuesAdjustSpeed: typeof r.cuesAdjustSpeed === 'boolean' ? r.cuesAdjustSpeed : d.cuesAdjustSpeed,
    cuePosition: positions.includes(r.cuePosition as CuePosition) ? (r.cuePosition as CuePosition) : d.cuePosition,
    cueSize: num(r.cueSize, 12, 44, d.cueSize),
    cueOpacity: num(r.cueOpacity, 0.3, 1, d.cueOpacity),
    cueDuration: num(r.cueDuration, 0.5, 10, d.cueDuration),
    cueIcons: typeof r.cueIcons === 'boolean' ? r.cueIcons : d.cueIcons,
    cueText: typeof r.cueText === 'boolean' ? r.cueText : d.cueText,
  };
}

function readJSON<T>(kv: KV, key: string): T | null {
  try {
    const raw = kv.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeStr(kv: KV, key: string, v: string) {
  try { kv.setItem(key, v); } catch { /* ignore */ }
}

export const loadSettings = (kv: KV) => sanitizeSettings(readJSON<Settings>(kv, SETTINGS_KEY));
export const saveSettings = (kv: KV, s: Settings) => writeStr(kv, SETTINGS_KEY, JSON.stringify(s));

export function loadPrompt(kv: KV, fallback: string): string {
  try { return kv.getItem(PROMPT_KEY) ?? fallback; } catch { return fallback; }
}
export const savePrompt = (kv: KV, p: string) => writeStr(kv, PROMPT_KEY, p);

export function loadCurrentId(kv: KV): string | null {
  try { return kv.getItem(CURRENT_KEY); } catch { return null; }
}
export const saveCurrentId = (kv: KV, id: string) => writeStr(kv, CURRENT_KEY, id);
