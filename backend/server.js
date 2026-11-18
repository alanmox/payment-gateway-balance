import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = "https://api.clickpesa.com/third-parties";
const { CLICKPESA_CLIENT_ID, CLICKPESA_API_KEY, PORT = 3000 } = process.env;

if (!CLICKPESA_CLIENT_ID || !CLICKPESA_API_KEY) {
  console.warn(
    "⚠  CLICKPESA_CLIENT_ID / CLICKPESA_API_KEY are not set. Copy backend/.env.example to backend/.env and fill them in."
  );
}

// ---- In-memory token cache (no database) ----
// ClickPesa tokens are valid for 1 hour, and you can only mint one
// per Client ID per IP every 3 minutes, so we reuse the token.
const TOKEN_TTL_MS = 55 * 60 * 1000; // refresh a little before the 1h expiry
let cachedToken = null;
let tokenExpiresAt = 0;
let pendingToken = null; // dedupe concurrent token requests

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function getToken({ force = false } = {}) {
  if (!force && cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  if (pendingToken) return pendingToken;

  pendingToken = (async () => {
    if (!CLICKPESA_CLIENT_ID || !CLICKPESA_API_KEY) {
      throw new ApiError(500, "Server is missing ClickPesa credentials.");
    }
    const res = await fetch(`${BASE_URL}/generate-token`, {
      method: "POST",
      headers: { "client-id": CLICKPESA_CLIENT_ID, "api-key": CLICKPESA_API_KEY },
    });
    const body = await readJson(res);
    if (!res.ok || !body.token) {
      throw new ApiError(res.status === 429 ? 429 : 502, body.message || "Could not get a ClickPesa token.");
    }
    cachedToken = body.token; // already prefixed with "Bearer "
    tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
    return cachedToken;
  })();

  try {
    return await pendingToken;
  } finally {
    pendingToken = null;
  }
}

async function fetchBalance(retry = true) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/account/balance`, {
    headers: { Authorization: token },
  });

  if (res.status === 401 && retry) {
    // Token expired early or was revoked: drop it and try once more.
    cachedToken = null;
    return fetchBalance(false);
  }
  const body = await readJson(res);
  if (res.status === 404) {
    throw new ApiError(404, "No balance account is linked yet. It appears after your first successful payment or deposit.");
  }
  if (!res.ok) {
    throw new ApiError(502, body.message || `ClickPesa returned ${res.status}.`);
  }
  return Array.isArray(body) ? body : [];
}

// ---- App ----
const app = express();
app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "..", "frontend", "dist")));

app.get("/api/balance", async (_req, res) => {
  try {
    const balances = await fetchBalance();
    res.json({ balances, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    if (!(err instanceof ApiError)) console.error(err);
    res.status(status).json({ error: err instanceof ApiError ? err.message : "Unexpected server error." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Balance dashboard running at http://localhost:${PORT}`);
});
