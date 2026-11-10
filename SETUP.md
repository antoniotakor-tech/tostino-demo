# Snipcart setup (practice shop)

How to switch on the cart and checkout. Everything below is done in the Snipcart dashboard or in `js/config.js`. Shipping, payment and tax are **never** faked in JavaScript.

Read this first, it changes the plan: **Snipcart's Test mode cannot use Stripe.** See "Payment: the plain answer" below.

Menu names marked *(check)* come from older or partial documentation. Snipcart's dashboard changes, so compare them with what you see.

---

## 1. Get the public API key

1. Create a Snipcart account (free to start). New accounts begin in **Test mode**.
2. In the dashboard open **Account → Credentials** (the error message in the console calls it "Store management > API keys") and copy the **Public API key for the Test environment**.
3. Paste it into `js/config.js`:
   ```js
   snipcartPublicKey: 'YOUR_PUBLIC_TEST_KEY',
   ```
   Only the **public** key goes in the code. Never commit the secret API key, a Stripe secret key or webhook secrets.
4. Until a key is there, the site shows the banner "Payments are not configured yet" and logs a console warning. Nothing breaks.

## 2. Register the domain (required for price validation)

Snipcart checks every price against `snipcart.json`, fetched from the site. The address must be allowed:

1. Dashboard → **Store configurations → Domains & URLs**.
2. Set the **default domain** to `antoniotakor-tech.github.io` (host only; subdomains must be listed one by one).
3. `siteUrl` in `js/config.js` must stay `https://antoniotakor-tech.github.io/tostino-demo/`. It cannot be `localhost`: Snipcart's server has to reach the file.

## 3. Payment: the plain answer

What the documentation says (checked 11 Nov 2026):

- **Test mode** has one built-in test payment method. The docs say: "In Test mode, you can integrate custom payment gateways. However, a default test payment method remains constant. All other payment gateway integrations become accessible only in Live mode." So you cannot connect Stripe (or Mollie) and pay with Stripe test cards while Snipcart is in Test mode.
- **Stripe through Snipcart** is listed as **credit card only**. That list is from 2021 and Snipcart's current release notes do not mention iDEAL, Apple Pay or Payment Element for Stripe. **I could not confirm that iDEAL works through Snipcart's Stripe integration. Assume it does not.**
- **iDEAL** is listed under the **Mollie** gateway.
- Each Snipcart account connects to **one** payment gateway, and you must first fill in **Account → Billing & Payments**.
- Snipcart and your gateway must use the same currency (EUR).

What you can do:

| Goal | Option |
|---|---|
| Try the whole flow without money | Stay in **Test mode** and use Snipcart's default test payment method. Carts, shipping, tax, emails and orders all work. |
| Try Stripe test cards | Needs Snipcart in **Live mode** with Stripe connected using Stripe **test** keys. Ask Snipcart support first whether that is allowed on your plan and whether it starts billing. Not verified. |
| Offer iDEAL | Use **Mollie** as the gateway (it lists iDEAL). Mollie is also Live-mode only in Snipcart. Or build a Snipcart *custom payment gateway* (more work). |
| Stripe without a cart | Stripe Payment Links, one per product. No cart, one item per payment. |

Dutch rule for real iDEAL shops: a KvK number must be shown. The footer shows a clearly fictional one (`KvK 12345678 (fictional)`). Replace it with your real number before going live.

## 4. Shipping *(check menu names)*

Dashboard → **Store configurations → Shipping**.

1. Method **PostNL**: €4.95, rate for the Netherlands.
2. **Free over €40**: Snipcart handles this as a shipping discount that sets shipping to €0 when the order total reaches €40 (an order-total trigger). Create it as a discount or as a conditional rule on the PostNL method, whichever your dashboard offers.
3. Method **Pickup in Utrecht (Tue–Sat)**: €0. Snipcart cannot limit it to opening days, so say "Tue–Sat 09:00–17:00" in the method's name or description.
4. **Delivery countries**: allow only the **Netherlands**.

## 5. Tax and VAT

The shop sends prices **including** tax: every Add-to-cart button carries `data-item-has-taxes-included="true"`.

1. Dashboard → **Store configurations → Taxes** (menu name confirmed by the docs).
2. Make sure your profile has a country set, then create the rate for the **Netherlands** and tick **Included in price**.
3. Decide whether **Applies on shipping** is ticked (then shipping is part of the VAT total).
4. **Confirm with an accountant (I did not guess any rate):**
   - the VAT rate for ground coffee and for mugs, drippers and mokas (they may differ);
   - the rate for shipping and for gift sets;
   - the small-business scheme (KOR) and whether you charge VAT at all;
   - what to show for customers outside the Netherlands (the shop delivers only inside it);
   - which VAT number and invoice details must appear.

## 6. Emails *(check menu names)*

Dashboard → **Store configurations → Email** (or Settings → Emails): turn on the order notification to you and the confirmation to the customer, set the sender name and reply-to (`ciao@tostino.example` is fictional, use a real address).

## 7. Where the orders are

Dashboard → **Orders**. In Test mode they appear under the Test environment only (Test and Live are separate).

---

## How prices stay safe

Products are drawn by JavaScript, so Snipcart's HTML crawler cannot see them. Instead every button points to `snipcart.json` (`data-item-url`). When a customer pays, Snipcart fetches that file and compares each cart item's `id` and `price`. A mismatch stops the payment and no order is created.

- One item per coffee size: `canale-blend-250g`, `canale-blend-1kg`. Accessories use the product id (`tostino-mug`).
- Grind and mug colour are custom fields without a price change.
- **After you change a price or add a product:**
  ```bash
  node scripts/build-snipcart-json.js
  ```
  then commit `snipcart.json` together with `products.json`. No dependencies, Node 14 or newer.
- Test the protection: in the browser console on a product page run
  `document.getElementById('pdp-add').setAttribute('data-item-price','0.01')`, add to cart and try to pay. Snipcart should answer that the price does not match. (Snipcart validates at payment time, not when the item is added.)

## What else the code does

- **Language**: the EN / NL / IT switch also sets Snipcart's language (`Snipcart.api.session.setLanguage`). Snipcart ships Dutch and Italian.
- **Theme**: brand colours are CSS variables on `#snipcart` at the end of `css/style.css` (Snipcart theming needs v3.2 or newer, version pinned in `js/config.js`). Snipcart's own fonts are not loaded, see below.
- **Content-Security-Policy**: the meta tag allows `cdn.snipcart.com`, `app.snipcart.com` and `js.stripe.com`. Snipcart's script needs `'unsafe-eval'` (without it the console shows an EvalError and the cart does not start), which weakens the policy. The default theme also tries to load Montserrat and Open Sans from `fonts.bunny.net`; that is **blocked on purpose** (no extra third party), so the cart uses a fallback font.
- **Old simulated checkout**: `cart.html`, `order.html`, `js/cart.js`, `js/order.js`, `js/payment.js` and the cart drawer in `js/app.js` are still in the repository, unlinked. Delete them once a real test purchase works end to end.

## Checklist before a real shop

- [ ] Real company details, KvK and VAT number, return address in the footer and legal pages.
- [ ] Legal pages checked by a professional (they are a starting point).
- [ ] Gateway chosen and tested; Live key in `js/config.js`.
- [ ] VAT rates confirmed; shipping rules tested for pickup and for free shipping over €40.
- [ ] Cookie consent decision for what Snipcart and the gateway store.
- [ ] Remove `noindex` and `robots.txt` Disallow when you want to be found.
