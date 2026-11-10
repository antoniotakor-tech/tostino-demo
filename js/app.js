/* Tostino practice shop: shared code for every page.
   - i18n (EN / NL / IT, JSON files in /lang, choice remembered in localStorage)
   - cart store (localStorage only, no cookies)
   - header, footer and slide-in cart drawer (injected so they are written once)
   Page scripts register with Tostino.render(fn): fn runs once the site is ready and again on every language change. */
(function () {
  'use strict';

  var LANGS = ['en', 'nl', 'it'];
  var LOCALES = { en: 'en-IE', nl: 'nl-NL', it: 'it-IT' };
  var KEY_LANG = 'tostino.lang';
  var KEY_CART = 'tostino.cart';
  var KEY_ORDER = 'tostino.lastOrder'; // sessionStorage
  var MAX_QTY = 20;

  var dicts = {};
  var lang = 'en';
  var data = null; // products.json
  var renderers = [];
  var ready = false;

  /* ---------- tiny helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function store(kind) { try { return window[kind]; } catch (e) { return null; } }
  function read(kind, key, fallback) {
    try { var raw = store(kind).getItem(key); return raw == null ? fallback : JSON.parse(raw); } catch (e) { return fallback; }
  }
  function write(kind, key, value) {
    try { store(kind).setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked: the site still works for this visit */ }
  }
  function readRaw(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function writeRaw(key, v) { try { localStorage.setItem(key, v); } catch (e) { /* ignore */ } }

  /* ---------- i18n ---------- */
  function t(key, fallback, vars) {
    var s = dicts[lang] && dicts[lang][key];
    if (s == null) s = dicts.en && dicts.en[key];
    if (s == null) s = fallback != null ? fallback : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }
  function loadDict(l) {
    if (dicts[l]) return Promise.resolve();
    return fetch('lang/' + l + '.json').then(function (r) { return r.json(); }).then(function (j) { dicts[l] = j; })
      .catch(function () { dicts[l] = {}; });
  }
  function applyI18n(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n'), el.textContent); });
    root.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var i = pair.indexOf('=');
        if (i > 0) el.setAttribute(pair.slice(0, i).trim(), t(pair.slice(i + 1).trim(), el.getAttribute(pair.slice(0, i).trim()) || ''));
      });
    });
  }
  function money(n) {
    return new Intl.NumberFormat(LOCALES[lang], { style: 'currency', currency: (data && data.currency) || 'EUR' }).format(n);
  }
  function pickLang() {
    var saved = readRaw(KEY_LANG);
    if (LANGS.indexOf(saved) > -1) return saved;
    var nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return LANGS.indexOf(nav) > -1 ? nav : 'en';
  }
  function setLang(l) {
    if (LANGS.indexOf(l) < 0) return Promise.resolve();
    return loadDict(l).then(function () {
      lang = l;
      writeRaw(KEY_LANG, l);
      document.documentElement.lang = l;
      var page = document.body.getAttribute('data-page');
      if (page && page !== 'product') document.title = t('title.' + page, document.title);
      document.querySelectorAll('.langs button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === l)); });
      applyI18n();
      renderers.forEach(function (fn) { fn(); });
      ddSync();
      updateCartUI();
    });
  }

  /* ---------- products ---------- */
  function loadProducts() {
    if (data) return Promise.resolve(data);
    return fetch('products.json').then(function (r) { return r.json(); }).then(function (j) { data = j; return j; });
  }
  function product(id) { return data && data.products.filter(function (p) { return p.id === id; })[0]; }
  var P = {
    name: function (p) { return t('pname.' + p.id, p.name); },
    desc: function (p) { return t('pdesc.' + p.id, p.description); },
    origin: function (p) { return t('origin.' + p.id, p.origin || ''); },
    note: function (n) { return t('note.' + slug(n), n); },
    grind: function (g) { return t('grind.' + slug(g), g); },
    color: function (c) { return t('color.' + slug(c), c); },
    roast: function (r) { return t('roastname.' + r, r); },
    isCoffee: function (p) { return p.category === 'coffee'; },
    from: function (p) { return p.sizes ? Math.min.apply(null, p.sizes.map(function (s) { return s.price; })) : p.price; },
    unit: function (p, sizeLabel) {
      if (!p.sizes) return p.price;
      var s = p.sizes.filter(function (x) { return x.label === sizeLabel; })[0] || p.sizes[0];
      return s.price;
    }
  };

  /* ---------- images with graceful fallback ---------- */
  var BEAN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(35 12 12)"><ellipse cx="12" cy="12" rx="6.4" ry="9.4" fill="currentColor"/><path class="bean-line" d="M12 3.2c-3.6 4.4 3.6 8.2 0 17.6" fill="none" stroke-width="1.7" stroke-linecap="round"/></g></svg>';
  var EXTS = ['png', 'jpg', 'jpeg', 'webp'];
  // sizes (optional): adds a srcset from the -400 / -800 variants next to the original, so small slots do not download the full photo
  function imgTag(src, alt, label, w, h, eager, sizes) {
    var set = '';
    var m = sizes && src.match(/^(.*)\.webp$/);
    if (m) set = ' srcset="' + esc(m[1]) + '-400.webp 400w, ' + esc(m[1]) + '-800.webp 800w, ' + esc(src) + ' 1264w" sizes="' + esc(sizes) + '"';
    return '<img src="' + esc(src) + '"' + set + ' alt="' + esc(alt) + '" data-ph="' + esc(label || alt) + '" width="' + (w || 600) + '" height="' + (h || 600) + '"' + (eager ? '' : ' loading="lazy"') + ' decoding="async">';
  }
  function placeholder(img) {
    var d = document.createElement('div');
    d.className = 'ph';
    d.setAttribute('role', 'img');
    d.setAttribute('aria-label', img.getAttribute('alt') || img.getAttribute('data-ph') || '');
    d.innerHTML = BEAN + '<span>' + esc(img.getAttribute('data-ph') || '') + '</span>';
    if (img.parentNode) img.parentNode.replaceChild(d, img);
  }
  function imgFailed(img) {
    img.removeAttribute('srcset'); img.removeAttribute('sizes');
    // Try the other usual extensions once each (the brief mentions both .png and .jpg), then show a cream placeholder.
    var tried = (img.getAttribute('data-tried') || '').split(',').filter(Boolean);
    var m = img.getAttribute('src').match(/^(.*)\.([a-z]+)$/i);
    if (m) {
      tried.push(m[2].toLowerCase());
      var next = EXTS.filter(function (e) { return tried.indexOf(e) < 0; })[0];
      if (next) { img.setAttribute('data-tried', tried.join(',')); img.setAttribute('src', m[1] + '.' + next); return; }
    }
    placeholder(img);
  }
  document.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') imgFailed(e.target); }, true);
  function checkImages() {
    document.querySelectorAll('img').forEach(function (img) { if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) imgFailed(img); });
  }

  /* ---------- product card (home + shop) ---------- */
  function card(p) {
    var coffee = P.isCoffee(p);
    var notes = coffee ? '<div class="tags">' + p.notes.map(function (n) { return '<span class="tag">' + esc(P.note(n)) + '</span>'; }).join('') + '</div>' : '';
    var price = coffee ? t('price.from', 'from {price}', { price: money(P.from(p)) }) : money(p.price);
    return '<article class="card"><div class="card__img">' + imgTag(p.image, P.name(p), P.name(p), 600, 600, false, '(max-width: 559px) calc(100vw - 32px), 280px') + '</div><div class="card__body">' +
      (coffee ? '<span class="roast roast--' + p.roast + '"><i></i>' + esc(P.roast(p.roast)) + '</span>' : '') +
      '<h3 class="card__title"><a href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(P.name(p)) + '</a></h3>' +
      (coffee ? '<p class="card__meta">' + esc(P.origin(p)) + '</p>' : '') + notes +
      '<p class="card__price">' + esc(price) + '</p></div></article>';
  }

  /* ---------- cart store ---------- */
  var cart = read('localStorage', KEY_CART, []);
  if (!Array.isArray(cart)) cart = [];
  function saveCart() { write('localStorage', KEY_CART, cart); updateCartUI(); }
  function keyOf(i) { return [i.id, i.size || '', i.grind || '', i.color || ''].join('|'); }
  var Cart = {
    items: function () { return cart.slice(); },
    add: function (item) {
      var k = keyOf(item), found = cart.filter(function (c) { return keyOf(c) === k; })[0];
      var qty = Math.max(1, Math.min(MAX_QTY, item.qty || 1));
      if (found) found.qty = Math.min(MAX_QTY, found.qty + qty); else cart.push({ id: item.id, size: item.size || '', grind: item.grind || '', color: item.color || '', qty: qty });
      saveCart();
    },
    setQty: function (k, q) {
      cart = cart.map(function (c) { if (keyOf(c) === k) c.qty = Math.min(MAX_QTY, q); return c; }).filter(function (c) { return c.qty > 0; });
      saveCart();
    },
    clear: function () { cart = []; saveCart(); },
    key: keyOf,
    count: function () { return cart.reduce(function (n, c) { return n + c.qty; }, 0); },
    lines: function () {
      return cart.map(function (c) {
        var p = product(c.id);
        if (!p) return null;
        var unit = P.unit(p, c.size);
        return { item: c, product: p, unit: unit, total: unit * c.qty, key: keyOf(c) };
      }).filter(Boolean);
    },
    totals: function (method) {
      var lines = Cart.lines();
      var subtotal = lines.reduce(function (n, l) { return n + l.total; }, 0);
      var ship = data.shipping;
      var shipping = (!lines.length || method === 'pickup' || subtotal >= ship.freeOver) ? 0 : ship.flat;
      return { subtotal: subtotal, shipping: shipping, total: subtotal + shipping, free: lines.length > 0 && method !== 'pickup' && subtotal >= ship.freeOver, toFree: Math.max(0, ship.freeOver - subtotal) };
    }
  };

  /* Cart line markup, shared by the drawer and cart.html */
  function lineHTML(l) {
    var p = l.product, c = l.item, opts = [];
    if (c.size) opts.push(c.size);
    if (c.grind) opts.push(P.grind(c.grind));
    if (c.color) opts.push(P.color(c.color));
    var name = P.name(p);
    return '<li class="line"><div class="line__img">' + imgTag(p.image, name, name, 72, 72, false, '72px') + '</div><div>' +
      '<p class="line__name"><a href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(name) + '</a></p>' +
      '<p class="line__opts">' + esc(opts.join(' · ')) + '</p>' +
      '<div class="line__row"><div class="qty" role="group" aria-label="' + esc(t('qty.label', 'Quantity')) + ': ' + esc(name) + '">' +
      '<button type="button" data-act="dec" data-key="' + esc(l.key) + '" aria-label="' + esc(t('qty.dec', 'Fewer')) + '">&minus;</button>' +
      '<output aria-live="polite">' + c.qty + '</output>' +
      '<button type="button" data-act="inc" data-key="' + esc(l.key) + '" aria-label="' + esc(t('qty.inc', 'More')) + '"' + (c.qty >= MAX_QTY ? ' disabled' : '') + '>+</button></div>' +
      '<span class="line__price">' + esc(money(l.total)) + '</span></div>' +
      '<button type="button" class="link-btn" data-act="remove" data-key="' + esc(l.key) + '">' + esc(t('cart.remove', 'Remove')) + '</button>' +
      '</div></li>';
  }
  function totalsHTML(tot, method) {
    var shipLabel = method === 'pickup' ? t('cart.pickup', 'Pickup') : t('cart.shipping', 'Shipping');
    var shipVal = tot.shipping === 0 ? t('cart.free', 'Free') : money(tot.shipping);
    var note = '';
    if (method !== 'pickup' && Cart.lines().length) {
      note = tot.free ? t('cart.freeship', 'You get free shipping.') : t('cart.toFree', 'Add {amount} more for free shipping.', { amount: money(tot.toFree) });
    }
    return '<dl class="totals"><div><dt>' + esc(t('cart.subtotal', 'Subtotal')) + '</dt><dd>' + esc(money(tot.subtotal)) + '</dd></div>' +
      '<div><dt>' + esc(shipLabel) + '</dt><dd>' + esc(shipVal) + '</dd></div>' +
      '<div class="grand"><dt>' + esc(t('cart.total', 'Total')) + '</dt><dd>' + esc(money(tot.total)) + '</dd></div></dl>' +
      (note ? '<p class="shipnote">' + esc(note) + '</p>' : '');
  }

  /* ---------- header, footer, drawer ---------- */
  // Header and footer are written into every page by the builder (no layout shift, work without JS). Only the cart drawer is created here.
  function injectChrome() {
    var d = document.createElement('div');
    d.className = 'ph';
    d.setAttribute('role', 'img');
    d.setAttribute('aria-label', img.getAttribute('alt') || img.getAttribute('data-ph') || '');
    d.innerHTML = BEAN + '<span>' + esc(img.getAttribute('data-ph') || '') + '</span>';
    if (img.parentNode) img.parentNode.replaceChild(d, img);
  }
  function imgFailed(img) {
    img.removeAttribute('srcset'); img.removeAttribute('sizes');
    // Try the other usual extensions once each (the brief mentions both .png and .jpg), then show a cream placeholder.
    var tried = (img.getAttribute('data-tried') || '').split(',').filter(Boolean);
    var m = img.getAttribute('src').match(/^(.*)\.([a-z]+)$/i);
    if (m) {
      tried.push(m[2].toLowerCase());
      var next = EXTS.filter(function (e) { return tried.indexOf(e) < 0; })[0];
      if (next) { img.setAttribute('data-tried', tried.join(',')); img.setAttribute('src', m[1] + '.' + next); return; }
    }
    placeholder(img);
  }
  document.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') imgFailed(e.target); }, true);
  function checkImages() {
    document.querySelectorAll('img').forEach(function (img) { if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) imgFailed(img); });
  }

  /* ---------- product card (home + shop) ---------- */
  function card(p) {
    var coffee = P.isCoffee(p);
    var notes = coffee ? '<div class="tags">' + p.notes.map(function (n) { return '<span class="tag">' + esc(P.note(n)) + '</span>'; }).join('') + '</div>' : '';
    var price = coffee ? t('price.from', 'from {price}', { price: money(P.from(p)) }) : money(p.price);
    return '<article class="card"><div class="card__img">' + imgTag(p.image, P.name(p), P.name(p), 600, 600, false, '(max-width: 559px) calc(100vw - 32px), 280px') + '</div><div class="card__body">' +
      (coffee ? '<span class="roast roast--' + p.roast + '"><i></i>' + esc(P.roast(p.roast)) + '</span>' : '') +
      '<h3 class="card__title"><a href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(P.name(p)) + '</a></h3>' +
      (coffee ? '<p class="card__meta">' + esc(P.origin(p)) + '</p>' : '') + notes +
      '<p class="card__price">' + esc(price) + '</p></div></article>';
  }

  /* ---------- cart store ---------- */
  var cart = read('localStorage', KEY_CART, []);
  if (!Array.isArray(cart)) cart = [];
  function saveCart() { write('localStorage', KEY_CART, cart); updateCartUI(); }
  function keyOf(i) { return [i.id, i.size || '', i.grind || '', i.color || ''].join('|'); }
  var Cart = {
    items: function () { return cart.slice(); },
    add: function (item) {
      var k = keyOf(item), found = cart.filter(function (c) { return keyOf(c) === k; })[0];
      var qty = Math.max(1, Math.min(MAX_QTY, item.qty || 1));
      if (found) found.qty = Math.min(MAX_QTY, found.qty + qty); else cart.push({ id: item.id, size: item.size || '', grind: item.grind || '', color: item.color || '', qty: qty });
      saveCart();
    },
    setQty: function (k, q) {
      cart = cart.map(function (c) { if (keyOf(c) === k) c.qty = Math.min(MAX_QTY, q); return c; }).filter(function (c) { return c.qty > 0; });
      saveCart();
    },
    clear: function () { cart = []; saveCart(); },
    key: keyOf,
    count: function () { return cart.reduce(function (n, c) { return n + c.qty; }, 0); },
    lines: function () {
      return cart.map(function (c) {
        var p = product(c.id);
        if (!p) return null;
        var unit = P.unit(p, c.size);
        return { item: c, product: p, unit: unit, total: unit * c.qty, key: keyOf(c) };
      }).filter(Boolean);
    },
    totals: function (method) {
      var lines = Cart.lines();
      var subtotal = lines.reduce(function (n, l) { return n + l.total; }, 0);
      var ship = data.shipping;
      var shipping = (!lines.length || method === 'pickup' || subtotal >= ship.freeOver) ? 0 : ship.flat;
      return { subtotal: subtotal, shipping: shipping, total: subtotal + shipping, free: lines.length > 0 && method !== 'pickup' && subtotal >= ship.freeOver, toFree: Math.max(0, ship.freeOver - subtotal) };
    }
  };

  /* Cart line markup, shared by the drawer and cart.html */
  function lineHTML(l) {
    var p = l.product, c = l.item, opts = [];
    if (c.size) opts.push(c.size);
    if (c.grind) opts.push(P.grind(c.grind));
    if (c.color) opts.push(P.color(c.color));
    var name = P.name(p);
    return '<li class="line"><div class="line__img">' + imgTag(p.image, name, name, 72, 72, false, '72px') + '</div><div>' +
      '<p class="line__name"><a href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(name) + '</a></p>' +
      '<p class="line__opts">' + esc(opts.join(' · ')) + '</p>' +
      '<div class="line__row"><div class="qty" role="group" aria-label="' + esc(t('qty.label', 'Quantity')) + ': ' + esc(name) + '">' +
      '<button type="button" data-act="dec" data-key="' + esc(l.key) + '" aria-label="' + esc(t('qty.dec', 'Fewer')) + '">&minus;</button>' +
      '<output aria-live="polite">' + c.qty + '</output>' +
      '<button type="button" data-act="inc" data-key="' + esc(l.key) + '" aria-label="' + esc(t('qty.inc', 'More')) + '"' + (c.qty >= MAX_QTY ? ' disabled' : '') + '>+</button></div>' +
      '<span class="line__price">' + esc(money(l.total)) + '</span></div>' +
      '<button type="button" class="link-btn" data-act="remove" data-key="' + esc(l.key) + '">' + esc(t('cart.remove', 'Remove')) + '</button>' +
      '</div></li>';
  }
  function totalsHTML(tot, method) {
    var shipLabel = method === 'pickup' ? t('cart.pickup', 'Pickup') : t('cart.shipping', 'Shipping');
    var shipVal = tot.shipping === 0 ? t('cart.free', 'Free') : money(tot.shipping);
    var note = '';
    if (method !== 'pickup' && Cart.lines().length) {
      note = tot.free ? t('cart.freeship', 'You get free shipping.') : t('cart.toFree', 'Add {amount} more for free shipping.', { amount: money(tot.toFree) });
    }
    return '<dl class="totals"><div><dt>' + esc(t('cart.subtotal', 'Subtotal')) + '</dt><dd>' + esc(money(tot.subtotal)) + '</dd></div>' +
      '<div><dt>' + esc(shipLabel) + '</dt><dd>' + esc(shipVal) + '</dd></div>' +
      '<div class="grand"><dt>' + esc(t('cart.total', 'Total')) + '</dt><dd>' + esc(money(tot.total)) + '</dd></div></dl>' +
      (note ? '<p class="shipnote">' + esc(note) + '</p>' : '');
  }

  /* ---------- header, footer, drawer ---------- */
  var MARK = '<svg class="logo__mark" viewBox="0 0 44 44" aria-hidden="true" focusable="false"><circle cx="22" cy="22" r="21" class="mark-bg"/><g transform="rotate(35 22 22)"><ellipse cx="22" cy="22" rx="7.4" ry="11.4" class="mark-bean"/><path class="mark-line" d="M22 11.4c-4.4 5.2 4.4 9.6 0 21.2" fill="none" stroke-width="2" stroke-linecap="round"/></g></svg>';
  var WORDBEAN = '<svg class="logo__bean" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(35 12 12)"><ellipse cx="12" cy="12" rx="6.2" ry="9.6" fill="currentColor"/><path class="bean-line" d="M12 3c-3.8 4.6 3.8 8.4 0 18" fill="none" stroke-width="2" stroke-linecap="round"/></g></svg>';
  var CART_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2.5l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>';

  function injectChrome() {
    var page = document.body.getAttribute('data-page');
    var cur = function (names) { return names.indexOf(page) > -1 ? ' aria-current="page"' : ''; };
    var langBtns = LANGS.map(function (l) { return '<button type="button" data-lang="' + l + '" lang="' + l + '" aria-pressed="false">' + l.toUpperCase() + '</button>'; }).join('');
    var header = document.getElementById('site-header');
    if (header) header.innerHTML =
      '<div class="topbar"><div class="wrap topbar__in"><span data-i18n="top.address">Oudegracht 112, Utrecht</span><span data-i18n="top.ship">Ships in 48 hours · Free shipping over €40</span></div></div>' +
      '<header class="top"><div class="wrap top__in">' +
      '<a class="logo" href="index.html" aria-label="Tostino" data-i18n-attr="aria-label=logo.aria">' + MARK + '<span class="logo__word" aria-hidden="true">tostin' + WORDBEAN + '</span></a>' +
      '<nav class="nav" aria-label="Main" data-i18n-attr="aria-label=nav.aria"><a href="shop.html"' + cur(['shop', 'product']) + ' data-i18n="nav.shop">Shop</a><a href="about.html"' + cur(['about']) + ' data-i18n="nav.about">About</a><a href="index.html#visit" data-i18n="nav.visit">Visit</a></nav>' +
      '<div class="langs" role="group" aria-label="Language" data-i18n-attr="aria-label=lang.label">' + langBtns + '</div>' +
      '<button class="cartbtn" type="button" data-cart-open aria-haspopup="dialog">' + CART_ICON + '<span class="cartbtn__label" data-i18n="cart.title">Cart</span><span class="cartbtn__count" data-cart-count>0</span></button>' +
      '</div></header>';

    var footer = document.getElementById('site-footer');
    if (footer) footer.innerHTML =
      '<footer class="foot"><div class="wrap"><div class="foot__grid">' +
      '<div><h3 data-i18n="foot.brand">Tostino</h3><p data-i18n="foot.blurb">Small-batch coffee roastery on the Oudegracht in Utrecht.</p><p>Oudegracht 112, Utrecht<br><a href="mailto:ciao@tostino.example">ciao@tostino.example</a></p></div>' +
      '<div><h3 data-i18n="foot.shop">Shop</h3><ul><li><a href="shop.html" data-i18n="nav.shop">Shop</a></li><li><a href="about.html" data-i18n="nav.about">About</a></li><li><a href="contact.html" data-i18n="nav.contact">Contact</a></li><li><a href="cart.html" data-i18n="cart.title">Cart</a></li><li><a href="https://github.com/antoniotakor-tech/tostino-demo" target="_blank" rel="noopener noreferrer" data-i18n="foot.github">Source code on GitHub</a></li></ul></div>' +
      '<div><h3 data-i18n="foot.legal">Legal</h3><ul><li><a href="privacy.html" data-i18n="foot.privacy">Privacy</a></li><li><a href="cookies.html" data-i18n="foot.cookies">Cookies</a></li><li><a href="terms.html" data-i18n="foot.terms">Terms and shipping</a></li></ul></div>' +
      '</div><p class="foot__note" data-i18n="foot.practice">Practice project: Tostino is an invented business. Names, prices, reviews and contact details are made up.</p></div></footer>';

    var d = document.createElement('div');
    d.innerHTML = '<div class="overlay" data-cart-close></div>' +
      '<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabindex="-1">' +
      '<div class="drawer__head"><h2 id="drawer-title" data-i18n="cart.title">Cart</h2><button class="iconbtn" type="button" data-cart-close aria-label="Close" data-i18n-attr="aria-label=cart.close">&times;</button></div>' +
      '<div class="drawer__body" id="drawer-body"></div><div class="drawer__foot" id="drawer-foot"></div></aside>';
    while (d.firstChild) document.body.appendChild(d.firstChild);
  }

  var lastFocus = null;
  function drawerEl() { return document.getElementById('drawer'); }
  function setInert(on) {
    ['site-header', 'site-main', 'site-footer'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); }
    });
  }
  function openDrawer() {
    var dr = drawerEl();
    if (!dr || dr.classList.contains('is-open')) return;
    lastFocus = document.activeElement;
    renderDrawer();
    dr.classList.add('is-open');
    document.querySelector('.overlay').classList.add('is-open');
    document.body.classList.add('is-locked');
    setInert(true);
    // focus after the drawer has become visible (a hidden element cannot take focus)
    setTimeout(function () { var b = dr.querySelector('.iconbtn'); if (b) b.focus(); }, 30);
  }
  function closeDrawer() {
    var dr = drawerEl();
    if (!dr || !dr.classList.contains('is-open')) return;
    dr.classList.remove('is-open');
    document.querySelector('.overlay').classList.remove('is-open');
    document.body.classList.remove('is-locked');
    setInert(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function renderDrawer() {
    var body = document.getElementById('drawer-body'), foot = document.getElementById('drawer-foot');
    if (!body || !data) return;
    var lines = Cart.lines();
    if (!lines.length) {
      body.innerHTML = '<div class="emptycart"><p>' + esc(t('cart.empty', 'Your cart is empty.')) + '</p><a class="btn btn--ghost" href="shop.html">' + esc(t('cart.keep', 'Browse the shop')) + '</a></div>';
      foot.innerHTML = '';
      return;
    }
    body.innerHTML = '<ul>' + lines.map(lineHTML).join('') + '</ul>';
    foot.innerHTML = totalsHTML(Cart.totals('ship'), 'ship') +
      '<a class="btn btn--block" href="cart.html#checkout">' + esc(t('cart.checkout', 'Checkout')) + '</a>' +
      '<a class="btn btn--ghost btn--block" href="cart.html">' + esc(t('cart.view', 'View cart')) + '</a>';
  }
  function updateCartUI() {
    var n = Cart.count();
    document.querySelectorAll('[data-cart-count]').forEach(function (el) { el.textContent = n; });
    document.querySelectorAll('[data-cart-open]').forEach(function (el) { el.setAttribute('aria-label', t('cart.aria', 'Open cart, {n} items', { n: n })); });
    if (drawerEl() && drawerEl().classList.contains('is-open')) renderDrawer();
    document.dispatchEvent(new CustomEvent('tostino:cart'));
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-cart-open],[data-cart-close],[data-act],.langs button') : null;
    if (!el) return;
    if (el.hasAttribute('data-cart-open')) { openDrawer(); return; }
    if (el.hasAttribute('data-cart-close')) { closeDrawer(); return; }
    if (el.hasAttribute('data-lang')) { setLang(el.getAttribute('data-lang')); return; }
    var act = el.getAttribute('data-act'), k = el.getAttribute('data-key');
    var line = cart.filter(function (c) { return keyOf(c) === k; })[0];
    if (!line) return;
    if (act === 'inc') Cart.setQty(k, line.qty + 1);
    if (act === 'dec') Cart.setQty(k, line.qty - 1);
    if (act === 'remove') Cart.setQty(k, 0);
  });
  document.addEventListener('keydown', function (e) {
    var dr = drawerEl();
    if (!dr || !dr.classList.contains('is-open')) return;
    if (e.key === 'Escape') { closeDrawer(); return; }
    if (e.key === 'Tab') { // keep focus inside the drawer
      var f = dr.querySelectorAll('a[href],button:not([disabled])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- opening hours (home + contact) ---------- */
  function renderVisit() {
    var rows = document.querySelectorAll('.hours tr[data-days]');
    var status = document.querySelectorAll('[data-status]');
    if (!rows.length && !status.length) return;
    var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    var get = function (type) { return parts.filter(function (p) { return p.type === type; })[0].value; };
    var day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday')];
    var mins = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);
    var open = day >= 2 && day <= 6 && mins >= 9 * 60 && mins < 17 * 60;
    rows.forEach(function (r) { r.classList.toggle('is-today', r.getAttribute('data-days').split(',').indexOf(String(day)) > -1); });
    status.forEach(function (el) {
      el.classList.toggle('is-open', open);
      el.querySelector('span:last-child').textContent = open ? t('visit.open', 'Open now, until 17:00') : t('visit.closed', 'Closed now');
    });
  }

  /* ---------- Motion: background beans + cups, scroll reveal, cart bump (skipped for prefers-reduced-motion) ---------- */
  var CUP = '<svg viewBox="0 0 48 44" aria-hidden="true" focusable="false"><path class="wisp" d="M17 14c-3-3 3-5 0-10"/><path class="wisp w2" d="M26 14c-3-3 3-5 0-10"/><path d="M8 19h26v6a13 13 0 0 1-26 0z" fill="currentColor"/><path d="M34 21h3a4.5 4.5 0 0 1 0 9h-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="21" cy="41" rx="18" ry="2.6" fill="currentColor"/></svg>';
  var FXBEAN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(35 12 12)"><ellipse cx="12" cy="12" rx="6.2" ry="9.6" fill="currentColor"/><path class="bean-line" d="M12 3c-3.8 4.6 3.8 8.4 0 18" fill="none" stroke-width="2" stroke-linecap="round"/></g></svg>';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function buildFx() {
    if (reduceMotion) return;
    document.documentElement.classList.add('js-fx');
    document.querySelectorAll('[data-fx]').forEach(function (host) {
      var kind = host.getAttribute('data-fx'), html = '';
      var cups = kind === 'hero' ? [2, 5, 9] : kind === 'band' ? [2, 5] : [];
      var n = kind === 'hero' ? 10 : kind === 'band' ? 7 : 12;
      for (var i = 1; i <= n; i++) {
        var cup = cups.indexOf(i) > -1;
        html += '<span class="fx__i ' + (cup ? 'cup' : 'bean c' + (((i - 1) % 3) + 1)) + '">' + (cup ? CUP : FXBEAN) + '</span>';
      }
      var layer = document.createElement('div');
      layer.className = 'fx fx--' + kind;
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = html;
      host.insertBefore(layer, host.firstChild);
    });
  }
  var io = null;
  function initReveal() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    io = io || new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.section__head,.card,.roastcard,.value,.faq,.split > *,.trust__grid li,.panel,.pdp > *').forEach(function (el) {
      if (el.hasAttribute('data-rv')) return;
      el.setAttribute('data-rv', '1');
      el.classList.add('reveal');
      io.observe(el);
    });
  }
  var lastCount = Cart.count();
  document.addEventListener('tostino:cart', function () {
    var n = Cart.count();
    if (n > lastCount && !reduceMotion) {
      document.querySelectorAll('.cartbtn__count').forEach(function (el) {
        el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
      });
    }
    lastCount = n;
  });
  document.addEventListener('tostino:rendered', initReveal);

  /* ---------- dropdown menus (filters, "Find your coffee"): <details class="dd"> ---------- */
  function ddSync() {
    document.querySelectorAll('.dd').forEach(function (dd) {
      var v = dd.querySelector('.dd__value'), sel = dd.querySelector('input:checked + span, .chip[aria-pressed="true"]');
      if (v) v.textContent = sel ? sel.textContent : t('dd.choose', 'Choose');
      dd.classList.toggle('has-value', !!sel);
    });
  }
  function ddCloseAll(except) { document.querySelectorAll('.dd[open]').forEach(function (d) { if (d !== except) d.removeAttribute('open'); }); }
  document.addEventListener('toggle', function (e) { if (e.target.classList && e.target.classList.contains('dd') && e.target.open) ddCloseAll(e.target); }, true);
  document.addEventListener('click', function (e) { if (!e.target.closest('.dd')) ddCloseAll(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = document.querySelector('.dd[open]');
    if (open) { open.removeAttribute('open'); var s = open.querySelector('summary'); if (s) s.focus(); }
  });
  document.addEventListener('change', function (e) {
    var dd = e.target.closest && e.target.closest('.dd');
    if (!dd) return;
    ddSync();
    setTimeout(function () { dd.removeAttribute('open'); }, 140); // brief pause so the choice is seen, then the menu disappears
  });
  document.addEventListener('tostino:rendered', ddSync);

  /* ---------- init ---------- */
  function render(fn) { renderers.push(fn); if (ready) fn(); }
  function init() {
    lang = pickLang();
    Promise.all([loadDict('en'), loadDict(lang), loadProducts()]).then(function () {
      injectChrome();
      renderers.push(renderVisit);
      ready = true;
      buildFx();
      return setLang(lang);
    }).then(initReveal).then(checkImages).then(function () { document.documentElement.classList.add('is-ready'); });
    // Re-check images after page scripts add markup (cheap, runs once per render pass)
    document.addEventListener('tostino:rendered', checkImages);
  }

  window.Tostino = {
    t: t, money: money, esc: esc, slug: slug, P: P, render: render, card: card, imgTag: imgTag,
    cart: Cart, product: product, lineHTML: lineHTML, totalsHTML: totalsHTML, openCart: openDrawer,
    data: function () { return data; }, lang: function () { return lang; },
    session: { get: function () { return read('sessionStorage', KEY_ORDER, null); }, set: function (v) { write('sessionStorage', KEY_ORDER, v); } },
    rendered: function () { document.dispatchEvent(new CustomEvent('tostino:rendered')); applyI18n(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
