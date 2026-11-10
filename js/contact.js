/* contact.html: builds a mailto: link from the form. Nothing is sent by this site. */
(function () {
  'use strict';
  var T = Tostino;
  var form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('c-name').value.trim(), msg = document.getElementById('c-msg').value.trim();
    var ok = true;
    [['c-name', name], ['c-msg', msg]].forEach(function (f) {
      var el = document.getElementById(f[0]), err = document.getElementById('err-' + f[0]);
      err.textContent = f[1] ? '' : T.t('err.required', 'Please fill this in.');
      if (f[1]) el.removeAttribute('aria-invalid'); else { el.setAttribute('aria-invalid', 'true'); if (ok) el.focus(); ok = false; }
    });
    if (!ok) return;
    location.href = 'mailto:ciao@tostino.example?subject=' + encodeURIComponent('Message from ' + name) + '&body=' + encodeURIComponent(msg + '\n\n' + name);
  });
})();
