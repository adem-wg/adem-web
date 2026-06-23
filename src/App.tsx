import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Info, Search, ShieldCheck } from 'lucide-react';
import { verifyDomain, type DomainVerification } from './domainVerifier';

type RequestState =
  | { status: 'idle' }
  | { status: 'loading'; domain: string }
  | { status: 'done'; result: DomainVerification };

const DOMAIN_QUERY_PARAM = 'domain';

function getInitialDomain(): string {
  return new URLSearchParams(window.location.search).get(DOMAIN_QUERY_PARAM) || '';
}

function syncDomainQueryParam(value: string): void {
  const url = new URL(window.location.href);
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    url.searchParams.delete(DOMAIN_QUERY_PARAM);
  } else {
    url.searchParams.set(DOMAIN_QUERY_PARAM, trimmed);
  }
  window.history.replaceState({}, '', url);
}

function ResultIcon({ result }: { result: DomainVerification }) {
  if (result.state === 'success') {
    return <CheckCircle2 aria-hidden="true" className="status-icon status-icon-success" />;
  }
  if (result.state === 'info') {
    return <Info aria-hidden="true" className="status-icon status-icon-info" />;
  }
  if (result.state === 'warning') {
    return <CircleAlert aria-hidden="true" className="status-icon status-icon-warning" />;
  }
  return <CircleAlert aria-hidden="true" className="status-icon status-icon-danger" />;
}

function ResultView({ result }: { result: DomainVerification }) {
  const detailRows = useMemo(
    () => [
      ['Verification', [
        result.verification.signed ? 'Signed' : undefined,
        result.verification.organizational ? 'Organizational' : undefined,
        result.verification.endorsed ? 'Endorsed' : undefined,
      ].filter(Boolean).join(', ') || 'Not verified'],
      ['Issuer', result.issuer || 'Not available'],
      ['Marked assets', result.protectedAssets.length.toString()],
      ['Endorsements', result.endorsedBy.length.toString()],
      ['DNS material', `${result.tokenCount} token${result.tokenCount === 1 ? '' : 's'}, ${result.keyCount} key${result.keyCount === 1 ? '' : 's'}`],
      ['Failure stage', result.stage || 'None'],
    ],
    [result],
  );

  return (
    <section className={`result result-${result.state}`} aria-live="polite">
      <div className="result-heading">
        <ResultIcon result={result} />
        <div>
          <p className="eyebrow">{result.domain || 'ADEM'}</p>
          <h2>{result.title}</h2>
        </div>
      </div>
      <p className="message">{result.message}</p>

      {result.protectedAssets.length > 0 && (
        <div className="asset-list" aria-label="Marked assets">
          {result.protectedAssets.map((asset) => (
            <span className="asset" key={asset}>{asset}</span>
          ))}
        </div>
      )}

      {result.endorsedBy.length > 0 && (
        <div className="endorsements">
          <p className="section-label">Endorsed by</p>
          <ul>
            {result.endorsedBy.map((issuer) => (
              <li key={issuer}>{issuer}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="details">
        <summary>Details</summary>
        <dl>
          {detailRows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {result.diagnostic && (
          <p className="diagnostic">{result.diagnostic}</p>
        )}
      </details>
    </section>
  );
}

function App() {
  const [domain, setDomain] = useState(getInitialDomain);
  const [request, setRequest] = useState<RequestState>({ status: 'idle' });
  const shouldVerifyInitialDomain = useRef(domain.trim().length > 0);

  async function runVerification(value: string) {
    const submitted = value.trim();
    setRequest({ status: 'loading', domain: submitted });
    const result = await verifyDomain(submitted);
    setRequest({ status: 'done', result });
  }

  useEffect(() => {
    if (!shouldVerifyInitialDomain.current || domain.trim().length === 0) {
      return;
    }

    shouldVerifyInitialDomain.current = false;
    void runVerification(domain);
  }, [domain]);

  function onDomainChange(event: ChangeEvent<HTMLInputElement>) {
    const nextDomain = event.target.value;
    setDomain(nextDomain);
    syncDomainQueryParam(nextDomain);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    syncDomainQueryParam(domain);
    await runVerification(domain);
  }

  return (
    <main className="app-shell">
      <section className="verifier-panel" aria-labelledby="page-title">
        <div className="brand-row">
          <ShieldCheck aria-hidden="true" className="brand-icon" />
          <h1 id="page-title">ADEM verifier</h1>
        </div>

        <form className="search-form" onSubmit={onSubmit}>
          <label htmlFor="domain">Domain</label>
          <div className="search-row">
            <input
              id="domain"
              name="domain"
              autoComplete="url"
              inputMode="url"
              placeholder="emblem.example.org"
              value={domain}
              onChange={onDomainChange}
              disabled={request.status === 'loading'}
            />
            <button type="submit" disabled={request.status === 'loading'}>
              <Search aria-hidden="true" />
              <span>{request.status === 'loading' ? 'Checking' : 'Verify'}</span>
            </button>
          </div>
        </form>

        {request.status === 'idle' && (
          <section className="empty-state" aria-live="polite">
            <p>No domain checked yet.</p>
          </section>
        )}

        {request.status === 'loading' && (
          <section className="loading-state" aria-live="polite">
            <div className="spinner" aria-hidden="true" />
            <p>Checking {request.domain || 'domain'}...</p>
          </section>
        )}

        {request.status === 'done' && <ResultView result={request.result} />}
      </section>
    </main>
  );
}

export default App;
