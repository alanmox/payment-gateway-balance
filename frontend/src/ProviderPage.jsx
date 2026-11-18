import { useBalance } from "./useBalance.js";
import { Amount, RefreshButton, SetupHint, Skeleton, StatusPill } from "./components.jsx";

function BalanceRows({ data }) {
  if (!data) return <Skeleton />;
  if (!data.balances.length) return <p className="muted">No balances to show.</p>;
  return (
    <div className="balances">
      {data.balances.map((b) => (
        <div className="balance-block" key={b.currency + (b.label || "")}>
          {b.label && <p className="label">{b.label}</p>}
          <Amount value={b.available} currency={b.currency} />
          {(b.pending !== undefined || b.total !== undefined) && (
            <dl className="sub">
              {b.pending !== undefined && (
                <div>
                  <dt>Pending</dt>
                  <dd>
                    <Amount value={b.pending} currency={b.currency} size="sm" />
                  </dd>
                </div>
              )}
              {b.total !== undefined && (
                <div>
                  <dt>Total balance</dt>
                  <dd>
                    <Amount value={b.total} currency={b.currency} size="sm" />
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ProviderPage({ provider }) {
  const ready = provider.status === "ready";
  const { data, error, notice, loading, refresh } = useBalance(provider.id, ready);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="with-dot">
            <span className={`dot dot-${provider.id}`} aria-hidden="true" />
            {provider.name}
          </h1>
          <p className="muted">
            <StatusPill status={provider.status} error={error} />
            {provider.sandbox && ready && <span className="pill pill-sandbox">Sandbox</span>}
            {data?.livemode === false && <span className="pill pill-sandbox">Test mode</span>}
          </p>
        </div>
        {ready && <RefreshButton loading={loading} onClick={refresh} />}
      </div>

      <section className="card" aria-live="polite">
        <p className="label">Available balance</p>
        {provider.status === "unsupported" && <p className="notice">{provider.unsupported}</p>}
        {provider.status === "not_configured" && <SetupHint provider={provider} />}
        {ready && (error && !data ? null : <BalanceRows data={data} />)}
        {ready && (
          <p className={`status${error ? " error" : ""}`}>
            {error ||
              notice ||
              (data?.fetchedAt ? `Last updated ${data.fetchedAt.toLocaleTimeString()}` : "")}
          </p>
        )}
      </section>

      {(provider.note || provider.docsUrl || provider.website) && (
        <section className="card details">
          {provider.note && <p>{provider.note}</p>}
          <p className="links">
            {provider.docsUrl && (
              <a href={provider.docsUrl} target="_blank" rel="noreferrer">
                API documentation ↗
              </a>
            )}
            {provider.website && (
              <a href={provider.website} target="_blank" rel="noreferrer">
                Website ↗
              </a>
            )}
          </p>
        </section>
      )}
    </>
  );
}
