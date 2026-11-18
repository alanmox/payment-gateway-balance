// Providers we show a dashboard for, but whose public API has no way to
// read an account balance.

export const palmpesa = {
  id: "palmpesa",
  name: "PalmPesa",
  website: "https://palmpesa.co.tz",
  docsUrl: "https://documentation.palmpesa.co.tz",
  env: [],
  unsupported:
    "PalmPesa's API (v2) only offers “Request Payment” and “Payment Status”. " +
    "It has no balance endpoint, so check your balance in the PalmPesa dashboard.",
};

export const fimipaya = {
  id: "fimipaya",
  name: "FimiPaya",
  website: null,
  docsUrl: null,
  env: [],
  unsupported:
    "No public API documentation for FimiPaya could be found. " +
    "Share the developer docs link and a balance endpoint can be added here.",
};
