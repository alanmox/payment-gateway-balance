import { useBalance } from "./useBalance.js";
import { Amount, RefreshButton, Skeleton, StatusPill } from "./components.jsx";

function ProviderCard({ provider }) {
  const ready = provider.status === "ready";
  const { data, error, notice, loading, refresh } = useBalance(provider.id, ready);
  const first = data?.balances?.[0];

  let body;
  if (provider.status === "unsupported") body = <p className="muted small">Balance not available via API</p>;
  else if (provider.status === "not_configured") body = <p className="muted small">Add API keys to connect</p>;
  else if (error) body = <p className="small error">{error}</p>;
  else if (!data) body = <Skeleton width="60%" />;
  else if (!first) body = <p className="muted small">No balances</p>;
  else
    body = (
      <>
        <Amount value={first.available} currency={first.currency} size="md" />
        {data.balances.length > 1 && (
          <p className="muted small">+{data.balances.length - 1} more currenc{data.balances.length > 2 ? "ies" : "y"}</p>
        )}
      </>
    );

  return (
    <article className={`pcard status-${provider.status}`}>
      <header className="pcard-head">
        <a className="pcard-name" href={`#/${provider.id}`}>
          <span className={`dot dot-${provider.id}`} aria-hidden="true" />
          {provider.name}
        </a>
        <StatusPill status={provider.status} error={error} />
      </header>
      <div className="pcard-body">{body}</div>
      <footer className="pcard-foot">
        <span className="muted small">
          {notice || (data?.fetchedAt ? `Updated ${data.fetchedAt.toLocaleTimeString()}` : " ")}
        </span>
        {ready && <RefreshButton compact loading={loading} onClick={refresh} />}
      </footer>
      <a className="pcard-link" href={`#/${provider.id}`} aria-label={`Open ${provider.name} dashboard`} />
    </article>
  );
}

export default function Overview({ providers }) {
  const ready = providers.filter((p) => p.status === "ready").length;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>All balances</h1>
          <p className="muted">
            {ready} of {providers.length} providers connected. Updates every 60 seconds.
          </p>
        </div>
      </div>
      <div className="grid">
        {providers.map((p) => (
          <ProviderCard key={p.id} provider={p} />
        ))}
      </div>
    </>
  );
}
