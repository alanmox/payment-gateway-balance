export function formatAmount(value, currency) {
  const n = Number(value) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: 2,
    })
      .format(n)
      .replace(currency, "")
      .trim();
  } catch {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
}

export const STATUS_LABEL = {
  ready: "Connected",
  not_configured: "Not configured",
  unsupported: "No balance API",
};
