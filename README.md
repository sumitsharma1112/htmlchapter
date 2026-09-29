# ReelPrompt

A **performance-aware teleprompter** for Instagram Reels, YouTube Shorts, talking-head videos and presentations.
Scripts may contain performance markers (`[PAUSE:1.5]`, `[LOUDER]`, …). ReelPrompt hides them from the spoken text
and turns them into small peripheral cues and automatic pauses. Runs fully in the browser — no backend, no account,
no AI API key.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build in dist/
npm run test     # vitest
```

## Implemented

| Phase | What |
|---|---|
| 1 Architecture | Vite + TypeScript, vanilla DOM (dev dependencies only: vite, typescript, vitest) |
| 2 Parser | `src/core/parser.ts` — all markers + natural variants, normalisation, clean export, unit tests |
| 3 Editor & storage | Script editor, add-cue toolbar (no syntax needed), live cue preview, rename/duplicate/delete, localStorage |
| 4 Teleprompter engine | `src/teleprompter/engine.ts` — rAF smooth scroll, reading line, current-line highlight, countdown, progress, elapsed / remaining, mirror, full screen, keyboard + tap |
| 5 Cue system | `src/teleprompter/cues.ts` — edge overlay (position, size, opacity, duration, icons/text configurable); pauses hold scrolling with a live countdown chip |
| 6 AI Script Prompt | Editable master prompt + COPY PROMPT (`src/core/prompt.ts`) |
| 7 Import / export | Import `.txt`; export Clean `.txt` and ReelPrompt `.txt`; copy clean; copy for AI (prompt + your script) |
| 8 Responsive / a11y | Mobile-friendly controls, reduced-motion, focus rings, ARIA labels, skip link, light/dark |
| ✨ Format for Performance | Local heuristics (`src/core/suggest.ts`) suggest cues; accept/dismiss in a structured editor |

## Markers

`[PAUSE]` `[PAUSE:n]` `[LONG_PAUSE:n]` `[LOUDER]` `[SOFTER]` `[FASTER]` `[SLOWER]` `[ENERGY_UP]` `[CALM]` `[WHISPER]` `[EMPHASIZE]`
(`[LOWER]` = softer). Natural variants: `(pause)`, `(pause 2 seconds)`, `(speak louder)`, `(softer)`, `(speak slowly)`,
`(speak faster)`, `(more energy)`, `(lower voice)`, `(emphasize)`. Unknown `[Brackets]` and ordinary `(parentheses)` stay as text.
A marker in the middle of a line splits that line at the marker.

## Teleprompter keys

Space play/pause · ↑/↓ speed · ←/→ nudge · `[` `]` font size · M mirror · F full screen · R reset · Esc exit.
Tap/click the text to play/pause. Faster/slower/energy/calm cues nudge scroll speed (toggle in Settings).

## Layout

```
src/core/          parser, cue metadata, suggestions, storage + settings, export, AI prompt, demo script
src/teleprompter/  engine (scroll/pause/cue timing) and cue overlay
src/ui/            DOM helpers, cue board, prompter view, app shell
tests/             vitest (parser, storage, export, suggestions, cue labels)
```
