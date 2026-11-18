# ClickPesa Balance Dashboard

A small full-stack app that shows your available ClickPesa balance. It has no database: the auth token lives in server memory only.

## Project structure

```
backend/    Express API (server.js), talks to ClickPesa
frontend/   React + Vite UI
  src/App.jsx         page layout
  src/useBalance.js   fetches /api/balance and refreshes every 60s
```

## Setup

```bash
npm run install:all                     # installs backend + frontend
cp backend/.env.example backend/.env    # then add your Client ID and API key
```

Get your Client ID and API key from the ClickPesa dashboard, under **API Integration Setup**.

## Run

**Production:** build React, and Express serves it:

```bash
npm start            # http://localhost:3000
```

**Development:** hot reload, with two terminals:

```bash
npm run dev:backend  # Express on :3000
npm run dev:frontend # Vite on http://localhost:5173 (proxies /api to :3000)
```

## How it works

- `backend/server.js`
  - `POST /third-parties/generate-token` gets a token, which is cached in memory for 55 minutes (tokens last 1 hour, and ClickPesa allows only one new token every 3 minutes).
  - `GET /api/balance` calls `GET /third-parties/account/balance` and returns `{ balances: [{ currency, balance }], fetchedAt }`.
  - If ClickPesa answers 401, the server gets a new token and retries once.
  - The server also serves the built React app from `frontend/dist`.
- `frontend/` calls `/api/balance`. Your API keys never reach the browser.

> ClickPesa has no sandbox, so every call runs against your live account. This app only reads data.
