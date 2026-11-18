import { useBalance } from "./useBalance.js";

const amountFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
      />
    </svg>
  );
}

function BalanceList({ balances }) {
  if (balances === null) return <div className="skeleton" />;
  if (balances.length === 0) return <p>No balances to show.</p>;
  return balances.map(({ currency, balance }) => (
    <div className="row" key={currency}>
      <span className="currency">{currency}</span>
      <span className="amount">{amountFormat.format(Number(balance) || 0)}</span>
    </div>
  ));
}

export default function App() {
  const { balances, fetchedAt, error, loading, refresh } = useBalance();
  // Hide the skeleton if the very first load failed.
  const shown = balances === null && error ? [] : balances;

  return (
    <main className="wrap">
      <header className="top">
        <div className="brand">
          <span className="dot" aria-hidden="true" />
          <span>ClickPesa</span>
        </div>
        <button
          className={`btn${loading ? " spin" : ""}`}
          type="button"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshIcon />
          Refresh
        </button>
      </header>

      <section className="card" aria-live="polite">
        <p className="label">Available balance</p>
        <div className="balances">
          {shown?.length === 0 && error ? null : <BalanceList balances={shown} />}
        </div>
        {error ? (
          <p className="status error">{error}</p>
        ) : fetchedAt ? (
          <p className="status">Last updated {fetchedAt.toLocaleTimeString()}</p>
        ) : null}
      </section>

      <p className="foot">
        Updates every 60 seconds. Your API keys stay on the server and never reach this page.
      </p>
    </main>
  );
}
