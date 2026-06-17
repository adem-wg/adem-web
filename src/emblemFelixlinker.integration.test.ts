import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { parseTXTRecords } from 'adem-chrome';
import { verifyMaterial } from './domainVerifier';

function loadFixture(name: string): string[] {
  return readFileSync(
    resolve(process.cwd(), 'node_modules/adem-chrome/test/fixtures', `${name}.txt`),
    'utf8',
  ).trim().split('\n');
}

describe('emblem.felixlinker.de verification boundary', () => {
  test('the token set verifies without running CT checks', async () => {
    const material = parseTXTRecords(loadFixture('emblem.felixlinker.de'));
    const ctVerifier = vi.fn(async () => {
      throw new Error('CT verifier should be disabled');
    });

    const result = await verifyMaterial(material, {
      ctVerifier,
    });

    expect(result.emblemIssuer).toBe('https://emblem.felixlinker.de');
    expect(result.emblem.payload.assets).toEqual(['[2a01:4f9:c010:d8e4::1]']);
    expect(ctVerifier).not.toHaveBeenCalled();
  });
});
