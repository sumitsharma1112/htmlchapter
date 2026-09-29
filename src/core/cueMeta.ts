import type { CueKind } from './types';

export interface CueMeta {
  /** Canonical marker name, e.g. LOUDER. */
  marker: string;
  /** Text displayed in the on-screen cue. */
  label: string;
  icon: string;
  /** Friendly name for menus. */
  menu: string;
}

export const CUE_META: Record<CueKind, CueMeta> = {
  pause: { marker: 'PAUSE', label: 'PAUSE', icon: '⏸', menu: 'Pause' },
  louder: { marker: 'LOUDER', label: 'LOUDER', icon: '🔊', menu: 'Louder' },
  softer: { marker: 'SOFTER', label: 'SOFTER', icon: '🔉', menu: 'Softer' },
  faster: { marker: 'FASTER', label: 'FASTER', icon: '⚡', menu: 'Faster' },
  slower: { marker: 'SLOWER', label: 'SLOWER', icon: '🐢', menu: 'Slower' },
  energy_up: { marker: 'ENERGY_UP', label: 'MORE ENERGY', icon: '↑', menu: 'More energy' },
  calm: { marker: 'CALM', label: 'CALM', icon: '○', menu: 'Calm' },
  whisper: { marker: 'WHISPER', label: 'WHISPER', icon: '🤫', menu: 'Whisper' },
  emphasize: { marker: 'EMPHASIZE', label: 'EMPHASIZE', icon: '●', menu: 'Emphasize' },
};

export const CUE_ORDER: CueKind[] = [
  'pause', 'louder', 'softer', 'faster', 'slower', 'energy_up', 'calm', 'whisper', 'emphasize',
];
