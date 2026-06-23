import {
  fetchDnsTokens,
  VerificationResult,
  verifyTokens,
} from 'adem-chrome';
import type {
  DNSMaterial,
  VerificationResults,
  VerifyOptions,
} from 'adem-chrome';

export type VerificationState =
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export type FailureStage =
  | 'input'
  | 'dns'
  | 'records'
  | 'verification';

export interface DomainVerification {
  state: VerificationState;
  domain?: string;
  stage?: FailureStage;
  title: string;
  message: string;
  issuer?: string;
  protectedAssets: string[];
  endorsedBy: string[];
  tokenCount: number;
  keyCount: number;
  verification: {
    signed: boolean;
    organizational: boolean;
    endorsed: boolean;
  };
  diagnostic?: string;
}

interface NormalizedDomain {
  ok: true;
  domain: string;
}

interface InvalidDomain {
  ok: false;
  message: string;
}

type DomainInput = NormalizedDomain | InvalidDomain;

const CT_DISABLED_VERIFY_OPTIONS: VerifyOptions = {
  ctVerifier: async () => undefined,
};

function emptyResult(overrides: Partial<DomainVerification>): DomainVerification {
  return {
    state: 'error',
    title: 'ADEM verification failed',
    message: 'The ADEM marking could not be verified.',
    protectedAssets: [],
    endorsedBy: [],
    tokenCount: 0,
    keyCount: 0,
    verification: {
      signed: false,
      organizational: false,
      endorsed: false,
    },
    ...overrides,
  };
}

export function normalizeDomain(input: string): DomainInput {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: 'Enter a domain name.' };
  }

  if (/\s/.test(trimmed)) {
    return { ok: false, message: 'Domain names cannot contain spaces.' };
  }

  let candidate = trimmed;
  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    candidate = parsed.hostname;
  } catch {
    return { ok: false, message: 'Enter a valid domain name.' };
  }

  const domain = candidate.toLowerCase().replace(/\.$/, '');
  if (domain.length === 0 || domain.length > 253) {
    return { ok: false, message: 'Enter a valid domain name.' };
  }

  const labels = domain.split('.');
  const validLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  if (labels.length < 2 || labels.some((label) => !validLabel.test(label))) {
    return { ok: false, message: 'Enter a DNS domain such as example.org.' };
  }

  return { ok: true, domain };
}

export async function verifyMaterial(
  material: DNSMaterial,
  options: VerifyOptions = {},
): Promise<VerificationResults> {
  return verifyTokens(
    [
      ...material.tokens,
      ...material.keys.map((key) => JSON.stringify(key)),
    ],
    [],
    { ...options, ...CT_DISABLED_VERIFY_OPTIONS },
  );
}

function verificationResult(
  domain: string,
  material: DNSMaterial,
  result: VerificationResults,
): DomainVerification {
  const marked = result.results.includes(VerificationResult.SIGNED);
  const hasErrors = result.errors.length > 0;
  const state = marked
    ? (hasErrors ? 'warning' : 'success')
    : 'error';

  return {
    state,
    domain,
    stage: hasErrors || !marked ? 'verification' : undefined,
    title: marked
      ? (hasErrors ? 'ADEM marking with errors' : 'Verified ADEM marking')
      : 'No verified ADEM marking',
    message: marked
      ? (hasErrors
          ? 'This domain is marked with ADEM, but verification reported errors.'
          : 'This domain is marked with ADEM and verification reported no errors.')
      : 'ADEM tokens were found, but no ADEM marking could be verified.',
    issuer: result.issuer,
    protectedAssets: result.protected,
    endorsedBy: result.endorsedBy,
    tokenCount: material.tokens.length,
    keyCount: material.keys.length,
    verification: {
      signed: result.results.includes(VerificationResult.SIGNED),
      organizational: result.results.includes(VerificationResult.ORGANIZATIONAL),
      endorsed: result.results.includes(VerificationResult.ENDORSED),
    },
    diagnostic: result.errors.length > 0
      ? result.errors.map((error) => error.message).join('\n')
      : undefined,
  };
}

export async function verifyDomain(input: string): Promise<DomainVerification> {
  const normalized = normalizeDomain(input);
  if (!normalized.ok) {
    return emptyResult({
      state: 'error',
      stage: 'input',
      title: 'Enter a valid domain',
      message: normalized.message,
    });
  }

  let material: DNSMaterial;
  try {
    material = await fetchDnsTokens(normalized.domain);
  } catch (error) {
    return emptyResult({
      state: 'error',
      domain: normalized.domain,
      stage: 'dns',
      title: 'No verified ADEM marking',
      message: 'ADEM DNS records could not be fetched or parsed.',
      diagnostic: error instanceof Error ? error.message : String(error),
    });
  }

  if (material.tokens.length === 0) {
    return emptyResult({
      state: 'info',
      domain: normalized.domain,
      stage: 'records',
      title: 'No ADEM marking',
      message: 'No ADEM tokens were found in DNS.',
      tokenCount: material.tokens.length,
      keyCount: material.keys.length,
    });
  }

  try {
    const result = await verifyMaterial(material);
    return verificationResult(normalized.domain, material, result);
  } catch (error) {
    return emptyResult({
      state: 'error',
      domain: normalized.domain,
      stage: 'verification',
      title: 'No verified ADEM marking',
      message: 'ADEM tokens were found, but no ADEM marking could be verified.',
      tokenCount: material.tokens.length,
      keyCount: material.keys.length,
      diagnostic: error instanceof Error ? error.message : String(error),
    });
  }
}
