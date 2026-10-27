function (el, d, opts) {
  // Point versus interval estimation as darts versus rings. Behind everything,
  // faint, the N(mu, se^2) sampling distribution of the sample mean, with the
  // truth mu as a dashed peg. In 'dart' mode one estimate falls onto the line
  // and its distance to mu is marked; then the rest fall and stack into rows,
  // each a segment from mu to its mu_hat; the rows average into a single
  // point on mu (unbiasedness, E[mu_hat - mu] = 0); and the squared distances
  // fill a tally whose average is the mean squared error. In 'ring' mode the
  // same samples are thrown as rings mu_hat +/- z se_hat: one lands, then the
  // rest, colored by whether they cover mu (misses in red, at full opacity),
  // with a running count, a grey bar for the share covering and a gold outline
  // for the nominal 2 Phi(z) - 1; then z widens and narrows. Data from
  // darts.json (built by make_darts.R), in units of the true se. One stage per
  // .dr-step fragment; stepping backwards runs each transition in reverse.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 580;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GOLD = '#d9a21b', GREY = '#9a9a9a';
  var MUX = 380, SC = 70;                          // truth at x = 380; px per se
  var AXY = 180, PEAK = 125, TOPY = 30;            // axis, density peak height, label line
  var ROW0 = 222, ROWS = 10, SUMY = 548;           // first row, row spacing, bias row
  var TX = 820, TW = 150;                          // tally panel
  var RY = 8, LAND = AXY - 16;                     // ring's half-height in flight; where it lands
  var mode = (opts && opts.mode) || 'dart';
  var N = d.err.length, Z = d.z;

  var STAGES = mode === 'dart'
    ? [{ one: 0, many: 0, bias: 0, mse: 0 },
       { one: 1, many: 0, bias: 0, mse: 0 },
       { one: 1, many: 1, bias: 0, mse: 0 },
       { one: 1, many: 1, bias: 1, mse: 0 },
       { one: 1, many: 1, bias: 1, mse: 1 }]
    : [{ one: 0, many: 0, z: 0 },
       { one: 1, many: 0, z: 0 },
       { one: 1, many: 1, z: 0 },
       { one: 1, many: 1, z: 1 },
       { one: 1, many: 1, z: 2 }];
  var DUR = mode === 'dart' ? [0, 1600, 6000, 1800, 1500] : [0, 1600, 6000, 1800, 1800];
  var EASED = { bias: 1, mse: 1, z: 1 };           // the rest are eased per element

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function win(v, a, b) { return clamp((v - a) / (b - a)); }
  function hx(v) { return MUX + v * SC; }
  function rowY(i) { return ROW0 + i * ROWS; }
  function Phi(x) {                                // Abramowitz-Stegun 7.1.26
    var t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
    var y = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
              * Math.exp(-x * x / 2);
    return x < 0 ? (1 - y) / 2 : (1 + y) / 2;
  }
  // Text from [string, italic?, hat?] parts. A combining circumflex lands
  // wherever the font puts it, so a hat is drawn as a path over its letter,
  // placed by placeHats() once the text has been laid out
  var hats = [];
  function rich(parts, attrs, parent) {
    var e = mk('text', attrs, parent);
    parts.forEach(function (s) {
      var t = mk('tspan', s[1] ? { 'font-style': 'italic' } : {}, e);
      t.textContent = s[0];
      if (s[2]) hats.push({ t: t, y: attrs.y, fs: attrs['font-size'],
                            p: mk('path', { fill: 'none', stroke: attrs.fill, 'stroke-width': attrs['font-size'] * 0.07,
                                            'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, parent) });
    });
    return e;
  }
  function placeHats() {
    hats.forEach(function (h) {
      var b;
      try { b = h.t.getExtentOfChar(0); } catch (err) { return; }   // not laid out yet (hidden slide)
      if (!b || !b.width) return;
      var cx = b.x + b.width * 0.5 + h.fs * 0.08, w = h.fs * 0.2;   // nudge right for the italic slant
      h.p.setAttribute('d', 'M' + (cx - w) + ' ' + (h.y - h.fs * 0.6) + 'L' + cx + ' ' + (h.y - h.fs * 0.78) +
                            'L' + (cx + w) + ' ' + (h.y - h.fs * 0.6));
    });
  }
  // Each element's share of a transition: the first is thrown alone, the
  // rest fall in turn over the 'many' transition
  function slot(i) {
    var s = 0.06 + 0.74 * (i - 1) / (N - 2);
    return [s, s + 0.1, s + 0.2];                  // start falling, land, settled
  }

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': mode === 'dart'
                          ? 'Point estimates fall like darts around the truth; their distances to it average to zero, and their squared distances average to the mean squared error'
                          : 'Interval estimates fall like rings around the truth; some cover it and some miss, and wider rings cover it more often',
                        style: 'width: 100%; height: auto; max-height: 560px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  // Background: the sampling distribution, faint, over the line
  var dens = [];
  for (var v = -4.9; v <= 4.9 + 1e-9; v += 0.05) dens.push(hx(v).toFixed(1) + ' ' + (AXY - PEAK * Math.exp(-v * v / 2)).toFixed(1));
  mk('path', { d: 'M' + dens.join('L') + 'Z', fill: INK, 'fill-opacity': 0.06, stroke: INK, 'stroke-opacity': 0.22,
               'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
  mk('line', { x1: 30, x2: 790, y1: AXY, y2: AXY, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  mk('line', { x1: MUX, x2: MUX, y1: TOPY + 10, y2: (mode === 'dart' ? SUMY : rowY(N - 1)) + 8, stroke: INK,
               'stroke-width': 2.5, 'stroke-dasharray': '12 8' }, svg);
  rich([['μ', 1]], { x: MUX, y: TOPY, 'text-anchor': 'middle', 'font-size': 26, fill: INK }, svg);

  var gRows = mk('g', {}, svg), gAir = mk('g', {}, svg);
  var items = [], render;

  if (mode === 'dart') {
    // The first dart's distance to mu, marked on the line
    var gap = mk('g', {}, svg);
    var gx = hx(d.err[0]), gy = AXY - 16;
    mk('line', { x1: MUX, x2: gx, y1: gy, y2: gy, stroke: RED, 'stroke-width': 3, 'stroke-linecap': 'round' }, gap);
    [MUX, gx].forEach(function (x) {
      mk('line', { x1: x, x2: x, y1: gy - 7, y2: gy + 7, stroke: RED, 'stroke-width': 3, 'stroke-linecap': 'round' }, gap);
    });
    rich([['μ', 1, 1], [' − '], ['μ', 1]], { x: gx + 14, y: gy + 2,
         'font-size': 23, fill: RED }, gap);

    // Darts: a glyph in flight, a dot where it lands, a rug tick on the line,
    // a segment back to mu in its row, and a ghost that runs into the average
    items = d.err.map(function (e, i) {
      var x = hx(e), it = { x: x, y: rowY(i), e: e };
      it.rug = mk('line', { x1: x, x2: x, y1: AXY - 6, y2: AXY + 6, stroke: BLUE, 'stroke-width': 2 }, gRows);
      it.seg = mk('line', { x1: MUX, x2: x, y1: it.y, y2: it.y, stroke: BLUE, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, gRows);
      it.dot = mk('circle', { cx: x, r: 5, fill: BLUE }, gRows);
      it.ghost = mk('circle', { r: 4, fill: GOLD }, gRows);
      it.dart = mk('g', {}, gAir);
      mk('line', { x1: 0, x2: 0, y1: -36, y2: -9, stroke: INK, 'stroke-width': 2.5 }, it.dart);
      mk('path', { d: 'M-4 -10L4 -10L0 0Z', fill: INK }, it.dart);
      mk('path', { d: 'M0 -28L-6 -38M0 -28L6 -38M0 -33L-6 -43M0 -33L6 -43', stroke: INK, 'stroke-width': 1.8, fill: 'none' }, it.dart);
      it.bar = mk('rect', { x: TX, y: it.y - 3.5, height: 7, fill: GREY }, svg);
      return it;
    });
    var meanErr = d.err.reduce(function (a, b) { return a + b; }, 0) / N;
    var meanSq = d.err.reduce(function (a, b) { return a + b * b; }, 0) / N;
    var maxSq = Math.max.apply(null, d.err.map(function (e) { return e * e; }));
    var TS = TW / maxSq;                           // tally px per se^2
    var gBias = mk('g', {}, svg);
    mk('circle', { cx: hx(meanErr), cy: SUMY, r: 8, fill: GOLD }, gBias);
    rich([['E['], ['μ', 1, 1], [' − '], ['μ', 1], ['] = 0']], { x: hx(meanErr) + 22, y: SUMY + 8, 'font-size': 23, fill: INK }, gBias);
    var zero = mk('line', { x1: TX, x2: TX, y1: ROW0 - 12, y2: rowY(N - 1) + 12, stroke: INK, 'stroke-width': 2.5 }, svg);
    var gMse = mk('g', {}, svg);
    mk('line', { x1: TX + TS * meanSq, x2: TX + TS * meanSq, y1: ROW0 - 12, y2: rowY(N - 1) + 12, stroke: GOLD, 'stroke-width': 3.5 }, gMse);
    rich([['E[('], ['μ', 1, 1], [' − '], ['μ', 1], [')²]']], { x: TX + TS * meanSq, y: SUMY + 8, 'text-anchor': 'middle', 'font-size': 23, fill: INK }, gMse);

    render = function (st) {
      var gapOp = win(st.one, 0.55, 0.85) * (1 - win(st.many, 0, 0.08));
      gap.setAttribute('opacity', gapOp);
      var b = st.bias, m = st.mse;
      items.forEach(function (it, i) {
        var fall, settle;
        if (i === 0) { fall = win(st.one, 0, 0.55); settle = win(st.many, 0, 0.12); }
        else { var s = slot(i); fall = win(st.many, s[0], s[1]); settle = win(st.many, s[1], s[2]); }
        var tip = lerp(-50, AXY, fall * fall);     // gravity
        it.dart.setAttribute('transform', 'translate(' + it.x.toFixed(1) + ' ' + tip.toFixed(1) + ')');
        it.dart.setAttribute('opacity', fall > 0 && fall < 1 ? 1 : 0);
        var se = ease(settle), landed = fall >= 1;
        it.dot.setAttribute('cy', lerp(AXY, it.y, se).toFixed(1));
        it.dot.setAttribute('opacity', landed ? 1 - 0.7 * b * (1 - m) - 0.3 * m : 0);
        it.rug.setAttribute('opacity', landed ? 0.35 * se : 0);
        it.seg.setAttribute('opacity', win(settle, 0.6, 1) * (1 - 0.7 * b * (1 - m)));
        var gb = ease(win(b, 0.35 * i / N, 0.35 * i / N + 0.5));
        it.ghost.setAttribute('cx', lerp(it.x, hx(meanErr), gb).toFixed(1));
        it.ghost.setAttribute('cy', lerp(it.y, SUMY, gb).toFixed(1));
        it.ghost.setAttribute('opacity', gb > 0 && gb < 1 ? 0.8 : 0);
        it.bar.setAttribute('width', (TS * it.e * it.e * ease(win(m, 0.4 * i / N, 0.4 * i / N + 0.45))).toFixed(1));
        it.bar.setAttribute('opacity', m > 0 ? 1 : 0);
      });
      gBias.setAttribute('opacity', win(b, 0.8, 1));
      zero.setAttribute('opacity', win(m, 0, 0.2));
      gMse.setAttribute('opacity', win(m, 0.85, 1));
      placeHats();
    };
  } else {
    // Rings: an ellipse in flight that flattens on landing into the interval
    // between two points, then drops into its row
    items = d.err.map(function (e, i) {
      var it = { x: hx(e), y: rowY(i), e: e, s: d.sehat[i] };
      it.ring = mk('ellipse', { fill: 'none', stroke: INK, 'stroke-width': 3 }, gAir);
      it.g = mk('g', {}, gRows);
      it.line = mk('line', { 'stroke-width': 2.5, 'stroke-linecap': 'round' }, it.g);
      it.lo = mk('circle', { r: 4.5 }, it.g);
      it.hi = mk('circle', { r: 4.5 }, it.g);
      return it;
    });
    var gTal = mk('g', {}, svg);
    var count = mk('text', { x: TX + TW / 2, y: 300, 'text-anchor': 'middle', 'font-size': 30, fill: INK }, gTal);
    mk('text', { x: TX + TW / 2, y: 332, 'text-anchor': 'middle', 'font-size': 21, fill: GREY }, gTal).textContent = 'cover';
    mk('rect', { x: TX, y: 352, width: TW, height: 26, fill: 'none', stroke: GREY, 'stroke-width': 1, 'stroke-opacity': 0.5 }, gTal);
    var share = mk('rect', { x: TX, y: 356, height: 18, fill: GREY }, gTal);
    var nominal = mk('rect', { x: TX, y: 349, height: 32, fill: 'none', stroke: GOLD, 'stroke-width': 3 }, gTal);
    var width = rich([['μ', 1, 1], [' ± ']], { x: TX + TW / 2, y: 250, 'text-anchor': 'middle', 'font-size': 23, fill: INK }, svg);
    var zSpan = mk('tspan', {}, width);
    mk('tspan', {}, width).textContent = ' SE';

    render = function (st) {
      var k = Math.min(Math.floor(st.z), Z.length - 2), z = lerp(Z[k], Z[k + 1], st.z - k);
      var settled = 0, covered = 0;
      items.forEach(function (it, i) {
        var fall, flat, drop;
        if (i === 0) { fall = win(st.one, 0, 0.55); flat = win(st.one, 0.55, 0.8); drop = win(st.many, 0, 0.12); }
        else { var s = slot(i); fall = win(st.many, s[0], s[1]); flat = win(st.many, s[1], s[1] + 0.03); drop = win(st.many, s[1] + 0.03, s[2]); }
        var hw = z * it.s * SC, cov = Math.abs(it.e) <= z * it.s, col = cov ? BLUE : RED;
        var cy = lerp(-20, LAND, fall * fall), dy = ease(drop), y = lerp(LAND, it.y, dy);
        it.ring.setAttribute('cx', it.x.toFixed(1)); it.ring.setAttribute('cy', cy.toFixed(1));
        it.ring.setAttribute('rx', hw.toFixed(1)); it.ring.setAttribute('ry', (RY * (1 - flat)).toFixed(2));
        it.ring.setAttribute('opacity', fall > 0 && flat < 1 ? 1 : 0);
        it.line.setAttribute('x1', (it.x - hw).toFixed(1)); it.line.setAttribute('x2', (it.x + hw).toFixed(1));
        it.line.setAttribute('y1', y.toFixed(1)); it.line.setAttribute('y2', y.toFixed(1));
        [[it.lo, -hw], [it.hi, hw]].forEach(function (p) {
          p[0].setAttribute('cx', (it.x + p[1]).toFixed(1)); p[0].setAttribute('cy', y.toFixed(1));
          p[0].setAttribute('fill', col);
        });
        it.line.setAttribute('stroke', col);
        it.g.setAttribute('opacity', flat > 0 ? flat * (cov ? lerp(1, 0.4, dy) : 1) : 0);
        if (drop >= 1) { settled++; if (cov) covered++; }
      });
      gTal.setAttribute('opacity', win(st.many, 0, 0.1));
      count.textContent = covered + ' of ' + settled;
      share.setAttribute('width', settled ? TW * covered / settled : 0);
      nominal.setAttribute('width', TW * (2 * Phi(z) - 1));
      zSpan.textContent = z.toFixed(1);
      width.setAttribute('opacity', win(st.one, 0.55, 0.8));
      placeHats();
    };
  }

  // ---- Stepping (one stage per .dr-step fragment) ----------------------------
  var cur = -1, raf = null;
  function mix(A, B, e) {
    var st = {};
    for (var k in A) st[k] = lerp(A[k], B[k], EASED[k] ? ease(e) : e);
    return st;
  }
  function goTo(s, animate) {
    s = Math.max(0, Math.min(STAGES.length - 1, s));
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

  // Reveal wiring, as in the week 6 WLLN animation
  var slide = el.closest('section');
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.dr-step.visible').length : 0;
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
  render(STAGES[0]);
  goTo(fragmentStage(), false);
}
