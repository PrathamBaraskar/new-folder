/* ==========================================================================
   Dwaar — work index: hover preview for project rows
   ========================================================================== */
(function () {
  'use strict';

  var peek = document.querySelector('[data-peek-el]');
  var rows = Array.prototype.slice.call(document.querySelectorAll('[data-peek]'));
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!peek || !rows.length || !fine.matches) return;

  var img = peek.querySelector('img');
  var shownFor = null;
  var raf = 0;
  var x = 0, y = 0;

  function place() {
    raf = 0;
    peek.style.left = x + 'px';
    peek.style.top = y + 'px';
  }

  function queue() {
    if (!raf) raf = requestAnimationFrame(place);
  }

  function activate(src, cx, cy) {
    if (src !== shownFor) {
      shownFor = src;
      img.src = src;
    }
    x = cx;
    y = cy;
    peek.classList.add('is-on');
    queue();
  }

  function deactivate() {
    peek.classList.remove('is-on');
  }

  rows.forEach(function (row) {
    var src = row.getAttribute('data-peek');
    if (!src) return;

    row.addEventListener('pointerenter', function (e) {
      activate(src, e.clientX, e.clientY);
    });
    row.addEventListener('pointermove', function (e) {
      x = e.clientX;
      y = e.clientY;
      queue();
    });
    row.addEventListener('pointerleave', deactivate);

    row.addEventListener('focus', function () {
      var r = row.getBoundingClientRect();
      activate(src, r.left + r.width * 0.72, r.top + r.height / 2);
    });
    row.addEventListener('blur', deactivate);
  });

  window.addEventListener('scroll', deactivate, { passive: true });
})();
