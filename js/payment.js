/* Payment adapter. THIS IS A SIMULATION: no money moves and nothing leaves the browser.
   cart.js calls TostinoPayment.pay(order) and only cares about the Promise it gets back,
   so a real provider can replace the body of pay() without touching the rest of the shop.

   ---- Plugging in a real provider ----------------------------------------------------
   Option A: Stripe Payment Links (no server). Create one Payment Link per product/size in the
     Stripe dashboard, list them in products.json (e.g. "paymentLink" on each size), then:
         var link = order.items[0].paymentLink;   // Payment Links take one product per link
         window.location.href = link;             // Stripe hosts the payment page
         return new Promise(function () {});      // the browser leaves the page
     A multi-item cart needs Stripe Checkout Sessions instead, which needs a tiny server function
     (Cloudflare Worker / Netlify function) that creates the session and returns its URL.

   Option B: Snipcart (no server). Load Snipcart's script + CSS in <head>, add
     data-item-id / data-item-price / data-item-url / data-item-name to the "Add to cart" button
     in product.js and let Snipcart own the cart + checkout. Then js/cart.js and this file are
     no longer needed. Snipcart also needs its own origin allowed in the Content-Security-Policy meta tag.

   Whatever you pick: add the provider's domains to the CSP <meta> in every page, update privacy.html
   and cookies.html (the provider sets its own cookies), and replace the "practice project" notices.
   -------------------------------------------------------------------------------------- */
(function () {
  'use strict';
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  window.TostinoPayment = {
    pay: function (order) {
      // order = { id, items, totals, delivery, payment: 'ideal' | 'card' | 'applepay', customer }
      return wait(1100).then(function () {
        return { status: 'paid', reference: 'SIM-' + order.id }; // pretend the provider said yes
      });
    }
  };
})();
