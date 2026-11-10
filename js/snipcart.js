/* Loads Snipcart (cart + checkout) and keeps it in step with the site language.
   - No public API key in js/config.js: nothing is loaded, a banner says so and the console gets a warning.
   - Snipcart opens from any element with the class snipcart-checkout and fills any .snipcart-items-count with the item count.
   - Product buttons (class snipcart-add-item) are built in js/product.js.
   Docs: https://docs.snipcart.com/v3/setup/installation */
(function () {
  'use strict';
  var C = window.TOSTINO || {};
  var T = window.Tostino;
  var loaded = false;

  function banner() {
    var existing = document.getElementById('pay-banner');
    if (existing) return existing;
    var b = document.createElement('p');
    b.id = 'pay-banner'; b.className = 'paybanner'; b.setAttribute('role', 'status');
    var top = document.querySelector('.topbar');
    if (top && top.parentNode) top.parentNode.insertBefore(b, top.nextSibling); else document.body.insertBefore(b, document.body.firstChild);
    return b;  // (the banner sits right under the dark top bar)
  }
  function paintBanner() {
    var b = banner(); if (b) b.textContent = T.t('pay.banner', 'Payments are not configured yet. You can look around, but you cannot buy.');
  }

  function load() {
    if (loaded) return; loaded = true;
    var v = C.snipcartVersion || '3.9.0', base = 'https://cdn.snipcart.com/themes/v' + v + '/default/';
    ['https://app.snipcart.com', 'https://cdn.snipcart.com'].forEach(function (h) {
      var l = document.createElement('link'); l.rel = 'preconnect'; l.href = h; document.head.appendChild(l);
    });
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'snipcart.css'; document.head.appendChild(css);
    var host = document.createElement('div');
    host.hidden = true; host.id = 'snipcart';
    host.setAttribute('data-api-key', C.snipcartPublicKey);
    host.setAttribute('data-currency', C.currency || 'eur');
    host.setAttribute('data-config-modal-style', 'side');       // side panel, like the old cart drawer
    document.body.appendChild(host);
    var js = document.createElement('script'); js.async = true; js.src = base + 'snipcart.js'; document.body.appendChild(js);
    document.addEventListener('snipcart.ready', function () { setLanguage(); });
  }

  // follow the EN / NL / IT switch (Snipcart ships nl and it translations)
  function setLanguage() {
    try { if (window.Snipcart && Snipcart.api) Snipcart.api.session.setLanguage(T.lang()); } catch (e) { console.warn('Tostino: could not set the Snipcart language', e); }
  }

  if (!T) return;
  if (!C.snipcartPublicKey) {
    console.warn('Tostino: no Snipcart public API key in js/config.js, so payments are disabled. See SETUP.md.');
    T.render(paintBanner);
    return;
  }
  T.render(function () { load(); setLanguage(); });
})();
