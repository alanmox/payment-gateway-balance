import express from "express";
import fs from "node:fs";
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

// ---- Token cache (no database) ----
// ClickPesa tokens are valid for 1 hour, and you can only mint one
// per Client ID per IP every 3 minutes. The token is kept in memory and
// mirrored to a small file so server restarts (e.g. `node --watch`)
// reuse it instead of minting a new one and hitting the rate limit.
const TOKEN_TTL_MS = 55 * 60 * 1000; // refresh a little before the 1h expiry
const TOKEN_FILE = path.join(__dirname, ".token-cache.json");
let cachedToken = null;
let tokenExpiresAt = 0;
let pendingToken = null; // dedupe concurrent token requests
let blockedUntil = 0; // set after a 429; no token requests before this time
let lastBalance = null; // last good response, served while rate-limited

function loadTokenFile() {
  try {
    const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
    if (saved.clientId === CLICKPESA_CLIENT_ID && saved.expiresAt > Date.now()) {
      cachedToken = saved.token;
      tokenExpiresAt = saved.expiresAt;
    }
    if (saved.clientId === CLICKPESA_CLIENT_ID && saved.blockedUntil > Date.now()) {
      blockedUntil = saved.blockedUntil;
    }
  } catch {
    /* no cache yet */
  }
}

function saveTokenFile() {
  try {
    fs.writeFileSync(
      TOKEN_FILE,
      JSON.stringify({ clientId: CLICKPESA_CLIENT_ID, token: cachedToken, expiresAt: tokenExpiresAt, blockedUntil }),
      { mode: 0o600 }
    );
  } catch (err) {
    console.warn("Could not write token cache:", err.message);
  }
}

loadTokenFile();

class ApiError extends Error {
  constructor(status, message, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter; // seconds, for 429s
  }
}

function rateLimitError() {
  const secs = Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1000));
  return new ApiError(429, `Waiting for ClickPesa rate limit. Retrying in ${secs}s.`, secs);
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
  if (Date.now() < blockedUntil) throw rateLimitError(); // don't burn more attempts

  pendingToken = (async () => {
    if (!CLICKPESA_CLIENT_ID || !CLICKPESA_API_KEY) {
      throw new ApiError(500, "Server is missing ClickPesa credentials.");
    }
    const res = await fetch(`${BASE_URL}/generate-token`, {
      method: "POST",
      headers: { "client-id": CLICKPESA_CLIENT_ID, "api-key": CLICKPESA_API_KEY },
    });
    const body = await readJson(res);
    if (res.status === 429) {
      const secs = Number(res.headers.get("retry-after")) || body.fields?.retryAfterSeconds || 180;
      blockedUntil = Date.now() + secs * 1000;
      saveTokenFile();
      throw rateLimitError();
    }
    if (!res.ok || !body.token) {
      throw new ApiError(502, body.message || "Could not get a ClickPesa token.");
    }
    cachedToken = body.token; // already prefixed with "Bearer "
    tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
    blockedUntil = 0;
    saveTokenFile();
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
    lastBalance = { balances, fetchedAt: new Date().toISOString() };
    res.json(lastBalance);
  } catch (err) {
    const known = err instanceof ApiError;
    if (!known) console.error(err);
    // While rate-limited, keep showing the last good balance.
    if (known && err.status === 429 && lastBalance) {
      return res.json({ ...lastBalance, stale: true, retryAfter: err.retryAfter });
    }
    res.status(known ? err.status : 500).json({
      error: known ? err.message : "Unexpected server error.",
      retryAfter: known ? err.retryAfter : undefined,
    });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Balance dashboard running at http://localhost:${PORT}`);
});
