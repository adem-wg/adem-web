import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchDnsTokens } from 'adem-chrome';
import {
  classifyVerificationError,
  normalizeDomain,
  verifyDomain,
} from './domainVerifier';

vi.mock('adem-chrome', () => ({
  fetchDnsTokens: vi.fn(),
  KeyStore: vi.fn(),
  NewClaim: vi.fn(),
  ClaimSet: vi.fn(),
}));

describe('normalizeDomain', () => {
  test('normalizes plain domains and URLs', () => {
    expect(normalizeDomain('  Example.ORG.  ')).toEqual({ ok: true, domain: 'example.org' });
    expect(normalizeDomain('https://Emblem.Example.org/path')).toEqual({
      ok: true,
      domain: 'emblem.example.org',
    });
  });

  test('rejects empty and non-domain input', () => {
    expect(normalizeDomain('')).toEqual({ ok: false, message: 'Enter a domain name.' });
    expect(normalizeDomain('localhost')).toEqual({
      ok: false,
      message: 'Enter a DNS domain such as example.org.',
    });
  });
});

describe('classifyVerificationError', () => {
  test('recognizes browser CT lookup failures as inconclusive', () => {
    expect(classifyVerificationError(new Error('Failed to fetch'))).toMatchObject({
      stage: 'ct',
      state: 'inconclusive',
    });
  });

  test('recognizes key-chain failures as not verified', () => {
    expect(classifyVerificationError(new Error('no verification key'))).toMatchObject({
      stage: 'signature',
      state: 'not_verified',
    });
  });
});

describe('verifyDomain', () => {
  beforeEach(() => {
    vi.mocked(fetchDnsTokens).mockReset();
  });

  test('returns invalid input without touching DNS', async () => {
    const result = await verifyDomain('not a domain');

    expect(fetchDnsTokens).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      state: 'invalid_input',
      stage: 'input',
      title: 'Enter a valid domain',
    });
  });

  test('reports missing ADEM token records', async () => {
    vi.mocked(fetchDnsTokens).mockResolvedValue({ tokens: [], keys: [] });

    const result = await verifyDomain('example.org');

    expect(fetchDnsTokens).toHaveBeenCalledWith('example.org');
    expect(result).toMatchObject({
      state: 'not_verified',
      stage: 'records',
      tokenCount: 0,
      keyCount: 0,
    });
  });

  test('reports DNS fetch failures as incomplete verification', async () => {
    vi.mocked(fetchDnsTokens).mockRejectedValue(new Error('response not okay - status 500'));

    const result = await verifyDomain('example.org');

    expect(result).toMatchObject({
      state: 'inconclusive',
      stage: 'dns',
      diagnostic: 'response not okay - status 500',
    });
  });
});
