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
  | 'verified'
  | 'unmarked'
  | 'not_verified'
  | 'inconclusive'
  | 'invalid_input';

export type FailureStage =
  | 'input'
  | 'dns'
  | 'records'
  | 'material'
  | 'signature'
  | 'ct'
  | 'constraints'
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
    state: 'inconclusive',
    title: 'Verification incomplete',
    message: 'ADEM verification could not be completed.',
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

export function classifyVerificationError(error: unknown): {
  stage: FailureStage;
  state: VerificationState;
  title: string;
  message: string;
  diagnostic?: string;
} {
  const diagnostic = error instanceof Error ? error.message : String(error);
  const lower = diagnostic.toLowerCase();

  if (
    lower.includes('could not parse token') ||
    lower.includes('token set must contain exactly one emblem') ||
    lower.includes('headers miss') ||
    lower.includes('headers contain wrong cty') ||
    lower.includes('iat/nbf/exp undefined')
  ) {
    return {
      stage: 'material',
      state: 'not_verified',
      title: 'No verified ADEM marking',
      message: 'The published ADEM token material is malformed or incomplete.',
      diagnostic,
    };
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('certificate') ||
    lower.includes('ct/') ||
    lower.includes('log inclusion') ||
    lower.includes('log info') ||
    lower.includes('issuer not in certificate') ||
    lower.includes('key hash not in certificate')
  ) {
    return {
      stage: 'ct',
      state: 'inconclusive',
      title: 'Verification incomplete',
      message: 'Certificate Transparency verification could not be completed by this browser.',
      diagnostic,
    };
  }

  if (
    lower.includes('signature') ||
    lower.includes('jws') ||
    lower.includes('jwt') ||
    lower.includes('no verification key') ||
    lower.includes('no key with kid') ||
    lower.includes('could not authenticate key')
  ) {
    return {
      stage: 'signature',
      state: 'not_verified',
      title: 'No verified ADEM marking',
      message: 'The token signatures or endorsement keys could not be verified.',
      diagnostic,
    };
  }

  if (lower.includes('constraint') || lower.includes('does not match')) {
    return {
      stage: 'constraints',
      state: 'not_verified',
      title: 'No verified ADEM marking',
      message: 'The emblem does not satisfy its endorsement constraints.',
      diagnostic,
    };
  }

  return {
    stage: 'verification',
    state: 'not_verified',
    title: 'No verified ADEM marking',
    message: 'The ADEM token set could not be verified.',
    diagnostic,
  };
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

function verifiedResult(
  domain: string,
  material: DNSMaterial,
  result: VerificationResults,
): DomainVerification {
  return {
    state: 'verified',
    domain,
    title: 'Verified ADEM marking',
    message: 'This domain has a verified ADEM marking.',
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
      state: 'invalid_input',
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
      domain: normalized.domain,
      stage: 'dns',
      title: 'Verification incomplete',
      message: 'ADEM DNS records could not be fetched or parsed.',
      diagnostic: error instanceof Error ? error.message : String(error),
    });
  }

  if (material.tokens.length === 0) {
    return emptyResult({
      state: 'unmarked',
      domain: normalized.domain,
      stage: 'records',
      title: 'No emblem',
      message: 'The domain is not marked with ADEM.',
      tokenCount: material.tokens.length,
      keyCount: material.keys.length,
    });
  }

  try {
    const result = await verifyMaterial(material);
    if (result.results.includes(VerificationResult.SIGNED)) {
      return verifiedResult(normalized.domain, material, result);
    }

    const errors = result.errors.length > 0
      ? new Error(result.errors.map((error) => error.message).join('\n'))
      : new Error('token set could not be verified');
    const classified = classifyVerificationError(errors);
    return emptyResult({
      state: classified.state,
      domain: normalized.domain,
      stage: classified.stage,
      title: classified.title,
      message: classified.message,
      tokenCount: material.tokens.length,
      keyCount: material.keys.length,
      diagnostic: classified.diagnostic,
    });
  } catch (error) {
    const classified = classifyVerificationError(error);
    return emptyResult({
      state: classified.state,
      domain: normalized.domain,
      stage: classified.stage,
      title: classified.title,
      message: classified.message,
      tokenCount: material.tokens.length,
      keyCount: material.keys.length,
      diagnostic: classified.diagnostic,
    });
  }
}
