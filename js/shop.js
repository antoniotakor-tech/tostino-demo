/* Shop page: filters (roast, size, category) that work without reloading and live in the URL.
   Example: shop.html?cat=coffee&roast=light&size=1kg */
(function () {
  'use strict';
  var T = Tostino;
  var GROUPS = [
    { key: 'cat', label: 'shop.cat', values: [['', 'shop.all'], ['coffee', 'cat.coffee'], ['accessories', 'cat.accessories']] },
    { key: 'roast', label: 'shop.roast', values: [['', 'shop.all'], ['light', 'roast.light'], ['medium', 'roast.medium'], ['dark', 'roast.dark']], coffeeOnly: true },
    { key: 'size', label: 'shop.size', values: [['', 'shop.all'], ['250g', 'size.250g'], ['1kg', 'size.1kg']], coffeeOnly: true }
  ];
  var state = { cat: '', roast: '', size: '' };
  var VALID = {};
  GROUPS.forEach(function (g) { VALID[g.key] = g.values.map(function (v) { return v[0]; }); });

  function fromURL() {
    var q = new URLSearchParams(location.search);
    GROUPS.forEach(function (g) { var v = q.get(g.key) || ''; state[g.key] = VALID[g.key].indexOf(v) > -1 ? v : ''; });
    if (state.cat === 'accessories') { state.roast = ''; state.size = ''; }
  }
  function toURL() {
    var q = new URLSearchParams();
    GROUPS.forEach(function (g) { if (state[g.key]) q.set(g.key, state[g.key]); });
    var s = q.toString();
    try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '')); } catch (e) { /* file:// or blocked */ }
  }
  function sizeKey(label) { return label.replace(/\s+/g, '').toLowerCase(); }

  function matches(p) {
    if (state.cat && p.category !== state.cat) return false;
    if (state.roast && p.roast !== state.roast) return false;
    if (state.size && !(p.sizes && p.sizes.some(function (s) { return sizeKey(s.label) === state.size; }))) return false;
    return true;
  }

  function chips() {
    var el = document.getElementById('filters');
    el.innerHTML = '<div class="finder__dds filters__dds">' + GROUPS.map(function (g) {
      var off = g.coffeeOnly && state.cat === 'accessories';
      return '<details class="dd" data-group="' + g.key + '"' + (off ? ' aria-disabled="true"' : '') + '><summary><span class="dd__text"><span class="dd__label">' + T.esc(T.t(g.label)) + '</span><span class="dd__value"></span></span></summary>' +
        '<div class="dd__panel" role="group" aria-label="' + T.esc(T.t(g.label)) + '"><div class="filters__row">' + g.values.map(function (v) {
          return '<button type="button" class="chip" data-group="' + g.key + '" data-value="' + v[0] + '" aria-pressed="' + (state[g.key] === v[0]) + '"' + (off ? ' disabled' : '') + '>' + T.esc(T.t(v[1])) + '</button>';
        }).join('') + '</div></div></details>';
    }).join('') + '</div>' +
      '<div class="filters__foot"><p class="fine" id="shop-count" role="status" aria-live="polite"></p><p class="fine">' + T.esc(T.t('shop.hint', 'Roast and size apply to coffee.')) + '</p></div>';
  }

  function list() {
    var items = T.data().products.filter(matches);
    var grid = document.getElementById('shop-grid');
    grid.innerHTML = items.map(T.card).join('');
    var empty = document.getElementById('shop-empty');
    empty.hidden = items.length > 0;
    document.getElementById('shop-count').textContent = T.t('shop.count', '{n} products', { n: items.length });
    T.rendered();
  }
  function paint() { chips(); list(); }

  var bound = false;
  T.render(function () {
    if (!bound) {
      bound = true;
      fromURL();
      document.getElementById('filters').addEventListener('click', function (e) {
        var b = e.target.closest('.chip');
        if (!b || b.disabled) return;
        state[b.getAttribute('data-group')] = b.getAttribute('data-value');
        if (state.cat === 'accessories') { state.roast = ''; state.size = ''; }
        toURL(); paint();
        var sum = document.querySelector('.dd[data-group="' + b.getAttribute('data-group') + '"] summary');
        if (sum) sum.focus(); // the menu closed and was re-rendered: give focus back to its button
      });
      document.getElementById('shop-reset').addEventListener('click', function () { state = { cat: '', roast: '', size: '' }; toURL(); paint(); });
    }
    paint();
  });
})();
