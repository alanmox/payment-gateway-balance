import { useCallback, useEffect, useRef, useState } from "react";

const REFRESH_MS = 60_000;

export function useBalance() {
  const [balances, setBalances] = useState(null); // null = not loaded yet
  const [fetchedAt, setFetchedAt] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(""); // soft, non-error message (rate limit)
  const [loading, setLoading] = useState(false);
  const retryTimer = useRef(null);

  const load = useCallback(async () => {
    clearTimeout(retryTimer.current);
    setLoading(true);
    try {
      const res = await fetch("/api/balance");
      const data = await res.json().catch(() => ({}));

      // Rate-limited by ClickPesa: wait, then retry automatically.
      if (data.retryAfter) {
        retryTimer.current = setTimeout(load, data.retryAfter * 1000 + 500);
        setNotice(`Connecting to ClickPesa… retrying in ${data.retryAfter}s`);
      } else {
        setNotice("");
      }

      if (res.ok) {
        setBalances(data.balances);
        setFetchedAt(new Date(data.fetchedAt));
        setError("");
      } else if (res.status !== 429) {
        throw new Error(data.error || "Could not load the balance.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      clearInterval(id);
      clearTimeout(retryTimer.current);
    };
  }, [load]);

  return { balances, fetchedAt, error, notice, loading, refresh: load };
}
