function (el, d) {
  // Critical values and the coverage they buy, in the visual language of the
  // week 8 integral animation. The N(0, 1) density (ink) comes first; then
  // symmetric bounds +/- z appear at the first critical value, the area
  // between them shaded blue with its probability 2 Phi(z) - 1 written in
  // the middle and each tail's share in red, and each step slides the bounds
  // out to the next critical value. A table on the right collects one row per
  // critical value. Probabilities are computed here from z. Data: d.z, the
  // critical values. One stage per .rl-step fragment; stepping backwards runs
  // each transition in reverse.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 400;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GREY = '#9a9a9a';
  var X0 = 30, X1 = 690, Y0 = 330, Y1 = 50, L = 3.5, YMAX = 0.42;
  var TX = 760, TX2 = 900, TY = 120, TR = 46;      // table: columns, header, row height
  var NZ = d.z.length;

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
  function area(a, b) {                            // closed path under the density from a to b
    var p = [px(a).toFixed(1) + ' ' + Y0];
    for (var x = a; x < b; x += 0.02) p.push(px(x).toFixed(1) + ' ' + py(npdf(x)).toFixed(1));
    p.push(px(b).toFixed(1) + ' ' + py(npdf(b)).toFixed(1), px(b).toFixed(1) + ' ' + Y0);
    return 'M' + p.join('L') + 'Z';
  }

  // Stages: the density alone, then each critical value
  var STAGES = [{ k: 0, t: 0 }];
  for (var i = 0; i < NZ; i++) STAGES.push({ k: i, t: 1 });
  var DUR = [0, 900].concat(d.z.slice(1).map(function () { return 1300; }));

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'Wider critical values capture more of the standard normal: plus or minus 1 holds 68%, 1.645 holds 90%, 1.96 holds 95%, and 2.58 holds 99%',
                        style: 'width: 100%; height: auto; max-height: 420px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  var mid = mk('path', { fill: BLUE, 'fill-opacity': 0.35 }, svg);
  var tails = [mk('path', { fill: RED }, svg), mk('path', { fill: RED }, svg)];
  mk('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  var pts = [];
  for (var v = -L; v <= L + 1e-9; v += 0.02) pts.push(px(v).toFixed(1) + ' ' + py(npdf(v)).toFixed(1));
  mk('path', { d: 'M' + pts.join('L'), fill: 'none', stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, svg);

  var gB = mk('g', {}, svg);
  var bounds = [-1, 1].map(function (s) {
    return {
      s: s,
      ln: mk('line', { y1: Y0, y2: Y1, stroke: BLUE, 'stroke-width': 2.5, 'stroke-dasharray': '10 7' }, gB),
      lab: mk('text', { y: Y0 + 32, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 600, fill: BLUE }, gB),
      tl: mk('text', { y: py(0.1), 'text-anchor': s < 0 ? 'end' : 'start', 'font-size': 20, fill: RED }, gB)
    };
  });
  var midV = mk('text', { x: px(0), y: py(0.12), 'text-anchor': 'middle', 'font-size': 34, 'font-weight': 600, fill: BLUE }, gB);

  // Table of critical values and coverage
  mk('text', { x: TX, y: TY, 'text-anchor': 'middle', 'font-size': 22, fill: GREY }, svg).textContent = 'z';
  mk('text', { x: TX2, y: TY, 'text-anchor': 'middle', 'font-size': 22, fill: GREY }, svg).textContent = '2Φ(z) − 1';
  mk('line', { x1: TX - 50, x2: TX2 + 75, y1: TY + 14, y2: TY + 14, stroke: GREY, 'stroke-width': 1.5 }, svg);
  var rows = d.z.map(function (z, j) {
    var g = mk('g', {}, svg), y = TY + 14 + TR * (j + 1) - 12;
    var a = mk('text', { x: TX, y: y, 'text-anchor': 'middle', 'font-size': 26, 'font-variant-numeric': 'tabular-nums' }, g);
    var b = mk('text', { x: TX2, y: y, 'text-anchor': 'middle', 'font-size': 26, 'font-variant-numeric': 'tabular-nums' }, g);
    a.textContent = z.toFixed(2);
    b.textContent = (2 * ncdf(z) - 1).toFixed(2);
    return { g: g, a: a, b: b };
  });

  function render(k, t) {
    var a = Math.floor(k), b = Math.min(a + 1, NZ - 1), f = k - a;
    var z = lerp(d.z[a], d.z[b], f), p = 2 * ncdf(z) - 1;
    mid.setAttribute('d', area(-z, z));
    mid.setAttribute('fill-opacity', 0.35 * t);
    tails[0].setAttribute('d', area(-L, -z));
    tails[1].setAttribute('d', area(z, L));
    tails.forEach(function (e) { e.setAttribute('fill-opacity', 0.75 * t); });
    bounds.forEach(function (bd) {
      var x = px(bd.s * z);
      bd.ln.setAttribute('x1', x); bd.ln.setAttribute('x2', x);
      bd.lab.setAttribute('x', x);
      bd.lab.textContent = (bd.s < 0 ? '−' : '') + z.toFixed(2);
      bd.tl.setAttribute('x', x + bd.s * 12);
      bd.tl.textContent = ncdf(-z).toFixed(3);
    });
    midV.textContent = p.toFixed(2);
    gB.setAttribute('opacity', t);
    rows.forEach(function (r, j) {
      var on = t * Math.max(0, Math.min(1, k - j + 1)), now = Math.max(0, 1 - Math.abs(k - j));
      r.g.setAttribute('opacity', on);
      var col = now > 0.5 ? BLUE : INK;
      r.a.setAttribute('fill', col); r.b.setAttribute('fill', col);
      r.b.setAttribute('font-weight', now > 0.5 ? 600 : 400);
    });
  }

  // ---- Stepping (one stage per .rl-step fragment) ----------------------------
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
  var slide = el.closest('section');
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.rl-step.visible').length : 0;
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
