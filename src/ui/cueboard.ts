import { CUE_META, CUE_ORDER } from '../core/cueMeta';
import type { Cue, ScriptItem } from '../core/types';
import type { Suggestion } from '../core/suggest';
import { h } from './dom';
import { icon } from './icons';

export interface CueChoice { label: string; cue: Cue }

/** Cue choices offered to non-technical users — no marker syntax required. */
export function cueChoices(defaults: { pause: number; longPause: number }): CueChoice[] {
  const out: CueChoice[] = [
    { label: 'Pause 1 sec', cue: { kind: 'pause', seconds: 1 } },
    { label: `Pause ${defaults.pause} sec`, cue: { kind: 'pause', seconds: defaults.pause, implicit: true } },
    { label: 'Pause 2 sec', cue: { kind: 'pause', seconds: 2 } },
    { label: `Long pause ${defaults.longPause} sec`, cue: { kind: 'pause', seconds: defaults.longPause, long: true, implicit: true } },
  ];
  for (const k of CUE_ORDER) if (k !== 'pause') out.push({ label: CUE_META[k].menu, cue: { kind: k } });
  return out;
}

const MARGIN: Record<Cue['kind'], string> = {
  pause: 'hold', louder: '↑ louder', softer: '↓ softer', faster: '» faster', slower: '« slower',
  energy_up: '↗ more energy', calm: '~ calm', whisper: 'whisper', emphasize: '! stress',
};

/** Red-pencil margin note for a cue (the marker text itself is never shown here). */
export function cueChipText(cue: Cue): string {
  if (cue.kind === 'pause') return cue.long ? 'long hold' : 'hold';
  return MARGIN[cue.kind];
}

export function cueChip(cue: Cue, extra = ''): HTMLElement {
  const label = cue.kind === 'pause' && extra.includes('ghost') && cue.seconds !== undefined ? `${cueChipText(cue)} ${cue.seconds}s` : cueChipText(cue);
  return h('span', { class: `chip cue-${cue.kind} ${extra}`.trim(), title: CUE_META[cue.kind].menu }, label);
}

export interface CueBoardOptions {
  items: ScriptItem[];
  defaults: { pause: number; longPause: number };
  onChange(items: ScriptItem[]): void;
  suggestions?: Suggestion[];
  onAccept?(s: Suggestion): void;
  onDismiss?(s: Suggestion): void;
}

/** Structured view of a script: spoken lines with removable / editable cue chips. */
export function renderCueBoard(o: CueBoardOptions): HTMLElement {
  const root = h('div', { class: 'cueboard', role: 'list' });
  const choices = cueChoices(o.defaults);
  const emit = (items: ScriptItem[]) => o.onChange(items);

  const suggestionRow = (s: Suggestion) =>
    h('div', { class: 'cb-suggest', role: 'listitem' },
      cueChip(s.cue, 'ghost'),
      h('span', { class: 'cb-reason' }, s.reason),
      h('button', { class: 'btn sm', type: 'button', on: { click: () => o.onAccept?.(s) } }, 'Add'),
      h('button', { class: 'btn sm quiet', type: 'button', 'aria-label': 'Dismiss suggestion', on: { click: () => o.onDismiss?.(s) } }, icon('x', 14)),
    );

  o.items.forEach((it, idx) => {
    o.suggestions?.filter((s) => s.index === idx).forEach((s) => root.append(suggestionRow(s)));

    if (it.type === 'blank') {
      root.append(h('div', { class: 'cb-blank', role: 'presentation' }));
    } else if (it.type === 'line') {
      const select = h('select', {
        class: 'cb-add', 'aria-label': `Add cue after: ${it.text.slice(0, 40)}`,
        on: {
          change: (e) => {
            const sel = e.target as HTMLSelectElement;
            const c = choices[Number(sel.value)];
            if (!c) return;
            const next = o.items.slice();
            next.splice(idx + 1, 0, { type: 'cue', cue: { ...c.cue } });
            emit(next);
          },
        },
      }, h('option', { value: '' }, '+ Cue'), ...choices.map((c, i) => h('option', { value: String(i) }, c.label)));
      root.append(h('div', { class: 'cb-line', role: 'listitem' }, h('span', { class: 'cb-text' }, it.text), select));
    } else {
      const cue = it.cue;
      const kids: (Node | string)[] = [cueChip(cue)];
      if (cue.kind === 'pause') {
        const input = h('input', {
          type: 'number', min: '0', max: '60', step: '0.5', value: String(cue.seconds ?? 1.5),
          class: 'cb-secs', 'aria-label': 'Pause seconds',
          on: {
            change: (e) => {
              const v = parseFloat((e.target as HTMLInputElement).value);
              if (!isFinite(v)) return;
              const next = o.items.slice();
              next[idx] = { type: 'cue', cue: { kind: 'pause', seconds: Math.min(60, Math.max(0, v)), ...(cue.long ? { long: true } : {}) } };
              emit(next);
            },
          },
        });
        kids.push(input, h('span', { class: 'cb-unit' }, 's'));
      }
      kids.push(h('button', {
        class: 'btn sm quiet', type: 'button', 'aria-label': `Remove ${cue.kind} cue`,
        on: { click: () => { const next = o.items.slice(); next.splice(idx, 1); emit(next); } },
      }, icon('x', 14)));
      root.append(h('div', { class: 'cb-cue', role: 'listitem' }, ...kids));
    }
  });
  o.suggestions?.filter((s) => s.index >= o.items.length).forEach((s) => root.append(suggestionRow(s)));
  if (!o.items.length) root.append(h('p', { class: 'muted' }, 'Nothing to show yet — paste a script.'));
  return root;
}
