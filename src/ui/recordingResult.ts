import { extensionFor } from '../recording/recorder';
import type { Recording } from '../recording/recorder';
import { safeFilename } from '../core/exportio';
import { formatTime } from '../core/parser';
import { h } from './dom';

/** Review dialog shown after a take. Lives on <body> so it survives leaving the prompter. */
export function showRecordingResult(rec: Recording, title: string, onAgain?: () => void): void {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const filename = `${safeFilename(title)}-${stamp}.${extensionFor(rec.mime)}`;
  const media = rec.kind === 'video'
    ? h('video', { src: rec.url, controls: true, playsInline: true, class: 'rec-media' })
    : h('audio', { src: rec.url, controls: true, class: 'rec-audio' });
  const size = `${(rec.blob.size / 1048576).toFixed(1)} MB`;
  let saved = false;
  const close = () => { URL.revokeObjectURL(rec.url); dlg.remove(); };
  const done = () => {
    if (!saved && !confirm('You have not downloaded this recording. Discard it?')) return;
    close();
  };
  const dlg = h('div', { class: 'rec-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Recording finished' },
    h('div', { class: 'rec-card' },
      h('h2', {}, rec.kind === 'video' ? '🎥 Video recorded' : '🎙 Audio recorded'),
      media,
      h('p', { class: 'muted small' }, `${formatTime(rec.seconds)} · ${size} · ${filename}`),
      h('div', { class: 'row wrap' },
        h('a', { class: 'btn primary', href: rec.url, download: filename, on: { click: () => { saved = true; } } }, '⬇ Download'),
        onAgain && h('button', { class: 'btn', type: 'button', on: { click: () => { if (saved || confirm('Discard this take and record again?')) { close(); onAgain(); } } } }, '● Record again'),
        h('button', { class: 'btn', type: 'button', on: { click: done } }, saved ? 'Done' : 'Discard')),
      h('p', { class: 'muted small' }, 'Recordings are kept only in this browser tab until you download them.')));
  document.body.append(dlg);
  (dlg.querySelector('a') as HTMLElement).focus();
}
