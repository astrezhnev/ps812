function (el, d, opts) {
  // The sampling distribution of a regression line. Repeated samples from one
  // heteroskedastic population (the error SD grows with X), each with its own
  // OLS line.
  //   stage 0  one sample and its fitted line
  //   1        a new sample: the points move, the line refits, the old line
  //            stays behind as a faint ghost
  //   2        six more samples in quick succession
  //   3        the rest of the samples: their lines fill in, the points fade
  //   4        the true line E[Y | X] on top
  //   5        a histogram of the slopes in the right margin, with its SE
  //   6        the intercepts: where each line crosses X = 0, and their histogram
  //   7        the middle 95% of the fitted lines at each X: narrowest at the
  //            mean of X, widening away from it
  // Data: d.px, d.py (the points of the first few samples, one array per
  // sample), d.b0, d.b1 (the fitted intercept and slope of every sample),
  // d.t0, d.t1 (the true line), d.xlim, d.ylim. One stage per .sd-step
  // fragment; stepping backwards runs each transition in reverse.
  opts = opts || {};
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 470;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GOLD = '#b8860b', GREY = '#9a9a9a';
  var X0 = 80, X1 = 640, Y0 = 400, Y1 = 40;
  var PX0 = 720, PX1 = 980;                        // the right margin panel
  var XL = d.xlim[0], XH = d.xlim[1], YL = d.ylim[0], YH = d.ylim[1];
  var S = d.b0.length, K = d.px.length;            // all samples; samples with points

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
  function mean(a) { var s = 0; a.forEach(function (v) { s += v; }); return s / a.length; }
  function sd(a) { var m = mean(a), s = 0; a.forEach(function (v) { s += (v - m) * (v - m); }); return Math.sqrt(s / (a.length - 1)); }
  function quant(a, p) { var b = a.slice().sort(function (u, v) { return u - v; }); var h = (b.length - 1) * p, l = Math.floor(h); return b[l] + (b[Math.min(l + 1, b.length - 1)] - b[l]) * (h - l); }

  // Math-ish labels, as in fwl.js: '^' before a letter puts a hat on it and
  // '_' before a character sets it as a subscript. Hats are drawn as paths
  // over the measured letter once the slide is laid out
  var ACC = [];
  function rich(t, parts) {
    var fs = parseFloat(t.getAttribute('font-size')), SH = 0.22 * fs, idx = 0, pend = 0;
    parts.forEach(function (p) {
      var a = {};
      for (var k in p[0]) a[k] = p[0][k];
      if (pend) { a.dy = (a.dy || 0) + pend; pend = 0; }
      var ts = mk('tspan', a, t), str = p[1], seg = '';
      function out(text, attrs) {
        if (!text) return;
        attrs = attrs || {};
        if (pend) { attrs.dy = (attrs.dy || 0) + pend; pend = 0; }
        mk('tspan', attrs, ts).textContent = text;
      }
      for (var j = 0; j < str.length; j++) {
        var c = str[j];
        if (c === '^' && j + 1 < str.length) { ACC.push({ t: t, i: idx }); continue; }
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
      var cx = r.x + r.width / 2 + 0.05 * fs;
      var y = b.y - 0.86 * fs, w = 0.42 * fs, x0 = cx - w / 2, x1 = cx + w / 2;
      var dd = 'M' + (x0 + 0.1 * w) + ' ' + (y + 1.5 * h) + 'L' + cx + ' ' + (y - 1.5 * h) + 'L' + (x1 - 0.1 * w) + ' ' + (y + 1.5 * h);
      mk('path', { d: dd, fill: 'none', stroke: a.t.getAttribute('fill'), 'stroke-width': 0.075 * fs,
                   'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, a.t.parentNode);
      a.done = true;
    });
  }

  var STAGES = [
    { k: 0, m: 0, tr: 0, hs: 0, hi: 0, bd: 0 },
    { k: 1, m: 0, tr: 0, hs: 0, hi: 0, bd: 0 },
    { k: K - 1, m: 0, tr: 0, hs: 0, hi: 0, bd: 0 },
    { k: K - 1, m: 1, tr: 0, hs: 0, hi: 0, bd: 0 },
    { k: K - 1, m: 1, tr: 1, hs: 0, hi: 0, bd: 0 },
    { k: K - 1, m: 1, tr: 1, hs: 1, hi: 0, bd: 0 },
    { k: K - 1, m: 1, tr: 1, hs: 1, hi: 1, bd: 0 },
    { k: K - 1, m: 1, tr: 1, hs: 1, hi: 1, bd: 1 }
  ];
  var DUR = [0, 1200, 700 * (K - 2), 2500, 900, 1000, 1000, 1200];
  var FROM = opts.from || 0, TO = opts.to == null ? STAGES.length - 1 : opts.to;

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'Repeated samples from one population, each with its own fitted regression line. The lines pile up around the true line; histograms of their slopes and intercepts show the sampling distributions, and the band of fitted lines is narrowest at the mean of X',
                        style: 'width: 100%; height: auto; max-height: 470px; display: block; margin: 0 auto; font-family: inherit;' }, el);
  var clipId = 'sdclip' + Math.random().toString(36).slice(2, 8);
  mk('rect', { x: X0, y: Y1, width: X1 - X0, height: Y0 - Y1 }, mk('clipPath', { id: clipId }, mk('defs', {}, svg)));

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

  var plot = mk('g', { 'clip-path': 'url(#' + clipId + ')' }, svg);

  // ---- The band of fitted values (under the lines) ----------------------------------
  var NG = 60, gx = [], lo = [], hi = [];
  for (var g = 0; g <= NG; g++) {
    var xg = lerp(XL, XH, g / NG), fv = [];
    for (var s = 0; s < S; s++) fv.push(d.b0[s] + d.b1[s] * xg);
    gx.push(xg); lo.push(quant(fv, 0.025)); hi.push(quant(fv, 0.975));
  }
  var bandPts = gx.map(function (x, i) { return px(x) + ',' + py(hi[i]); })
    .concat(gx.slice().reverse().map(function (x, i) { return px(x) + ',' + py(lo[NG - i]); }));
  var gBd = mk('g', {}, plot);
  mk('polygon', { points: bandPts.join(' '), fill: GOLD, 'fill-opacity': 0.25 }, gBd);
  ['hi', 'lo'].forEach(function (w) {
    var arr = w === 'hi' ? hi : lo;
    mk('polyline', { points: gx.map(function (x, i) { return px(x) + ',' + py(arr[i]); }).join(' '),
                     fill: 'none', stroke: GOLD, 'stroke-width': 3 }, gBd);
  });

  // ---- Ghost lines, one per sample ---------------------------------------------------
  var gGh = mk('g', {}, plot), ghosts = [];
  for (s = 0; s < S; s++)
    ghosts.push(mk('line', { x1: px(XL), x2: px(XH), y1: py(d.b0[s] + d.b1[s] * XL), y2: py(d.b0[s] + d.b1[s] * XH),
                             stroke: BLUE, 'stroke-width': 2 }, gGh));

  // ---- Intercepts on the Y axis ------------------------------------------------------
  var gIc = mk('g', {}, svg);
  for (s = 0; s < S; s++)
    mk('circle', { cx: X0, cy: py(d.b0[s]), r: 5, fill: RED, 'fill-opacity': 0.12 }, gIc);

  // ---- The current sample: its points and its line -----------------------------------
  var cLine = mk('line', { stroke: INK, 'stroke-width': 4, 'stroke-linecap': 'round' }, plot);
  var gPt = mk('g', {}, svg), pts = d.px[0].map(function () {
    return mk('circle', { r: 6.5, fill: BLUE, 'fill-opacity': 0.75 }, gPt);
  });

  // ---- The true line -----------------------------------------------------------------
  var gTr = mk('g', {}, svg);
  mk('line', { x1: px(XL), x2: px(XH), y1: py(d.t0 + d.t1 * XL), y2: py(d.t0 + d.t1 * XH),
               stroke: RED, 'stroke-width': 4, 'stroke-linecap': 'round' }, gTr);
  // (below the band at the right edge, with a halo over the faint lines)
  mk('text', { x: X1 - 4, y: py(lo[NG]) + 38, 'text-anchor': 'end', 'font-size': 24, 'font-weight': 600, fill: RED,
               stroke: '#f7f7f7', 'stroke-width': 7, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, gTr)
    .textContent = 'E[Y | X]';

  // ---- Right margin: the sample counter ------------------------------------------------
  var cnt = mk('text', { x: PX0, y: 52, 'font-size': 26, 'font-weight': 600, fill: INK }, svg);

  // ---- Right margin: histograms of the slopes and the intercepts ------------------------
  function hist(vals, truth, base, top, label, col) {
    var g = mk('g', {}, svg), m = mean(vals), sdv = sd(vals);
    var lo = m - 3.5 * sdv, hiV = m + 3.5 * sdv, NB = 21, bw = (hiV - lo) / NB, cnts = [];
    for (var b = 0; b < NB; b++) cnts.push(0);
    vals.forEach(function (v) { var b = Math.floor((v - lo) / bw); if (b >= 0 && b < NB) cnts[b]++; });
    var mx = Math.max.apply(null, cnts), hx = function (v) { return PX0 + (v - lo) / (hiV - lo) * (PX1 - PX0); };
    var bars = cnts.map(function (c, b) {
      return mk('rect', { x: hx(lo + b * bw) + 1, width: (PX1 - PX0) / NB - 2, y: base, height: 0,
                          fill: col, 'fill-opacity': 0.45, stroke: col, 'stroke-width': 1, 'data-h': (base - top - 22) * c / mx }, g);
    });
    mk('line', { x1: PX0, x2: PX1, y1: base, y2: base, stroke: GREY, 'stroke-width': 2 }, g);
    mk('line', { x1: hx(truth), x2: hx(truth), y1: base, y2: base + 12, stroke: RED, 'stroke-width': 4 }, g);
    var t = mk('text', { x: PX0, y: top, 'font-size': 24, fill: INK }, g);
    rich(t, [[{ 'font-style': 'italic', 'font-weight': 600 }, label], [{ dx: 14 }, 'SE = ' + sdv.toFixed(2)]]);
    return { g: g, bars: bars, base: base };
  }
  var hS = hist(d.b1, d.t1, 200, 72, '^β_1', BLUE);
  var hI = hist(d.b0, d.t0, 412, 284, '^β_0', RED);

  function render(st) {
    // The current sample, moving between samples floor(k) and floor(k) + 1
    var j = Math.min(Math.floor(st.k), K - 1), f = ease(st.k - j), j2 = Math.min(j + 1, K - 1);
    var a = lerp(d.b0[j], d.b0[j2], f), b = lerp(d.b1[j], d.b1[j2], f);
    pts.forEach(function (c, i) {
      c.setAttribute('cx', px(lerp(d.px[j][i], d.px[j2][i], f)));
      c.setAttribute('cy', py(lerp(d.py[j][i], d.py[j2][i], f)));
    });
    gPt.setAttribute('opacity', 1 - st.m);
    cLine.setAttribute('x1', px(XL)); cLine.setAttribute('y1', py(a + b * XL));
    cLine.setAttribute('x2', px(XH)); cLine.setAttribute('y2', py(a + b * XH));
    cLine.setAttribute('opacity', 1 - st.m);

    // Ghosts: the samples already drawn, then the rest filling in
    var ga = lerp(0.35, 0.07, clamp(st.m * 1.5)), nFill = st.m * (S - K);
    ghosts.forEach(function (gl, s) {
      var vis = s < K ? Math.max(clamp(st.k - s), s === K - 1 ? clamp(st.m * 4) : 0) : clamp(nFill - (s - K));
      gl.setAttribute('stroke-opacity', vis * ga);
    });
    cnt.textContent = st.m > 0 ? 'Samples: ' + Math.min(S, K + Math.round(nFill)) : 'Sample ' + (Math.round(st.k) + 1);
    cnt.setAttribute('opacity', 1 - clamp(st.hs * 2));

    gTr.setAttribute('opacity', st.tr);
    [[hS, st.hs], [hI, st.hi]].forEach(function (p) {
      p[0].g.setAttribute('opacity', clamp(p[1] * 3));
      var e = ease(clamp(p[1]));
      p[0].bars.forEach(function (r) {
        var h = +r.getAttribute('data-h') * e;
        r.setAttribute('y', p[0].base - h); r.setAttribute('height', h);
      });
    });
    gIc.setAttribute('opacity', st.hi);
    gBd.setAttribute('opacity', st.bd);
    placeAccents();
  }

  // ---- Stepping (stage = opts.from + visible .sd-step fragments) ------------
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

  var slide = el.closest('section');
  function fragmentStage() {
    return FROM + (slide ? slide.querySelectorAll('.fragment.sd-step.visible').length : 0);
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
