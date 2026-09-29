import { describe, expect, it } from 'vitest';
import { cleanScript, cueToMarker, normalizeScript, parseScript } from '../src/core/parser';
import { DEMO_SCRIPT } from '../src/core/demo';
import type { Cue } from '../src/core/types';

const cues = (s: string): Cue[] =>
  parseScript(s).items.flatMap((i) => (i.type === 'cue' ? [i.cue] : []));
const lines = (s: string) =>
  parseScript(s).items.flatMap((i) => (i.type === 'line' ? [i.text] : []));

describe('canonical markers', () => {
  it('[PAUSE:1.5]', () => {
    const p = parseScript('Hello.\n[PAUSE:1.5]\nWorld.');
    expect(p.spoken).toBe('Hello.\nWorld.');
    expect(cues('[PAUSE:1.5]')).toEqual([{ kind: 'pause', seconds: 1.5 }]);
  });
  it('[LONG_PAUSE:3]', () => expect(cues('[LONG_PAUSE:3]')).toEqual([{ kind: 'pause', seconds: 3, long: true }]));
  it('[PAUSE] uses the configured default', () => {
    expect(cues('[PAUSE]')[0]).toMatchObject({ kind: 'pause', seconds: 1.5, implicit: true });
    expect(parseScript('[PAUSE]', { pause: 0.8, longPause: 4 }).items[0]).toMatchObject({ cue: { seconds: 0.8 } });
    expect(parseScript('[LONG_PAUSE]', { pause: 0.8, longPause: 4 }).items[0]).toMatchObject({ cue: { seconds: 4, long: true } });
  });
  it.each([
    ['[LOUDER]', 'louder'], ['[SOFTER]', 'softer'], ['[FASTER]', 'faster'], ['[SLOWER]', 'slower'],
    ['[ENERGY_UP]', 'energy_up'], ['[CALM]', 'calm'], ['[WHISPER]', 'whisper'], ['[EMPHASIZE]', 'emphasize'],
    ['[LOWER]', 'softer'],
  ])('%s -> %s', (src, kind) => {
    expect(cues(`Line one.\n${src}\nLine two.`)).toEqual([{ kind }]);
    expect(cleanScript(`Line one.\n${src}\nLine two.`)).toBe('Line one.\nLine two.');
  });
});

describe('natural variants', () => {
  it.each([
    ['(pause)', { kind: 'pause', seconds: 1.5, implicit: true }],
    ['(pause 2 seconds)', { kind: 'pause', seconds: 2 }],
    ['(louder)', { kind: 'louder' }],
    ['(speak louder)', { kind: 'louder' }],
    ['(softer)', { kind: 'softer' }],
    ['(speak slowly)', { kind: 'slower' }],
    ['(speak faster)', { kind: 'faster' }],
    ['(more energy)', { kind: 'energy_up' }],
    ['(lower voice)', { kind: 'softer' }],
    ['(emphasize)', { kind: 'emphasize' }],
    ['[pause 2]', { kind: 'pause', seconds: 2 }],
  ])('%s', (src, cue) => {
    expect(cues(src)).toEqual([cue]);
    expect(cleanScript(`A.\n${src}\nB.`)).toBe('A.\nB.');
  });
  it('leaves ordinary parentheses and unknown brackets alone', () => {
    const p = parseScript('He laughed (a lot) at [Intro] time.');
    expect(p.spoken).toBe('He laughed (a lot) at [Intro] time.');
    expect(p.unknown).toEqual(['[Intro]']);
    expect(p.cueCount).toBe(0);
  });
});

describe('text fidelity', () => {
  it('keeps ordinary text, punctuation and ellipses intact', () => {
    const t = 'Aaj main aapse…\n\n“India… IS changing!”\n\nJab hum bolte hain—';
    expect(cleanScript(t)).toBe(t);
  });
  it('handles multiple markers', () => {
    const src = 'One.\n[PAUSE:1]\n[LOUDER]\nTwo.\n[SLOWER]\n[PAUSE:2]\nThree.';
    expect(cues(src).map((c) => c.kind)).toEqual(['pause', 'louder', 'slower', 'pause']);
    expect(cleanScript(src)).toBe('One.\nTwo.\nThree.');
  });
  it('handles inline markers without losing text', () => {
    expect(lines('Wait… [PAUSE:1] what?')).toEqual(['Wait…', 'what?']);
    expect(cues('Wait… [PAUSE:1] what?')).toEqual([{ kind: 'pause', seconds: 1 }]);
  });
  it('clamps absurd pauses', () => expect(cues('[PAUSE:9999]')[0].seconds).toBe(60));
  it('handles CRLF', () => expect(lines('a\r\n[LOUDER]\r\nb')).toEqual(['a', 'b']));
});

describe('normalisation', () => {
  it('rewrites variants to canonical markers', () => {
    expect(normalizeScript('Hi.\n(speak louder)\n(pause 2 seconds)\nYo.')).toBe('Hi.\n[LOUDER]\n[PAUSE:2]\nYo.');
  });
  it('round-trips', () => {
    const once = normalizeScript(DEMO_SCRIPT);
    expect(normalizeScript(once)).toBe(once);
  });
  it('cueToMarker', () => {
    expect(cueToMarker({ kind: 'pause', seconds: 3, long: true })).toBe('[LONG_PAUSE:3]');
    expect(cueToMarker({ kind: 'energy_up' })).toBe('[ENERGY_UP]');
  });
});

describe('canonical demo script', () => {
  const p = parseScript(DEMO_SCRIPT);
  it('extracts the expected cues in order', () => {
    expect(p.cueCount).toBe(7);
    expect(p.items.flatMap((i) => (i.type === 'cue' ? [i.cue.kind + (i.cue.seconds ?? '')] : []))).toEqual([
      'pause1.5', 'faster', 'pause1.5', 'softer', 'pause1.5', 'energy_up', 'pause3',
    ]);
  });
  it('spoken text contains no markers', () => {
    expect(p.spoken).not.toMatch(/\[[A-Z_:.0-9]+\]/);
    expect(p.spoken).toContain('“India… IS changing!”');
    expect(p.unknown).toEqual([]);
  });
});
