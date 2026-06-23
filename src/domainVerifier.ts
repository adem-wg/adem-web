import {
  fetchDnsTokens,
  VerificationResult,
  verifyTokens,
} from 'adem-js';
import type {
  VerificationResults,
  VerifyOptions,
} from 'adem-js';
import { JWK } from 'jose';
import { parseDomain, ParseResultType } from 'parse-domain';

export type VerificationState =
  | 'no-emblem'
  | 'marked'
  | 'marked-with-errors'
  | 'errors';

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
    this.tokens = tokens;
    this.keys = keys;
    this.result = result;
  }

  state(): VerificationState {
    if (this.tokens.length + this.keys.length === 0) {
      return 'no-emblem';
    } else if (this.result.results.includes(VerificationResult.INVALID)) {
      return 'errors';
    } else if (this.result.errors.length > 0) {
      return 'marked-with-errors';
    } else {
      return 'marked';
    }
  }

  summary(): string {
    switch (this.state()) {
      case 'no-emblem': return 'No emblem';
      case 'errors': return 'Invalid emblem';
      case 'marked-with-errors': return 'Marked with ADEM';
      case 'marked': return 'Marked with ADEM';
    }
  }

  message(): string {
    switch (this.state()) {
      case 'no-emblem': return 'No emblem was found.';
      case 'errors': return 'Emblem verification failed.';
      case 'marked-with-errors': return 'The domain is marked with ADEM, but there were non-critical errors during verification';
      case 'marked': return 'The domain is marked with ADEM, and no errors occurred during verification.';
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
