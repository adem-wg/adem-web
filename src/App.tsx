import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Info, Search, ShieldCheck } from 'lucide-react';
import { normalizeDomain, Verification, VerificationState, verify } from './domainVerifier';

type RequestState =
  | { status: 'idle' }
  | { status: 'loading'; domain: string }
  | { status: 'done'; result: Verification | Error };

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

function ResultIcon({ state }: { state: VerificationState }) {
  if (state === 'marked') {
    return <CheckCircle2 aria-hidden="true" className="status-icon status-icon-success" />;
  }
  if (state === 'no-emblem') {
    return <Info aria-hidden="true" className="status-icon status-icon-info" />;
  }
  if (state === 'marked-with-errors') {
    return <CircleAlert aria-hidden="true" className="status-icon status-icon-warning" />;
  }
  return <CircleAlert aria-hidden="true" className="status-icon status-icon-danger" />;
}

function ResultView({ result }: { result: Verification | Error }) {
  let detailRows: string[][] = [];
  const verificationState = result instanceof Verification ? result.state() : 'errors';
  const emblemFound = result instanceof Verification && verificationState !== 'no-emblem';
  if (result instanceof Verification && emblemFound) {
    const tokens = result.tokens.length;
    const keys = result.keys.length;
    detailRows = useMemo(
      () => [
        ['Verification', result.result.results.join(', ')],
        ['DNS material', `${tokens} token${tokens === 1 ? '' : 's'}, ${keys} key${keys === 1 ? '' : 's'}`],
      ],
      [result],
    );
  }

  return (
    <section className={`result result-${verificationState}`} aria-live="polite">
      <div className="result-heading">
        <ResultIcon state={verificationState} />
        <div>
          <h2>{result instanceof Verification ? result.summary() : 'Could not start verification'}</h2>
        </div>
      </div>
      <p className="message">{result instanceof Verification ? result.message() : result.message}</p>

      {emblemFound && result.result.protected.length > 0 && (
        <div className="result-section">
          <p className="section-label">Marked assets</p>
            <div className="asset-list">
              {result.result.protected.map((asset) => (
                <span className="asset" key={asset}>{asset}</span>
              ))}
            </div>
        </div>
      )}

      {emblemFound && result.result.issuer !== undefined && (
        <div className="result-section">
          <p className="section-label">Issuer</p>
          <p className="section-value">{result.result.issuer}</p>
        </div>
      )}

      {emblemFound && result.result.endorsedBy.length > 0 && (
        <div className="result-section">
          <p className="section-label">Endorsed by</p>
          <ul className="endorsement-list">
            {result.result.endorsedBy.map((issuer) => (
              <li key={issuer}>{issuer}</li>
            ))}
          </ul>
        </div>
      )}

      {emblemFound && result.result.errors.length > 0 && (
        <details className="errors">
          <summary>Errors</summary>
          <ul>
            {result.result.errors.map((error, index) => (
              <li key={`${index}-${error}`}>{error.message}</li>
            ))}
          </ul>
        </details>
      )}

      {detailRows.length > 0 && (
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
          </details>
      )}
    </section>
  );
}

function App() {
  const [domain, setDomain] = useState(getInitialDomain);
  const [request, setRequest] = useState<RequestState>({ status: 'idle' });
  const shouldVerifyInitialDomain = useRef(domain.trim().length > 0);

  async function runVerification(value: string) {
    setRequest({ status: 'loading', domain: value });
    const submitted = normalizeDomain(value);
    if (submitted === undefined) {
      setRequest({ status: 'done', result: new Error('Please enter a valid domain name.') });
    } else {
      verify(submitted)
        .then((result) => setRequest({ status: 'done', result }))
        .catch((reason) => setRequest({ status: 'done', result: new Error(reason) }))
    }
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
          <h1 id="page-title">ADEM Verifier</h1>
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
