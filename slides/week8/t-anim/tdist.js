function (el, d) {
  // The t distribution converging to the standard normal, in the visual
  // language of the week 7 CLT animation. The N(0, 1) density (ink) and its
  // critical values +/- 1.96 (grey) are drawn first; then the t density with
  // n - 1 degrees of freedom (blue) appears at a small n, its 2.5% tails
  // shaded and its critical values dashed, and each step raises n so the
  // curve and the critical values close in on the normal ones. The critical
  // value is also written into the .tcrit span on the slide (the interval
  // formula under the plot). Densities and quantiles are computed here for
  // any (fractional) df, so in-between frames are exact. Data: d.n, the
  // sample sizes to step through. One stage per .td-step fragment; stepping
  // backwards runs each transition in reverse.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 400;
  var BLUE = '#0479a8', INK = '#333333', GREY = '#9a9a9a';
  var X0 = 60, X1 = 940, Y0 = 340, Y1 = 60, L = 5, YMAX = 0.43;
  var Z = 1.959964, NN = d.n.length;

  // Stages: the normal alone, then each n
  var STAGES = [{ k: 0, t: 0 }];
  for (var i = 0; i < NN; i++) STAGES.push({ k: i, t: 1 });
  var DUR = [0, 1100].concat(d.n.slice(1).map(function () { return 1300; }));

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
  function lgamma(x) {                             // Lanczos approximation
    var c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
             -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1;
    var a = c[0], t = x + 7.5;
    for (var j = 1; j < 9; j++) a += c[j] / (x + j);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function tpdf(x, v) {
    return Math.exp(lgamma((v + 1) / 2) - lgamma(v / 2) - 0.5 * Math.log(v * Math.PI) - (v + 1) / 2 * Math.log(1 + x * x / v));
  }
  function npdf(x) { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); }
  function tcrit(v) {                              // 97.5% quantile: integrate from 0 to 0.475
    var h = 0.002, cum = 0, prev = tpdf(0, v);
    for (var x = h; x < 20; x += h) {
      var f = tpdf(x, v), add = (prev + f) / 2 * h;
      if (cum + add >= 0.475) return x - h + (0.475 - cum) / add * h;
      cum += add; prev = f;
    }
    return 20;
  }
  function curve(f, a, b) {
    var p = [];
    for (var x = a; x <= b + 1e-9; x += 0.02) p.push(px(x).toFixed(1) + ' ' + py(f(x)).toFixed(1));
    return p;
  }

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'As the sample size grows, the t density approaches the standard normal and its 97.5% critical value falls toward 1.96',
                        style: 'width: 100%; height: auto; max-height: 420px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  var counter = mk('text', { x: (X0 + X1) / 2, y: 36, 'text-anchor': 'middle', 'font-size': 34, fill: INK }, svg);
  // Legend
  mk('line', { x1: X0, x2: X0 + 34, y1: 26, y2: 26, stroke: INK, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, svg);
  mk('text', { x: X0 + 44, y: 33, 'font-size': 21, fill: INK }, svg).textContent = 'N(0, 1)';
  var legT = mk('g', {}, svg);
  mk('line', { x1: X1 - 34, x2: X1, y1: 26, y2: 26, stroke: BLUE, 'stroke-width': 4.5, 'stroke-linecap': 'round' }, legT);
  var legTxt = mk('text', { x: X1 - 44, y: 33, 'text-anchor': 'end', 'font-size': 21, fill: INK }, legT);

  var tails = mk('path', { fill: BLUE, 'fill-opacity': 0.35 }, svg);
  mk('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  // The normal and its critical values
  mk('path', { d: 'M' + curve(npdf, -L, L).join('L'), fill: 'none', stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, svg);
  [-Z, Z].forEach(function (c) {
    mk('line', { x1: px(c), x2: px(c), y1: Y0, y2: Y1, stroke: GREY, 'stroke-width': 2, 'stroke-dasharray': '4 6' }, svg);
    mk('text', { x: px(c), y: Y0 + 32, 'text-anchor': 'middle', 'font-size': 21, fill: GREY }, svg).textContent =
      (c < 0 ? '−' : '') + '1.96';
  });
  // The t density and its critical values
  var tcurve = mk('path', { fill: 'none', stroke: BLUE, 'stroke-width': 4.5, 'stroke-linejoin': 'round' }, svg);
  var tlines = [-1, 1].map(function () {
    return mk('line', { y1: Y0, y2: Y1, stroke: BLUE, 'stroke-width': 2.5, 'stroke-dasharray': '10 7' }, svg);
  });

  // The formula comes after this script in the page, so find it when drawing
  var slide = el.closest('section');
  function critSpan() { return slide ? slide.querySelector('.tcrit') : null; }

  function render(k, t) {
    var a = Math.floor(k), b = Math.min(a + 1, NN - 1), f = k - a;
    var n = Math.exp(lerp(Math.log(d.n[a]), Math.log(d.n[b]), f)), v = n - 1;
    var c = tcrit(v), dens = function (x) { return tpdf(x, v); };
    tcurve.setAttribute('d', 'M' + curve(dens, -L, L).join('L'));
    var cc = Math.min(c, L);
    tails.setAttribute('d', 'M' + px(-L) + ' ' + Y0 + 'L' + curve(dens, -L, -cc).join('L') + 'L' + px(-cc) + ' ' + Y0 + 'Z' +
                            'M' + px(cc) + ' ' + Y0 + 'L' + curve(dens, cc, L).join('L') + 'L' + px(L) + ' ' + Y0 + 'Z');
    tlines.forEach(function (ln, j) {
      var x = px(j ? cc : -cc);
      ln.setAttribute('x1', x); ln.setAttribute('x2', x);
    });
    [tcurve, tails, legT, counter].concat(tlines).forEach(function (e) { e.setAttribute('opacity', t); });
    counter.textContent = 'n = ' + Math.round(n);
    legTxt.textContent = 't with ' + Math.round(v) + ' df';
    var crit = critSpan();
    if (crit) crit.textContent = (t > 0 ? c : Z).toFixed(3);
  }

  // ---- Stepping (one stage per .td-step fragment) ----------------------------
  var cur = -1, raf = null;
  function show(s) { render(STAGES[s].k, STAGES[s].t); }
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
      render(lerp(A.k, B.k, w), lerp(A.t, B.t, w));
      raf = e < 1 ? requestAnimationFrame(frame) : null;
    });
  }

  // Reveal wiring, as in the week 7 CLT animation
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.td-step.visible').length : 0;
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
