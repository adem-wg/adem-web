import { Buffer as BufferPolyfill } from 'buffer';

type BufferFrom = typeof BufferPolyfill.from;
type AnyBufferFrom = (value: unknown, encodingOrOffset?: unknown, length?: number) => Buffer;

function toBase64(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  return padding === 0 ? base64 : `${base64}${'='.repeat(4 - padding)}`;
}

export function installBufferPolyfill(): void {
  const originalFrom = BufferPolyfill.from.bind(BufferPolyfill) as AnyBufferFrom;

  BufferPolyfill.from = ((value: unknown, encodingOrOffset?: unknown, length?: number) => {
    if (typeof value === 'string' && encodingOrOffset === 'base64url') {
      return originalFrom(toBase64(value), 'base64');
    }

    return originalFrom(value, encodingOrOffset, length);
  }) as BufferFrom;

  (globalThis as unknown as { Buffer: typeof BufferPolyfill }).Buffer = BufferPolyfill;
}
