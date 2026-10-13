function (el, d) {
  // The weak law of large numbers, in the visual language of the population
  // animation: sample means (as small pies) fall out of the population pie
  // into rows of growing n, an epsilon-band around the truth dims the ones
  // that land inside it, a grey bar per row measures the share that land
  // outside (Pr(|Ybar_n - mu| >= epsilon)), a gold outline marks Chebyshev's
  // bound sigma^2 / (n epsilon^2), and finally the band narrows to a smaller
  // epsilon. Data from wlln.json (built by make_wlln.R). One stage per
  // .wl-step fragment; stepping backwards runs each transition in reverse.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 560;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GOLD = '#d9a21b', GREY = '#9a9a9a';
  var MUX = 410, SC = 700 / 0.9;                   // truth at x = 410; px per unit share
  var ROWY = [170, 290, 410, 530], BANDH = 86, PR = 6;   // row baselines, strip height, pie radius
  var POP = { x: MUX, y: 44, r: 28 }, TX = 805, TW = 165;  // population pie; tally bars
  var mu = d.mu, NR = d.n.length, eps = d.eps;

  // Stages: rows dropped, band, tally bars, Chebyshev outlines, smaller epsilon
  var STAGES = [
    { r0: 0, r1: 0, r2: 0, r3: 0, band: 0, tal: 0, ch: 0, e: 0 },
    { r0: 1, r1: 0, r2: 0, r3: 0, band: 0, tal: 0, ch: 0, e: 0 },
    { r0: 1, r1: 1, r2: 1, r3: 1, band: 0, tal: 0, ch: 0, e: 0 },
    { r0: 1, r1: 1, r2: 1, r3: 1, band: 1, tal: 0, ch: 0, e: 0 },
    { r0: 1, r1: 1, r2: 1, r3: 1, band: 1, tal: 1, ch: 0, e: 0 },
    { r0: 1, r1: 1, r2: 1, r3: 1, band: 1, tal: 1, ch: 1, e: 0 },
    { r0: 1, r1: 1, r2: 1, r3: 1, band: 1, tal: 1, ch: 1, e: 1 }
  ];
  var DUR = [0, 1800, 3600, 900, 1200, 1000, 1500];
  // Part of a transition each quantity moves over (rows 2-4 drop in turn)
  var WIN = { r0: [0, 1], r1: [0, 0.45], r2: [0.27, 0.72], r3: [0.55, 1],
              band: [0, 1], tal: [0, 1], ch: [0, 1], e: [0, 1] };

  var seed = 640;
  function rand() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function hx(v) { return MUX + (v - mu) * SC; }
  function wedge(c, r, a0, a1) {
    if (a1 - a0 >= 2 * Math.PI - 1e-9) return 'M' + (c.x - r) + ' ' + c.y + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + -2 * r + ' 0Z';
    if (a1 - a0 <= 1e-9) return '';
    var p = function (a) { return (c.x + r * Math.sin(a)).toFixed(2) + ' ' + (c.y - r * Math.cos(a)).toFixed(2); };
    return 'M' + c.x + ' ' + c.y + 'L' + p(a0) + 'A' + r + ' ' + r + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + p(a1) + 'Z';
  }
  function pie(parent, share) {
    var g = mk('g', {}, parent);
    mk('path', { fill: BLUE, d: wedge({ x: 0, y: 0 }, 1, 0, 2 * Math.PI * share) }, g);
    mk('path', { fill: RED, d: wedge({ x: 0, y: 0 }, 1, 2 * Math.PI * share, 2 * Math.PI) }, g);
    var ring = mk('circle', { r: 1, fill: 'none', stroke: INK, 'vector-effect': 'non-scaling-stroke' }, g);
    return { g: g, ring: ring };
  }

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'Sample means at growing sample sizes bunch up around the truth, and the share falling outside a band around it shrinks toward zero',
                        style: 'width: 100%; height: auto; max-height: 580px; display: block;' }, el);

  // Band around the truth, behind everything
  var band = mk('rect', { y: POP.y + POP.r + 8, height: ROWY[NR - 1] - POP.y - POP.r - 8, fill: INK, 'fill-opacity': 0.07 }, svg);
  var bandL = mk('line', { y1: POP.y + POP.r + 8, y2: ROWY[NR - 1], stroke: INK, 'stroke-width': 2, 'stroke-dasharray': '0.1 7', 'stroke-linecap': 'round' }, svg);
  var bandR = mk('line', { y1: POP.y + POP.r + 8, y2: ROWY[NR - 1], stroke: INK, 'stroke-width': 2, 'stroke-dasharray': '0.1 7', 'stroke-linecap': 'round' }, svg);
  // Baselines, the truth, the population pie
  var axes = ROWY.map(function (y) {
    return mk('line', { x1: 60, y1: y, y2: y, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  });
  mk('line', { x1: MUX, x2: MUX, y1: POP.y + POP.r + 8, y2: ROWY[NR - 1], stroke: INK, 'stroke-width': 2.5,
               'stroke-dasharray': '12 8' }, svg);
  var popPie = pie(svg, mu);
  popPie.g.setAttribute('transform', 'translate(' + POP.x + ' ' + POP.y + ') scale(' + POP.r + ')');
  popPie.ring.setAttribute('stroke-width', 0);

  // Tally: a zero line, a grey bar per row for the share outside the band,
  // and a gold outline for Chebyshev's bound
  var zero = mk('line', { x1: TX, x2: TX, y1: ROWY[0] - BANDH - 6, y2: ROWY[NR - 1], stroke: INK, 'stroke-width': 2.5 }, svg);
  var bounds = ROWY.map(function (y) {
    return mk('rect', { x: TX, y: y - BANDH / 2 - 21, height: 34, fill: 'none', stroke: GOLD, 'stroke-width': 3 }, svg);
  });
  var bars = ROWY.map(function (y) {
    return mk('rect', { x: TX, y: y - BANDH / 2 - 14, height: 20, fill: GREY }, svg);
  });

  // Sample-mean pies, jittered up and down within their row's strip
  var pies = d.ybar.map(function (vals, s) {
    return vals.map(function (v) {
      var p = pie(svg, v);
      return { p: p, v: v, x: hx(v), y: ROWY[s] - PR - 6 - rand() * (BANDH - 2 * PR - 10), d: rand(),
               in0: Math.abs(v - mu) < eps[0], in1: Math.abs(v - mu) < eps[1] };
    });
  });

  function render(lo, hi, w) {
    function g(k) {
      var a = lo[k], b = hi[k];
      if (a === b) return a;
      var W0 = WIN[k];
      return lerp(a, b, ease(clamp((w - W0[0]) / (W0[1] - W0[0]))));
    }
    function rowProg(s) {                       // raw (uneased) progress for row s
      var k = 'r' + s, a = lo[k], b = hi[k];
      if (a === b) return a;
      var W0 = WIN[k];
      return lerp(a, b, clamp((w - W0[0]) / (W0[1] - W0[0])));
    }
    var bd = g('band'), e = g('e'), tal = g('tal'), ch = g('ch');
    var half = lerp(eps[0], eps[1], e) * SC;
    band.setAttribute('x', MUX - half); band.setAttribute('width', 2 * half);
    band.setAttribute('opacity', bd);
    [[bandL, -1], [bandR, 1]].forEach(function (q) {
      q[0].setAttribute('x1', MUX + q[1] * half); q[0].setAttribute('x2', MUX + q[1] * half);
      q[0].setAttribute('opacity', bd);
    });
    zero.setAttribute('opacity', Math.max(tal, ch));
    pies.forEach(function (row, s) {
      var rp = rowProg(s);
      axes[s].setAttribute('x2', lerp(60, 760, ease(clamp(rp * 3))));
      axes[s].setAttribute('opacity', rp > 0 ? 1 : 0);
      row.forEach(function (q) {
        var f = clamp((rp - q.d * 0.6) / 0.4), t = ease(f);
        var x = lerp(POP.x, q.x, t), y = lerp(POP.y, q.y, t), r = lerp(POP.r * 0.5, PR, t);
        var inside = lerp(q.in0 ? 1 : 0, q.in1 ? 1 : 0, e);
        q.p.g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(' + r.toFixed(2) + ')');
        q.p.g.setAttribute('opacity', f > 0 ? 1 - 0.7 * bd * inside : 0);
        q.p.ring.setAttribute('stroke-width', (1.6 * bd * (1 - inside)).toFixed(2));
      });
      var out = lerp(d.outside[s][0], d.outside[s][1], e), cb = lerp(d.cheb[s][0], d.cheb[s][1], e);
      bars[s].setAttribute('width', TW * out * tal);
      bars[s].setAttribute('opacity', tal > 0 ? 1 : 0);
      bounds[s].setAttribute('width', TW * cb);
      bounds[s].setAttribute('opacity', ch);
    });
  }

  // ---- Stepping (one stage per .wl-step fragment) ----------------------------
  var cur = -1, raf = null;
  function goTo(s, animate) {
    s = Math.max(0, Math.min(STAGES.length - 1, s));
    if (raf) { cancelAnimationFrame(raf); raf = null; render(STAGES[cur], STAGES[cur], 1); }
    if (s === cur) return;
    var prev = cur;
    cur = s;
    if (!animate || prev < 0 || Math.abs(s - prev) !== 1) { render(STAGES[s], STAGES[s], 1); return; }
    var fwd = s > prev, lo = STAGES[Math.min(s, prev)], hi = STAGES[Math.max(s, prev)];
    var dur = DUR[Math.max(s, prev)], t0 = null;
    raf = requestAnimationFrame(function frame(now) {
      if (t0 === null) t0 = now;
      var e = Math.min(1, (now - t0) / dur);
      render(lo, hi, fwd ? e : 1 - e);
      raf = e < 1 ? requestAnimationFrame(frame) : null;
    });
  }

  // Reveal wiring, as on the week 4 Datasaurus slide
  var slide = el.closest('section');
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.wl-step.visible').length : 0;
  }
  function onThisSlide() {
    return window.Reveal && Reveal.getCurrentSlide && Reveal.getCurrentSlide() === slide;
  }
  ['fragmentshown', 'fragmenthidden'].forEach(function (type) {
    document.addEventListener(type, function () {
      if (onThisSlide()) goTo(fragmentStage(), true);
    });
  });
  ['ready', 'slidechanged'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (e.currentSlide === slide) { if (raf) { cancelAnimationFrame(raf); raf = null; } cur = -1; goTo(fragmentStage(), false); }
    });
  });
  render(STAGES[0], STAGES[0], 1);
  goTo(fragmentStage(), false);
}
