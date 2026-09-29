export type CueKind =
  | 'pause'
  | 'louder'
  | 'softer'
  | 'faster'
  | 'slower'
  | 'energy_up'
  | 'calm'
  | 'whisper'
  | 'emphasize';

export interface Cue {
  kind: CueKind;
  /** Pause length in seconds (pause cues only). */
  seconds?: number;
  /** True for LONG_PAUSE markers. */
  long?: boolean;
  /** True when the marker carried no explicit duration and uses the configured default. */
  implicit?: boolean;
}

export type ScriptItem =
  | { type: 'line'; text: string }
  | { type: 'blank' }
  | { type: 'cue'; cue: Cue };

export interface ParsedScript {
  items: ScriptItem[];
  /** Clean spoken script — no markers. */
  spoken: string;
  wordCount: number;
  cueCount: number;
  /** Bracketed markers that were not recognised and were left in the text. */
  unknown: string[];
}

export interface PauseDefaults {
  pause: number;
  longPause: number;
}

export const DEFAULT_PAUSES: PauseDefaults = { pause: 1.5, longPause: 3 };
