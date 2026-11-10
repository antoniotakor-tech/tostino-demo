/* order.html: confirmation page for the simulated order (kept in sessionStorage for this tab only). */
(function () {
  'use strict';
  var T = Tostino;
  var PAY = { ideal: 'iDEAL', card: null, applepay: 'Apple Pay' };

  T.render(function () {
    var o = T.session.get(), el = document.getElementById('order');
    if (!o) {
      el.innerHTML = '<h1>' + T.esc(T.t('order.none', 'No recent order')) + '</h1><p class="lead"><a href="shop.html">' + T.esc(T.t('cart.keep', 'Browse the shop')) + '</a></p>';
      return;
    }
    var rows = o.items.map(function (i) {
      var p = T.product(i.id); if (!p) return '';
      var opts = [i.size, i.grind ? T.P.grind(i.grind) : '', i.color ? T.P.color(i.color) : ''].filter(Boolean).join(' · ');
      return '<li class="line"><div></div><div><p class="line__name">' + i.qty + ' × ' + T.esc(T.P.name(p)) + '</p><p class="line__opts">' + T.esc(opts) + '</p></div></li>';
    }).join('');
    var pay = PAY[o.payment] || T.t('co.card', 'Card');
    var where = o.delivery === 'pickup'
      ? T.t('order.pickup', 'Pick up at Oudegracht 112, Utrecht, Tue–Sat 09:00–17:00. We will have it ready.')
      : T.t('order.ship', 'We ship with PostNL within 48 hours to {addr}.', { addr: o.customer.street + ', ' + o.customer.postcode + ' ' + o.customer.city });
    el.innerHTML = '<div class="done"><div class="done__tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<p class="eyebrow">' + T.esc(T.t('order.label', 'Practice order')) + '</p>' +
      '<h1>' + T.esc(T.t('order.title', 'Thank you, {name}!', { name: o.customer.name.split(' ')[0] })) + '</h1>' +
      '<p class="lead">' + T.esc(T.t('order.number', 'Your order number is {id}.', { id: o.id })) + '</p>' +
      '<div class="panel"><ul>' + rows + '</ul>' + T.totalsHTML(o.totals, o.delivery) +
      '<p class="fine">' + T.esc(T.t('order.paid', 'Payment method: {pay} (simulated).', { pay: pay })) + '</p>' +
      '<p>' + T.esc(where) + '</p>' +
      '<p class="fine">' + T.esc(T.t('order.note', 'This is a practice project: no payment was taken and no email was sent to {email}.', { email: o.customer.email })) + '</p></div>' +
      '<p><a class="btn" href="index.html">' + T.esc(T.t('order.home', 'Back to home')) + '</a></p></div>';
  });
})();
