function (el, d, opts) {
  // Power, and the Type S and Type M errors of an underpowered test, in the
  // visual language of the week 8 hypothesis testing animation. One scene is
  // built up across several slides: each slide embeds this script with
  // opts.from (the stage it opens on, drawn without animation) and opts.to
  // (the stage its last fragment reaches).
  //   stage 0  the N(0, 1) distribution of T under H0
  //   1        the rejection region beyond +/- z_{1 - alpha/2}
  //   2        the null fades to the background and the distribution of T
  //            under the truth, N(delta, 1), grows out of it at delta = 0;
  //            its area in the rejection region (the power) is shaded
  //   3 ...    delta steps through d.deltas, the power growing with it and
  //            each value collected in a table
  //   then     delta drops back to d.low (low power)
  //   then     Type S: the significant estimates with the wrong sign (gold)
  //   then     Type M: the average significant |T| against the true delta
  // Data: d.alpha, d.deltas (the effect sizes in standard errors to step
  // through), d.low (the underpowered effect size). Every number on the plot
  // is computed live from the current delta. One stage per .pw-step
  // fragment; stepping backwards runs each transition in reverse.
  opts = opts || {};
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 470;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GOLD = '#d9a21b', GREY = '#9a9a9a';
  var X0 = 60, X1 = 940, Y0 = 380, Y1 = 180, LO = -4, HI = 7, YMAX = 0.42;

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
  function px(v) { return X0 + (v - LO) / (HI - LO) * (X1 - X0); }
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
  var Z = nq(1 - d.alpha / 2);
  // For T ~ N(m, 1): P(reject), P(reject with the wrong sign) for m > 0, and
  // E[|T| | reject] (the truncated normal means of the two tails)
  function power(m) { return ncdf(m - Z) + ncdf(-m - Z); }
  function wrong(m) { return ncdf(-m - Z); }
  function absMean(m) {
    return (m * ncdf(m - Z) + npdf(Z - m) + npdf(Z + m) - m * ncdf(-m - Z)) / power(m);
  }
  function curve(m, s) {                           // s * density of N(m, 1) across the axis
    var p = [];
    for (var x = LO; x <= HI + 1e-9; x += 0.02) p.push(px(x).toFixed(1) + ' ' + py(s * npdf(x - m)).toFixed(1));
    return 'M' + p.join('L');
  }
  function area(a, b, m, s) {                      // closed path under it from a to b
    var p = [px(a).toFixed(1) + ' ' + Y0];
    for (var x = a; x < b; x += 0.02) p.push(px(x).toFixed(1) + ' ' + py(s * npdf(x - m)).toFixed(1));
    p.push(px(b).toFixed(1) + ' ' + py(s * npdf(b - m)).toFixed(1), px(b).toFixed(1) + ' ' + Y0);
    return 'M' + p.join('L') + 'Z';
  }
  function fmt(v, k) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(k == null ? 2 : k); }
  function short(v) { return String(+v.toFixed(2)); }

  // ---- Stages ----------------------------------------------------------------
  // rj: rejection region; tr: truth on, null in the background; dl: delta;
  // tb: table columns shown; ts, tm: Type S and Type M
  var COLS = [0].concat(d.deltas, [d.low]);
  var NLOW = 2 + COLS.length - 1;                  // the stage delta drops to d.low
  var STAGES = [];
  for (var s = 0; s <= NLOW + 2; s++) {
    STAGES.push({ rj: s >= 1 ? 1 : 0, tr: s >= 2 ? 1 : 0, dl: s < 2 ? 0 : COLS[Math.min(s - 2, COLS.length - 1)],
                  tb: Math.max(0, Math.min(s - 1, COLS.length)), ts: s > NLOW ? 1 : 0, tm: s > NLOW + 1 ? 1 : 0 });
  }
  var DUR = STAGES.map(function (_, s) { return s === 0 ? 0 : s === NLOW ? 2600 : s === 2 ? 1500 : 1300; });
  d.deltas.forEach(function (_, j) { DUR[3 + j] = 1700; });
  var FROM = opts.from || 0, TO = opts.to == null ? STAGES.length - 1 : opts.to;

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'The distribution of the test statistic under the null with its rejection region; the distribution under the truth slides away from the null and its area in the rejection region, the power, grows; then at a small effect the significant estimates are often the wrong sign and always far too large',
                        style: 'width: 100%; height: auto; max-height: 470px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  // ---- Null distribution and its rejection region ---------------------------
  var nFillB = mk('path', { d: area(LO, HI, 0, 1), fill: BLUE }, svg);
  var nFillG = mk('path', { d: area(LO, HI, 0, 1), fill: GREY }, svg);
  var nTails = [mk('path', { d: area(LO, -Z, 0, 1), fill: RED }, svg), mk('path', { d: area(Z, HI, 0, 1), fill: RED }, svg)];

  // ---- Truth: its density, and its area in the rejection region --------------
  var tFill = mk('path', { fill: BLUE, 'fill-opacity': 0.12 }, svg);
  var tRejL = mk('path', { fill: BLUE }, svg), tRejS = mk('path', { fill: GOLD }, svg), tRejR = mk('path', { fill: BLUE }, svg);
  var nLine = mk('path', { d: curve(0, 1), fill: 'none', 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, svg);
  var tLine = mk('path', { fill: 'none', stroke: BLUE, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, svg);

  var nLab = mk('text', { x: px(-0.75), y: py(0.36), 'text-anchor': 'end', 'font-size': 21 }, svg);
  nLab.textContent = 'T under H₀: N(0, 1)';
  var tLab = mk('text', { y: py(0.36), 'text-anchor': 'start', 'font-size': 21, fill: BLUE }, svg);
  tLab.textContent = 'truth: N(δ, 1)';

  // Critical values, with the week 8 "reject" / "fail to reject" labels
  var gRj = mk('g', {}, svg), gRjLab = mk('g', {}, svg);
  [-1, 1].forEach(function (s) {
    mk('line', { x1: px(s * Z), x2: px(s * Z), y1: Y0, y2: py(0.24), stroke: RED, 'stroke-width': 2.5, 'stroke-dasharray': '10 7' }, gRj);
    mk('text', { x: px(s * Z), y: Y0 + 34, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 600, fill: RED }, gRj).textContent = fmt(s * Z);
    mk('text', { x: px(s * (Z + 1.25)), y: py(0.16), 'text-anchor': 'middle', 'font-size': 22, fill: RED }, gRjLab).textContent = 'reject H₀';
    mk('text', { x: px(s * (Z + 1.25)), y: py(0.16) + 26, 'text-anchor': 'middle', 'font-size': 19, fill: RED }, gRjLab).textContent = 'α/2 = ' + (d.alpha / 2).toFixed(3);
  });
  mk('text', { x: px(0), y: py(0.1), 'text-anchor': 'middle', 'font-size': 22, fill: INK }, gRjLab).textContent = 'fail to reject H₀';

  // ---- Axis -------------------------------------------------------------------
  mk('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  var ticks = [];
  for (var v = LO; v <= HI; v++) {
    var g = mk('g', {}, svg);
    mk('line', { x1: px(v), x2: px(v), y1: Y0, y2: Y0 + 8, stroke: GREY, 'stroke-width': 2 }, g);
    mk('text', { x: px(v), y: Y0 + 34, 'text-anchor': 'middle', 'font-size': 20, fill: GREY }, g).textContent = v < 0 ? '−' + (-v) : String(v);
    ticks.push({ v: v, g: g });
  }
  mk('text', { x: (X0 + X1) / 2, y: Y0 + 70, 'text-anchor': 'middle', 'font-size': 22, fill: INK }, svg).textContent =
    'T = (Ȳ − μ₀) / SE(Ȳ)   (standard errors from the null)';

  // ---- Readout (top right) and power table (top left) ------------------------
  var gRd = mk('g', {}, svg);
  var rdD = mk('text', { x: X1, y: 46, 'text-anchor': 'end', 'font-size': 22, fill: INK }, gRd);
  var rdP = mk('text', { x: X1, y: 84, 'text-anchor': 'end', 'font-size': 30, 'font-weight': 700, fill: BLUE }, gRd);
  mk('text', { x: X1, y: 112, 'text-anchor': 'end', 'font-size': 18, fill: GREY }, gRd).textContent = 'P(reject H₀) under the truth';
  var gTb = mk('g', {}, svg);
  mk('text', { x: X0, y: 46, 'font-size': 20, fill: INK }, gTb).textContent = 'δ';
  mk('text', { x: X0, y: 80, 'font-size': 20, fill: BLUE }, gTb).textContent = 'power';
  var cols = COLS.map(function (c, i) {
    var low = i === COLS.length - 1, x = 160 + i * 78 + (low ? 20 : 0), g = mk('g', {}, svg);
    if (low) mk('line', { x1: x - 49, x2: x - 49, y1: 24, y2: 90, stroke: GREY, 'stroke-width': 1.5 }, g);
    mk('text', { x: x, y: 46, 'text-anchor': 'middle', 'font-size': 20, fill: low ? RED : INK }, g).textContent = short(c);
    mk('text', { x: x, y: 80, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 600, fill: low ? RED : BLUE }, g).textContent = power(c).toFixed(3);
    return g;
  });

  // ---- Type S: significant, but the wrong sign -------------------------------
  var gTs = mk('g', {}, svg);
  mk('text', { x: px(-Z - 1.05), y: py(0.16) + 26, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 600, fill: GOLD }, gTs).textContent = 'wrong sign';
  var tsTxt = mk('text', { x: X0, y: 136, 'font-size': 21, 'font-weight': 600, fill: GOLD }, gTs);

  // ---- Type M: the average significant |T| against the truth -----------------
  var gTm = mk('g', {}, svg);
  var tmTrue = mk('line', { y1: Y0, y2: 150, stroke: BLUE, 'stroke-width': 2.5, 'stroke-dasharray': '8 6' }, gTm);
  var tmTrueL = mk('text', { y: 140, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 600, fill: BLUE }, gTm);
  var tmAvg = mk('line', { y1: Y0, y2: 150, stroke: RED, 'stroke-width': 2.5, 'stroke-dasharray': '8 6' }, gTm);
  var tmAvgL = mk('text', { y: 140, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 600, fill: RED }, gTm);
  var tmArrow = mk('path', { fill: 'none', stroke: RED, 'stroke-width': 2.5 }, gTm);
  var tmHead = mk('path', { fill: RED }, gTm);
  var tmTxt = mk('text', { x: X0, y: 166, 'font-size': 21, 'font-weight': 600, fill: RED }, gTm);

  function render(st) {
    var m = st.dl, gr = ease(clamp(st.tr)), bg = st.tr;
    // Null: blue and ink in the foreground, grey in the background
    nFillB.setAttribute('fill-opacity', 0.12 * (1 - bg));
    nFillG.setAttribute('fill-opacity', 0.08 * bg);
    nTails.forEach(function (t) { t.setAttribute('fill-opacity', st.rj * lerp(0.75, 0.3, bg)); });
    nLine.setAttribute('stroke', mixc(INK, GREY, bg));
    nLab.setAttribute('fill', mixc(INK, GREY, bg));
    gRj.setAttribute('opacity', st.rj);
    gRjLab.setAttribute('opacity', st.rj * (1 - clamp(2 * bg)));
    ticks.forEach(function (tk) {
      tk.g.setAttribute('opacity', Math.abs(Math.abs(tk.v) - Z) < 0.5 ? 1 - st.rj : 1);
    });
    // Truth grows up out of the null at delta = 0, then slides
    tFill.setAttribute('d', area(LO, HI, m, gr));
    tLine.setAttribute('d', curve(m, gr));
    tLine.setAttribute('opacity', st.tr > 0 ? 1 : 0);
    tRejR.setAttribute('d', area(Z, HI, m, gr));
    tRejL.setAttribute('d', area(LO, -Z, m, gr));
    tRejS.setAttribute('d', area(LO, -Z, m, gr));
    tRejR.setAttribute('fill-opacity', 0.6 * st.tr);
    tRejL.setAttribute('fill-opacity', 0.6 * st.tr * (1 - st.ts));
    tRejS.setAttribute('fill-opacity', 0.85 * st.ts);
    tLab.setAttribute('x', px(m + 0.8));
    tLab.setAttribute('opacity', clamp(2 * st.tr - 1) * (1 - st.tm));
    // Readout and table
    rdD.textContent = 'δ = (μ − μ₀) / SE(Ȳ) = ' + fmt(m);
    rdP.textContent = 'power = ' + power(m).toFixed(3);
    gRd.setAttribute('opacity', clamp(2 * st.tr - 1));
    gTb.setAttribute('opacity', clamp(st.tb));
    cols.forEach(function (c, i) { c.setAttribute('opacity', clamp(st.tb - i)); });
    // Type S
    gTs.setAttribute('opacity', st.ts);
    tsTxt.textContent = 'P(wrong sign | reject) = ' + (wrong(m) / power(m)).toFixed(2);
    // Type M
    var M = absMean(m), a = px(m), b = px(M);
    tmTrue.setAttribute('x1', a); tmTrue.setAttribute('x2', a);
    tmTrueL.setAttribute('x', a); tmTrueL.textContent = 'δ = ' + short(m);
    tmAvg.setAttribute('x1', b); tmAvg.setAttribute('x2', b);
    tmAvgL.setAttribute('x', b); tmAvgL.textContent = 'E[ |T| | reject ] = ' + M.toFixed(2);
    tmArrow.setAttribute('d', 'M' + (a + 4) + ' 160H' + (b - 14));
    tmHead.setAttribute('d', 'M' + b + ' 160L' + (b - 16) + ' 151L' + (b - 16) + ' 169Z');
    tmTxt.textContent = 'exaggeration: ' + (M / m).toFixed(1) + '× too big';
    gTm.setAttribute('opacity', st.tm);
  }

  // ---- Stepping (stage = opts.from + visible .pw-step fragments) ------------
  var cur = -1, raf = null;
  function mix(A, B, e) {
    var st = {}, w = ease(e);
    for (var k in A) st[k] = lerp(A[k], B[k], w);
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
    return FROM + (slide ? slide.querySelectorAll('.fragment.pw-step.visible').length : 0);
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
