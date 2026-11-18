import crypto from "node:crypto";
import { store } from "./store.js";

export class ApiError extends Error {
  /**
   * @param {number} status HTTP status to send to the browser
   * @param {string} message human-readable message
   * @param {number} [retryAfter] seconds, for rate limits
   */
  constructor(status, message, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function rateLimited(seconds, provider) {
  const secs = Math.max(1, Math.ceil(seconds));
  return new ApiError(429, `Waiting for ${provider} rate limit. Retrying in ${secs}s.`, secs);
}

export async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 200) };
  }
}

/** Pull a readable error message out of the many shapes providers use. */
export function errorMessage(body, fallback) {
  return (
    body?.error?.message ||
    (typeof body?.error === "string" && body.error) ||
    body?.message ||
    body?.msg ||
    fallback
  );
}

const TIMEOUT_MS = 15_000;

export async function request(url, options = {}) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const reason = err.name === "TimeoutError" ? "timed out" : "could not be reached";
    throw new ApiError(502, `${new URL(url).host} ${reason}.`);
  }
}

const fingerprint = (...parts) =>
  crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);

/**
 * Caches a provider's access token in memory + the token file, dedupes
 * concurrent mints, and honours rate-limit cooldowns.
 *
 * `mint()` must resolve to `{ token, expiresAt }` (ms epoch) or throw an
 * ApiError; an ApiError with `retryAfter` starts a cooldown.
 */
export class TokenManager {
  constructor({ key, provider, credentials, mint }) {
    this.key = `token:${key}`;
    this.provider = provider;
    this.credentials = credentials; // () => string[]; a change invalidates the cache
    this.mint = mint;
    this.pending = null;
  }

  #state() {
    const fp = fingerprint(...this.credentials());
    const s = store.get(this.key);
    return s?.fp === fp ? s : { fp };
  }

  async get() {
    const s = this.#state();
    const now = Date.now();
    if (s.token && s.expiresAt > now) return s.token;
    if (this.pending) return this.pending;
    if (s.blockedUntil > now) throw rateLimited((s.blockedUntil - now) / 1000, this.provider);

    this.pending = (async () => {
      try {
        const { token, expiresAt } = await this.mint();
        store.set(this.key, { fp: s.fp, token, expiresAt });
        return token;
      } catch (err) {
        if (err instanceof ApiError && err.retryAfter) {
          store.set(this.key, { fp: s.fp, blockedUntil: Date.now() + err.retryAfter * 1000 });
        }
        throw err;
      } finally {
        this.pending = null;
      }
    })();
    return this.pending;
  }

  invalidate() {
    const s = this.#state();
    store.set(this.key, { fp: s.fp, blockedUntil: s.blockedUntil });
  }
}
