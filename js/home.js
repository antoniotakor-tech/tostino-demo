/* Home page: featured products + "Find your coffee" guide. */
(function () {
  'use strict';
  var T = Tostino;
  var GRIND_FOR = { espresso: 'espresso', moka: 'moka', filter: 'filter', unsure: 'whole beans' };
  var TASTE = { choc: 'chocolate and nuts', fruity: 'fruity and bright', dark: 'strong and dark', decaf: 'no caffeine' };

  function pick(brew, taste) {
    var coffees = T.data().products.filter(T.P.isCoffee);
    if (taste === 'decaf') return coffees.filter(function (p) { return p.id === 'decaf-colombia'; })[0];
    var best = null, bestScore = -1;
    coffees.forEach(function (p) { // taste counts more than brew method; ties keep the catalogue order
      var s = (p.taste.indexOf(TASTE[taste]) > -1 ? 3 : 0) + (brew !== 'unsure' && p.brewWith.indexOf(brew) > -1 ? 2 : 0);
      if (s > bestScore) { best = p; bestScore = s; }
    });
    return best;
  }

  function featured() {
    var el = document.getElementById('featured');
    if (!el) return;
    el.innerHTML = T.data().products.filter(function (p) { return p.featured; }).slice(0, 3).map(T.card).join('');
  }

  function finder() {
    var form = document.getElementById('finder');
    if (!form) return;
    var out = document.getElementById('finder-preview'), btn = document.getElementById('finder-go');
    function update() {
      var brew = (form.querySelector('input[name=brew]:checked') || {}).value;
      var taste = (form.querySelector('input[name=taste]:checked') || {}).value;
      if (!brew || !taste) {
        out.textContent = T.t('finder.pick', 'Pick how you brew and what you like to see your coffee.');
        btn.setAttribute('aria-disabled', 'true'); btn.removeAttribute('data-href');
        return;
      }
      var p = pick(brew, taste);
      var tip = (brew !== 'unsure' && p.brewWith.indexOf(brew) < 0)
        ? ' ' + T.t('finder.tip', 'Tip: it works best as {methods}.', { methods: p.brewWith.map(T.P.grind).join(' / ') }) : '';
      out.textContent = T.t('finder.result', 'Try {name}: {notes}.', { name: T.P.name(p), notes: p.notes.map(T.P.note).join(', ') }) + tip;
      btn.removeAttribute('aria-disabled');
      btn.setAttribute('data-href', 'product.html?id=' + encodeURIComponent(p.id) + '&grind=' + encodeURIComponent(GRIND_FOR[brew]));
    }
    if (!form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('change', update);
      form.addEventListener('submit', function (e) { e.preventDefault(); var h = btn.getAttribute('data-href'); if (h) location.href = h; else out.focus(); });
    }
    update();
  }

  T.render(function () { featured(); finder(); T.rendered(); });
})();
