import { formatAmount, STATUS_LABEL } from "./format.js";

export function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
      />
    </svg>
  );
}

export function RefreshButton({ loading, onClick, compact = false }) {
  return (
    <button
      className={`btn${loading ? " spin" : ""}${compact ? " icon-only" : ""}`}
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="Refresh balance"
    >
      <RefreshIcon />
      {!compact && "Refresh"}
    </button>
  );
}

export function StatusPill({ status, error }) {
  const s = error && status === "ready" ? "error" : status;
  const label = s === "error" ? "Error" : STATUS_LABEL[status];
  return <span className={`pill pill-${s}`}>{label}</span>;
}

export function Amount({ value, currency, size = "lg" }) {
  return (
    <span className={`amount-wrap amount-${size}`}>
      <span className="currency">{currency}</span>
      <span className="amount">{formatAmount(value, currency)}</span>
    </span>
  );
}

export function Skeleton({ width = "70%" }) {
  return <div className="skeleton" style={{ width }} />;
}

export function SetupHint({ provider }) {
  return (
    <div className="setup">
      <p>Add these to <code>backend/.env</code> and restart the backend:</p>
      <pre>{provider.missingEnv.map((v) => `${v}=`).join("\n")}</pre>
    </div>
  );
}
