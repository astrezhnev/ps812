function (el, d) {
  // The inverse CDF, in the visual language of the week 8 integral
  // animation. Left: the N(0, 1) density with the area below a bound z
  // shaded. Right: the CDF Phi(z), with the bound as a point on the curve.
  // First the CDF runs forwards, from z on the horizontal axis up to the
  // curve and across to the probability Phi(z) (blue); then it runs
  // backwards, from the probability 1 - alpha/2 on the vertical axis across
  // to the curve (gold) and down to the critical value z_{1 - alpha/2}, while
  // the bound slides there and the shaded area grows to 1 - alpha/2. Every
  // number is computed live from the current bound. Data: d.z, the
  // illustrative bounds for the forward steps, and d.alpha. One stage per
  // .qn-step fragment; stepping backwards runs each transition in reverse.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 400;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GOLD = '#d9a21b', GREY = '#9a9a9a';
  var Y0 = 330, Y1 = 60, L = 3.5, YMAX = 0.42;
  var LX0 = 30, LX1 = 450, RX0 = 570, RX1 = 970;   // density panel, CDF panel

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function pxL(v) { return LX0 + (v + L) / (2 * L) * (LX1 - LX0); }
  function pxR(v) { return RX0 + (v + L) / (2 * L) * (RX1 - RX0); }
  function pyD(v) { return Y0 - v / YMAX * (Y0 - Y1); }
  function pyC(p) { return Y0 - p * (Y0 - Y1); }
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
  var P = 1 - d.alpha / 2, Q = nq(P);
  function area(a, b) {                            // closed path under the density from a to b
    var p = [pxL(a).toFixed(1) + ' ' + Y0];
    for (var x = a; x < b; x += 0.02) p.push(pxL(x).toFixed(1) + ' ' + pyD(npdf(x)).toFixed(1));
    p.push(pxL(b).toFixed(1) + ' ' + pyD(npdf(b)).toFixed(1), pxL(b).toFixed(1) + ' ' + Y0);
    return 'M' + p.join('L') + 'Z';
  }
  function curve(f, px, py) {
    var p = [];
    for (var x = -L; x <= L + 1e-9; x += 0.02) p.push(px(x).toFixed(1) + ' ' + py(f(x)).toFixed(1));
    return 'M' + p.join('L');
  }
  function arrow(x, y, dir, col, parent) {          // small triangle pointing left or down
    var s = 9, pts = dir === 'left' ? [[x, y], [x + s * 1.6, y - s], [x + s * 1.6, y + s]]
                                    : [[x, y], [x - s, y - s * 1.6], [x + s, y - s * 1.6]];
    return mk('path', { d: 'M' + pts.map(function (q) { return q.join(' '); }).join('L') + 'Z', fill: col }, parent);
  }

  // Stages: forward at the first bound, forward at the second, the target
  // probability across to the curve, then down to the critical value
  var STAGES = [
    { x: d.z[0], fw: 1, h: 0, v: 0, tail: 0 },
    { x: d.z[1], fw: 1, h: 0, v: 0, tail: 0 },
    { x: d.z[1], fw: 0, h: 1, v: 0, tail: 0 },
    { x: Q,      fw: 0, h: 1, v: 1, tail: 1 }
  ];
  var DUR = [0, 1200, 1200, 1600];
  var CAP = ['Φ:  z  →  probability', 'Φ:  z  →  probability', 'Φ⁻¹:  probability  →  z', 'Φ⁻¹:  probability  →  z'];

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'The CDF maps a value z to the area below it under the normal density; the inverse CDF goes the other way, from the probability 0.975 back to the critical value 1.96',
                        style: 'width: 100%; height: auto; max-height: 420px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  // ---- Density panel --------------------------------------------------------
  mk('text', { x: LX0, y: 28, 'font-size': 22, fill: GREY }, svg).textContent = 'density';
  var shade = mk('path', { fill: BLUE, 'fill-opacity': 0.35 }, svg);
  var tail = mk('path', { fill: RED }, svg);
  mk('line', { x1: LX0, x2: LX1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  mk('path', { d: curve(npdf, pxL, pyD), fill: 'none', stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, svg);
  var bnd = mk('line', { y1: Y0, y2: Y1, stroke: BLUE, 'stroke-width': 2.5, 'stroke-dasharray': '10 7' }, svg);
  var bndLab = mk('text', { y: Y0 + 32, 'text-anchor': 'middle', 'font-size': 22, fill: BLUE }, svg);
  var areaLab = mk('text', { x: pxL(-0.85), y: pyD(0.05), 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 600, fill: BLUE }, svg);
  var tailLab = mk('text', { y: pyD(0.1), 'font-size': 22, fill: RED }, svg);

  // ---- CDF panel ------------------------------------------------------------
  var cap = mk('text', { x: (RX0 + RX1) / 2, y: 28, 'text-anchor': 'middle', 'font-size': 24, fill: INK }, svg);
  mk('line', { x1: RX0, x2: RX1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  mk('line', { x1: RX0, x2: RX0, y1: Y0, y2: pyC(1) - 10, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  [0, 0.5, 1].forEach(function (p) {
    mk('line', { x1: RX0 - 6, x2: RX0, y1: pyC(p), y2: pyC(p), stroke: INK, 'stroke-width': 2 }, svg);
    mk('text', { x: RX0 - 12, y: pyC(p) + 7, 'text-anchor': 'end', 'font-size': 20, fill: GREY }, svg).textContent = p === 0.5 ? '0.5' : String(p);
  });
  mk('line', { x1: RX0, x2: RX1, y1: pyC(1), y2: pyC(1), stroke: GREY, 'stroke-width': 1, 'stroke-dasharray': '3 5' }, svg);
  mk('path', { d: curve(ncdf, pxR, pyC), fill: 'none', stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, svg);

  // Forward: up from z to the curve, across to the probability (blue)
  var gF = mk('g', {}, svg);
  var fUp = mk('line', { stroke: BLUE, 'stroke-width': 2.5, 'stroke-dasharray': '6 5' }, gF);
  var fAc = mk('line', { stroke: BLUE, 'stroke-width': 2.5, 'stroke-dasharray': '6 5' }, gF);
  var fArr = mk('g', {}, gF);
  var fLab = mk('text', { 'text-anchor': 'end', 'font-size': 22, 'font-weight': 600, fill: BLUE }, gF);
  var fz = mk('text', { y: Y0 + 32, 'text-anchor': 'middle', 'font-size': 22, fill: BLUE }, gF);

  // Inverse: across from the probability to the curve, down to z (gold)
  var gI = mk('g', {}, svg);
  var iAc = mk('line', { x1: RX0, y1: pyC(P), y2: pyC(P), stroke: GOLD, 'stroke-width': 3.5 }, gI);
  var iDn = mk('line', { x1: pxR(Q), x2: pxR(Q), y1: pyC(P), stroke: GOLD, 'stroke-width': 3.5 }, gI);
  var iArr = arrow(pxR(Q), Y0, 'down', GOLD, gI);
  var iP = mk('text', { x: RX0 - 12, y: pyC(P) + 26, 'text-anchor': 'end', 'font-size': 22, 'font-weight': 600, fill: GOLD }, gI);
  iP.textContent = P.toFixed(3);
  var iZ = mk('text', { x: pxR(Q), y: Y0 + 32, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 600, fill: GOLD }, gI);
  iZ.textContent = Q.toFixed(2);

  var dot = mk('circle', { r: 7, fill: BLUE }, svg);

  function render(st, stage) {
    var x = st.x, p = ncdf(x);
    // Density
    shade.setAttribute('d', area(-L, x));
    tail.setAttribute('d', area(x, L));
    tail.setAttribute('fill-opacity', 0.75 * st.tail);
    bnd.setAttribute('x1', pxL(x)); bnd.setAttribute('x2', pxL(x));
    bndLab.setAttribute('x', pxL(x)); bndLab.textContent = x.toFixed(2);
    areaLab.textContent = p.toFixed(3);
    tailLab.setAttribute('x', pxL(x) + 14);
    tailLab.textContent = (1 - p).toFixed(3);
    tailLab.setAttribute('opacity', st.tail);
    // CDF
    cap.textContent = CAP[stage];
    var cx = pxR(x), cy = pyC(p);
    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
    fUp.setAttribute('x1', cx); fUp.setAttribute('x2', cx); fUp.setAttribute('y1', Y0); fUp.setAttribute('y2', cy);
    fAc.setAttribute('x1', cx); fAc.setAttribute('x2', RX0 + 14); fAc.setAttribute('y1', cy); fAc.setAttribute('y2', cy);
    fArr.innerHTML = ''; arrow(RX0, cy, 'left', BLUE, fArr);
    fLab.setAttribute('x', RX0 - 12); fLab.setAttribute('y', cy + 7);
    fLab.textContent = p.toFixed(3);
    fz.setAttribute('x', cx); fz.textContent = x.toFixed(2);
    gF.setAttribute('opacity', st.fw);
    iAc.setAttribute('x2', lerp(RX0, pxR(Q), st.h));
    iDn.setAttribute('y2', lerp(pyC(P), Y0 - 14, st.v));
    iArr.setAttribute('opacity', st.v > 0.9 ? 1 : 0);
    iP.setAttribute('opacity', Math.min(1, 3 * st.h));
    iZ.setAttribute('opacity', st.v);
    gI.setAttribute('opacity', st.h > 0 ? 1 : 0);
  }

  // ---- Stepping (one stage per .qn-step fragment) ----------------------------
  var cur = -1, raf = null;
  function mix(A, B, e) {
    var st = {}, w = ease(e);
    for (var k in A) st[k] = lerp(A[k], B[k], w);
    return st;
  }
  function goTo(s, animate) {
    s = Math.max(0, Math.min(STAGES.length - 1, s));
    if (raf) { cancelAnimationFrame(raf); raf = null; render(STAGES[cur], cur); }
    if (s === cur) return;
    var prev = cur;
    cur = s;
    if (!animate || prev < 0 || Math.abs(s - prev) !== 1) { render(STAGES[s], s); return; }
    var A = STAGES[prev], B = STAGES[s], dur = DUR[Math.max(s, prev)], t0 = null;
    raf = requestAnimationFrame(function frame(now) {
      if (t0 === null) t0 = now;
      var e = Math.min(1, (now - t0) / dur);
      render(mix(A, B, e), e < 0.5 ? prev : s);
      raf = e < 1 ? requestAnimationFrame(frame) : null;
    });
  }

  // Reveal wiring, as in the week 7 CLT animation
  var slide = el.closest('section');
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.qn-step.visible').length : 0;
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
  render(STAGES[0], 0);
  goTo(fragmentStage(), false);
}
