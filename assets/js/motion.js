/* ==========================================================================
   Dwaar — motion engine
   Lenis smooth scroll + GSAP/ScrollTrigger/SplitText.
   Every effect degrades to a readable static state.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var hasGSAP = !!(gsap && ST);
  var ready = false;
  var bootStarted = false;

  /* ── Fail-safe ──────────────────────────────────────────────────
     If anything below throws or GSAP never arrives, drop the .js class
     so the CSS-hidden reveal states stop hiding content.            */
  function revealAll() {
    root.classList.remove('js');
  }
  window.setTimeout(function () {
    if (!bootStarted) revealAll();
  }, 2500);

  /* ── Chrome that must work regardless of GSAP ──────────────────── */
  function initChrome() {
    /* current page in nav */
    var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.nav__links a, .menu__list a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href) return;
      var file = href.split('#')[0].toLowerCase();
      if (file && (file === here || (here === 'index.html' && file === 'index.html'))) {
        a.setAttribute('aria-current', 'page');
      }
    });

    /* sticky nav state */
    var nav = document.querySelector('[data-nav]');
    if (nav) {
      var ticking = false;
      var threshold = function () { return window.innerHeight * 0.68; };
      var state = function () {
        ticking = false;
        nav.classList.toggle('is-solid', window.scrollY > threshold());
      };
      window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(state); }
      }, { passive: true });
      state();
    }

    /* mobile menu */
    var toggle = document.querySelector('[data-menu-toggle]');
    var menu = document.querySelector('[data-menu]');
    if (toggle && menu) {
      var setOpen = function (open) {
        menu.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        if (nav) nav.classList.toggle('is-open', open);
        root.classList.toggle('is-locked', open);
        body.classList.toggle('menu-open', open);
      };
      toggle.addEventListener('click', function () {
        setOpen(!menu.classList.contains('is-open'));
      });
      menu.addEventListener('click', function (e) {
        if (e.target.closest('a')) setOpen(false);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.classList.contains('is-open')) {
          setOpen(false);
          toggle.focus();
        }
      });
    }

    /* year */
    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });

    /* form (demo) */
    var form = document.querySelector('[data-form]');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var status = form.querySelector('[data-form-status]');
        if (!form.checkValidity()) {
          if (status) status.textContent = 'Please complete the highlighted fields.';
          return;
        }
        if (status) status.textContent = 'Thank you — we will reply within two working days.';
        form.reset();
        if (status) {
          gsap ? gsap.fromTo(status, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .5 }) : null;
        }
      });
    }

    /* filters (projects page) */
    var filterBar = document.querySelector('[data-filters]');
    if (filterBar) {
      var rows = Array.prototype.slice.call(document.querySelectorAll('[data-work-row]'));
      var count = document.querySelector('[data-work-count]');
      filterBar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-filter]');
        if (!btn) return;
        var key = btn.getAttribute('data-filter');
        filterBar.querySelectorAll('[data-filter]').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        var shown = 0;
        rows.forEach(function (row) {
          var match = key === 'all' || row.getAttribute('data-kind') === key;
          row.classList.toggle('is-hidden', !match);
          if (match) {
            shown++;
            if (gsap && !REDUCE.matches) {
              gsap.fromTo(row, { opacity: 0, y: 10 },
                { opacity: 1, y: 0, duration: .45, ease: 'power2.out', overwrite: true });
            }
          }
        });
        if (count) count.textContent = String(shown).padStart(2, '0');
      });
    }
  }

  /* ── Scroll runtimes ───────────────────────────────────────────── */

  function initSmoothScroll() {
    if (REDUCE.matches || typeof window.Lenis === 'undefined') return null;
    var lenis = new window.Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      syncTouch: false,
      anchors: { offset: -70 },
    });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    return lenis;
  }

  /* 1 — Scroll reveal: fade / up / down / left / right / scale */
  function initReveals() {
    var groups = new WeakMap();

    document.querySelectorAll('[data-stagger]').forEach(function (group) {
      groups.set(group, Array.prototype.slice.call(group.children));
    });

    gsap.utils.toArray('[data-reveal]').forEach(function (el) {
      var variant = (el.getAttribute('data-reveal') || 'up').toLowerCase();
      var parent = el.closest('[data-stagger]');
      var siblings = parent ? groups.get(parent) : null;
      var index = siblings ? siblings.indexOf(el) : 0;
      var delay = siblings ? Math.min(index * 0.09, 0.54) : 0;

      var to = { opacity: 1, y: 0, x: 0, scale: 1, duration: 0.95, ease: 'power3.out', delay: delay };
      var from = { opacity: 0 };
      if (variant === 'up') from.y = 28;
      else if (variant === 'down') from.y = -26;
      else if (variant === 'left') from.x = -34;
      else if (variant === 'right') from.x = 34;
      else if (variant === 'scale') from.scale = 0.94;

      gsap.fromTo(el, from, Object.assign({}, to, {
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      }));
    });

    /* blur-to-sharp */
    gsap.utils.toArray('[data-blur]').forEach(function (el) {
      gsap.to(el, {
        opacity: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      });
    });

    /* image mask / curtain / clip reveal */
    gsap.utils.toArray('[data-mask]').forEach(function (el) {
      var dir = el.getAttribute('data-mask') || 'up';
      var from = 'inset(0% 0% 0% 0%)';
      if (dir === 'up') from = 'inset(0% 0% 100% 0%)';
      else if (dir === 'down') from = 'inset(100% 0% 0% 0%)';
      else if (dir === 'left') from = 'inset(0% 100% 0% 0%)';
      else if (dir === 'right') from = 'inset(0% 0% 0% 100%)';
      else if (dir === 'split') from = 'inset(0% 50% 0% 50%)';
      else if (dir === 'circle') from = 'circle(0% at 50% 50%)';

      gsap.fromTo(el, { clipPath: from }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.25, ease: 'power3.inOut',
        scrollTrigger: { trigger: el, start: 'top 84%', once: true },
      });

      var inner = el.querySelector('img, video');
      if (inner) {
        gsap.fromTo(inner, { scale: 1.16 }, {
          scale: 1, duration: 1.5, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 84%', once: true },
        });
      }
    });

    /* SVG stroke drawing */
    gsap.utils.toArray('[data-stroke]').forEach(function (svg) {
      var shapes = svg.querySelectorAll('path, line, circle, polyline, rect, ellipse');
      shapes.forEach(function (s) {
        var len = typeof s.getTotalLength === 'function' ? s.getTotalLength() : 1200;
        s.style.setProperty('--len', Math.ceil(len) + 'px');
        s.style.strokeDasharray = Math.ceil(len) + 'px';
        s.style.strokeDashoffset = Math.ceil(len) + 'px';
      });
      gsap.to(shapes, {
        strokeDashoffset: 0,
        duration: 1.6,
        ease: 'power2.inOut',
        stagger: 0.12,
        scrollTrigger: { trigger: svg, start: 'top 82%', once: true },
      });
    });
  }

  /* 6 — Typography: chars / words / lines */
  function initSplitText() {
    if (!window.SplitText) return;
    gsap.registerPlugin(window.SplitText);

    gsap.utils.toArray('[data-split]').forEach(function (el) {
      var mode = (el.getAttribute('data-split') || 'lines').toLowerCase();
      var type = mode === 'chars' ? 'chars' : mode === 'words' ? 'words' : 'lines';

      var split = new window.SplitText(el, {
        type: 'lines,words,chars',
        linesClass: 'sp-line',
        autoSplit: true,
        onSplit: function (self) {
          if (type === 'chars') {
            return gsap.from(self.chars, {
              yPercent: 70, opacity: 0, duration: 0.9, ease: 'power4.out',
              stagger: 0.022,
              scrollTrigger: { trigger: el, start: 'top 84%', once: true },
            });
          }
          if (type === 'words') {
            return gsap.from(self.words, {
              yPercent: 60, opacity: 0, duration: 0.85, ease: 'power3.out',
              stagger: 0.045,
              scrollTrigger: { trigger: el, start: 'top 84%', once: true },
            });
          }
          return gsap.from(self.lines, {
            yPercent: 55, opacity: 0, duration: 1, ease: 'power3.out',
            stagger: 0.09,
            scrollTrigger: { trigger: el, start: 'top 86%', once: true },
          });
        },
      });
      return split;
    });

    /* letter-spacing expansion */
    gsap.utils.toArray('[data-track]').forEach(function (el) {
      gsap.fromTo(el, { letterSpacing: '0.34em', opacity: 0.2 }, {
        letterSpacing: '-0.02em', opacity: 1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 42%', scrub: 0.6 },
      });
    });
  }

  /* 2 — Parallax: vertical layers + mouse parallax */
  function initParallax() {
    gsap.utils.toArray('[data-parallax]').forEach(function (el) {
      var depth = parseFloat(el.getAttribute('data-parallax')) || 12;
      var scope = el.closest('[data-parallax-scope]') || el.parentElement || el;
      gsap.fromTo(el, { yPercent: depth * 0.5 }, {
        yPercent: -depth * 0.5, ease: 'none',
        scrollTrigger: { trigger: scope, start: 'top bottom', end: 'bottom top', scrub: 0.5 },
      });
    });

    /* mouse parallax layers */
    gsap.utils.toArray('[data-mouse]').forEach(function (scope) {
      if (window.matchMedia('(hover: none)').matches) return;
      var layers = Array.prototype.slice.call(scope.querySelectorAll('[data-depth]'));
      var qx = gsap.quickTo ? null : null;
      var setX = layers.map(function (l) {
        return gsap.quickTo(l, 'x', { duration: 0.9, ease: 'power3.out' });
      });
      var setY = layers.map(function (l) {
        return gsap.quickTo(l, 'y', { duration: 0.9, ease: 'power3.out' });
      });
      scope.addEventListener('pointermove', function (e) {
        var r = scope.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5;
        var ny = (e.clientY - r.top) / r.height - 0.5;
        layers.forEach(function (l, i) {
          var d = parseFloat(l.getAttribute('data-depth')) || 8;
          setX[i](nx * d);
          setY[i](ny * d);
        });
      });
      scope.addEventListener('pointerleave', function () {
        layers.forEach(function (l, i) { setX[i](0); setY[i](0); });
      });
    });
  }

  /* 3 — Sticky storytelling with crossfade media */
  function initStory() {
    gsap.utils.toArray('[data-story]').forEach(function (story) {
      var steps = Array.prototype.slice.call(story.querySelectorAll('[data-story-step]'));
      var figs = Array.prototype.slice.call(story.querySelectorAll('[data-story-figure]'));
      if (!steps.length || !figs.length) return;
      var active = 0;

      var setActive = function (i) {
        if (i === active) return;
        active = i;
        figs.forEach(function (f, k) { f.classList.toggle('is-on', k === i); });
        if (!REDUCE.matches) {
          gsap.fromTo(figs[i], { scale: 1.06 }, { scale: 1, duration: 1.4, ease: 'power2.out' });
        }
      };

      figs.forEach(function (f, i) { f.classList.toggle('is-on', i === 0); });

      steps.forEach(function (step, i) {
        ST.create({
          trigger: step,
          start: 'top 62%',
          end: 'bottom 42%',
          onEnter: function () { setActive(i); },
          onEnterBack: function () { setActive(i); },
        });
      });
    });
  }

  /* 5 — Horizontal scroll */
  function initHorizontal() {
    gsap.utils.toArray('[data-hscroll]').forEach(function (section) {
      var track = section.querySelector('[data-hscroll-track]');
      if (!track) return;

      var mm = gsap.matchMedia();
      mm.add('(min-width: 901px)', function () {
        var distance = function () {
          return Math.max(0, track.scrollWidth - section.clientWidth + 40);
        };
        var tween = gsap.to(track, {
          x: function () { return -distance(); },
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: function () { return '+=' + distance(); },
            pin: true,
            scrub: 0.7,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        return function () {
          if (tween.scrollTrigger) tween.scrollTrigger.kill();
          tween.kill();
          gsap.set(track, { clearProps: 'transform' });
        };
      });
    });
  }

  /* 4 — Scroll-linked zoom */
  function initZoom() {
    gsap.utils.toArray('[data-zoomout]').forEach(function (section) {
      var img = section.querySelector('[data-zoomout-media]');
      var copy = section.querySelector('[data-zoomout-copy]');
      if (!img) return;
      gsap.fromTo(img, { scale: 1.6 }, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
      });
      if (copy) {
        /* the copy arrives as the image settles, so the line lands on a
           readable frame instead of riding a mid-zoom blur */
        gsap.fromTo(copy, { opacity: 0, y: 48 }, {
          opacity: 1, y: 0, ease: 'none',
          scrollTrigger: { trigger: section, start: 'top top', end: '55% top', scrub: 0.4 },
        });
      }
    });
  }

  /* 4b — hero image zoom-through on entry */
  function initHeroZoom() {
    gsap.utils.toArray('[data-zoom-hero]').forEach(function (img) {
      gsap.fromTo(img, { scale: 1.18 }, {
        scale: 1, ease: 'none',
        scrollTrigger: {
          trigger: img.closest('.proj__hero, .phero') || img,
          start: 'top top', end: 'bottom top', scrub: 0.5,
        },
      });
    });
  }

  /* 8 — Stacking sections */
  function initStack() {
    gsap.utils.toArray('[data-stack]').forEach(function (wrap) {
      var cards = Array.prototype.slice.call(wrap.querySelectorAll('[data-stack-card]'));
      cards.forEach(function (card, i) {
        var next = cards[i + 1];
        if (!next) return;
        gsap.to(card, {
          scale: 0.955,
          ease: 'none',
          scrollTrigger: {
            trigger: next,
            start: 'top bottom',
            end: 'top top+=140',
            scrub: 0.5,
          },
        });
      });
    });
  }

  /* 10 — Scroll-scrubbed video */
  function initScrubVideo() {
    gsap.utils.toArray('[data-scrubvideo]').forEach(function (section) {
      var video = section.querySelector('video');
      var sticky = section.querySelector('[data-scrub-sticky]');
      if (!video || !sticky) return;

      var target = 0;
      var seeking = false;
      var failed = 0;
      var fallback = false;

      var seek = function () {
        if (fallback || seeking || !video.duration) return;
        var v = Math.min(video.duration - 0.05, Math.max(0, target * video.duration));
        if (Math.abs(video.currentTime - v) < 0.04) return;
        seeking = true;
        try { video.currentTime = v; } catch (err) { seeking = false; failed++; }
      };
      video.addEventListener('seeked', function () { seeking = false; failed = 0; seek(); });

      /* Servers without Range support leave the video at 0 forever. Rather than
         sit on a frozen frame, fall back to a normal looping playback. */
      var checkSeek = function () {
        if (fallback) return;
        if (failed >= 3 || (video.seekable.length === 0 || video.seekable.end(0) < 0.5)) {
          fallback = true;
          section.classList.add('is-playing');
          video.loop = true;
          video.play().catch(function () {});
        }
      };

      video.addEventListener('loadedmetadata', function () { seek(); setTimeout(checkSeek, 900); });

      ST.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          /* 'top top' -> 'bottom bottom' spans exactly the sticky travel
             (section height minus sticky height), so progress maps 1:1 */
          target = Math.min(1, Math.max(0, self.progress));
          seek();
          setTimeout(checkSeek, 300);
        },
      });

      /* A fallback video should also stop looping while it is off screen. */
      ST.create({
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        onLeave: function () { if (fallback) video.pause(); },
        onEnter: function () { if (fallback) video.play().catch(function () {}); },
      });
    });
  }

  /* 9 — 3D tilt cards */
  function initTilt() {
    if (window.matchMedia('(hover: none)').matches) return;
    gsap.utils.toArray('[data-tilt]').forEach(function (card) {
      var rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      var ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
      gsap.set(card, { transformPerspective: 900 });
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5;
        var ny = (e.clientY - r.top) / r.height - 0.5;
        ry(nx * 10);
        rx(-ny * 10);
      });
      card.addEventListener('pointerleave', function () { rx(0); ry(0); });
    });
  }

  /* 14 — CSS 3D model assembly */
  function initModel() {
    gsap.utils.toArray('[data-model]').forEach(function (stage) {
      var model = stage.querySelector('.model');
      var plates = Array.prototype.slice.call(stage.querySelectorAll('.model__plate'));
      if (!model) return;
      gsap.set(model, { transformPerspective: 1200 });

      /* each plate lifts off the one below as the block enters — the stack
         assembles rather than fading in */
      plates.forEach(function (p, i) {
        gsap.fromTo(p, { z: -40, opacity: 0 }, {
          z: i * 58, opacity: 1, duration: 0.9, delay: i * 0.09, ease: 'power3.out',
          scrollTrigger: { trigger: stage, start: 'top 80%', once: true },
        });
      });

      /* the whole stack turns as it is scrolled through, so the axon reads
         as a model being handled rather than a flat picture */
      gsap.fromTo(model, { rotationX: 64, rotationZ: -46 }, {
        rotationX: 50, rotationZ: -22, ease: 'none',
        scrollTrigger: { trigger: stage, start: 'top bottom', end: 'bottom top', scrub: 0.9 },
      });
    });
  }

  /* 15 — Image displacement (SVG feDisplacementMap, scroll-driven) */
  function initDisplacement() {
    var filter = document.getElementById('dwaar-displace-map');
    if (!filter) return;
    var scaleNode = filter;
    var turb = document.getElementById('dwaar-displace-noise');
    if (!scaleNode || !turb) return;

    gsap.utils.toArray('[data-displace]').forEach(function (el) {
      var last = -1;
      ST.create({
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6,
        onUpdate: function (self) {
          var p = self.progress;
          var wobble = Math.sin(p * Math.PI * 3) * 22 + Math.abs(p - 0.5) * 40;
          if (Math.abs(wobble - last) < 0.8) return;
          last = wobble;
          scaleNode.setAttribute('scale', wobble.toFixed(1));
          turb.setAttribute('baseFrequency', (0.004 + Math.abs(p - 0.5) * 0.008).toFixed(4));
        },
      });
    });
  }

  /* counters */
  function initCounters() {
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var end = parseFloat(el.getAttribute('data-count')) || 0;
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var obj = { v: 0 };
      gsap.to(obj, {
        v: end, duration: 1.6, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onUpdate: function () { el.textContent = obj.v.toFixed(decimals); },
      });
    });
  }

  /* marquee: duplicate content so the loop is seamless */
  function initMarquee() {
    document.querySelectorAll('[data-marquee]').forEach(function (track) {
      var html = track.innerHTML;
      track.insertAdjacentHTML('beforeend', html);
      track.setAttribute('aria-hidden', 'true');
    });
  }

  /* section-index links + smooth anchors handled by Lenis */

  /* ── Boot ──────────────────────────────────────────────────────── */
  function boot() {
    bootStarted = true;
    initChrome();
    initMarquee();

    if (!hasGSAP || REDUCE.matches) {
      revealAll();
      ready = true;
      body.classList.add('motion-ready');
      return;
    }

    gsap.registerPlugin(ST);
    if (window.SplitText) gsap.registerPlugin(window.SplitText);
    ST.config({ ignoreMobileResize: true });

    var lenis = initSmoothScroll();

    var start = function () {
      initReveals();
      initSplitText();
      initParallax();
      initStory();
      initHorizontal();
      initZoom();
      initHeroZoom();
      initStack();
      initScrubVideo();
      initTilt();
      initModel();
      initDisplacement();
      initCounters();

      ST.refresh();
      ready = true;
      body.classList.add('motion-ready');
      root.classList.add('motion-on');
    };

    /* split text only once webfonts are in, or lines break in the wrong place */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(start);
    } else {
      start();
    }

    window.addEventListener('load', function () { ST.refresh(); });

    /* resize: refresh triggers after layout settles */
    var rto;
    window.addEventListener('resize', function () {
      clearTimeout(rto);
      rto = setTimeout(function () {
        if (lenis && lenis.resize) lenis.resize();
        ST.refresh();
      }, 220);
    });

    /* anchor links inside the page */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -70, duration: 1.2 });
      else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
