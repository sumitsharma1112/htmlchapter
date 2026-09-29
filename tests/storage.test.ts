import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, ScriptStore, sanitizeSettings } from '../src/core/storage';
import { suggestCues, applySuggestions } from '../src/core/suggest';
import { buildAiRequest, exportClean, exportReelPrompt } from '../src/core/exportio';
import { parseScript, serializeItems } from '../src/core/parser';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('ScriptStore', () => {
  it('create / rename / duplicate / update / delete', () => {
    const s = new ScriptStore(mem());
    const a = s.create('First', 'hello');
    expect(s.list()).toHaveLength(1);
    s.rename(a.id, 'Renamed');
    expect(s.get(a.id)?.name).toBe('Renamed');
    const d = s.duplicate(a.id)!;
    expect(d.name).toBe('Renamed (copy)');
    s.update(a.id, { content: 'changed' });
    expect(s.get(a.id)?.content).toBe('changed');
    s.remove(a.id);
    expect(s.list().map((x) => x.id)).toEqual([d.id]);
  });
  it('survives corrupt storage', () => {
    const kv = mem();
    kv.setItem('reelprompt.scripts.v1', '{oops');
    expect(new ScriptStore(kv).list()).toEqual([]);
  });
});

describe('settings', () => {
  it('sanitises bad values', () => {
    const s = sanitizeSettings({ fontSize: -5, cuePosition: 'nope' as never, cueOpacity: 9 });
    expect(s.fontSize).toBe(20);
    expect(s.cuePosition).toBe(DEFAULT_SETTINGS.cuePosition);
    expect(s.cueOpacity).toBe(1);
  });
});

describe('export & suggestions', () => {
  const src = 'Hi there.\n(speak louder)\nBig moment!\n[PAUSE:2]\nEnd.';
  it('clean removes markers; reelprompt normalises', () => {
    expect(exportClean(src)).toBe('Hi there.\nBig moment!\nEnd.');
    expect(exportReelPrompt(src)).toBe('Hi there.\n[LOUDER]\nBig moment!\n[PAUSE:2]\nEnd.');
  });
  it('AI request embeds the clean script', () => {
    const r = buildAiRequest(src);
    expect(r).toContain('SCRIPT:\nHi there.\nBig moment!\nEnd.');
  });
  it('suggests a pause after a question and applies it', () => {
    const items = parseScript('Line a.\nLine b.\nKya aap sun rahe hain?\nLine d.').items;
    const sug = suggestCues(items);
    expect(sug.some((x) => x.cue.kind === 'pause')).toBe(true);
    const out = serializeItems(applySuggestions(items, sug));
    expect(out).toContain('hain?\n[PAUSE:1]');
  });
});

describe('speed setting (words per minute)', () => {
  it('migrates the old 1-20 dial to the default and clamps wpm', () => {
    expect(sanitizeSettings({ speed: 8 }).speed).toBe(DEFAULT_SETTINGS.speed);
    expect(sanitizeSettings({ speed: 500 }).speed).toBe(300);
    expect(sanitizeSettings({ speed: 160 }).speed).toBe(160);
  });
});

import { paceLabel } from '../src/ui/pace';
describe('paceLabel', () => {
  it('names speeds in plain language', () => {
    expect(paceLabel(60)).toBe('Very slow');
    expect(paceLabel(100)).toBe('Slow');
    expect(paceLabel(140)).toBe('Natural');
    expect(paceLabel(180)).toBe('Brisk');
    expect(paceLabel(260)).toBe('Fast');
  });
});

describe('reading mode', () => {
  it('defaults to cues on and accepts plain mode', () => {
    expect(sanitizeSettings({}).cuesEnabled).toBe(true);
    expect(sanitizeSettings({ cuesEnabled: false }).cuesEnabled).toBe(false);
    expect(sanitizeSettings({ cuesEnabled: 'no' as never }).cuesEnabled).toBe(true);
  });
});

describe('ScriptStore when storage is blocked', () => {
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  it('still creates, edits and lists scripts in memory', () => {
    const s = new ScriptStore(blocked);
    const a = s.create('One', 'hello');
    expect(s.get(a.id)?.content).toBe('hello');
    s.update(a.id, { content: 'changed' });
    expect(s.list()).toHaveLength(1);
    expect(s.get(a.id)?.content).toBe('changed');
    s.remove(a.id);
    expect(s.list()).toHaveLength(0);
  });
  it('keeps unsaved scripts when only writing fails (storage full)', () => {
    const data = new Map<string, string>();
    let full = false;
    const kv = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { if (full) throw new Error('quota'); data.set(k, v); } };
    const s = new ScriptStore(kv);
    s.create('Saved', 'a');
    full = true;
    const b = s.create('Unsaved', 'b');
    expect(s.list().map((x) => x.name).sort()).toEqual(['Saved', 'Unsaved']);
    expect(s.get(b.id)?.content).toBe('b');
  });
});
