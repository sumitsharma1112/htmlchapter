import { describe, expect, it } from 'vitest';
import { cueLabel } from '../src/teleprompter/cues';

describe('cueLabel', () => {
  it('icon + text by default', () => {
    expect(cueLabel({ kind: 'louder' }, { cueIcons: true, cueText: true })).toBe('🔊 LOUDER');
    expect(cueLabel({ kind: 'energy_up' }, { cueIcons: true, cueText: true })).toBe('↑ MORE ENERGY');
  });
  it('respects icon/text toggles', () => {
    expect(cueLabel({ kind: 'whisper' }, { cueIcons: true, cueText: false })).toBe('🤫');
    expect(cueLabel({ kind: 'calm' }, { cueIcons: false, cueText: true })).toBe('CALM');
    expect(cueLabel({ kind: 'calm' }, { cueIcons: false, cueText: false })).toBe('CALM');
  });
  it('shows pause length', () => {
    expect(cueLabel({ kind: 'pause', seconds: 1.5 }, { cueIcons: false, cueText: true })).toBe('PAUSE 1.5s');
  });
});
