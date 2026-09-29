import { toast } from './dom';

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string, okMsg = 'Copied to clipboard'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) return toast('Copy failed — select the text and copy manually');
  }
  toast(okMsg);
}

export function pickTextFile(): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,text/plain,.md';
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name.replace(/\.[^.]+$/, ''), text: await f.text() } : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
