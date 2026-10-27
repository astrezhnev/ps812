function (el, d) {
  // Why the asymptotic interval breaks down in small samples, in the visual
  // language of the week 7 CLT animation. The N(0, 1) density (ink) and the
  // critical values +/- z (dashed) are drawn first; then a histogram of the
  // simulated standardized mean (Ybar - mu) / (sigma_hat / sqrt(n)) appears
  // at a large n and morphs as n shrinks, its bars beyond +/- z in red. A
  // tally on the right gives the share of draws beyond +/- z, against a gold
  // outline at the nominal alpha. Data from the pivot-sim chunk of
  // week8_inference.qmd. One stage per .pv-step fragment; stepping backwards
  // runs each transition in reverse.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 500;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GOLD = '#d9a21b', GREY = '#9a9a9a';
  var X0 = 40, X1 = 780, Y0 = 420, Y1 = 80;        // panel
  var TX = 830, TW = 150, TMAX = 0.2;              // tally: TW px for a 20% share
  var NN = d.n.length, E = d.edges, NB = E.length - 1, L = E[NB];
  var ymax = 1.08 * Math.max(0.4, Math.max.apply(null, d.dens.map(function (r) { return Math.max.apply(null, r); })));

  // Stages: limit and critical values, the large-n histogram, then each smaller n
  var STAGES = [{ k: 0, hist: 0 }];
  for (var i = 0; i < NN; i++) STAGES.push({ k: i, hist: 1 });
  var DUR = [0, 1000].concat(d.n.slice(1).map(function () { return 1300; }));

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function px(v) { return X0 + (v + L) / (2 * L) * (X1 - X0); }
  function py(v) { return Y0 - v / ymax * (Y0 - Y1); }

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'As the sample size shrinks, the standardized sample mean puts more probability beyond the normal critical values, so the interval covers less often',
                        style: 'width: 100%; height: auto; max-height: 540px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  var counter = mk('text', { x: (X0 + X1) / 2, y: 40, 'text-anchor': 'middle', 'font-size': 34, fill: INK }, svg);

  // Histogram bars, red beyond the critical values
  var bars = [];
  for (var b = 0; b < NB; b++) {
    var mid = (E[b] + E[b + 1]) / 2, out = Math.abs(mid) > d.crit;
    bars.push(mk('rect', { x: px(E[b]) + 0.5, width: px(E[b + 1]) - px(E[b]) - 1,
                           fill: out ? RED : BLUE, 'fill-opacity': out ? 0.75 : 0.3 }, svg));
  }
  mk('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  // The N(0, 1) density and the critical values
  var pts = [];
  for (var v = -L; v <= L + 1e-9; v += 0.02) pts.push(px(v).toFixed(1) + ' ' + py(Math.exp(-v * v / 2) / Math.sqrt(2 * Math.PI)).toFixed(1));
  mk('path', { d: 'M' + pts.join('L'), fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
  [-d.crit, d.crit].forEach(function (c) {
    mk('line', { x1: px(c), x2: px(c), y1: Y0, y2: Y1 - 10, stroke: INK, 'stroke-width': 2, 'stroke-dasharray': '8 7' }, svg);
    var t = mk('text', { x: px(c), y: Y0 + 34, 'text-anchor': 'middle', 'font-size': 22, fill: GREY }, svg);
    t.textContent = (c < 0 ? '−' : '') + Math.abs(c).toFixed(2);
  });

  // Tally: share beyond the critical values, against the nominal alpha
  var tally = mk('g', {}, svg);
  var pct = mk('text', { x: TX + TW / 2, y: 225, 'text-anchor': 'middle', 'font-size': 36, fill: RED }, tally);
  mk('rect', { x: TX, y: 250, width: TW, height: 26, fill: 'none', stroke: GREY, 'stroke-width': 1, 'stroke-opacity': 0.5 }, tally);
  var share = mk('rect', { x: TX, y: 254, height: 18, fill: RED, 'fill-opacity': 0.75 }, tally);
  mk('rect', { x: TX, y: 247, width: TW * d.alpha / TMAX, height: 32, fill: 'none', stroke: GOLD, 'stroke-width': 3 }, tally);

  function render(k, h) {
    var a = Math.floor(k), b2 = Math.min(a + 1, NN - 1), f = k - a;
    bars.forEach(function (r, j) {
      var hv = lerp(d.dens[a][j], d.dens[b2][j], f) * h;
      r.setAttribute('y', py(hv).toFixed(1));
      r.setAttribute('height', Math.max(0, Y0 - py(hv)).toFixed(1));
    });
    var o = lerp(d.out[a], d.out[b2], f);
    pct.textContent = (100 * o).toFixed(1) + '%';
    share.setAttribute('width', (TW * Math.min(o, TMAX) / TMAX).toFixed(1));
    tally.setAttribute('opacity', h);
    counter.setAttribute('opacity', h);
    counter.textContent = 'n = ' + Math.round(Math.exp(lerp(Math.log(d.n[a]), Math.log(d.n[b2]), f)));
  }

  // ---- Stepping (one stage per .pv-step fragment) ----------------------------
  var cur = -1, raf = null;
  function show(s) { render(STAGES[s].k, STAGES[s].hist); }
  function goTo(s, animate) {
    s = Math.max(0, Math.min(STAGES.length - 1, s));
    if (raf) { cancelAnimationFrame(raf); raf = null; show(cur); }
    if (s === cur) return;
    var prev = cur;
    cur = s;
    if (!animate || prev < 0 || Math.abs(s - prev) !== 1) { show(s); return; }
    var A = STAGES[prev], B = STAGES[s], dur = DUR[Math.max(s, prev)], t0 = null;
    raf = requestAnimationFrame(function frame(now) {
      if (t0 === null) t0 = now;
      var e = Math.min(1, (now - t0) / dur), w = ease(e);
      render(lerp(A.k, B.k, w), lerp(A.hist, B.hist, w));
      raf = e < 1 ? requestAnimationFrame(frame) : null;
    });
  }

  // Reveal wiring, as in the week 7 CLT animation
  var slide = el.closest('section');
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.pv-step.visible').length : 0;
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
  show(0);
  goTo(fragmentStage(), false);
}
