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
npm run dev:https  # HTTPS on your LAN — needed for camera/mic on a phone
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
| Recording | `src/recording/recorder.ts` (MediaRecorder wrapper), preview + review dialog in `src/ui/` |
| ✨ Format for Performance | Local heuristics (`src/core/suggest.ts`) suggest cues; accept/dismiss in a structured editor |

## Recording (audio & selfie video)

In the prompter, tap **Rec** to cycle Off → 🎥 Video → 🎙 Audio. The camera preview appears dimmed behind the text
(adjust with *Camera dim*), **Flip** switches front/back camera, and recording starts when scrolling starts (after the
countdown) and stops when the script finishes or you tap **■ Stop rec**. A review dialog lets you play back and
download the take (MP4 where the browser supports it, otherwise WebM; `.m4a`/`.webm` for audio). Only the camera and
microphone are recorded — never the script — and the saved video is not mirrored. Nothing is uploaded.

**Browsers only allow camera/mic on HTTPS or `localhost`.** To test on a phone on the same Wi-Fi run
`npm run dev:https` (or `npm run build && npm run preview:https`), open the printed `https://<lan-ip>:port` address and
accept the self-signed certificate warning once.

## Markers

`[PAUSE]` `[PAUSE:n]` `[LONG_PAUSE:n]` `[LOUDER]` `[SOFTER]` `[FASTER]` `[SLOWER]` `[ENERGY_UP]` `[CALM]` `[WHISPER]` `[EMPHASIZE]`
(`[LOWER]` = softer). Natural variants: `(pause)`, `(pause 2 seconds)`, `(speak louder)`, `(softer)`, `(speak slowly)`,
`(speak faster)`, `(more energy)`, `(lower voice)`, `(emphasize)`. Unknown `[Brackets]` and ordinary `(parentheses)` stay as text.
A marker in the middle of a line splits that line at the marker.

## Teleprompter keys

Space play/pause · ↑/↓ speed · ←/→ nudge · `[` `]` font size · M mirror · F full screen · R reset · Esc exit.
Speed is a tortoise ⇄ rabbit bar (words per minute, with plain-language names). Tap/click the text to play/pause. Faster/slower/energy/calm cues nudge scroll speed (toggle in Settings).

## Layout

```
src/core/          parser, cue metadata, suggestions, storage + settings, export, AI prompt, demo script
src/teleprompter/  engine (scroll/pause/cue timing) and cue overlay
src/ui/            DOM helpers, cue board, prompter view, app shell
tests/             vitest (parser, storage, export, suggestions, cue labels)
```
