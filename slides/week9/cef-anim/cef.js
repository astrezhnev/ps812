function (el, d, opts) {
  // From the mean of Y to the conditional expectation function, in the visual
  // language of the week 8 coverage animation. A scatterplot of a sample from
  // a population whose CEF is linear, E[Y | X] = b0 + b1 X with normal errors.
  //   stage 0  the estimand mu = E[Y] as a horizontal line, with the
  //            marginal density of Y in the right margin
  //   1        the line pivots about (E[X], E[Y]) into the CEF
  // One slide can embed this script with opts.from (the stage it opens on,
  // drawn without animation) and opts.to (the stage its last fragment
  // reaches). Data: d.x, d.y (the sample), d.b0, d.b1, d.sigma (the CEF and
  // the error SD), d.mux, d.sdx (the mean and SD of X), d.xlim, d.ylim. One
  // stage per .cf-step fragment; stepping backwards runs each transition in
  // reverse.
  opts = opts || {};
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 470;
  var BLUE = '#0479a8', INK = '#333333', GREY = '#9a9a9a';
  var X0 = 90, X1 = 770, Y0 = 400, Y1 = 40, MX = 800, DS = 380;
  var XL = d.xlim[0], XH = d.xlim[1], YL = d.ylim[0], YH = d.ylim[1];
  var MU = d.b0 + d.b1 * d.mux, SDY = Math.sqrt(d.b1 * d.b1 * d.sdx * d.sdx + d.sigma * d.sigma);

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
  function py(v) { return Y0 - (v - YL) / (YH - YL) * (Y0 - Y1); }
  function dnorm(y, m, s) { return Math.exp(-0.5 * Math.pow((y - m) / s, 2)) / (s * Math.sqrt(2 * Math.PI)); }
  function side(x0, m, s, g, a, b, close) {        // a density of Y turned on its side, from x0
    var p = [];
    for (var y = a; y <= b + 1e-9; y += 0.04) p.push((x0 + g * DS * dnorm(y, m, s)).toFixed(1) + ' ' + py(y).toFixed(1));
    return close ? 'M' + x0 + ' ' + py(a).toFixed(1) + 'L' + p.join('L') + 'L' + x0 + ' ' + py(b).toFixed(1) + 'Z' : 'M' + p.join('L');
  }

  var STAGES = [{ cf: 0 }, { cf: 1 }];
  var DUR = [0, 1800];
  var FROM = opts.from || 0, TO = opts.to == null ? STAGES.length - 1 : opts.to;

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'A scatterplot of Y against X with a horizontal line at the mean of Y; the line pivots through the point of means into the conditional expectation function, and the distribution of Y at a few values of X is centered on that line',
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

  // ---- Marginal density of Y (right margin) -------------------------------------
  var gMg = mk('g', {}, svg);
  mk('line', { x1: MX, x2: MX, y1: Y0, y2: Y1, stroke: GREY, 'stroke-width': 1.5 }, gMg);
  mk('path', { d: side(MX, MU, SDY, 1, YL, YH, true), fill: BLUE, 'fill-opacity': 0.12 }, gMg);
  mk('path', { d: side(MX, MU, SDY, 1, YL, YH, false), fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' }, gMg);
  mk('text', { x: MX + 8, y: Y0 + 32, 'font-size': 19, fill: GREY }, gMg).textContent = 'density of Y';

  // ---- Points ---------------------------------------------------------------------
  d.x.forEach(function (x, i) {
    mk('circle', { cx: px(x).toFixed(1), cy: py(d.y[i]).toFixed(1), r: 5, fill: BLUE, 'fill-opacity': 0.5 }, svg);
  });

  // ---- The line: mu, then the CEF -------------------------------------------------
  var mExt = mk('line', { x1: X1, y1: py(MU), y2: py(MU), x2: MX + DS * dnorm(MU, MU, SDY),
                          stroke: INK, 'stroke-width': 2, 'stroke-dasharray': '6 6' }, svg);
  var cLine = mk('line', { stroke: INK, 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
  var labMu = mk('text', { 'text-anchor': 'end', 'font-size': 26, 'font-weight': 600, fill: INK }, svg);
  labMu.textContent = 'μ = E[Y]';
  // The CEF's label sits in the right margin, off the end of the line
  var labCf = mk('text', { x: X1 + 14, 'font-size': 26, 'font-weight': 600, fill: INK }, svg);
  mk('tspan', { x: X1 + 14 }, labCf).textContent = 'E[Y | X]';
  mk('tspan', { x: X1 + 14, dy: 32 }, labCf).textContent = '= β₀ + β₁X';

  function render(st) {
    var cf = st.cf, b = d.b1 * ease(clamp(cf));
    // The line pivots about the point of means (E[X], E[Y])
    function ln(x) { return MU + b * (x - d.mux); }
    cLine.setAttribute('x1', px(XL)); cLine.setAttribute('y1', py(ln(XL)));
    cLine.setAttribute('x2', px(XH)); cLine.setAttribute('y2', py(ln(XH)));
    var lx = XH - 0.2;
    labMu.setAttribute('x', px(lx)); labMu.setAttribute('y', py(ln(lx)) - 16);
    labCf.setAttribute('y', py(ln(XH)) - 4);
    labMu.setAttribute('opacity', clamp(1 - 2 * cf));
    labCf.setAttribute('opacity', clamp(2 * cf - 1));
    mExt.setAttribute('opacity', 1 - clamp(2 * cf));
    gMg.setAttribute('opacity', lerp(1, 0.35, clamp(cf)));
  }

  // ---- Stepping (stage = opts.from + visible .cf-step fragments) ------------
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
    return FROM + (slide ? slide.querySelectorAll('.fragment.cf-step.visible').length : 0);
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
