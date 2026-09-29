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
