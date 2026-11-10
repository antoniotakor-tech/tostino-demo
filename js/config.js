/* Tostino shop configuration. Only PUBLIC values belong here.
   Never put a secret key (Snipcart secret API key, Mollie or other provider keys, webhook secrets) in this repository. */
window.TOSTINO = {
  // Snipcart PUBLIC API key. Use the TEST key while practising, the LIVE key only for a real shop.
  // Empty = payments are off: the site shows a "Payments are not configured" banner and logs a console warning.
  snipcartPublicKey: '',

  // Pin the Snipcart version: theming and CSS overrides need a fixed version (see SETUP.md).
  snipcartVersion: '3.9.0',

  // Absolute address of this site. Snipcart's price validation fetches snipcart.json from here,
  // so it must be a public URL (it cannot be localhost) and its domain must be registered in the Snipcart dashboard.
  siteUrl: 'https://antoniotakor-tech.github.io/tostino-demo/',

  currency: 'eur'
};
