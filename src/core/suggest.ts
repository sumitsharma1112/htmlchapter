import type { Cue, ScriptItem } from './types';

export interface Suggestion {
  id: string;
  /** Insert the cue before items[index] (index === items.length appends). */
  index: number;
  cue: Cue;
  reason: string;
}

const SOFT_WORDS = /\b(whisper|secret|softly|quietly|dheemi|dheere|shaant)\b/i;
const SLOW_WORDS = /\b(slowly|dhire|ruk\s?jaa|stop|silence)\b/i;

const isLine = (i: ScriptItem | undefined): i is Extract<ScriptItem, { type: 'line' }> => i?.type === 'line';

/**
 * Local, offline heuristics that propose performance cues for a plain script.
 * Suggestions are only proposals — the user accepts each one.
 */
export function suggestCues(items: ScriptItem[]): Suggestion[] {
  const out: Suggestion[] = [];
  let sinceLast = 99;
  const taken = (idx: number) => items[idx - 1]?.type === 'cue' || items[idx]?.type === 'cue';

  items.forEach((it, idx) => {
    if (it.type === 'cue') { sinceLast = 0; return; }
    if (!isLine(it)) return;
    sinceLast++;
    const text = it.text;
    const after = idx + 1; // insert position after this line
    const next = items[after];

    // A question deserves a beat.
    if (/[?]["”’)]*$/.test(text) && !taken(after) && sinceLast >= 2) {
      out.push({ id: `s${idx}p`, index: after, cue: { kind: 'pause', seconds: 1, }, reason: 'Question — let it land' });
      sinceLast = 0;
      return;
    }
    // Strong exclamation or ALL-CAPS word → emphasis before the line.
    const caps = /\b[A-Z]{3,}\b/.test(text) && /[a-z]/.test(text);
    if ((caps || /!["”’)]*$/.test(text)) && text.split(/\s+/).length >= 3 && !taken(idx) && sinceLast >= 3) {
      out.push({ id: `s${idx}e`, index: idx, cue: { kind: caps ? 'emphasize' : 'energy_up' }, reason: caps ? 'CAPS word — stress it' : 'Exclamation — raise the energy' });
      sinceLast = 0;
      return;
    }
    if (SOFT_WORDS.test(text) && !taken(idx) && sinceLast >= 2) {
      out.push({ id: `s${idx}s`, index: idx, cue: { kind: 'softer' }, reason: 'Quiet moment' });
      sinceLast = 0;
      return;
    }
    if (SLOW_WORDS.test(text) && !taken(idx) && sinceLast >= 2) {
      out.push({ id: `s${idx}l`, index: idx, cue: { kind: 'slower' }, reason: 'Slow-down moment' });
      sinceLast = 0;
      return;
    }
    // Paragraph end after a full stop → short beat (only after a few lines).
    if (next?.type === 'blank' && /[.!]["”’)]*$/.test(text) && sinceLast >= 5 && !taken(after)) {
      out.push({ id: `s${idx}b`, index: after, cue: { kind: 'pause', seconds: 1 }, reason: 'End of a beat' });
      sinceLast = 0;
    }
  });
  return out;
}

/** Return a new item list with the given suggestions inserted (later indices first). */
export function applySuggestions(items: ScriptItem[], picks: Suggestion[]): ScriptItem[] {
  const next = items.slice();
  [...picks].sort((a, b) => b.index - a.index).forEach((s) => next.splice(s.index, 0, { type: 'cue', cue: s.cue }));
  return next;
}
