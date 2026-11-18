// Docs: https://developerdocs.azampay.co.tz
// Endpoints/hosts taken from the AzamPay SDK (github.com/trixa-tz/azampay):
//   Token:   POST {auth}/AppRegistration/GenerateToken  {appName, clientId, clientSecret}
//            → { data: { accessToken, expire } }
//   Balance: GET  {checkout}/api/v1/azampay/imt/CheckBalance/azampesa
// AzamPay's Tanzania checkout API has no balance endpoint; the Azampesa
// (IMT) balance is the only balance AzamPay exposes on Tanzanian hosts.
import { ApiError, TokenManager, errorMessage, rateLimited, readJson, request } from "../lib/http.js";

const env = () => process.env;
const HOSTS = {
  sandbox: {
    auth: "https://authenticator-sandbox.azampay.co.tz",
    checkout: "https://sandbox.azampay.co.tz",
  },
  production: {
    auth: "https://authenticator.azampay.co.tz",
    checkout: "https://checkout.azampay.co.tz",
  },
};
const hosts = () => (env().AZAMPAY_ENV === "production" ? HOSTS.production : HOSTS.sandbox);

const tokens = new TokenManager({
  key: "azampay",
  provider: "AzamPay",
  credentials: () => [env().AZAMPAY_ENV, env().AZAMPAY_APP_NAME, env().AZAMPAY_CLIENT_ID, env().AZAMPAY_CLIENT_SECRET],
  async mint() {
    const res = await request(`${hosts().auth}/AppRegistration/GenerateToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appName: env().AZAMPAY_APP_NAME,
        clientId: env().AZAMPAY_CLIENT_ID,
        clientSecret: env().AZAMPAY_CLIENT_SECRET,
      }),
    });
    const body = await readJson(res);
    if (res.status === 429) throw new ApiError(429, "rate limited", Number(res.headers.get("retry-after")) || 60);
    const token = body?.data?.accessToken;
    if (!res.ok || !token) {
      throw new ApiError(502, errorMessage(body, "Could not get an AzamPay token. Check app name, client ID and secret."));
    }
    const expire = Date.parse(body.data.expire);
    const expiresAt = Number.isNaN(expire) ? Date.now() + 55 * 60 * 1000 : expire - 60 * 1000;
    return { token, expiresAt };
  },
});

// The balance response shape isn't published, so search it for the first
// numeric field whose name contains "balance".
function findNumber(obj, re, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 4) return undefined;
  for (const [k, v] of Object.entries(obj)) {
    if (re.test(k) && v !== null && v !== "" && !Number.isNaN(Number(v)) && typeof v !== "object") return Number(v);
  }
  for (const v of Object.values(obj)) {
    const found = findNumber(v, re, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

async function fetchBalance(retry = true) {
  const headers = { Authorization: `Bearer ${await tokens.get()}` };
  if (env().AZAMPAY_API_KEY) headers["X-API-Key"] = env().AZAMPAY_API_KEY;

  const res = await request(`${hosts().checkout}/api/v1/azampay/imt/CheckBalance/azampesa`, { headers });
  if (res.status === 401 && retry) {
    tokens.invalidate();
    return fetchBalance(false);
  }
  const body = await readJson(res);
  if (res.status === 429) throw rateLimited(Number(res.headers.get("retry-after")) || 60, "AzamPay");
  if (!res.ok || body?.success === false) {
    throw new ApiError(502, errorMessage(body, `AzamPay returned ${res.status}.`));
  }
  const balance = findNumber(body, /balance/i) ?? findNumber(body, /amount/i);
  if (balance === undefined) throw new ApiError(502, "AzamPay response did not include a balance.");
  const currency = JSON.stringify(body).match(/"currency"\s*:\s*"([A-Z]{3})"/i)?.[1]?.toUpperCase() || "TZS";
  return [{ currency, available: balance, label: "Azampesa balance" }];
}

export default {
  id: "azampay",
  name: "AzamPay",
  website: "https://azampay.com",
  docsUrl: "https://developerdocs.azampay.co.tz",
  env: ["AZAMPAY_APP_NAME", "AZAMPAY_CLIENT_ID", "AZAMPAY_CLIENT_SECRET"],
  note:
    "AzamPay's Tanzania checkout API has no balance endpoint, so this shows the Azampesa (IMT) balance. " +
    "Set AZAMPAY_ENV=production for live keys (default: sandbox).",
  get sandbox() {
    return env().AZAMPAY_ENV !== "production";
  },
  fetchBalance,
};
