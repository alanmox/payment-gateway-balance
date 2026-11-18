// Docs: https://developers.selcommobile.com  (“Get Float Balance”)
// POST /v1/vendor/balance  body {vendor, pin, transid}
// Signing follows Selcom's official Node client (selcom-apigw-client):
//   Authorization: SELCOM base64(API_KEY)
//   Digest = base64(HMAC_SHA256("timestamp=<ts>&k1=v1&k2=v2...", API_SECRET))
//   Signed-Fields = keys of the JSON body, in order
import crypto from "node:crypto";
import { ApiError, errorMessage, readJson, request } from "../lib/http.js";

const env = () => process.env;

// ISO-8601 with local offset, e.g. 2026-11-18T14:05:09+03:00
function timestamp(d = new Date()) {
  const pad = (n) => String(Math.abs(n)).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
  );
}

function signedHeaders(body) {
  const ts = timestamp();
  const keys = Object.keys(body);
  const signing = [`timestamp=${ts}`, ...keys.map((k) => `${k}=${body[k]}`)].join("&");
  const digest = crypto.createHmac("sha256", env().SELCOM_API_SECRET).update(signing).digest("base64");
  return {
    "Content-Type": "application/json",
    Authorization: `SELCOM ${Buffer.from(env().SELCOM_API_KEY, "ascii").toString("base64")}`,
    "Digest-Method": "HS256",
    Digest: digest,
    Timestamp: ts,
    "Signed-Fields": keys.join(","),
  };
}

async function fetchBalance() {
  const base = (env().SELCOM_BASE_URL || "https://apigw.selcommobile.com").replace(/\/+$/, "");
  const body = {
    vendor: env().SELCOM_VENDOR,
    pin: env().SELCOM_PIN,
    transid: `BAL${Date.now()}`,
  };
  const res = await request(`${base}/v1/vendor/balance`, {
    method: "POST",
    headers: signedHeaders(body),
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (!res.ok || (data.resultcode && data.resultcode !== "000")) {
    throw new ApiError(502, errorMessage(data, `Selcom returned ${res.status}.`));
  }
  const balance = Number(data.data?.[0]?.balance);
  if (Number.isNaN(balance)) throw new ApiError(502, "Unexpected response from Selcom.");
  return [{ currency: "TZS", available: balance, label: "Float balance" }];
}

export default {
  id: "selcom",
  name: "Selcom",
  website: "https://www.selcom.net",
  docsUrl: "https://developers.selcommobile.com/#get-float-balance",
  env: ["SELCOM_API_KEY", "SELCOM_API_SECRET", "SELCOM_VENDOR", "SELCOM_PIN"],
  note: "Shows the vendor float balance. API access is granted by Selcom (info@selcom.net).",
  fetchBalance,
};
