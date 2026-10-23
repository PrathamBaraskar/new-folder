/* ==========================================================================
   Dwaar — site chrome: nav state, reveals, year
   ========================================================================== */
(function () {
  'use strict';

  var nav = document.querySelector('[data-nav]');
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* nav turns to paper once the hero has been left */
  if (nav) {
    var navTicking = false;
    function navState() {
      navTicking = false;
      nav.classList.toggle('is-solid', window.scrollY > window.innerHeight * 0.72);
    }
    window.addEventListener('scroll', function () {
      if (!navTicking) {
        navTicking = true;
        requestAnimationFrame(navState);
      }
    }, { passive: true });
    navState();
  }

  /* staggered reveals */
  var items = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  if (REDUCE.matches || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    items.forEach(function (el) { io.observe(el); });
  }

  /* year */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
