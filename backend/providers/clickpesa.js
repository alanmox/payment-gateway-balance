// Docs: https://docs.clickpesa.com/api-reference/account/get-account-balance
import { ApiError, TokenManager, errorMessage, readJson, request } from "../lib/http.js";

const BASE_URL = "https://api.clickpesa.com/third-parties";
const env = () => process.env;

// Tokens last 1h; ClickPesa allows one new token per Client ID per IP every 3 min.
const tokens = new TokenManager({
  key: "clickpesa",
  provider: "ClickPesa",
  credentials: () => [env().CLICKPESA_CLIENT_ID, env().CLICKPESA_API_KEY],
  async mint() {
    const res = await request(`${BASE_URL}/generate-token`, {
      method: "POST",
      headers: { "client-id": env().CLICKPESA_CLIENT_ID, "api-key": env().CLICKPESA_API_KEY },
    });
    const body = await readJson(res);
    if (res.status === 429) {
      const secs = Number(res.headers.get("retry-after")) || body.fields?.retryAfterSeconds || 180;
      throw new ApiError(429, "rate limited", secs);
    }
    if (!res.ok || !body.token) {
      throw new ApiError(502, errorMessage(body, "Could not get a ClickPesa token."));
    }
    // token is already prefixed with "Bearer "
    return { token: body.token, expiresAt: Date.now() + 55 * 60 * 1000 };
  },
});

async function fetchBalance(retry = true) {
  const res = await request(`${BASE_URL}/account/balance`, {
    headers: { Authorization: await tokens.get() },
  });
  if (res.status === 401 && retry) {
    tokens.invalidate();
    return fetchBalance(false);
  }
  const body = await readJson(res);
  if (res.status === 404) {
    throw new ApiError(
      404,
      "No balance account is linked yet. It appears after your first successful payment or deposit."
    );
  }
  if (!res.ok) throw new ApiError(502, errorMessage(body, `ClickPesa returned ${res.status}.`));

  return (Array.isArray(body) ? body : []).map((b) => ({
    currency: b.currency,
    available: Number(b.balance) || 0,
  }));
}

export default {
  id: "clickpesa",
  name: "ClickPesa",
  website: "https://clickpesa.com",
  docsUrl: "https://docs.clickpesa.com/api-reference/account/get-account-balance",
  env: ["CLICKPESA_CLIENT_ID", "CLICKPESA_API_KEY"],
  fetchBalance,
};
