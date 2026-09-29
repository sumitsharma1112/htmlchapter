export type RecordMode = 'off' | 'video' | 'audio';
export type Facing = 'user' | 'environment';

const VIDEO_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4',
  'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm',
];
const AUDIO_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

const defaultSupported = (t: string) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t);

/** Best container the browser can record (MP4 first — it is what Instagram and phones prefer). */
export function pickMimeType(mode: 'video' | 'audio', supported: (t: string) => boolean = defaultSupported): string | undefined {
  return (mode === 'video' ? VIDEO_TYPES : AUDIO_TYPES).find(supported);
}

export function extensionFor(mime: string): string {
  if (mime.includes('mp4')) return mime.startsWith('audio') ? 'm4a' : 'mp4';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

/** Friendly message for getUserMedia / MediaRecorder failures. */
export function describeMediaError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'InsecureContext') return 'Camera and microphone need HTTPS (or localhost). Run “npm run dev:https” and open the https:// address.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Permission denied — allow camera/microphone access in your browser settings and try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No matching camera or microphone was found.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'The camera or microphone is being used by another app.';
  if (name === 'UnsupportedRecorder') return 'This browser cannot record media (MediaRecorder is unavailable).';
  return `Could not start recording: ${(e as Error)?.message ?? 'unknown error'}`;
}

export interface Recording { blob: Blob; url: string; mime: string; seconds: number; kind: 'video' | 'audio' }

const fail = (name: string, message: string) => Object.assign(new Error(message), { name });

/** Thin wrapper over getUserMedia + MediaRecorder. Records camera/mic only — never the script. */
export class Recorder {
  stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private kind: 'video' | 'audio' = 'video';
  private mime = '';

  get recording(): boolean { return this.rec?.state === 'recording'; }
  get seconds(): number { return this.recording ? (performance.now() - this.startedAt) / 1000 : 0; }

  /** Ask for permission and open the devices (used for the live preview too). */
  async open(mode: 'video' | 'audio', facing: Facing): Promise<MediaStream> {
    if (typeof MediaRecorder === 'undefined') throw fail('UnsupportedRecorder', 'MediaRecorder unavailable');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw fail('InsecureContext', 'Insecure context');
    this.close();
    const portrait = window.innerHeight > window.innerWidth;
    this.kind = mode;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: mode === 'video'
        ? { facingMode: { ideal: facing }, width: { ideal: portrait ? 1080 : 1920 }, height: { ideal: portrait ? 1920 : 1080 } }
        : false,
    });
    return this.stream;
  }

  start(): void {
    if (!this.stream) throw fail('NotFoundError', 'No open stream');
    this.mime = pickMimeType(this.kind) ?? '';
    const chunks: Blob[] = [];
    this.chunks = chunks;
    this.rec = new MediaRecorder(this.stream, {
      ...(this.mime ? { mimeType: this.mime } : {}),
      ...(this.kind === 'video' ? { videoBitsPerSecond: 5_000_000 } : {}),
      audioBitsPerSecond: 128_000,
    });
    this.mime = this.rec.mimeType || this.mime || (this.kind === 'video' ? 'video/webm' : 'audio/webm');
    this.rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    this.rec.start(1000);
    this.startedAt = performance.now();
  }

  stop(): Promise<Recording | null> {
    const rec = this.rec;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    const seconds = (performance.now() - this.startedAt) / 1000;
    const { chunks, mime, kind } = this;
    this.rec = null; // a new take may start right away without touching this one
    this.chunks = [];
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        resolve(blob.size ? { blob, url: URL.createObjectURL(blob), mime, seconds, kind } : null);
      };
      rec.stop();
    });
  }

  /** Release camera and microphone. */
  close(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
