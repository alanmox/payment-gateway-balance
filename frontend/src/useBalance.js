import { useCallback, useEffect, useRef, useState } from "react";

const REFRESH_MS = 60_000;

/** Fetches /api/balance/:provider, refreshes every 60s, and backs off on rate limits. */
export function useBalance(providerId, enabled = true) {
  const [data, setData] = useState(null); // { balances, fetchedAt, livemode? }
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const retryTimer = useRef(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    clearTimeout(retryTimer.current);
    setLoading(true);
    try {
      const res = await fetch(`/api/balance/${providerId}`);
      const body = await res.json().catch(() => ({}));

      if (body.retryAfter) {
        retryTimer.current = setTimeout(load, body.retryAfter * 1000 + 500);
        setNotice(`Rate limited, retrying in ${body.retryAfter}s`);
      } else {
        setNotice("");
      }

      if (res.ok) {
        setData({ ...body, fetchedAt: new Date(body.fetchedAt) });
        setError("");
      } else if (res.status !== 429) {
        throw new Error(body.error || "Could not load the balance.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [providerId, enabled]);

  useEffect(() => {
    setData(null);
    setError("");
    setNotice("");
    if (!enabled) return;
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      clearInterval(id);
      clearTimeout(retryTimer.current);
    };
  }, [load, enabled]);

  return { data, error, notice, loading, refresh: load };
}

export function useProviders() {
  const [providers, setProviders] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/providers")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Backend not reachable."))))
      .then(setProviders)
      .catch((e) => setError(e.message));
  }, []);
  return { providers, error };
}
