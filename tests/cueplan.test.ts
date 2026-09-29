import { describe, expect, it } from 'vitest';
import { planCues } from '../src/teleprompter/cues';

const g = (vh: number, line: number, fontSize = 56) => ({ readY: vh * 0.36, above: line * 1.5 + fontSize * 0.25, below: line / 2, vh });
const chipH = (size: number) => size * 1.75 + 4;

describe('planCues', () => {
  it('caps size so the longest label fits a phone-width screen', () => {
    const p = planCues({ ...g(2000, 40), vw: 390 }, 'top', 44);
    expect(p.size * 10.8).toBeLessThanOrEqual(390 - 32 + 1);
  });
  it('desktop: keeps the preferred top edge and full size', () => {
    const p = planCues(g(800, 81), 'top', 22);
    expect(p).toMatchObject({ edge: 'top', size: 22 });
  });
  it('caps a huge cue size so one chip always fits', () => {
    const geo = g(800, 81);
    const p = planCues(geo, 'top', 44);
    const avail = geo.readY - geo.above - 12 - 16;
    expect(chipH(p.size)).toBeLessThanOrEqual(avail);
  });
  it('phone with tall wrapped lines moves cues to the roomier bottom edge', () => {
    const p = planCues(g(780, 243), 'top', 44);
    expect(p.edge).toBe('bottom');
    expect(p.max).toBeGreaterThanOrEqual(1);
  });
  it('never asks for more than 3 stacked chips and always at least 1', () => {
    expect(planCues(g(2000, 40), 'top', 12).max).toBe(3);
    expect(planCues(g(300, 300), 'top', 44).max).toBe(1);
  });
  it('shrinks but never below the readable minimum', () => {
    expect(planCues(g(300, 300), 'bottom', 44).size).toBeGreaterThanOrEqual(12);
  });
});
