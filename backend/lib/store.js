// Tiny JSON-file key/value store (no database).
// Used only to keep auth tokens and rate-limit cooldowns across restarts,
// so `node --watch` reloads don't mint new tokens and trip rate limits.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".token-cache.json");

let data = {};
try {
  data = JSON.parse(fs.readFileSync(FILE, "utf8")) || {};
} catch {
  data = {};
}

function save() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data), { mode: 0o600 });
  } catch (err) {
    console.warn("Could not write token cache:", err.message);
  }
}

export const store = {
  get: (key) => data[key],
  set(key, value) {
    data[key] = value;
    save();
  },
};
