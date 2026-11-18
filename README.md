# Payment Gateway Balances

A small full-stack dashboard that shows your available balance across Tanzanian and global payment gateways. It has no database: auth tokens are cached in memory and in `backend/.token-cache.json`, which is git-ignored and readable only by you.

| Provider  | Balance endpoint | Auth |
|-----------|------------------|------|
| ClickPesa | `GET /third-parties/account/balance` | client-id + api-key → token (1h) |
| Snippe    | `GET /v1/payments/balance` | `Bearer` API key |
| AzamPay   | `GET /api/v1/azampay/imt/CheckBalance/azampesa` (Azampesa) | appName/clientId/secret → token |
| Selcom    | `POST /v1/vendor/balance` (float) | HMAC-SHA256 signed headers |
| Stripe    | `GET /v1/balance` (available + pending) | `Bearer` secret key |
| PalmPesa  | none: API only has payments + status | n/a |
| FimiPaya  | none: no public API docs found | n/a |

## Project structure

```
backend/
  server.js            Express: /api/providers, /api/balance/:provider, serves frontend/dist
  lib/http.js          shared fetch, errors, TokenManager (token cache + rate-limit cooldown)
  lib/store.js         JSON-file key/value store for tokens
  providers/*.js       one file per gateway
frontend/              React + Vite
  src/Overview.jsx     all providers at a glance
  src/ProviderPage.jsx one dashboard per provider (#/clickpesa, #/stripe, …)
```

## Setup

```bash
npm run install:all
cp backend/.env.example backend/.env    # fill in only the providers you use
npm start                               # http://localhost:3000
```

Development with hot reload, using two terminals:

```bash
npm run dev:backend   # Express on :3000
npm run dev:frontend  # Vite on http://localhost:5173 (proxies /api)
```

## Adding a provider

Create `backend/providers/<id>.js` that exports `{ id, name, env: [...], fetchBalance }`. `fetchBalance()` returns `[{ currency, available, pending?, total?, label? }]` in major units. Then add it to `PROVIDERS` in `server.js`.

## Notes

- ClickPesa, Snippe and Selcom have no sandbox, so calls hit your live account. This app only reads balances.
- AzamPay defaults to sandbox. Set `AZAMPAY_ENV=production` for live keys.
- For Stripe, a restricted key with only **Balance: Read** is enough.
