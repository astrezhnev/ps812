function (el, d) {
  // The CLT for Bernoulli(p) draws, in two panels that move together: on the
  // left the MGF of sqrt(n) (Ybar_n - p) = (S_n - n p) / sqrt(n), on the right its PMF drawn as
  // a histogram on the density scale. The first step draws in the limits
  // (e^(sigma^2 t^2/2) and the N(0, sigma^2) density); each step after that
  // raises n, and both blue curves morph toward the red ones while a counter
  // ticks n up. Data from binom.json (built by make_binom.R). One stage per
  // .bn-step fragment; stepping backwards runs each transition in reverse.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 500;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GREY = '#9a9a9a';
  var Y0 = 420, Y1 = 95;                           // panel baseline and top
  var L = { x0: 50, x1: 465, lim: [-d.tlim, d.tlim], ymax: d.mgf_ymax };   // MGF panel
  var R = { x0: 535, x1: 950, lim: [-d.slim, d.slim], ymax: d.pdf_ymax };  // PMF panel
  var NN = d.n.length;

  // Stages: n = 1 alone, the limits drawn in, then each larger n
  var STAGES = [{ k: 0, lim: 0 }];
  for (var i = 0; i < NN; i++) STAGES.push({ k: i, lim: 1 });
  var DUR = [0, 1500].concat(d.n.slice(1).map(function () { return 1300; }));

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function px(P, v) { return P.x0 + (v - P.lim[0]) / (P.lim[1] - P.lim[0]) * (P.x1 - P.x0); }
  function py(P, v) { return Y0 - v / P.ymax * (Y0 - Y1); }
  function path(P, xs, ys) {
    return 'M' + xs.map(function (x, j) { return px(P, x).toFixed(1) + ' ' + py(P, ys[j]).toFixed(1); }).join('L');
  }
  function text(str, attrs, parent) {
    var e = mk('text', attrs, parent);
    e.textContent = str;
    return e;
  }
  // Text from [string, italic?, subscript] parts
  function rich(parts, attrs, parent) {
    var e = mk('text', attrs, parent);
    parts.forEach(function (s) {
      mk('tspan', s[1] ? { 'font-style': 'italic' } : {}, e).textContent = s[0];
      if (s[2]) mk('tspan', { 'baseline-shift': 'sub', 'font-size': '0.7em', 'font-style': 'italic' }, e).textContent = s[2];
    });
    return e;
  }
  // Tick values at a round step, two to four of them each side of zero
  function ticks(lim) {
    var step = [0.25, 0.5, 1, 2, 5, 10].filter(function (v) { return lim / v <= 4; })[0], out = [];
    for (var v = -Math.floor(lim / step) * step; v <= lim + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'As n grows, the moment generating function of the scaled error of a sample mean of Bernoulli draws approaches the normal MGF, and its probability mass function approaches the normal density',
                        style: 'width: 100%; height: auto; max-height: 540px; display: block; margin: 0 auto; font-family: inherit;' }, el);
  var defs = mk('defs', {}, svg);
  [['bn-clipL', L], ['bn-clipR', R]].forEach(function (c) {
    var cp = mk('clipPath', { id: c[0] }, defs);
    mk('rect', { x: c[1].x0 - 5, y: Y1 - 5, width: c[1].x1 - c[1].x0 + 10, height: Y0 - Y1 + 5 }, cp);
  });

  // Counter and legend
  var counter = text('', { x: W / 2, y: 44, 'text-anchor': 'middle', 'font-size': 36, fill: INK }, svg);
  mk('line', { x1: 50, x2: 84, y1: 33, y2: 33, stroke: BLUE, 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
  rich([['\u221An('], ['\u0232', true, 'n'], [' \u2212 '], ['p', true], ['), '], ['p', true], [' = ' + d.p]],
       { x: 94, y: 40, 'font-size': 21, fill: INK }, svg);
  var legLim = mk('g', {}, svg);
  mk('line', { x1: 916, x2: 950, y1: 33, y2: 33, stroke: RED, 'stroke-width': 4, 'stroke-linecap': 'round' }, legLim);
  text('N(0, ' + d.sigma2 + ')', { x: 904, y: 40, 'text-anchor': 'end', 'font-size': 21, fill: INK }, legLim);

  // Panels: zero line, baseline, a few ticks, a caption underneath
  function axes(P, ticks, caption) {
    mk('line', { x1: px(P, 0), x2: px(P, 0), y1: Y0, y2: Y1, stroke: GREY, 'stroke-width': 1.5, 'stroke-dasharray': '6 6' }, svg);
    mk('line', { x1: P.x0, x2: P.x1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
    ticks.forEach(function (v) {
      mk('line', { x1: px(P, v), x2: px(P, v), y1: Y0, y2: Y0 + 7, stroke: INK, 'stroke-width': 2 }, svg);
      text(v < 0 ? '−' + -v : String(v), { x: px(P, v), y: Y0 + 30, 'text-anchor': 'middle', 'font-size': 19, fill: GREY }, svg);
    });
    rich(caption, { x: (P.x0 + P.x1) / 2, y: Y0 + 70, 'text-anchor': 'middle', 'font-size': 23, fill: INK }, svg);
  }
  // Captions name the plotted quantity, sqrt(n) (Ybar_n - p)
  var scaled = [['\u221An('], ['\u0232', true, 'n'], [' \u2212 '], ['p', true], [')']];
  axes(L, ticks(d.tlim), [['MGF of ']].concat(scaled, [[' at '], ['t', true]]));
  axes(R, ticks(d.slim), [['PMF of ']].concat(scaled, [[', as a histogram']]));
  // Every MGF passes through (0, 1)
  mk('line', { x1: L.x0, x2: L.x1, y1: py(L, 1), y2: py(L, 1), stroke: GREY, 'stroke-width': 1, 'stroke-dasharray': '2 5' }, svg);
  text('1', { x: L.x0 - 12, y: py(L, 1) + 6, 'text-anchor': 'end', 'font-size': 19, fill: GREY }, svg);

  // The binomial (blue) under the limits (red, drawn in on the first step)
  var gL = mk('g', { 'clip-path': 'url(#bn-clipL)' }, svg), gR = mk('g', { 'clip-path': 'url(#bn-clipR)' }, svg);
  var mgf = mk('path', { fill: 'none', stroke: BLUE, 'stroke-width': 4.5, 'stroke-linejoin': 'round' }, gL);
  var hist = mk('path', { fill: BLUE, 'fill-opacity': 0.25, stroke: BLUE, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, gR);
  var limL = mk('path', { d: path(L, d.t, d.mgf_lim), fill: 'none', stroke: RED, 'stroke-width': 3.5, pathLength: 1,
                          'stroke-dasharray': '1 1' }, gL);
  var limR = mk('path', { d: path(R, d.s, d.pdf_lim), fill: 'none', stroke: RED, 'stroke-width': 3.5, pathLength: 1,
                          'stroke-dasharray': '1 1' }, gR);
  mk('circle', { cx: px(L, 0), cy: py(L, 1), r: 6, fill: INK }, svg);

  // Draw state: k is a (fractional) index into d.n, lim how far the limits are drawn
  function render(k, lim) {
    var a = Math.floor(k), b = Math.min(a + 1, NN - 1), f = k - a;
    function mix(arr) { return arr[a].map(function (v, j) { return lerp(v, arr[b][j], f); }); }
    mgf.setAttribute('d', path(L, d.t, mix(d.mgf)));
    var hs = path(R, d.s, mix(d.pmf));
    hist.setAttribute('d', 'M' + px(R, d.s[0]) + ' ' + Y0 + 'L' + hs.slice(1) + 'L' + px(R, d.s[d.s.length - 1]) + ' ' + Y0 + 'Z');
    [limL, limR].forEach(function (p) {
      p.setAttribute('stroke-dashoffset', 1 - lim);
      p.setAttribute('opacity', lim > 0 ? 1 : 0);
    });
    legLim.setAttribute('opacity', lim);
    counter.textContent = 'n = ' + Math.round(Math.exp(lerp(Math.log(d.n[a]), Math.log(d.n[b]), f)));
  }

  // ---- Stepping (one stage per .bn-step fragment) ----------------------------
  var cur = -1, raf = null;
  function show(s) { render(STAGES[s].k, STAGES[s].lim); }
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
      render(lerp(A.k, B.k, w), lerp(A.lim, B.lim, w));
      raf = e < 1 ? requestAnimationFrame(frame) : null;
    });
  }

  // Reveal wiring, as in the week 6 WLLN animation
  var slide = el.closest('section');
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.bn-step.visible').length : 0;
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
