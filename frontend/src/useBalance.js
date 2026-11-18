import { useCallback, useEffect, useState } from "react";

const REFRESH_MS = 60_000;

export function useBalance() {
  const [balances, setBalances] = useState(null); // null = not loaded yet
  const [fetchedAt, setFetchedAt] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/balance");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load the balance.");
      setBalances(data.balances);
      setFetchedAt(new Date(data.fetchedAt));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return { balances, fetchedAt, error, loading, refresh: load };
}
