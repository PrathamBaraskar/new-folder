/* ==========================================================================
   Dwaar — hero scroll scrub
   192 frames, foundation → completed tower, driven by scroll position.
   ========================================================================== */
(function () {
  'use strict';

  var hero = document.querySelector('[data-hero]');
  if (!hero) return;

  var TOTAL = 192;
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');

  var pin = hero.querySelector('[data-stage]');
  var canvas = hero.querySelector('[data-canvas]');
  var loader = hero.querySelector('[data-loader]');
  var loadBar = hero.querySelector('[data-loadbar]');
  var hint = hero.querySelector('[data-hint]');
  var content = hero.querySelector('.hero__content');
  var finalEl = hero.querySelector('[data-final]');
  var veil = hero.querySelector('.hero__veil');
  var bar = hero.querySelector('[data-bar]');
  var counter = hero.querySelector('[data-frame]');
  var actEls = Array.prototype.slice.call(hero.querySelectorAll('[data-act]'));

  if (!canvas || !pin) return;
  var ctx = canvas.getContext('2d', { alpha: false });

  /* ── Tier selection ─────────────────────────────────────────────
     hd 1280 / md 960 / sd 640. Data-saver and narrow screens get the
     light tier so the scrub stays smooth on phones.                */
  function pickTier() {
    var w = window.innerWidth;
    var c = navigator.connection || {};
    if (c.saveData || /(^|-)2g$/.test(c.effectiveType || '') || w < 700) return 'sd';
    if (w < 1240) return 'md';
    return 'hd';
  }

  var tier = pickTier();
  var base = 'assets/frames/' + tier + '/';
  /* native width of the tier — the plate is never scaled past this */
  var SRC_W = tier === 'sd' ? 640 : tier === 'md' ? 960 : 1280;

  function pad(n) {
    return ('000' + n).slice(-4);
  }

  function url(i) {
    return base + 'frame-' + pad(i) + '.webp';
  }

  /* ── State ──────────────────────────────────────────────────────── */
  var images = new Array(TOTAL);
  var queue = [];
  var loadedCount = 0;
  var POOL = 6;
  var loaderDismissed = false;
  var startedAt = performance.now();

  var cw = 0;
  var ch = 0;
  var lastIndex = -1;

  var target = 0;   // 0..1 scroll progress
  var pos = 0;      // 0..TOTAL-1 smoothed frame position
  var raf = 0;

  var lastAct = -1;
  var lastOut = null;
  var lastFinal = null;
  var lastVeil = -1;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function smoothstep(edge0, edge1, x) {
    var t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /* ── Frame loading ──────────────────────────────────────────────── */
  function ok(i) {
    var im = images[i];
    return !!(im && im.complete && im.naturalWidth > 0);
  }

  function progressBar() {
    if (loadBar) {
      loadBar.style.transform = 'scaleX(' + (loadedCount / TOTAL).toFixed(4) + ')';
    }
    if (
      !loaderDismissed &&
      (loadedCount >= 26 || loadedCount >= TOTAL || performance.now() - startedAt > 5000)
    ) {
      dismissLoader();
    }
  }

  /* draw whatever is ready right now — new frames must appear without
     waiting for the user to scroll */
  function wake() {
    if (!raf) raf = requestAnimationFrame(animate);
  }

  function dismissLoader() {
    if (loaderDismissed) return;
    loaderDismissed = true;
    if (loader) loader.classList.add('is-done');
    if (hint) hint.classList.remove('is-hidden');
  }

  function loadNext() {
    if (!queue.length) return Promise.resolve();
    var i = queue.shift();

    return new Promise(function (resolve) {
      var img = new Image();
      img.decoding = 'async';
      images[i] = img;

      img.onload = function () {
        function done() {
          loadedCount++;
          progressBar();
          wake();
          resolve();
        }
        if (img.decode) img.decode().then(done, done);
        else done();
      };
      img.onerror = function () {
        resolve();
      };

      img.src = url(i + 1);
    }).then(loadNext);
  }

  /* Opening frames first so the first screens of scroll are already smooth,
     then every 8th frame so a fast scroll still reads as a build, then
     the gaps. */
  function buildQueue() {
    var head = [];
    var coarse = [];
    var rest = [];
    for (var i = 0; i < TOTAL; i++) {
      if (i < 24) head.push(i);
      else if (i % 8 === 0) coarse.push(i);
      else rest.push(i);
    }
    return head.concat(coarse, rest);
  }

  function startPool() {
    if (queue.length) return;
    queue = buildQueue();
    for (var k = 0; k < POOL; k++) loadNext();
  }

  /* Nearest loaded frame, preferring frames at or below the target so
     the build never appears to leap ahead while loading. */
  function nearest(i) {
    if (ok(i)) return i;
    for (var d = 1; d < TOTAL; d++) {
      if (i - d >= 0 && ok(i - d)) return i - d;
      if (i + d < TOTAL && ok(i + d)) return i + d;
    }
    return -1;
  }

  /* ── Canvas ─────────────────────────────────────────────────────── */
  /* Cinematic framing: the frame is fitted whole into a centred "plate" and
     the margins are filled with a blurred, cover-scaled copy of the same frame.
     Nothing is cropped away, so the tower, pool and grounds stay in shot. */
  var plate = { x: 0, y: 0, w: 0, h: 0 };
  var soft = document.createElement('canvas');
  var softCtx = soft.getContext('2d', { alpha: false });
  var plateCanvas = document.createElement('canvas');
  var plateCtx = plateCanvas.getContext('2d');
  var mask = document.createElement('canvas');

  function layoutPlate() {
    var aspect = cw / ch;
    var w;
    var h;

    if (aspect < 0.9) {
      /* Portrait: a cinemascope band holding the whole frame at or below the
         tier's native width — cropping a little beats upscaling the tier into
         mush. The bed carries the rest and leaves room for the copy. */
      w = Math.min(cw * 1.5, SRC_W);
      h = w * 9 / 16;
    } else {
      /* Wide: the whole frame, edge to edge — only a thin letterbox remains,
         so nothing is cropped away and the seam sits out of the composition. */
      w = cw;
      h = w * 9 / 16;
      var cap = ch * 0.98;
      if (h > cap) { h = cap; w = h * 16 / 9; }
    }

    plate.w = Math.round(w);
    plate.h = Math.round(h);
    plate.x = Math.round((cw - plate.w) / 2);
    /* portrait holds the band high so the copy sits on the open bed beneath */
    plate.y = Math.round((ch - plate.h) * (aspect < 0.9 ? 0.22 : 0.5));
    plateCanvas.width = plate.w;
    plateCanvas.height = plate.h;
    buildMask();
  }

  /* soft-edged mask: the edges that sit inside the stage are feathered so the
     sharp render dissolves into the bed instead of ending on a hard frame edge.
     Edges that meet the stage boundary stay crisp — no seam to fade. */
  function buildMask() {
    var w = plate.w;
    var h = plate.h;
    /* the portrait band dissolves into the bed above and below, so it needs a
       much longer feather than the edge-to-edge desktop plate */
    var band = plate.h < ch;
    var feather = Math.round(Math.min(w, h) * (band ? 0.14 : 0.03));
    var fx = plate.w >= cw ? 0 : feather;
    var fy = plate.h >= ch ? 0 : feather;
    mask.width = w;
    mask.height = h;
    var m = mask.getContext('2d');
    if (!m) return;
    m.fillStyle = '#000';
    if (typeof m.filter === 'string') m.filter = 'blur(' + Math.max(2, Math.round(Math.min(fx || fy, feather) * 0.8)) + 'px)';
    m.fillRect(fx, fy, w - fx * 2, h - fy * 2);
    m.filter = 'none';
  }

  function sizeCanvas() {
    var rect = pin.getBoundingClientRect();
    /* past ~1.5x the frame tier is the limiting factor, not the canvas */
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.round(rect.width * dpr);
    var h = Math.round(rect.height * dpr);
    if (!w || !h) return false;
    if (w === cw && h === ch) return false;
    cw = w;
    ch = h;
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = '#F7F3EA';
    ctx.fillRect(0, 0, w, h);

    /* the ambient bed is drawn tiny and scaled back up — cheap blur */
    var sw = Math.max(56, Math.round(w / 9));
    var sh = Math.max(48, Math.round(sw * h / w));
    soft.width = sw;
    soft.height = sh;

    layoutPlate();
    lastIndex = -1;
    return true;
  }

  function paint(i) {
    var idx = nearest(i);
    if (idx < 0) return;
    if (idx === lastIndex) return;

    var img = images[idx];
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;
    if (!iw) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    /* 1 — ambient bed: a blurred, cover-scaled copy fills the whole stage */
    var s = Math.max(soft.width / iw, soft.height / ih);
    var bw = iw * s;
    var bh = ih * s;
    softCtx.imageSmoothingEnabled = true;
    softCtx.imageSmoothingQuality = 'high';
    softCtx.drawImage(img, (soft.width - bw) / 2, (soft.height - bh) / 2, bw, bh);

    if (typeof ctx.filter === 'string') {
      /* margin bed keeps the frame's colour so it reads as depth, not haze */
      ctx.filter = 'saturate(1.12)';
      ctx.drawImage(soft, 0, 0, soft.width, soft.height, 0, 0, cw, ch);
      ctx.filter = 'none';
    } else {
      ctx.drawImage(soft, 0, 0, soft.width, soft.height, 0, 0, cw, ch);
    }

    /* 2 — the plate: the frame drawn whole, feathered into the bed */
    plateCtx.imageSmoothingEnabled = true;
    plateCtx.imageSmoothingQuality = 'high';
    plateCtx.globalCompositeOperation = 'source-over';
    plateCtx.drawImage(img, 0, 0, plate.w, plate.h);
    plateCtx.globalCompositeOperation = 'destination-in';
    plateCtx.drawImage(mask, 0, 0, plate.w, plate.h);
    plateCtx.globalCompositeOperation = 'source-over';

    ctx.drawImage(plateCanvas, plate.x, plate.y);

    lastIndex = idx;
    if (counter) counter.textContent = pad(idx + 1);
  }

  /* ── Chrome (HUD, copy beats, veil) ─────────────────────────────── */
  function chrome(p) {
    if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';

    var act = p < 0.34 ? 0 : p < 0.74 ? 1 : 2;
    if (act !== lastAct) {
      for (var a = 0; a < actEls.length; a++) {
        actEls[a].classList.toggle('is-active', a === act);
      }
      lastAct = act;
    }

    if (veil) {
      /* hold the paper wash while the opening copy is up, ease it off so
         the structure reads mid-build, bring it back for the final beat */
      var dip = smoothstep(0.26, 0.46, p) * (1 - smoothstep(0.62, 0.72, p));
      var end = smoothstep(0.82, 0.94, p);
      var o = 1 - 0.28 * dip - 0.14 * end;
      if (Math.abs(o - lastVeil) > 0.012) {
        veil.style.opacity = o.toFixed(3);
        lastVeil = o;
      }
    }

    var out = p > 0.70;
    if (out !== lastOut && content) {
      content.classList.toggle('is-out', out);
      lastOut = out;
    }

    var showFinal = p > 0.84;
    if (showFinal !== lastFinal && finalEl) {
      finalEl.classList.toggle('is-in', showFinal);
      lastFinal = showFinal;
    }

    if (hint && loaderDismissed) {
      hint.classList.toggle('is-hidden', p > 0.012);
    }
  }

  /* ── Scroll → frame ─────────────────────────────────────────────── */
  function readProgress() {
    var rect = hero.getBoundingClientRect();
    /* the sticky stage unpins when its bottom meets the container bottom,
       so measure travel against the stage, not the viewport */
    var travel = hero.offsetHeight - pin.offsetHeight;
    if (travel <= 0) return 0;
    return clamp(-rect.top / travel, 0, 1);
  }

  function animate() {
    raf = 0;
    var goal = target * (TOTAL - 1);

    if (Math.abs(goal - pos) < 0.08) pos = goal;
    else pos += (goal - pos) * 0.2;

    paint(Math.round(pos));
    chrome(pos / (TOTAL - 1));

    if (pos !== goal) raf = requestAnimationFrame(animate);
  }

  function onScroll() {
    target = readProgress();
    if (!raf) raf = requestAnimationFrame(animate);
  }

  function layout() {
    var h = window.innerHeight;
    var factor = window.innerWidth < 900 ? 4.2 : 4.6;
    hero.style.height = Math.round(h * factor) + 'px';
  }

  function onResize() {
    if (REDUCE.matches) {
      hero.style.height = '';
      sizeCanvas();
      paint(TOTAL - 1);
      return;
    }
    layout();
    sizeCanvas();
    onScroll();
  }

  /* ── Reduced motion: static completed tower, no pinning ─────────── */
  function reducedInit() {
    if (loader) loader.classList.add('is-done');
    if (hint) hint.classList.add('is-hidden');
    if (bar) bar.style.transform = 'scaleX(1)';
    if (counter) counter.textContent = pad(TOTAL);
    if (content) content.classList.remove('is-out');
    if (actEls.length) {
      for (var a = 0; a < actEls.length; a++) {
        actEls[a].classList.toggle('is-active', a === actEls.length - 1);
      }
    }

    var img = new Image();
    img.onload = function () {
      images[TOTAL - 1] = img;
      sizeCanvas();
      paint(TOTAL - 1);
    };
    img.src = url(TOTAL);

    window.addEventListener('resize', onResize);
  }

  /* ── Boot ───────────────────────────────────────────────────────── */
  function init() {
    sizeCanvas();

    if (REDUCE.matches) {
      reducedInit();
      return;
    }

    layout();
    sizeCanvas();

    target = readProgress();
    pos = target * (TOTAL - 1);
    paint(Math.round(pos));
    chrome(target);

    startPool();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
