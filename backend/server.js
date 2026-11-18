import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "./lib/http.js";
import clickpesa from "./providers/clickpesa.js";
import snippe from "./providers/snippe.js";
import azampay from "./providers/azampay.js";
import selcom from "./providers/selcom.js";
import stripe from "./providers/stripe.js";
import { palmpesa, fimipaya } from "./providers/unsupported.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { PORT = 3000 } = process.env;

const PROVIDERS = [clickpesa, snippe, azampay, selcom, stripe, palmpesa, fimipaya];
const byId = new Map(PROVIDERS.map((p) => [p.id, p]));

const missingEnv = (p) => p.env.filter((name) => !process.env[name]);

function statusOf(p) {
  if (p.unsupported) return "unsupported";
  return missingEnv(p).length ? "not_configured" : "ready";
}

// Last good result per provider, served while a provider is rate-limiting us.
const lastGood = new Map();

const app = express();
app.disable("x-powered-by");

app.get("/api/providers", (_req, res) => {
  res.json(
    PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      website: p.website,
      docsUrl: p.docsUrl,
      status: statusOf(p),
      env: p.env,
      missingEnv: missingEnv(p),
      note: p.note,
      unsupported: p.unsupported,
      sandbox: p.sandbox || false,
    }))
  );
});

app.get("/api/balance/:provider", async (req, res) => {
  const p = byId.get(req.params.provider);
  if (!p) return res.status(404).json({ error: "Unknown provider." });

  const status = statusOf(p);
  if (status === "unsupported") return res.status(501).json({ error: p.unsupported });
  if (status === "not_configured") {
    return res.status(503).json({ error: `Not configured. Set ${missingEnv(p).join(", ")} in backend/.env.` });
  }

  try {
    const result = await p.fetchBalance();
    const payload = {
      ...(Array.isArray(result) ? { balances: result } : result),
      fetchedAt: new Date().toISOString(),
    };
    lastGood.set(p.id, payload);
    res.json(payload);
  } catch (err) {
    const known = err instanceof ApiError;
    if (!known) console.error(`[${p.id}]`, err);
    if (known && err.status === 429 && lastGood.has(p.id)) {
      return res.json({ ...lastGood.get(p.id), stale: true, retryAfter: err.retryAfter });
    }
    res.status(known ? err.status : 500).json({
      error: known ? err.message : "Unexpected server error.",
      retryAfter: known ? err.retryAfter : undefined,
    });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Serve the built React app (SPA fallback for client-side routes).
const dist = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(dist));
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(PORT, () => {
  console.log(`Balance dashboard running at http://localhost:${PORT}`);
  for (const p of PROVIDERS) console.log(`  ${p.name.padEnd(10)} ${statusOf(p)}`);
});
