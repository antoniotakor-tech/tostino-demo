# Tostino (practice project)

An invented small coffee roastery in Utrecht, with a working shop. Plain HTML, CSS and vanilla JavaScript.
No framework, no build step, no cookies, no tracking. The checkout is a **simulation**: no real payment is taken.
Tostino, Giulia Ferri, the prices, reviews and contact details are made up.

## Run it locally

The site loads `products.json` and the language files with `fetch`, so it must be served over HTTP
(opening `index.html` by double-click will not work). From this folder:

```bash
python3 -m http.server 8790
```

Then open http://localhost:8790

## Publish it

Live demo: https://antoniotakor-tech.github.io/tostino-demo/ · Source: https://github.com/antoniotakor-tech/tostino-demo

Both hosts serve the folder as it is. There is nothing to build.

**GitHub Pages**
1. Push this folder to a repository (the files must be at the root of the published branch).
2. Settings, Pages, "Deploy from a branch", pick `main` and `/ (root)`.
3. The site appears at `https://<user>.github.io/<repo>/`. All links are relative, so a sub-path works.

**Cloudflare Pages**
1. Create a project and connect the repository (or use "Direct upload" and drop the folder).
2. Framework preset: none. Build command: empty. Output directory: `/`.
3. Optional: add a `_headers` file for real security headers (`X-Frame-Options`, `Referrer-Policy`). GitHub Pages cannot set headers.

Every page has `noindex, nofollow` and `robots.txt` disallows everything. Remove both when it becomes a real business.

## Folder map

```
index.html shop.html product.html cart.html order.html about.html contact.html privacy.html cookies.html terms.html
products.json        all products, prices, tasting notes (English source)
lang/en|nl|it.json   all interface text and product translations
css/style.css        one stylesheet, colour tokens at the top
js/app.js            language switch, cart store, header, footer, cart drawer (shared by every page)
js/home.js shop.js product.js cart.js order.js contact.js   one small script per page
js/payment.js        the payment adapter (simulation, see below)
assets/              photos, logo and self-hosted fonts (Inter and Fraunces, OFL licences included)
```

`order.html` is the order confirmation page. Header and footer are written once in `js/app.js` and injected on every page.

## Images

Put these in `assets/`: `logo.svg`, `hero-workshop`, `giulia`, `bag`, `mug`, `v60`, `moka`, `giftset`
(`.png`, `.jpg`, `.jpeg` or `.webp`: the site tries each extension). A missing image shows a cream placeholder with its name.
The file name per product is set in `products.json` (`"image": "assets/bag.png"`).

## Add a product

1. Add an object to `products` in `products.json`. Coffee needs `roast` (`light|medium|dark`), `notes`, `brewWith`,
   `taste` and `sizes` (`[{ "label": "250 g", "price": 8.50 }]`). Accessories need a single `price`.
   Optional: `colors`, `contents`, `featured: true` (shown on the home page).
2. Put its photo in `assets/` and point `image` at it.
3. Add its texts to the three language files so NL and IT do not fall back to English:
   `pname.<id>` (accessories; coffee names stay as they are), `pdesc.<id>`, `origin.<id>` (coffee), and
   `note.<slug>` for any new tasting note (slug = lowercase with dashes: "dark cocoa" becomes `note.dark-cocoa`).
4. The shop filters, product page and cart pick it up automatically.

Shipping (€4.95, free over €40) lives at the top of `products.json`. The "Ships in 48 hours · Free shipping over €40"
text is in the language files (`top.ship`, `co.ship`).

## Connect a real payment provider

All checkout code goes through one function: `TostinoPayment.pay(order)` in `js/payment.js`. It currently waits a second and says "paid".
The file has a comment block showing where to plug in:

- **Stripe Payment Links** (no server): one link per product and size, then redirect with `window.location.href`.
  A mixed cart needs Stripe Checkout Sessions, which needs a small serverless function.
- **Snipcart** (no server): add its script and `data-item-*` attributes to the "Add to cart" button and let it own cart and checkout.

When you do this, also: allow the provider's domains in the `Content-Security-Policy` meta tag on every page,
update `privacy.html` and `cookies.html` (providers set cookies), replace the "practice project" notices,
and add real company details (KvK, VAT, return address).

## Privacy, accessibility, performance

- No cookies, no analytics, no third-party requests (fonts are self-hosted). `localStorage` keeps the language and the cart;
  `sessionStorage` keeps the last practice order until the tab closes. See `cookies.html`.
- Strict CSP meta tag (same origin only). No inline scripts or styles.
- Semantic HTML, skip link, visible focus, keyboard-operable cart drawer (Escape closes, focus is trapped and returned),
  labelled form fields with inline errors, `prefers-reduced-motion` respected.
- Contrast: small orange labels use a deeper orange (`--accent-text`, 5.3:1 on cream) and orange buttons carry near-black text (5.0:1).
  The pure `#D2691E` is only used as a fill.
- Images are lazy-loaded with width and height set. Under 40 KB of JavaScript in total and one stylesheet.
