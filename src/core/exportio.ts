import { DEFAULT_AI_PROMPT } from './prompt';
import { cleanScript, normalizeScript } from './parser';
import type { PauseDefaults } from './types';

export const exportClean = (src: string, d?: PauseDefaults) => cleanScript(src, d);
export const exportReelPrompt = (src: string, d?: PauseDefaults) => normalizeScript(src, d);

/** The AI prompt followed by the user's plain script, ready to paste into any assistant. */
export function buildAiRequest(script: string, prompt: string = DEFAULT_AI_PROMPT, d?: PauseDefaults): string {
  return (
    `${prompt.trim()}\n\n---\nTASK: Do not write a new script. Take the script below and return it ` +
    `with ReelPrompt performance markers added exactly as described above. Keep every spoken word unchanged.\n\n` +
    `SCRIPT:\n${cleanScript(script, d)}\n`
  );
}

export function safeFilename(name: string): string {
  return (name.replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim().replace(/\s+/g, '-') || 'script').slice(0, 60);
}
