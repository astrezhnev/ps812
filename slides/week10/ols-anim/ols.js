function (el, d, opts) {
  // Least squares as minimizing the sum of squared residuals, in the visual
  // language of the week 9 CEF animation. A scatterplot of a small fake sample.
  //   stage 0  the points
  //   1        a horizontal candidate line, y = d.c0
  //   2        the residuals, y_i - (a + b x_i), as vertical segments
  //   3        their squares, drawn beside each segment, with the
  //            sum of squared residuals in the right margin
  //   4        the line moves to the OLS fit (a straight path in (a, b),
  //            along which the convex SSR falls monotonically); the squares
  //            and the SSR shrink live
  //   5        the squares fade and the OLS residuals fly out of the plot to
  //            sit as bars on a zero line in the right margin
  //   6        the bars chain head to tail, the positive ones up and the
  //            negative ones back down, ending at zero: sum of residuals = 0
  //   7        the residuals return to the regression line
  // Data: d.x, d.y (the sample), d.c0 (the height of the starting line),
  // d.b0, d.b1 (the OLS fit), d.xlim, d.ylim. One stage per .ol-step
  // fragment; stepping backwards runs each transition in reverse.
  opts = opts || {};
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 470;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GOLD = '#d9a21b', GREY = '#9a9a9a';
  var X0 = 80, X1 = 640, Y0 = 400, Y1 = 40;
  var PX0 = 720, PX1 = 980;                        // the right margin panel
  var XL = d.xlim[0], XH = d.xlim[1], YL = d.ylim[0], YH = d.ylim[1];
  var KY = (Y0 - Y1) / (YH - YL);                  // pixels per unit of Y
  var n = d.x.length;

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function px(v) { return X0 + (v - XL) / (XH - XL) * (X1 - X0); }
  function py(v) { return Y0 - (v - YL) * KY; }
  function fmt(v, k) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(k); }
  function sgn(v, k) { return (v < 0 ? ' − ' : ' + ') + Math.abs(v).toFixed(k); }

  var STAGES = [
    { ln: 0, rs: 0, sq: 0, ft: 0, pl: 0, ch: 0 },
    { ln: 1, rs: 0, sq: 0, ft: 0, pl: 0, ch: 0 },
    { ln: 1, rs: 1, sq: 0, ft: 0, pl: 0, ch: 0 },
    { ln: 1, rs: 1, sq: 1, ft: 0, pl: 0, ch: 0 },
    { ln: 1, rs: 1, sq: 1, ft: 1, pl: 0, ch: 0 },
    { ln: 1, rs: 1, sq: 0, ft: 1, pl: 1, ch: 0 },
    { ln: 1, rs: 1, sq: 0, ft: 1, pl: 1, ch: 1 },
    { ln: 1, rs: 1, sq: 0, ft: 1, pl: 0, ch: 0 }
  ];
  var DUR = [0, 800, 900, 900, 3200, 1600, 1600, 1600];
  var FROM = opts.from || 0, TO = opts.to == null ? STAGES.length - 1 : opts.to;

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'A scatterplot with a horizontal line, the residuals from it and their squares; the line moves to the least squares fit as the squares shrink, then the residuals are lifted out and chained together to show that they sum to zero',
                        style: 'width: 100%; height: auto; max-height: 470px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  // ---- Axes ---------------------------------------------------------------------
  mk('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  mk('line', { x1: X0, x2: X0, y1: Y0, y2: Y1, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  for (var v = Math.ceil(XL); v <= XH; v += 2) {
    mk('line', { x1: px(v), x2: px(v), y1: Y0, y2: Y0 + 8, stroke: GREY, 'stroke-width': 2 }, svg);
    mk('text', { x: px(v), y: Y0 + 32, 'text-anchor': 'middle', 'font-size': 20, fill: GREY }, svg).textContent = v;
  }
  for (var u = Math.ceil(YL); u <= YH; u += 2) {
    mk('line', { x1: X0 - 8, x2: X0, y1: py(u), y2: py(u), stroke: GREY, 'stroke-width': 2 }, svg);
    mk('text', { x: X0 - 14, y: py(u) + 7, 'text-anchor': 'end', 'font-size': 20, fill: GREY }, svg).textContent = u;
  }
  mk('text', { x: (X0 + X1) / 2, y: Y0 + 62, 'text-anchor': 'middle', 'font-size': 24, 'font-style': 'italic', fill: INK }, svg).textContent = 'X';
  mk('text', { x: X0 - 50, y: (Y0 + Y1) / 2 + 8, 'text-anchor': 'middle', 'font-size': 24, 'font-style': 'italic', fill: INK }, svg).textContent = 'Y';

  // ---- Squares (under everything else) -------------------------------------------
  var gSq = mk('g', {}, svg), sqs = [];
  for (var i = 0; i < n; i++)
    sqs.push(mk('rect', { fill: GOLD, 'fill-opacity': 0.16, stroke: GOLD, 'stroke-width': 1.5 }, gSq));

  // ---- The line -----------------------------------------------------------------
  var fLine = mk('line', { stroke: INK, 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);

  // ---- Points ---------------------------------------------------------------------
  var gPt = mk('g', {}, svg);
  d.x.forEach(function (x, i) {
    mk('circle', { cx: px(x).toFixed(1), cy: py(d.y[i]).toFixed(1), r: 7, fill: BLUE, 'fill-opacity': 0.75 }, gPt);
  });

  // ---- Residual segments (above the points so they can fly out) -------------------
  var gRs = mk('g', {}, svg), segs = [];
  for (i = 0; i < n; i++)
    segs.push(mk('line', { 'stroke-width': 4, 'stroke-linecap': 'round' }, gRs));

  // ---- Right margin: the fitted line and the sum of squared residuals ----------------
  var gRo = mk('g', {}, svg);
  var roEq = mk('text', { x: PX0, y: 80, 'font-size': 26, fill: INK }, gRo);
  mk('text', { x: PX0, y: 150, 'font-size': 22, fill: GREY }, gRo).textContent = 'Sum of squared residuals';
  var roSs = mk('text', { x: PX0, y: 186, 'font-size': 30, 'font-weight': 600, fill: INK }, gRo);
  var roBar = mk('rect', { x: PX0, y: 204, height: 22, fill: GOLD, 'fill-opacity': 0.35, stroke: GOLD, 'stroke-width': 1.5 }, gRo);
  var roMin = mk('text', { x: PX0, y: 268, 'font-size': 24, 'font-weight': 600, fill: INK }, gRo);
  roMin.textContent = 'minimized: OLS';

  // ---- Right margin: the residuals as bars, then chained ---------------------------
  var gZ = mk('g', {}, svg);
  var BASE = (Y0 + Y1) / 2;                        // the zero line for the bars
  mk('line', { x1: PX0 - 10, x2: PX1, y1: 0, y2: 0, stroke: GREY, 'stroke-width': 2, 'stroke-dasharray': '6 6', class: 'zl' }, gZ);
  var zLab = mk('text', { x: PX0 - 18, 'text-anchor': 'end', 'font-size': 22, fill: GREY }, gZ);
  zLab.textContent = '0';
  var zSum = mk('text', { x: (PX0 + PX1) / 2, y: Y1 + 8, 'text-anchor': 'middle', 'font-size': 28, 'font-weight': 600, fill: INK }, gZ);
  zSum.textContent = 'Σ êᵢ = 0';
  var zPos = mk('text', { 'text-anchor': 'end', 'font-size': 22, fill: BLUE }, gZ);
  var zNeg = mk('text', { 'font-size': 22, fill: RED }, gZ);
  var zLine = gZ.querySelector('.zl');

  // ---- Geometry of the OLS residuals in the margin -----------------------------------
  var e = d.x.map(function (x, i) { return d.y[i] - d.b0 - d.b1 * x; });
  var bx = e.map(function (_, i) { return PX0 + 10 + (PX1 - PX0 - 20) * i / (n - 1); });
  // The chain: positive residuals stacked upward in one column, then the
  // negative ones back down in the next, from the top to the bottom line
  var CA = PX0 + 80, CB = PX0 + 120;
  var sPos = 0;
  e.forEach(function (v) { if (v > 0) sPos += v; });
  var CBOT = Y0 - 10, cTop = CBOT - sPos * KY;
  var ch = [], up = CBOT, dn = cTop;
  e.forEach(function (v, i) {
    if (v > 0) { ch[i] = { x: CA, y1: up, y2: up - v * KY }; up -= v * KY; }
    else { ch[i] = { x: CB, y1: dn, y2: dn - v * KY }; dn -= v * KY; }
  });
  zPos.setAttribute('x', CA - 14); zPos.setAttribute('y', (CBOT + cTop) / 2 + 8);
  zPos.textContent = '+' + sPos.toFixed(2);
  zNeg.setAttribute('x', CB + 14); zNeg.setAttribute('y', (CBOT + cTop) / 2 + 8);
  zNeg.textContent = '−' + sPos.toFixed(2);

  var SS0 = 0;
  d.y.forEach(function (y) { SS0 += (y - d.c0) * (y - d.c0); });
  var SSMIN = 0;
  e.forEach(function (v) { SSMIN += v * v; });

  function render(st) {
    var f = ease(clamp(st.ft));
    var a = lerp(d.c0, d.b0, f), b = lerp(0, d.b1, f);
    function ln(x) { return a + b * x; }

    // The line draws in from the left
    var lnT = ease(clamp(st.ln));
    fLine.setAttribute('x1', px(XL)); fLine.setAttribute('y1', py(ln(XL)));
    fLine.setAttribute('x2', px(lerp(XL, XH, lnT))); fLine.setAttribute('y2', py(ln(lerp(XL, XH, lnT))));
    fLine.setAttribute('opacity', lnT > 0 ? 1 : 0);

    // Residuals and their squares about the current line
    var ss = 0, rsT = clamp(st.rs), sqT = clamp(st.sq);
    var pl = ease(clamp(st.pl)), chT = ease(clamp(st.ch));
    d.x.forEach(function (x, i) {
      var r = d.y[i] - ln(x), s = Math.abs(r) * KY;
      ss += r * r;
      // In the plot: from the line to the point, growing out of the line
      var sx = px(x), sy1 = py(ln(x)), sy2 = py(lerp(ln(x), d.y[i], rsT));
      // In the margin: a bar on the zero line, then a link in the chain
      var mx = lerp(bx[i], ch[i].x, chT);
      // (each link pulls in 3px at both ends so the residuals stay distinct)
      var gp = 3 * chT * (ch[i].y2 > ch[i].y1 ? 1 : -1);
      var my1 = lerp(BASE, ch[i].y1, chT) + gp, my2 = lerp(BASE - e[i] * KY, ch[i].y2, chT) - gp;
      var seg = segs[i];
      seg.setAttribute('x1', lerp(sx, mx, pl)); seg.setAttribute('x2', lerp(sx, mx, pl));
      seg.setAttribute('y1', lerp(sy1, my1, pl)); seg.setAttribute('y2', lerp(sy2, my2, pl));
      seg.setAttribute('stroke', r >= 0 ? BLUE : RED);
      seg.setAttribute('opacity', rsT > 0 ? 1 : 0);
      // Each square sits on the side of its segment facing the middle of the plot
      var top = Math.min(py(ln(x)), py(d.y[i]));
      sqs[i].setAttribute('x', x > (XL + XH) / 2 ? sx - s : sx); sqs[i].setAttribute('y', top);
      sqs[i].setAttribute('width', s); sqs[i].setAttribute('height', s);
    });
    gSq.setAttribute('opacity', sqT);

    // The readout appears with the squares and fades as the residuals fly out
    gRo.setAttribute('opacity', Math.min(sqT, 1 - pl));
    roEq.textContent = 'ŷ = ' + fmt(a, 2) + sgn(b, 2) + 'x';
    roSs.textContent = 'Σ eᵢ² = ' + ss.toFixed(1);
    roBar.setAttribute('width', Math.max(0, (PX1 - PX0) * ss / SS0));
    roMin.setAttribute('opacity', clamp((st.ft - 0.9) * 10));

    // The zero line starts mid-panel and drops to the foot of the chain
    var zy = lerp(BASE, CBOT, chT);
    zLine.setAttribute('y1', zy); zLine.setAttribute('y2', zy);
    zLab.setAttribute('y', zy + 7);
    gZ.setAttribute('opacity', pl);
    zSum.setAttribute('opacity', chT);
    zPos.setAttribute('opacity', chT); zNeg.setAttribute('opacity', chT);
    gPt.setAttribute('opacity', lerp(1, 0.45, pl));
  }

  // ---- Stepping (stage = opts.from + visible .ol-step fragments) ------------
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
    return FROM + (slide ? slide.querySelectorAll('.fragment.ol-step.visible').length : 0);
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
