/** Normalize QR payload from host channel events (base64, data URL, or http URL). */
export function normalizeQrImageSource(data: { qr?: string; raw?: string }): string | null {
  const qr = typeof data.qr === 'string' ? data.qr.trim() : '';
  if (qr) {
    if (qr.startsWith('data:image') || qr.startsWith('http://') || qr.startsWith('https://')) {
      return qr;
    }
    return `data:image/png;base64,${qr}`;
  }

  const raw = typeof data.raw === 'string' ? data.raw.trim() : '';
  if (!raw) return null;
  if (raw.startsWith('data:image') || raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  return null;
}
