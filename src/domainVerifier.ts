import {
  fetchDnsTokens,
  VerificationResult,
  verifyTokens,
} from 'adem-chrome';
import type {
  VerificationResults,
  VerifyOptions,
} from 'adem-chrome';
import { JWK } from 'jose';
import { parseDomain, ParseResultType } from 'parse-domain';

export type VerificationState =
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

const CT_DISABLED_VERIFY_OPTIONS: VerifyOptions = {
  ctVerifier: async () => undefined,
};

export async function verify(domain: string): Promise<Verification> {
  const material = await fetchDnsTokens(domain);
  const tokens = material.tokens;
  const keys = material.keys;
  const result = await verifyTokens(material.tokens, material.keys, [], CT_DISABLED_VERIFY_OPTIONS);
  return new Verification(domain, tokens, keys, result);
}

export class Verification {
  domain: string;
  tokens: string[] = [];
  keys: JWK[] = [];
  result: VerificationResults;

  constructor(domain: string, tokens: string[], keys: JWK[], result: VerificationResults) {
    this.domain = domain;
    this.tokens = [];
    this.keys = [];
    this.result = result;
  }

  state(): VerificationState {
    if (this.tokens.length + this.keys.length === 0) {
      return 'info';
    } else if (this.result.results.includes(VerificationResult.INVALID)) {
      return 'error';
    } else if (this.result.errors.length > 0) {
      return 'warning';
    } else {
      return 'success';
    }
  }

  summary(): string {
    switch (this.state()) {
      case 'info': return 'No emblem';
      case 'error': return 'Invalid emblem';
      case 'warning': return 'Marked with ADEM';
      case 'success': return 'Marked with ADEM';
    }
  }

  message(): string {
    switch (this.state()) {
      case 'info': return 'No emblem was found.';
      case 'error': return 'Emblem verification failed.';
      case 'warning': return 'The domain is marked with ADEM, but there were non-critical errors during verification';
      case 'success': return 'The domain is marked with ADEM, and no errors occurred during verification.';
    }
  }
}

export function normalizeDomain(input: string): string | undefined {
  // First try parsing the input as a domain
  const res = parseDomain(input);
  if (res.type === ParseResultType.Listed || res.type === ParseResultType.NotListed) {
    return input;
  }

  // Otherwise try parsing it as a URL
  try {
    const url = new URL(input);
    return url.hostname;
  } catch {
    return undefined;
  }
}
