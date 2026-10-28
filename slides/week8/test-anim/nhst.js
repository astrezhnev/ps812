function (el, d, opts) {
  // The null hypothesis testing framework, step by step, in the visual
  // language of the week 8 interval animations. One scene is built up across
  // several slides: each slide embeds this script with opts.from (the stage
  // it opens on, drawn without animation) and opts.to (the stage its last
  // fragment reaches), so the framework can be interspersed with text.
  //   stage 0  the axis, in units of the estimate Ybar
  //   1  2     H0: mu = mu0 (gold line), then Ha: mu != mu0 (arrows)    step 1
  //   3        the axis rescales to the test statistic T                 step 2
  //   4        the Type I error budget alpha (one square in 1 / alpha)   step 3
  //   5        the N(0, 1) null distribution grows out of the H0 line    step 4
  //   6        the alpha budget splits into the two tails: the
  //            rejection region beyond +/- z_{1 - alpha/2}               step 5
  //   7  8     the observed T falls onto the axis, then the decision     step 6
  //   9        the p-value: the probability beyond +/- |T|               (extra)
  // Data: d.ybar and d.se (the estimate and its standard error), d.mu0 (the
  // null value), d.alpha, d.ylab (what Ybar measures). One stage per
  // .nh-step fragment; stepping backwards runs each transition in reverse.
  opts = opts || {};
  var FROM = opts.from || 0, TO = opts.to == null ? 9 : opts.to;
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 440;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GOLD = '#d9a21b', GREY = '#9a9a9a';
  var X0 = 60, X1 = 940, Y0 = 360, Y1 = 120, L = 4.5, YMAX = 0.42;
  var T = (d.ybar - d.mu0) / d.se, Z, P;

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function px(v) { return X0 + (v + L) / (2 * L) * (X1 - X0); }
  function py(v) { return Y0 - v / YMAX * (Y0 - Y1); }
  function npdf(x) { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); }
  function ncdf(x) {                               // Abramowitz and Stegun 7.1.26
    var z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
    var e = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z);
    return x < 0 ? (1 - e) / 2 : (1 + e) / 2;
  }
  function nq(p) {                                 // quantile by bisection
    var a = -10, b = 10;
    for (var i = 0; i < 80; i++) { var m = (a + b) / 2; if (ncdf(m) < p) a = m; else b = m; }
    return (a + b) / 2;
  }
  Z = nq(1 - d.alpha / 2);
  P = 2 * (1 - ncdf(Math.abs(T)));
  function area(a, b, s) {                         // closed path under s * density from a to b
    var p = [px(a).toFixed(1) + ' ' + Y0];
    for (var x = a; x < b; x += 0.02) p.push(px(x).toFixed(1) + ' ' + py(s * npdf(x)).toFixed(1));
    p.push(px(b).toFixed(1) + ' ' + py(s * npdf(b)).toFixed(1), px(b).toFixed(1) + ' ' + Y0);
    return 'M' + p.join('L') + 'Z';
  }
  function fmt(v) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2); }

  var KEYS = ['h0', 'ha', 'ax', 'al', 'dn', 'rj', 'ob', 'dc', 'pv'];
  var STAGES = KEYS.map(function () { return 0; }).concat(0).map(function (_, s) {
    var st = {};
    KEYS.forEach(function (k, j) { st[k] = s > j ? 1 : 0; });
    return st;
  });
  var DUR = [0, 800, 900, 1400, 900, 1300, 1500, 1100, 800, 900];

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'A hypothesis test built up step by step: the null and alternative, the test statistic, the error rate, the null distribution, the rejection region, and where the observed statistic lands',
                        style: 'width: 100%; height: auto; max-height: 460px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  // ---- Null distribution and rejection region (drawn under everything) ------
  var gDn = mk('g', {}, svg);
  var dnFill = mk('path', { fill: BLUE, 'fill-opacity': 0.12 }, gDn);
  var dnLine = mk('path', { fill: 'none', stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, gDn);
  var dnLab = mk('text', { x: px(1.3), y: py(0.3), 'text-anchor': 'start', 'font-size': 21, fill: INK }, gDn);
  dnLab.textContent = 'T under H₀: N(0, 1)';
  var gRj = mk('g', {}, svg);
  var tails = [mk('path', { fill: RED, 'fill-opacity': 0.75, d: area(-L, -Z, 1) }, gRj),
               mk('path', { fill: RED, 'fill-opacity': 0.75, d: area(Z, L, 1) }, gRj)];
  [-1, 1].forEach(function (s) {
    mk('line', { x1: px(s * Z), x2: px(s * Z), y1: Y0, y2: Y1 - 20, stroke: RED, 'stroke-width': 2.5, 'stroke-dasharray': '10 7' }, gRj);
    mk('text', { x: px(s * Z), y: Y0 + 34, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 600, fill: RED }, gRj).textContent = fmt(s * Z);
    var t = mk('text', { x: px(s * (Z + 1.25)), y: py(0.16), 'text-anchor': 'middle', 'font-size': 22, fill: RED }, gRj);
    t.textContent = 'reject H₀';
    mk('text', { x: px(s * (Z + 1.25)), y: py(0.16) + 26, 'text-anchor': 'middle', 'font-size': 19, fill: RED }, gRj).textContent = 'α/2 = ' + (d.alpha / 2).toFixed(3);
  });
  var keep = mk('text', { x: px(0), y: py(0.1), 'text-anchor': 'middle', 'font-size': 22, fill: INK }, gRj);
  keep.textContent = 'fail to reject H₀';
  var gPv = mk('g', {}, svg);
  [-1, 1].forEach(function (s) {
    mk('path', { fill: GOLD, d: s < 0 ? area(-L, -Math.abs(T), 1) : area(Math.abs(T), L, 1) }, gPv);
  });

  // ---- Axis: Ybar units, then T units ---------------------------------------
  mk('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  var yTicks = [], tTicks = [];
  for (var v = -4; v <= 4; v++) {
    yTicks.push({ v: v, t: mk('text', { y: Y0 + 34, 'text-anchor': 'middle', 'font-size': 20, fill: GREY }, svg),
                  k: mk('line', { y1: Y0, y2: Y0 + 8, stroke: GREY, 'stroke-width': 2 }, svg) });
    yTicks[yTicks.length - 1].t.textContent = fmt(d.mu0 + v).replace('.00', '');
    tTicks.push({ v: v, t: mk('text', { x: px(v), y: Y0 + 34, 'text-anchor': 'middle', 'font-size': 20, fill: GREY }, svg),
                  k: mk('line', { x1: px(v), x2: px(v), y1: Y0, y2: Y0 + 8, stroke: GREY, 'stroke-width': 2 }, svg) });
    tTicks[tTicks.length - 1].t.textContent = v < 0 ? '−' + (-v) : String(v);
  }
  var axY = mk('text', { x: (X0 + X1) / 2, y: Y0 + 70, 'text-anchor': 'middle', 'font-size': 22, fill: INK }, svg);
  axY.textContent = 'Ȳ: ' + d.ylab;
  var axT = mk('text', { x: (X0 + X1) / 2, y: Y0 + 70, 'text-anchor': 'middle', 'font-size': 22, fill: INK }, svg);
  axT.textContent = 'T = (Ȳ − ' + d.mu0 + ') / SE(Ȳ)   (standard errors from the null)';

  // ---- Hypotheses -----------------------------------------------------------
  var gH0 = mk('g', {}, svg);
  var h0Line = mk('line', { x1: px(0), x2: px(0), y1: 52, y2: Y0, stroke: GOLD, 'stroke-width': 3, 'stroke-dasharray': '12 8' }, gH0);
  mk('text', { x: px(0), y: 40, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 600, fill: GOLD }, gH0).textContent = 'H₀: μ = ' + d.mu0;
  var gHa = mk('g', {}, svg);
  [-1, 1].forEach(function (s) {
    var a = px(s * 1.25), b = px(s * 3.6);
    mk('line', { x1: a, x2: b - s * 14, y1: 32, y2: 32, stroke: INK, 'stroke-width': 3 }, gHa);
    mk('path', { d: 'M' + b + ' 32L' + (b - s * 16) + ' 23L' + (b - s * 16) + ' 41Z', fill: INK }, gHa);
    mk('text', { x: b + s * 10, y: 40, 'text-anchor': s < 0 ? 'end' : 'start', 'font-size': 22, fill: INK }, gHa).textContent = s < 0 ? 'μ < ' + d.mu0 : 'μ > ' + d.mu0;
  });
  mk('text', { x: px(2.4), y: 64, 'text-anchor': 'middle', 'font-size': 22, fill: INK }, gHa).textContent = 'Hₐ: μ ≠ ' + d.mu0;

  // ---- Error budget: one square in 1 / alpha --------------------------------
  var NB = Math.round(1 / d.alpha), BC = 5, BS = 22, BX = X0 + 6, BY = 140;
  var gAl = mk('g', {}, svg);
  for (var i = 0; i < NB; i++) {
    mk('rect', { x: BX + (i % BC) * (BS + 5), y: BY + Math.floor(i / BC) * (BS + 5), width: BS, height: BS,
                 fill: 'none', stroke: GREY, 'stroke-width': 1.5 }, gAl);
  }
  var nbRows = Math.ceil(NB / BC);
  mk('text', { x: BX, y: BY - 14, 'font-size': 22, 'font-weight': 600, fill: RED }, gAl).textContent = 'α = ' + d.alpha;
  mk('text', { x: BX, y: BY + nbRows * (BS + 5) + 20, 'font-size': 18, fill: GREY }, gAl).textContent = 'false positives we accept';
  // The red square, as two halves that later fly to the tails
  var sx = BX + (NB - 1) % BC * (BS + 5), sy = BY + (nbRows - 1) * (BS + 5);
  var halves = [0, 1].map(function (j) { return mk('rect', { width: BS / 2, height: BS, fill: RED }, svg); });

  // ---- Observed statistic and decision --------------------------------------
  var gOb = mk('g', {}, svg);
  var obStem = mk('line', { x1: px(T), x2: px(T), stroke: BLUE, 'stroke-width': 3 }, gOb);
  var obDot = mk('circle', { cx: px(T), r: 9, fill: BLUE }, gOb);
  var obLab = mk('text', { x: px(T), 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 600, fill: BLUE }, gOb);
  obLab.textContent = 'T = ' + fmt(T);
  var gDc = mk('g', {}, svg);
  var rejected = Math.abs(T) > Z;
  // Decision and p-value in the empty corner on the side T falls
  var CX = T > 0 ? X1 : X0, CA = T > 0 ? 'end' : 'start';
  mk('text', { x: CX, y: Y1 + 0, 'text-anchor': CA, 'font-size': 24, fill: rejected ? RED : INK }, gDc).textContent =
    '|T| ' + (rejected ? '>' : '≤') + ' ' + Z.toFixed(2);
  mk('text', { x: CX, y: Y1 + 32, 'text-anchor': CA, 'font-size': 28, 'font-weight': 700, fill: rejected ? RED : INK }, gDc).textContent =
    rejected ? 'reject H₀' : 'fail to reject H₀';
  var gPvL = mk('g', {}, svg);
  mk('text', { x: CX, y: Y1 + 70, 'text-anchor': CA, 'font-size': 26, 'font-weight': 700, fill: GOLD }, gPvL).textContent =
    'p = ' + (P < 0.001 ? P.toFixed(4) : P.toFixed(3));
  mk('text', { x: CX, y: Y1 + 96, 'text-anchor': CA, 'font-size': 19, fill: GOLD }, gPvL).textContent =
    'P(|T| ≥ ' + Math.abs(T).toFixed(2) + ' | H₀)';

  function render(st) {
    gH0.setAttribute('opacity', st.h0);
    gHa.setAttribute('opacity', st.ha);
    // Axis rescale: a Ybar tick at mu0 + v sits at v (one plot unit per point
    // of Ybar) and slides to T = v / se
    yTicks.forEach(function (tk) {
      var x = px(tk.v * lerp(1, 1 / d.se, st.ax)), vis = Math.abs(tk.v * lerp(1, 1 / d.se, st.ax)) <= L ? 1 : 0;
      tk.t.setAttribute('x', x); tk.k.setAttribute('x1', x); tk.k.setAttribute('x2', x);
      tk.t.setAttribute('opacity', (1 - st.ax) * vis); tk.k.setAttribute('opacity', (1 - st.ax) * vis);
    });
    tTicks.forEach(function (tk) {
      var hide = Math.abs(Math.abs(tk.v) - Z) < 0.5 ? 1 - st.rj : 1;   // make room for the critical values
      tk.t.setAttribute('opacity', st.ax * hide); tk.k.setAttribute('opacity', st.ax * hide);
    });
    axY.setAttribute('opacity', 1 - st.ax);
    axT.setAttribute('opacity', st.ax);
    gAl.setAttribute('opacity', st.al * (1 - clamp(2 * st.rj)));
    // Null density grows up out of the H0 line
    var g = ease(clamp(st.dn));
    dnFill.setAttribute('d', area(-L, L, g));
    var pts = [];
    for (var x = -L; x <= L + 1e-9; x += 0.02) pts.push(px(x).toFixed(1) + ' ' + py(g * npdf(x)).toFixed(1));
    dnLine.setAttribute('d', 'M' + pts.join('L'));
    gDn.setAttribute('opacity', st.dn > 0 ? 1 : 0);
    dnLab.setAttribute('opacity', st.dn * (1 - st.rj));
    gRj.setAttribute('opacity', clamp(2 * st.rj - 1));
    // The red square splits and flies to the tails
    halves.forEach(function (h, j) {
      var s = j ? 1 : -1, tx = px(s * (Z + 0.5)) - BS / 4, ty = Y0 - BS - 4;
      h.setAttribute('x', lerp(sx + j * BS / 2, tx, ease(clamp(1.6 * st.rj))));
      h.setAttribute('y', lerp(sy, ty, ease(clamp(1.6 * st.rj))));
      h.setAttribute('opacity', st.al * (1 - clamp(2 * st.rj - 1)));
    });
    // The observed statistic falls in from the top
    var f = ease(clamp(st.ob)), yy = lerp(40, Y0 - 9, f);
    obDot.setAttribute('cy', yy);
    obStem.setAttribute('y1', yy); obStem.setAttribute('y2', Y0);
    obStem.setAttribute('opacity', f > 0.95 ? 1 : 0);
    obLab.setAttribute('y', Y0 - 26);
    obLab.setAttribute('opacity', clamp(3 * st.ob - 2));
    gOb.setAttribute('opacity', st.ob > 0 ? 1 : 0);
    var red = rejected ? st.dc : 0;
    obDot.setAttribute('fill', red > 0.5 ? RED : BLUE); obStem.setAttribute('stroke', red > 0.5 ? RED : BLUE);
    obLab.setAttribute('fill', red > 0.5 ? RED : BLUE);
    gDc.setAttribute('opacity', st.dc);
    gPv.setAttribute('opacity', st.pv);
    gPvL.setAttribute('opacity', st.pv);
    keep.setAttribute('opacity', 1);
  }

  // ---- Stepping (stage = opts.from + visible .nh-step fragments) ------------
  var cur = -1, raf = null;
  function mix(A, B, e) {
    var st = {};
    for (var k in A) st[k] = lerp(A[k], B[k], e);
    return st;
  }
  function goTo(s, animate) {
    s = Math.max(FROM, Math.min(TO, s));
    if (raf) { cancelAnimationFrame(raf); raf = null; render(STAGES[cur]); }
    if (s === cur) return;
    var prev = cur;
    cur = s;
    if (!animate || prev < 0 || Math.abs(s - prev) !== 1) { render(STAGES[s]); return; }
    var A = STAGES[prev], B = STAGES[s], dur = DUR[Math.max(s, prev)], t0 = null;
    raf = requestAnimationFrame(function frame(now) {
      if (t0 === null) t0 = now;
      var e = Math.min(1, (now - t0) / dur);
      render(mix(A, B, e));
      raf = e < 1 ? requestAnimationFrame(frame) : null;
    });
  }

  // Reveal wiring, as in the week 7 CLT animation
  var slide = el.closest('section');
  function fragmentStage() {
    return FROM + (slide ? slide.querySelectorAll('.fragment.nh-step.visible').length : 0);
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
  render(STAGES[FROM]);
  goTo(fragmentStage(), false);
}
