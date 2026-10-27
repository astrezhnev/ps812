function (el, d) {
  // The coverage probability as an area under the N(0, 1) density, in the
  // visual language of the week 8 t-distribution animation. The density (ink)
  // and the bounds +/- c / SE(Ybar) (dashed) come first, with the area between
  // them shaded and its value written in the middle. Then the area is built
  // as a difference of CDFs: everything below the upper bound, minus the
  // tail below the lower bound (red); by symmetry the upper tail has the
  // same area; and finally the bounds slide out until the middle holds
  // 1 - alpha, landing on the critical values +/- z_{1 - alpha/2}. Every
  // number on the plot is computed live from the current bound. Data: d.k,
  // the illustrative starting value of c / SE(Ybar), and d.alpha. One stage
  // per .ig-step fragment; stepping backwards runs each transition in reverse.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 400;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GREY = '#9a9a9a';
  var X0 = 60, X1 = 940, Y0 = 330, Y1 = 50, L = 4, YMAX = 0.42;
  var C = 'c/SE(Ȳ)';

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
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
  var Z = nq(1 - d.alpha / 2);
  function area(a, b) {                            // closed path under the density from a to b
    var p = [px(a).toFixed(1) + ' ' + Y0];
    for (var x = a; x < b; x += 0.02) p.push(px(x).toFixed(1) + ' ' + py(npdf(x)).toFixed(1));
    p.push(px(b).toFixed(1) + ' ' + py(npdf(b)).toFixed(1), px(b).toFixed(1) + ' ' + Y0);
    return 'M' + p.join('L') + 'Z';
  }
  function f3(v) { return v.toFixed(3); }

  // Stages: the area we want; below the upper bound; minus below the lower;
  // symmetry; bounds at the critical values
  var STAGES = [
    { k: 0, up: 0, lo: 0, lr: 0, rt: 0, tl: 0 },
    { k: 0, up: 1, lo: 0, lr: 0, rt: 0, tl: 0 },
    { k: 0, up: 1, lo: 1, lr: 1, rt: 0, tl: 0 },
    { k: 0, up: 0, lo: 0, lr: 1, rt: 1, tl: 1 },
    { k: 1, up: 0, lo: 0, lr: 1, rt: 1, tl: 1 }
  ];
  var DUR = [0, 900, 900, 1000, 2000];
  var MID = ['', '', 'Φ(' + C + ') − Φ(−' + C + ')', '2Φ(' + C + ') − 1', '1 − α'];

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'The probability that the interval covers is the area under the standard normal density between the two bounds; it equals the CDF at the upper bound minus the CDF at the lower bound, and setting it to 95% puts the bounds at plus and minus 1.96',
                        style: 'width: 100%; height: auto; max-height: 420px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  // Shaded regions: lower tail, middle, upper tail
  var gLoB = mk('path', { fill: BLUE }, svg), gLoR = mk('path', { fill: RED }, svg), gMid = mk('path', { fill: BLUE, 'fill-opacity': 0.35 }, svg), gRt = mk('path', { fill: RED }, svg);
  mk('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  mk('path', { d: 'M' + (function () {
    var p = []; for (var x = -L; x <= L + 1e-9; x += 0.02) p.push(px(x).toFixed(1) + ' ' + py(npdf(x)).toFixed(1)); return p.join('L');
  })(), fill: 'none', stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, svg);

  // Bounds and their labels
  var bounds = [-1, 1].map(function (s) {
    var ln = mk('line', { y1: Y0, y2: Y1 - 10, stroke: BLUE, 'stroke-width': 2.5, 'stroke-dasharray': '10 7' }, svg);
    var sym = mk('text', { y: Y0 + 34, 'text-anchor': 'middle', 'font-size': 22, fill: INK }, svg);
    var num = mk('text', { y: Y0 + 34, 'text-anchor': 'middle', 'font-size': 22, fill: INK }, svg);
    sym.textContent = (s < 0 ? '−' : '') + C;
    return { s: s, ln: ln, sym: sym, num: num };
  });

  // Middle: formula and value
  var midF = mk('text', { x: px(0), y: py(0.15), 'text-anchor': 'middle', 'font-size': 19, fill: INK }, svg);
  var midV = mk('text', { x: px(0), y: py(0.15) + 38, 'text-anchor': 'middle', 'font-size': 32, fill: BLUE, 'font-weight': 600 }, svg);

  // Brackets: everything below the upper bound, and below the lower bound
  function bracket(col, yy) {
    var g = mk('g', {}, svg);
    var p = mk('path', { fill: 'none', stroke: col, 'stroke-width': 2.5 }, g);
    var t = mk('text', { y: yy - 12, 'text-anchor': 'start', 'font-size': 21, fill: col }, g);
    return { g: g, p: p, t: t, y: yy };
  }
  var brUp = bracket(BLUE, py(0.405) - 10), brLo = bracket(RED, py(0.24));
  function placeBracket(br, b, txt) {
    br.p.setAttribute('d', 'M' + px(-L) + ' ' + (br.y + 10) + 'V' + br.y + 'H' + px(b) + 'V' + (br.y + 10));
    br.t.setAttribute('x', px(-L) + 8);
    br.t.textContent = txt;
  }

  // Tail labels
  var tails = [-1, 1].map(function (s) {
    var g = mk('g', {}, svg);
    var a = mk('text', { 'text-anchor': s < 0 ? 'end' : 'start', 'font-size': 20, fill: RED }, g);
    var b = mk('text', { 'text-anchor': s < 0 ? 'end' : 'start', 'font-size': 20, fill: RED }, g);
    return { s: s, g: g, a: a, b: b };
  });

  function render(st, stage) {
    var k = lerp(d.k, Z, st.k), up = ncdf(k), lo = ncdf(-k);
    // Lower tail: blue while it is part of "below the upper bound", red once subtracted
    gLoB.setAttribute('d', area(-L, -k));
    gLoB.setAttribute('fill-opacity', 0.35 * st.up * (1 - st.lr));
    gLoR.setAttribute('d', area(-L, -k));
    gLoR.setAttribute('fill-opacity', 0.75 * st.lr);
    gMid.setAttribute('d', area(-k, k));
    gRt.setAttribute('d', area(k, L));
    gRt.setAttribute('fill-opacity', 0.75 * st.rt);

    bounds.forEach(function (b) {
      var x = px(b.s * k);
      b.ln.setAttribute('x1', x); b.ln.setAttribute('x2', x);
      b.sym.setAttribute('x', x); b.num.setAttribute('x', x);
      b.sym.setAttribute('opacity', 1 - st.k);
      b.num.setAttribute('opacity', st.k);
      b.num.textContent = (b.s < 0 ? '−' : '') + k.toFixed(2);
    });

    midF.textContent = MID[stage];
    midV.textContent = f3(up - lo);

    placeBracket(brUp, k, 'Φ(' + C + ') = ' + f3(up));
    brUp.g.setAttribute('opacity', st.up);
    placeBracket(brLo, -k, 'Φ(−' + C + ') = ' + f3(lo));
    brLo.g.setAttribute('opacity', st.lo);

    var fin = st.k > 0.5;
    tails.forEach(function (t) {
      var x = px(t.s * k) + t.s * 12;
      t.a.setAttribute('x', x); t.b.setAttribute('x', x);
      t.a.setAttribute('y', py(0.31)); t.b.setAttribute('y', py(0.31) + 26);
      t.a.textContent = fin ? 'α/2' : t.s < 0 ? 'Φ(−' + C + ')' : '1 − Φ(' + C + ')';
      t.b.textContent = '= ' + f3(lo);
      t.g.setAttribute('opacity', st.tl);
    });
  }

  // ---- Stepping (one stage per .ig-step fragment) ----------------------------
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
    return slide ? slide.querySelectorAll('.fragment.ig-step.visible').length : 0;
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
