import { CUE_META } from './cueMeta';
import { DEFAULT_PAUSES } from './types';
import type { Cue, CueKind, ParsedScript, PauseDefaults, ScriptItem } from './types';

const MAX_PAUSE = 60;

/** Matches [BRACKET] and (paren) groups; the body is interpreted separately. */
const GROUP_RE = /\[\s*([^\][\n]{1,40}?)\s*\]|\(\s*([^()\n]{1,40}?)\s*\)/g;

interface Rule {
  re: RegExp;
  kind: CueKind;
  /** Only honoured inside [brackets] — too ambiguous as plain parenthetical prose. */
  bracketOnly?: boolean;
}

const RULES: Rule[] = [
  { re: /^(?:speak |be |a bit |a little )?louder(?: voice)?$/, kind: 'louder' },
  { re: /^(?:speak |be |a bit |a little )?(?:softer|quieter)$|^speak softly$|^softly$|^lower voice$/, kind: 'softer' },
  { re: /^lower$/, kind: 'softer', bracketOnly: true },
  { re: /^(?:speak |be )?faster$|^speed up$|^pick up (?:the )?pace$/, kind: 'faster' },
  { re: /^(?:speak |be )?slower$|^speak slowly$|^slowly$|^slow down$/, kind: 'slower' },
  { re: /^energy up$|^more energy$|^high energy$|^energetic$/, kind: 'energy_up' },
  { re: /^energy$/, kind: 'energy_up', bracketOnly: true },
  { re: /^calm(?:ly)?$|^calm down$/, kind: 'calm' },
  { re: /^whisper(?:ing)?$|^(?:speak )?in a whisper$/, kind: 'whisper' },
  { re: /^emphasi[sz]e(?: this)?$|^emphasis$/, kind: 'emphasize' },
];

const PAUSE_RE =
  /^(long )?pause(?: for)?(?: (\d+(?:\.\d+)?))?(?: ?(?:s|sec|secs|second|seconds))?$/;

function clampSeconds(n: number): number {
  return Math.min(MAX_PAUSE, Math.max(0, Math.round(n * 100) / 100));
}

/** Interpret the inside of a marker group. Returns null when it is not a known marker. */
export function interpretMarker(
  body: string,
  bracket: boolean,
  defaults: PauseDefaults = DEFAULT_PAUSES,
): Cue | null {
  const norm = body.toLowerCase().replace(/[_\-:]+/g, ' ').replace(/\s+/g, ' ').trim();
  const p = PAUSE_RE.exec(norm);
  if (p) {
    const long = !!p[1];
    if (p[2] !== undefined) {
      return { kind: 'pause', seconds: clampSeconds(parseFloat(p[2])), ...(long ? { long: true } : {}) };
    }
    return {
      kind: 'pause',
      seconds: long ? defaults.longPause : defaults.pause,
      implicit: true,
      ...(long ? { long: true } : {}),
    };
  }
  for (const r of RULES) {
    if (r.bracketOnly && !bracket) continue;
    if (r.re.test(norm)) return { kind: r.kind };
  }
  return null;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

export function parseScript(src: string, defaults: PauseDefaults = DEFAULT_PAUSES): ParsedScript {
  const items: ScriptItem[] = [];
  const unknown: string[] = [];

  const pushLine = (text: string) => {
    const t = text.trim();
    if (t) items.push({ type: 'line', text: t });
  };

  for (const rawLine of src.replace(/\r\n?/g, '\n').split('\n')) {
    if (rawLine.trim() === '') {
      items.push({ type: 'blank' });
      continue;
    }
    let last = 0;
    GROUP_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = GROUP_RE.exec(rawLine)) !== null) {
      const bracket = m[1] !== undefined;
      const cue = interpretMarker(bracket ? m[1] : m[2], bracket, defaults);
      if (!cue) {
        if (bracket) unknown.push(m[0]);
        continue; // leave as ordinary text
      }
      pushLine(rawLine.slice(last, m.index));
      items.push({ type: 'cue', cue });
      last = m.index + m[0].length;
    }
    pushLine(rawLine.slice(last));
  }

  // Tidy blanks: collapse runs, drop leading/trailing.
  const tidy: ScriptItem[] = [];
  for (const it of items) {
    if (it.type === 'blank') {
      const prev = tidy[tidy.length - 1];
      if (!prev || prev.type === 'blank') continue;
    }
    tidy.push(it);
  }
  while (tidy.length && tidy[tidy.length - 1].type === 'blank') tidy.pop();

  const spoken = tidy
    .filter((i) => i.type !== 'cue')
    .map((i) => (i.type === 'line' ? i.text : ''))
    .join('\n');

  return {
    items: tidy,
    spoken,
    wordCount: countWords(spoken),
    cueCount: tidy.filter((i) => i.type === 'cue').length,
    unknown,
  };
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Canonical marker text for a cue, e.g. [PAUSE:1.5]. */
export function cueToMarker(cue: Cue): string {
  if (cue.kind === 'pause') {
    const name = cue.long ? 'LONG_PAUSE' : 'PAUSE';
    return cue.implicit || cue.seconds === undefined ? `[${name}]` : `[${name}:${fmt(cue.seconds)}]`;
  }
  return `[${CUE_META[cue.kind].marker}]`;
}

export function serializeItems(items: ScriptItem[]): string {
  return items
    .map((i) => (i.type === 'line' ? i.text : i.type === 'cue' ? cueToMarker(i.cue) : ''))
    .join('\n');
}

/** Rewrite every recognised marker variant to its canonical form. */
export function normalizeScript(src: string, defaults: PauseDefaults = DEFAULT_PAUSES): string {
  return serializeItems(parseScript(src, defaults).items);
}

/** Script with every marker removed (spoken words only). */
export function cleanScript(src: string, defaults: PauseDefaults = DEFAULT_PAUSES): string {
  return parseScript(src, defaults).spoken;
}

/** Rough duration: words at `wpm` plus every pause. */
export function estimateDuration(p: ParsedScript, wpm = 150): number {
  let pauses = 0;
  for (const i of p.items) if (i.type === 'cue' && i.cue.kind === 'pause') pauses += i.cue.seconds ?? 0;
  return (p.wordCount / wpm) * 60 + pauses;
}

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
