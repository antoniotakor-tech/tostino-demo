/* Product page (one template): loads the product from products.json using ?id=
   Optional ?grind= preselects a grind (the home page guide uses it).
   The "Add to cart" button is a Snipcart button (class snipcart-add-item). Snipcart reads its data-item-* attributes
   at the moment of the click, so we keep them in sync with the chosen size, grind / colour and quantity.
   Prices are checked by Snipcart against snipcart.json (built from products.json by scripts/build-snipcart-json.js). */
(function () {
  'use strict';
  var T = Tostino;
  var C = window.TOSTINO || {};
  var params = new URLSearchParams(location.search);
  var state = { size: null, grind: null, color: null, qty: 1 };
  var current = null;

  function pill(name, value, label, checked) {
    return '<label class="pill"><input type="radio" name="' + name + '" value="' + T.esc(value) + '"' + (checked ? ' checked' : '') + '><span>' + T.esc(label) + '</span></label>';
  }

  /* Item id Snipcart will validate. Coffee: one item per size (the size changes the price), e.g. canale-blend-1kg.
     Accessories: the product id. Must match scripts/build-snipcart-json.js. */
  function itemId() {
    return current.sizes ? current.id + '-' + state.size.toLowerCase().replace(/\s+/g, '') : current.id;
  }
  function itemName() {
    return T.P.name(current) + (current.sizes ? ' ' + state.size : '');
  }
  function absolute(path) { return (C.siteUrl || '') + path; }

  function paintBuy() {
    var unit = T.P.unit(current, state.size);
    document.getElementById('pdp-price').textContent = T.money(unit);
    document.getElementById('pdp-qty').textContent = state.qty;
    document.getElementById('pdp-add-price').textContent = T.money(unit * state.qty);

    var b = document.getElementById('pdp-add'), coffee = T.P.isCoffee(current);
    var img = current.image.replace(/\.webp$/, '-800.webp');
    var attrs = {
      'data-item-id': itemId(),
      'data-item-name': itemName(),
      'data-item-price': unit.toFixed(2),
      'data-item-url': absolute('snipcart.json'),
      'data-item-image': absolute(img),
      'data-item-description': T.P.desc(current).slice(0, 180),
      'data-item-quantity': String(state.qty),
      'data-item-max-quantity': '20',
      'data-item-has-taxes-included': 'true'
    };
    // one custom field, no price change: grind for coffee, colour for the mug
    if (coffee) {
      attrs['data-item-custom1-name'] = T.t('pdp.grind', 'Grind');
      attrs['data-item-custom1-options'] = T.data().grinds.map(T.P.grind).join('|');
      attrs['data-item-custom1-value'] = T.P.grind(state.grind);
    } else if (current.colors) {
      attrs['data-item-custom1-name'] = T.t('pdp.color', 'Colour');
      attrs['data-item-custom1-options'] = current.colors.map(T.P.color).join('|');
      attrs['data-item-custom1-value'] = T.P.color(state.color);
    }
    Array.prototype.slice.call(b.attributes).forEach(function (a) { if (a.name.indexOf('data-item-') === 0) b.removeAttribute(a.name); });
    Object.keys(attrs).forEach(function (k) { b.setAttribute(k, attrs[k]); });
  }

  function view() {
    var p = current, coffee = T.P.isCoffee(p), data = T.data();
    var name = T.P.name(p);
    document.title = name + ' · Tostino';
    document.getElementById('crumb-name').textContent = name;
    var html = '<div class="photo pdp__img">' + T.imgTag(p.image, name, name, 800, 800, true, '(min-width: 760px) 560px, calc(100vw - 32px)') + '</div><div>';
    if (coffee) html += '<span class="roast roast--' + p.roast + '"><i></i>' + T.esc(T.P.roast(p.roast)) + '</span>';
    html += '<h1>' + T.esc(name) + '</h1>';
    if (coffee) {
      html += '<p class="muted">' + T.esc(T.P.origin(p)) + '</p><div class="tags" aria-label="' + T.esc(T.t('pdp.notes', 'Tasting notes')) + '">' +
        p.notes.map(function (n) { return '<span class="tag">' + T.esc(T.P.note(n)) + '</span>'; }).join('') + '</div>';
    }
    html += '<p class="lead">' + T.esc(T.P.desc(p)) + '</p>';
    if (p.contents) html += '<h2 class="sr">' + T.esc(T.t('pdp.contents', 'In the box')) + '</h2><ul class="contents">' + p.contents.map(function (c) { return '<li>' + T.esc(T.t('content.' + T.slug(c), c)) + '</li>'; }).join('') + '</ul>';
    html += '<p class="pdp__price" id="pdp-price" aria-live="polite"></p><form id="pdp-form" novalidate>';
    if (p.sizes) html += '<fieldset><legend>' + T.esc(T.t('pdp.size', 'Size')) + '</legend><div class="pills">' + p.sizes.map(function (s) { return pill('size', s.label, s.label + ' · ' + T.money(s.price), s.label === state.size); }).join('') + '</div></fieldset>';
    if (coffee) html += '<fieldset><legend>' + T.esc(T.t('pdp.grind', 'Grind')) + '</legend><div class="pills">' + data.grinds.map(function (g) { return pill('grind', g, T.P.grind(g), g === state.grind); }).join('') + '</div></fieldset>';
    if (p.colors) html += '<fieldset><legend>' + T.esc(T.t('pdp.color', 'Colour')) + '</legend><div class="pills">' + p.colors.map(function (c) { return pill('color', c, T.P.color(c), c === state.color); }).join('') + '</div></fieldset>';
    html += '<div class="pdp__buy"><div class="qty" role="group" aria-label="' + T.esc(T.t('qty.label', 'Quantity')) + '"><button type="button" id="pdp-dec" aria-label="' + T.esc(T.t('qty.dec', 'Fewer')) + '">&minus;</button><output id="pdp-qty" aria-live="polite">1</output><button type="button" id="pdp-inc" aria-label="' + T.esc(T.t('qty.inc', 'More')) + '">+</button></div>' +
      '<button class="btn snipcart-add-item" type="button" id="pdp-add">' + T.esc(T.t('pdp.add', 'Add to cart')) + ' · <span id="pdp-add-price"></span></button></div>' +
      '<p class="fine" id="pdp-msg" role="status"></p></form>' +
      '<p class="fine sim-note">' + T.esc(coffee ? T.t('pdp.fresh', 'Roasted the day before it ships. Opened coffee cannot be returned.') : T.t('pdp.return', 'Accessories can be returned within 14 days.')) + '</p></div>';
    document.getElementById('pdp').innerHTML = html;
    paintBuy();
    T.rendered();
  }

  function bind() {
    var form = document.getElementById('pdp');
    form.addEventListener('change', function (e) {
      if (e.target.name) { state[e.target.name] = e.target.value; paintBuy(); }
    });
    form.addEventListener('click', function (e) {
      if (e.target.id === 'pdp-inc') { state.qty = Math.min(20, state.qty + 1); paintBuy(); }
      if (e.target.id === 'pdp-dec') { state.qty = Math.max(1, state.qty - 1); paintBuy(); }
      if (e.target.closest && e.target.closest('#pdp-add') && !C.snipcartPublicKey) {
        // no Snipcart key in js/config.js: say so instead of failing silently
        document.getElementById('pdp-msg').textContent = T.t('pay.banner', 'Payments are not configured yet. You can look around, but you cannot buy.');
      }
    });
  }

  var bound = false;
  T.render(function () {
    current = T.product(params.get('id'));
    if (!current) {
      document.getElementById('pdp').innerHTML = '<div><h1>' + T.esc(T.t('pdp.missing', 'Product not found')) + '</h1><p class="lead"><a href="shop.html">' + T.esc(T.t('cart.keep', 'Browse the shop')) + '</a></p></div>';
      return;
    }
    if (state.size === null) {
      state.size = current.sizes ? current.sizes[0].label : '';
      var g = params.get('grind');
      state.grind = T.data().grinds.indexOf(g) > -1 ? g : 'whole beans';
      state.color = current.colors ? current.colors[0] : '';
    }
    view();
    if (!bound) { bound = true; bind(); }
  });
})();
