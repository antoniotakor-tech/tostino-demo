/* cart.html: cart lines, totals and the (simulated) checkout form. */
(function () {
  'use strict';
  var T = Tostino;
  var form, bound = false;

  function method() { return (form.querySelector('input[name=delivery]:checked') || {}).value || 'ship'; }

  function paint() {
    var lines = T.cart.lines(), has = lines.length > 0;
    document.getElementById('cart-lines').innerHTML = has
      ? '<ul>' + lines.map(T.lineHTML).join('') + '</ul>'
      : '<div class="emptycart"><h2>' + T.esc(T.t('cart.empty', 'Your cart is empty.')) + '</h2><p><a class="btn" href="shop.html">' + T.esc(T.t('cart.keep', 'Browse the shop')) + '</a></p></div>';
    document.getElementById('cart-side').hidden = !has;
    form.hidden = !has;
    if (has) {
      var m = method();
      document.getElementById('cart-totals').innerHTML = T.totalsHTML(T.cart.totals(m), m);
      document.getElementById('address-fields').hidden = m === 'pickup';
    }
    T.rendered();
  }

  function setErr(id, key) {
    var input = document.getElementById(id), msg = document.getElementById('err-' + id);
    msg.textContent = key ? T.t(key) : '';
    if (key) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    return key ? input : null;
  }

  function validate() {
    var bad = [], pickup = method() === 'pickup';
    var v = function (id) { return document.getElementById(id).value.trim(); };
    bad.push(setErr('f-name', v('f-name') ? '' : 'err.required'));
    bad.push(setErr('f-email', !v('f-email') ? 'err.required' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('f-email')) ? '' : 'err.email'));
    if (!pickup) {
      bad.push(setErr('f-street', v('f-street') ? '' : 'err.required'));
      bad.push(setErr('f-postcode', !v('f-postcode') ? 'err.required' : /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/.test(v('f-postcode')) ? '' : 'err.postcode'));
      bad.push(setErr('f-city', v('f-city') ? '' : 'err.required'));
    }
    return bad.filter(Boolean);
  }

  function submit(e) {
    e.preventDefault();
    var errBox = document.getElementById('form-error'), btn = document.getElementById('pay-btn');
    errBox.textContent = '';
    if (!T.cart.lines().length) return;
    var bad = validate();
    if (bad.length) { errBox.textContent = T.t('err.summary', 'Please check the highlighted fields.'); bad[0].focus(); return; }
    var m = method(), val = function (id) { return document.getElementById(id).value.trim(); };
    var order = {
      id: 'TOS-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000),
      items: T.cart.lines().map(function (l) { return { id: l.item.id, size: l.item.size, grind: l.item.grind, color: l.item.color, qty: l.item.qty, unit: l.unit }; }),
      totals: T.cart.totals(m),
      delivery: m,
      payment: form.querySelector('input[name=pay]:checked').value,
      customer: { name: val('f-name'), email: val('f-email'), street: val('f-street'), postcode: val('f-postcode'), city: val('f-city') }
    };
    btn.disabled = true;
    btn.textContent = T.t('co.processing', 'Processing…');
    window.TostinoPayment.pay(order).then(function (res) {
      order.reference = res.reference;
      T.session.set(order);
      T.cart.clear();
      location.href = 'order.html';
    }).catch(function () {
      errBox.textContent = T.t('co.failed', 'The payment did not go through. Nothing was charged. Please try again.');
      btn.disabled = false;
      btn.textContent = T.t('co.pay', 'Place practice order');
    });
  }

  T.render(function () {
    form = document.getElementById('checkout');
    if (!bound) {
      bound = true;
      form.addEventListener('submit', submit);
      form.addEventListener('change', function (e) { if (e.target.name === 'delivery') paint(); });
      document.addEventListener('tostino:cart', paint);
    }
    var btn = document.getElementById('pay-btn');
    if (!btn.disabled) btn.textContent = T.t('co.pay', 'Place practice order');
    paint();
  });
})();
