// Docs: https://docs.stripe.com/api/balance/balance_retrieve
// GET /v1/balance → { available: [{amount, currency}], pending: [{amount, currency}] }
import { ApiError, errorMessage, rateLimited, readJson, request } from "../lib/http.js";

// Stripe amounts are in the smallest currency unit.
// https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL = new Set(
  "bif clp djf gnf jpy kmf krw mga pyg rwf ugx vnd vuv xaf xof xpf".split(" ")
);
const THREE_DECIMAL = new Set("bhd jod kwd omr tnd".split(" "));

function toMajor(amount, currency) {
  const c = currency.toLowerCase();
  if (ZERO_DECIMAL.has(c)) return amount;
  if (THREE_DECIMAL.has(c)) return amount / 1000;
  return amount / 100;
}

async function fetchBalance() {
  const res = await request("https://api.stripe.com/v1/balance", {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  const body = await readJson(res);
  if (res.status === 429) throw rateLimited(Number(res.headers.get("retry-after")) || 10, "Stripe");
  if (!res.ok) throw new ApiError(502, errorMessage(body, `Stripe returned ${res.status}.`));

  const byCurrency = new Map();
  const row = (cur) => {
    const key = cur.toUpperCase();
    if (!byCurrency.has(key)) byCurrency.set(key, { currency: key, available: 0, pending: 0 });
    return byCurrency.get(key);
  };
  for (const a of body.available || []) row(a.currency).available += toMajor(a.amount, a.currency);
  for (const p of body.pending || []) row(p.currency).pending += toMajor(p.amount, p.currency);

  return { balances: [...byCurrency.values()], livemode: body.livemode };
}

export default {
  id: "stripe",
  name: "Stripe",
  website: "https://stripe.com",
  docsUrl: "https://docs.stripe.com/api/balance/balance_retrieve",
  env: ["STRIPE_SECRET_KEY"],
  note: "Use a restricted key with only “Balance: Read” permission.",
  fetchBalance,
};
