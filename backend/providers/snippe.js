// Docs: https://docs.snippe.sh  ·  SDK: github.com/Neurotech-HQ/snippe-js-sdk
// GET /v1/payments/balance  →  { data: { available: {value, currency}, balance: {value, currency} } }
import { ApiError, errorMessage, rateLimited, readJson, request } from "../lib/http.js";

const BASE_URL = "https://api.snippe.sh";

async function fetchBalance() {
  const res = await request(`${BASE_URL}/v1/payments/balance`, {
    headers: { Authorization: `Bearer ${process.env.SNIPPE_API_KEY}`, Accept: "application/json" },
  });
  const body = await readJson(res);
  if (res.status === 429) {
    throw rateLimited(Number(res.headers.get("retry-after")) || 60, "Snippe");
  }
  if (res.status === 401 || res.status === 403) {
    throw new ApiError(502, errorMessage(body, "Snippe rejected the API key."));
  }
  if (!res.ok) throw new ApiError(502, errorMessage(body, `Snippe returned ${res.status}.`));

  const { available, balance } = body.data || {};
  if (!available) throw new ApiError(502, "Unexpected response from Snippe.");
  // Amounts are whole TZS (smallest unit = 1 TZS).
  return [
    {
      currency: available.currency || "TZS",
      available: Number(available.value) || 0,
      total: balance ? Number(balance.value) || 0 : undefined,
    },
  ];
}

export default {
  id: "snippe",
  name: "Snippe",
  website: "https://snippe.sh",
  docsUrl: "https://docs.snippe.sh",
  env: ["SNIPPE_API_KEY"],
  fetchBalance,
};
