import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { verifyDomain, type DomainVerification } from './domainVerifier';

vi.mock('./domainVerifier', async () => {
  const actual = await vi.importActual<typeof import('./domainVerifier')>('./domainVerifier');
  return {
    ...actual,
    verifyDomain: vi.fn(),
  };
});

function result(overrides: Partial<DomainVerification> = {}): DomainVerification {
  return {
    state: 'verified',
    domain: 'emblem.example.org',
    title: 'Verified ADEM marking',
    message: 'This domain has a verified ADEM marking.',
    issuer: 'https://example.org',
    protectedAssets: ['adem.example.org'],
    endorsedBy: ['https://endorser.example'],
    tokenCount: 3,
    keyCount: 1,
    verification: {
      signed: true,
      organizational: true,
      endorsed: true,
    },
    ...overrides,
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.mocked(verifyDomain).mockReset();
    window.history.replaceState({}, '', '/');
  });

  test('shows the empty verifier state initially', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'ADEM verifier' })).toBeInTheDocument();
    expect(screen.getByText('No domain checked yet.')).toBeInTheDocument();
  });

  test('submits a domain and renders verified details', async () => {
    vi.mocked(verifyDomain).mockResolvedValue(result());
    render(<App />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Domain'), {
        target: { value: 'emblem.example.org' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    });

    expect(await screen.findByRole('heading', { name: 'Verified ADEM marking' })).toBeInTheDocument();
    expect(verifyDomain).toHaveBeenCalledWith('emblem.example.org');
    expect(screen.getByText('adem.example.org')).toBeInTheDocument();
    expect(screen.getByText('https://endorser.example')).toBeInTheDocument();
  });

  test('keeps the domain query parameter in sync with the input', async () => {
    render(<App />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Domain'), {
        target: { value: 'emblem.example.org' },
      });
    });

    expect(new URL(window.location.href).searchParams.get('domain')).toBe('emblem.example.org');

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Domain'), {
        target: { value: '' },
      });
    });

    expect(new URL(window.location.href).searchParams.has('domain')).toBe(false);
    expect(verifyDomain).not.toHaveBeenCalled();
  });

  test('loads the domain query parameter and verifies immediately', async () => {
    vi.mocked(verifyDomain).mockResolvedValue(result());
    window.history.replaceState({}, '', '/?domain=emblem.example.org');

    render(<App />);

    expect(screen.getByLabelText('Domain')).toHaveValue('emblem.example.org');
    expect(await screen.findByRole('heading', { name: 'Verified ADEM marking' })).toBeInTheDocument();
    expect(verifyDomain).toHaveBeenCalledWith('emblem.example.org');
  });

  test('renders incomplete verification failures', async () => {
    vi.mocked(verifyDomain).mockResolvedValue(result({
      state: 'inconclusive',
      title: 'Verification incomplete',
      message: 'Certificate Transparency verification could not be completed by this browser.',
      protectedAssets: [],
      endorsedBy: [],
      verification: {
        signed: false,
        organizational: false,
        endorsed: false,
      },
      stage: 'ct',
      diagnostic: 'Failed to fetch',
    }));
    render(<App />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Domain'), {
        target: { value: 'emblem.example.org' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    });

    expect(await screen.findByRole('heading', { name: 'Verification incomplete' })).toBeInTheDocument();
    expect(screen.getByText(/Certificate Transparency verification/)).toBeInTheDocument();
  });
});
