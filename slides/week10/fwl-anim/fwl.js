function (el, d, opts) {
  // Frisch-Waugh-Lovell as partialling out in both dimensions, after
  // ryxcommar's "Frisch-Waugh-Lovell theorem, animated" (2020), in the visual
  // language of the OLS animation. A Simpson's paradox: Y rises with X1 across
  // the groups of X2 but falls with X1 within each group. The line is always
  // the OLS fit of Y on X1 to the points as currently drawn.
  //   stage 0  the points and the pooled regression of Y on X1
  //   1        the points take their group's color
  //   2        regress Y on X2: the fitted values are the group means of Y
  //   3        keep the residuals: each point drops by its group's mean (the
  //            group means collapse onto the grand mean, which is 0 on the
  //            new Y axis); the slope flips sign but is attenuated
  //   4        regress X1 on X2: the group means of X1
  //   5        keep the residuals: each point slides by its group's mean of X1;
  //            the slope steepens to the multiple regression's beta_1
  //   6        the points return, and the multiple regression draws one line
  //            per group, all with that slope
  // Residuals are drawn with the grand mean added back so the points stay in
  // place on the plot; the axes relabel to the residual scale. Data: d.x, d.y,
  // d.g (groups 1..K), d.b1 (the coefficient on X1 in Y ~ X1 + X2), d.xlim,
  // d.ylim. One stage per .fw-step fragment; stepping backwards runs each
  // transition in reverse.
  opts = opts || {};
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 470;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GOLD = '#b8860b', GREY = '#9a9a9a', NEUT = '#666666';
  var GCOL = [BLUE, GOLD, RED];
  var X0 = 80, X1 = 640, Y0 = 400, Y1 = 40;
  var PX0 = 700;                                   // the right margin panel
  var XL = d.xlim[0], XH = d.xlim[1], YL = d.ylim[0], YH = d.ylim[1];
  var n = d.x.length, K = Math.max.apply(null, d.g);

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function mixc(a, b, t) {                         // blend two #rrggbb colors
    var c = [1, 3, 5].map(function (i) {
      return Math.round(lerp(parseInt(a.substr(i, 2), 16), parseInt(b.substr(i, 2), 16), t));
    });
    return 'rgb(' + c.join(',') + ')';
  }
  function px(v) { return X0 + (v - XL) / (XH - XL) * (X1 - X0); }
  function py(v) { return Y0 - (v - YL) / (YH - YL) * (Y0 - Y1); }
  function fmt(v) { return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2); }
  function mean(a) { var s = 0; a.forEach(function (v) { s += v; }); return s / a.length; }
  function ols(xs, ys) {
    var mx = mean(xs), my = mean(ys), sxy = 0, sxx = 0;
    xs.forEach(function (x, i) { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) * (x - mx); });
    return { b: sxy / sxx, a: my - sxy / sxx * mx };
  }
  // Math-ish labels, since the deck's font places combining marks badly and
  // its Unicode subscripts are tiny. In a string, '~' or '^' before a letter
  // puts a tilde or a hat on it, and '_' before a character sets it as a
  // subscript. Accents are drawn as paths over the measured letter on the
  // first render after the slide is laid out (a hidden slide has no glyph
  // metrics yet); subscripts are smaller tspans shifted down and back up
  var ACC = [];
  function rich(t, parts) {                        // parts: [[tspan attrs, string], ...]
    var fs = parseFloat(t.getAttribute('font-size')), SH = 0.22 * fs, idx = 0, pend = 0;
    parts.forEach(function (p) {
      var a = {};
      for (var k in p[0]) a[k] = p[0][k];
      if (pend) { a.dy = (a.dy || 0) + pend; pend = 0; }   // undo a subscript ending the last part
      var ts = mk('tspan', a, t), str = p[1], seg = '';
      function out(text, attrs) {
        if (!text) return;
        attrs = attrs || {};
        if (pend) { attrs.dy = (attrs.dy || 0) + pend; pend = 0; }
        mk('tspan', attrs, ts).textContent = text;
      }
      for (var j = 0; j < str.length; j++) {
        var c = str[j];
        if ((c === '~' || c === '^') && j + 1 < str.length) { ACC.push({ t: t, i: idx, k: c }); continue; }
        if (c === '_' && j + 1 < str.length) {
          out(seg); seg = '';
          out(str[j + 1], { dy: SH, 'font-size': 0.7 * fs });
          pend = -SH; j++; idx++;
          continue;
        }
        seg += c; idx++;
      }
      out(seg);
    });
    return t;
  }
  function placeAccents() {
    ACC.forEach(function (a) {
      if (a.done) return;
      var r, b;
      try { r = a.t.getExtentOfChar(a.i); b = a.t.getStartPositionOfChar(a.i); } catch (err) { return; }
      if (!r || !(r.width > 0)) return;
      var fs = parseFloat(a.t.getAttribute('font-size')), h = 0.06 * fs;
      var cx = r.x + r.width / 2 + (a.t.getAttribute('font-style') === 'italic' ? 0.1 * fs : 0);
      var y = b.y - 0.86 * fs, w = 0.42 * fs, x0 = cx - w / 2, x1 = cx + w / 2;
      var dd = a.k === '~'
        ? 'M' + x0 + ' ' + (y + h) + 'C' + (x0 + w / 3) + ' ' + (y - 2 * h) + ' ' + (x1 - w / 3) + ' ' + (y + 2 * h) + ' ' + x1 + ' ' + (y - h)
        : 'M' + (x0 + 0.1 * w) + ' ' + (y + 1.5 * h) + 'L' + cx + ' ' + (y - 1.5 * h) + 'L' + (x1 - 0.1 * w) + ' ' + (y + 1.5 * h);
      mk('path', { d: dd, fill: 'none', stroke: a.t.getAttribute('fill'), 'stroke-width': 0.075 * fs,
                   'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, a.t.parentNode);
      a.done = true;
    });
  }

  // Group and grand means, and the slopes the readout records along the way
  var XB = mean(d.x), YB = mean(d.y), gx = [], gy = [], gxr = [], gyr = [];
  for (var k = 1; k <= K; k++) {
    var xs = [], ys = [];
    d.g.forEach(function (g, i) { if (g === k) { xs.push(d.x[i]); ys.push(d.y[i]); } });
    gx.push(mean(xs)); gy.push(mean(ys));
    gxr.push([Math.min.apply(null, xs), Math.max.apply(null, xs)]);
    gyr.push([Math.min.apply(null, ys), Math.max.apply(null, ys)]);
  }
  var yt = d.y.map(function (y, i) { return y - gy[d.g[i] - 1] + YB; });
  var xt = d.x.map(function (x, i) { return x - gx[d.g[i] - 1] + XB; });
  var B_POOL = ols(d.x, d.y).b, B_Y = ols(d.x, yt).b, B_XY = ols(xt, yt).b;

  var STAGES = [
    { cl: 0, my: 0, ry: 0, mx: 0, rx: 0, bk: 0, cap: 0 },
    { cl: 1, my: 0, ry: 0, mx: 0, rx: 0, bk: 0, cap: 1 },
    { cl: 1, my: 1, ry: 0, mx: 0, rx: 0, bk: 0, cap: 2 },
    { cl: 1, my: 1, ry: 1, mx: 0, rx: 0, bk: 0, cap: 3 },
    { cl: 1, my: 1, ry: 1, mx: 1, rx: 0, bk: 0, cap: 4 },
    { cl: 1, my: 1, ry: 1, mx: 1, rx: 1, bk: 0, cap: 5 },
    { cl: 1, my: 1, ry: 1, mx: 1, rx: 1, bk: 1, cap: 6 }
  ];
  var DUR = [0, 800, 900, 2200, 900, 2200, 2000];
  var FROM = opts.from || 0, TO = opts.to == null ? STAGES.length - 1 : opts.to;

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'Three groups of points: across groups Y rises with X1, within each group it falls. Partialling the group means out of Y and then out of X1 turns the positive pooled slope into the negative within-group slope of the multiple regression',
                        style: 'width: 100%; height: auto; max-height: 470px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  // ---- Axes: the original scale and the residual scale, crossfaded -----------------
  mk('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  mk('line', { x1: X0, x2: X0, y1: Y0, y2: Y1, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  function xTicks(at, lab, g) {
    at.forEach(function (v, j) {
      mk('line', { x1: px(v), x2: px(v), y1: Y0, y2: Y0 + 8, stroke: GREY, 'stroke-width': 2 }, g);
      mk('text', { x: px(v), y: Y0 + 32, 'text-anchor': 'middle', 'font-size': 20, fill: GREY }, g).textContent = lab[j];
    });
  }
  function yTicks(at, lab, g) {
    at.forEach(function (v, j) {
      mk('line', { x1: X0 - 8, x2: X0, y1: py(v), y2: py(v), stroke: GREY, 'stroke-width': 2 }, g);
      mk('text', { x: X0 - 14, y: py(v) + 7, 'text-anchor': 'end', 'font-size': 20, fill: GREY }, g).textContent = lab[j];
    });
  }
  function grid(lo, hi, c) {                       // even offsets from c inside [lo, hi]
    var at = [], lab = [];
    for (var v = Math.ceil((lo - c) / 2) * 2; c + v <= hi; v += 2) {
      at.push(c + v); lab.push(v === 0 ? '0' : (v < 0 ? '−' : '') + Math.abs(v));
    }
    return { at: at, lab: lab };
  }
  var gXo = mk('g', {}, svg), gXr = mk('g', {}, svg), gYo = mk('g', {}, svg), gYr = mk('g', {}, svg);
  var ox = grid(XL, XH, 0), oy = grid(YL, YH, 0), rxg = grid(XL, XH, XB), ryg = grid(YL, YH, YB);
  xTicks(ox.at, ox.lab, gXo); xTicks(rxg.at, rxg.lab, gXr);
  yTicks(oy.at, oy.lab, gYo); yTicks(ryg.at, ryg.lab, gYr);
  var axX = mk('text', { x: (X0 + X1) / 2, y: Y0 + 62, 'text-anchor': 'middle', 'font-size': 24, 'font-style': 'italic', fill: INK }, gXo);
  rich(axX, [[{}, 'X_1']]);
  rich(mk('text', { x: (X0 + X1) / 2, y: Y0 + 62, 'text-anchor': 'middle', 'font-size': 24, 'font-style': 'italic', fill: INK }, gXr), [[{}, '~X_1']]);
  mk('text', { x: X0 - 50, y: (Y0 + Y1) / 2 + 8, 'text-anchor': 'middle', 'font-size': 24, 'font-style': 'italic', fill: INK }, gYo).textContent = 'Y';
  rich(mk('text', { x: X0 - 50, y: (Y0 + Y1) / 2 + 8, 'text-anchor': 'middle', 'font-size': 24, 'font-style': 'italic', fill: INK }, gYr), [[{}, '~Y']]);

  // ---- The pooled fit, ghosted once the points start to move ----------------------
  var pool = ols(d.x, d.y);
  var ghost = mk('line', { x1: px(XL), x2: px(XH), y1: py(pool.a + pool.b * XL), y2: py(pool.a + pool.b * XH),
                           stroke: GREY, 'stroke-width': 2.5, 'stroke-dasharray': '8 7' }, svg);

  // ---- Fitted values from the regressions on X2: the group means ---------------------
  var gMy = mk('g', {}, svg), gMx = mk('g', {}, svg), mY = [], mX = [];
  for (k = 0; k < K; k++) {
    mY.push(mk('line', { stroke: GCOL[k], 'stroke-width': 3.5, 'stroke-dasharray': '10 6' }, gMy));
    mX.push(mk('line', { stroke: GCOL[k], 'stroke-width': 3.5, 'stroke-dasharray': '10 6' }, gMx));
  }

  // ---- Points, group labels, and the fitted lines ------------------------------------
  var gPt = mk('g', {}, svg), pts = d.x.map(function () { return mk('circle', { r: 6.5, 'fill-opacity': 0.7 }, gPt); });
  var gLab = mk('g', {}, svg);
  for (k = 0; k < K; k++) {
    rich(mk('text', { x: px(gxr[k][0]) - 6, y: py(gyr[k][1]) - 10, 'text-anchor': 'end', 'font-size': 22, 'font-weight': 600, fill: GCOL[k] }, gLab), [[{}, 'X_2 = ' + (k + 1)]]);
  }
  var fLine = mk('line', { stroke: INK, 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
  var gPar = mk('g', {}, svg), par = [];
  for (k = 0; k < K; k++) {
    var x1 = gxr[k][0] - 0.3, x2 = gxr[k][1] + 0.3;
    par.push(mk('line', { x1: px(x1), x2: px(x2), y1: py(gy[k] + d.b1 * (x1 - gx[k])), y2: py(gy[k] + d.b1 * (x2 - gx[k])),
                          stroke: GCOL[k], 'stroke-width': 4, 'stroke-linecap': 'round' }, gPar));
  }

  // ---- Right margin: what we just did, the live slope, and its history ---------------
  var CAPS = [['Regress Y on X_1'], ['Color by the', 'covariate X_2'], ['Regress Y on X_2:', 'the group means'],
              ['Keep the residuals', '~Y = Y − ^Y(X_2)'], ['Regress X_1 on X_2:', 'the group means'],
              ['Keep the residuals', '~X_1 = X_1 − ^X_1(X_2)'], ['Regress Y on X_1, X_2:', 'one slope, every group']];
  var caps = CAPS.map(function (lines) {
    var g = mk('g', {}, svg), t = mk('text', { x: PX0, y: 70, 'font-size': 25, 'font-weight': 600, fill: INK }, g);
    rich(t, lines.map(function (s, j) { return [{ x: PX0, dy: j ? 32 : 0 }, s]; }));
    return g;
  });
  var roSl = mk('text', { x: PX0, y: 190, 'font-size': 30, 'font-weight': 600, fill: INK }, svg);
  var HIST = [['Y on X_1', B_POOL], ['~Y on X_1', B_Y], ['~Y on ~X_1', B_XY]];
  var hist = HIST.map(function (h, j) {
    var g = mk('g', {}, svg), t = mk('text', { x: PX0, y: 260 + 38 * j, 'font-size': 24, fill: INK }, g);
    rich(t, [[{}, h[0] + ':'], [{ x: PX0 + 160, 'font-weight': 600 }, fmt(h[1])]]);
    return g;
  });
  var hist4 = mk('text', { x: PX0, y: 260 + 38 * 3, 'font-size': 24, fill: INK }, svg);
  rich(hist4, [[{}, 'Y on X_1, X_2:']]);
  mk('tspan', { x: PX0 + 160, 'font-weight': 600 }, hist4).textContent = fmt(d.b1);
  rich(mk('text', { x: PX0, y: 236, 'font-size': 20, fill: GREY }, svg), [[{}, 'Slope on X_1']]);

  function render(st) {
    placeAccents();
    var cl = clamp(st.cl), ry = ease(clamp(st.ry)), rx = ease(clamp(st.rx)), bk = ease(clamp(st.bk));
    // Partialling out, undone again on the way back
    var fy = ry * (1 - bk), fx = rx * (1 - bk);
    var cx = [], cy = [];
    d.x.forEach(function (x, i) {
      var g = d.g[i] - 1;
      cx.push(x - fx * (gx[g] - XB)); cy.push(d.y[i] - fy * (gy[g] - YB));
      pts[i].setAttribute('cx', px(cx[i]).toFixed(1)); pts[i].setAttribute('cy', py(cy[i]).toFixed(1));
      pts[i].setAttribute('fill', mixc(NEUT, GCOL[g], cl));
    });
    gLab.setAttribute('opacity', clamp(cl) * (1 - clamp(st.my)) + bk);

    // The live fit of Y on X1 to the points as drawn
    var f = ols(cx, cy);
    fLine.setAttribute('x1', px(XL)); fLine.setAttribute('y1', py(f.a + f.b * XL));
    fLine.setAttribute('x2', px(XH)); fLine.setAttribute('y2', py(f.a + f.b * XH));
    fLine.setAttribute('opacity', 1 - bk);
    ghost.setAttribute('opacity', clamp(st.my));
    gPar.setAttribute('opacity', bk);

    // Group means of Y: horizontal over each group's X1 range, then dropping
    // with the points onto the grand mean; they fade once they get there
    var my = clamp(st.my), mxT = clamp(st.mx);
    for (var k = 0; k < K; k++) {
      var yk = gy[k] - fy * (gy[k] - YB), xa = gxr[k][0] - fx * (gx[k] - XB), xb = gxr[k][1] - fx * (gx[k] - XB);
      mY[k].setAttribute('x1', px(xa)); mY[k].setAttribute('x2', px(xb));
      mY[k].setAttribute('y1', py(yk)); mY[k].setAttribute('y2', py(yk));
      var xk = gx[k] - fx * (gx[k] - XB), ya = gyr[k][0] - fy * (gy[k] - YB), yb = gyr[k][1] - fy * (gy[k] - YB);
      mX[k].setAttribute('x1', px(xk)); mX[k].setAttribute('x2', px(xk));
      mX[k].setAttribute('y1', py(ya)); mX[k].setAttribute('y2', py(yb));
    }
    gMy.setAttribute('opacity', my * (1 - clamp((st.ry - 0.6) * 2.5)));
    gMx.setAttribute('opacity', mxT * (1 - clamp((st.rx - 0.6) * 2.5)));

    // Axes relabel to the residual scale as each variable is partialled out
    gYo.setAttribute('opacity', 1 - fy); gYr.setAttribute('opacity', fy);
    gXo.setAttribute('opacity', 1 - fx); gXr.setAttribute('opacity', fx);

    // Margin text
    caps.forEach(function (c, j) { c.setAttribute('opacity', clamp(1 - 2 * Math.abs(st.cap - j))); });
    roSl.textContent = 'slope = ' + fmt(f.b);
    roSl.setAttribute('opacity', 1 - bk);
    hist[0].setAttribute('opacity', 1);
    hist[1].setAttribute('opacity', clamp((st.ry - 0.9) * 10));
    hist[2].setAttribute('opacity', clamp((st.rx - 0.9) * 10));
    hist4.setAttribute('opacity', bk);
  }

  // ---- Stepping (stage = opts.from + visible .fw-step fragments) ------------
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
    return FROM + (slide ? slide.querySelectorAll('.fragment.fw-step.visible').length : 0);
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
