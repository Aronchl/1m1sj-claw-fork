import { describe, expect, it } from 'vitest';
import { normalizeQrImageSource } from '@/lib/qr-image';

describe('normalizeQrImageSource', () => {
  it('wraps raw base64 in data URL', () => {
    expect(normalizeQrImageSource({ qr: 'abcd' })).toBe('data:image/png;base64,abcd');
  });

  it('passes through data URLs and https URLs', () => {
    expect(normalizeQrImageSource({ qr: 'data:image/png;base64,xx' })).toBe('data:image/png;base64,xx');
    expect(normalizeQrImageSource({ qr: 'https://example.com/q.png' })).toBe('https://example.com/q.png');
  });

  it('uses raw when qr missing', () => {
    expect(normalizeQrImageSource({ raw: 'https://x/y' })).toBe('https://x/y');
  });
});
