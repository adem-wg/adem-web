import { describe, expect, test } from 'vitest';
import { installBufferPolyfill } from './polyfills';

describe('installBufferPolyfill', () => {
  test('supports base64url decoding for JWS parts', () => {
    installBufferPolyfill();

    expect(Buffer.from('eyJjdHkiOiJhZGVtLWVtYiJ9', 'base64url').toString()).toBe('{"cty":"adem-emb"}');
  });
});
