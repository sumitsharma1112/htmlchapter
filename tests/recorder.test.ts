import { describe, expect, it } from 'vitest';
import { describeMediaError, extensionFor, pickMimeType } from '../src/recording/recorder';
import { sanitizeSettings } from '../src/core/storage';

describe('recorder helpers', () => {
  it('prefers mp4 when supported, else webm', () => {
    expect(pickMimeType('video', (t) => t.startsWith('video/mp4'))).toContain('mp4');
    expect(pickMimeType('video', (t) => t === 'video/webm')).toBe('video/webm');
    expect(pickMimeType('audio', (t) => t === 'audio/webm')).toBe('audio/webm');
    expect(pickMimeType('video', () => false)).toBeUndefined();
  });
  it('picks file extensions', () => {
    expect(extensionFor('video/mp4;codecs=avc1')).toBe('mp4');
    expect(extensionFor('audio/mp4')).toBe('m4a');
    expect(extensionFor('video/webm;codecs=vp9,opus')).toBe('webm');
    expect(extensionFor('audio/ogg;codecs=opus')).toBe('ogg');
  });
  it('explains errors', () => {
    expect(describeMediaError({ name: 'InsecureContext' })).toMatch(/HTTPS/);
    expect(describeMediaError({ name: 'NotAllowedError' })).toMatch(/Permission/);
  });
  it('sanitises recording settings', () => {
    expect(sanitizeSettings({ recordMode: 'bogus' as never }).recordMode).toBe('off');
    expect(sanitizeSettings({ recordMode: 'video', facing: 'environment' })).toMatchObject({ recordMode: 'video', facing: 'environment' });
  });
});
