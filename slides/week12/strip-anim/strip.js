function (el, d, opts) {
  // Where the randomness comes from: sampling from a population versus
  // "punching out" units of a fixed finite population. Y runs up the page in
  // every panel: the population density F on the left (sideways), a strip of
  // N unit cells in the middle, and the distribution of the estimates on the
  // right (also sideways), so each estimate's line runs straight into it.
  //   stage 0   the population F and an empty strip of N cells
  //   1         one i.i.d. sample: N draws fly out of F into the cells; its mean
  //   2         more samples: the values change, the cells stay
  //   3         the rest of the samples fill the histogram; the truth mu
  //   4         freeze the last sample: Y_1, ..., Y_N are now fixed numbers,
  //             F fades, the R_i row appears, the truth is the mean of all N
  //   5         simple random sampling: N - n cells are punched out
  //   6         more draws of R: the values stay, the holes move
  //   7         the rest of the draws fill the histogram (centered on the truth)
  //   8         a covariate X colors the units; holes close
  //   9         R_i ~ Bernoulli(pi(X_i)): low-Y units go missing more often
  //   10        more draws of R
  //   11        the rest of the draws: the complete-case mean is biased
  //   12        inverse probability weights: observed cells widen in
  //             proportion to 1 / pi(X_i) until they fill the strip (Hajek)
  //   13        the weighted estimate over every draw: centered on the truth
  // Data: d.N, d.n, d.K (draws animated one at a time), d.ylim,
  // d.dens = {w1, m0, m1, s} (F is a two-component normal mixture), d.mu (the
  // mean of F), d.muN (the mean of the finite population), d.ay (K samples of
  // N values from F; the last one is the finite population), d.fx (its X),
  // d.br (K SRS response patterns, 0/1), d.cr (K patterns under pi(X)),
  // d.pi = [pi(0), pi(1)], and the estimate from every draw: d.estA (sample
  // means), d.estB (SRS means), d.estC (complete-case means under pi(X)),
  // d.estW (Hajek estimates under pi(X)). One stage per .st-step fragment;
  // stepping backwards runs each transition in reverse.
  opts = opts || {};
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 580;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GOLD = '#b8860b', GREY = '#9a9a9a',
      GREEN = '#2e7d32', BG = '#f7f7f7';
  var AX = 70, DX0 = 76, DX1 = 196;                 // Y axis; the density panel
  var SX0 = 216, SX1 = 716;                         // the strip
  var HX0 = 790, HX1 = 985;                         // the histogram panel
  var Y0 = 515, Y1 = 86, RY = 550;                  // plot bottom/top; the R_i row
  var YL = d.ylim[0], YH = d.ylim[1];
  var N = d.N, K = d.K, SW = SX1 - SX0, CW = SW / N;
  var XCOL = [BLUE, GOLD];
  var fy = d.ay[K - 1];

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function py(v) { return Y0 - (v - YL) / (YH - YL) * (Y0 - Y1); }
  function mean(a) { var s = 0; a.forEach(function (v) { s += v; }); return s / a.length; }
  function sd(a) { var m = mean(a), s = 0; a.forEach(function (v) { s += (v - m) * (v - m); }); return Math.sqrt(s / (a.length - 1)); }
  function hash(a, b) { var x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
  // Staggered start: unit i of N begins its move at fraction 0.5 * i / (N - 1)
  function stag(f, i) { return clamp((f - 0.5 * i / (N - 1)) / 0.5); }
  function hex(c) { return [1, 3, 5].map(function (k) { return parseInt(c.slice(k, k + 2), 16); }); }
  function mixCol(a, b, t) {
    var A = hex(a), B = hex(b);
    return 'rgb(' + A.map(function (v, k) { return Math.round(lerp(v, B[k], t)); }).join(',') + ')';
  }

  // Math-ish labels: '^' before a character puts a hat on it, '_x' or '_{xy}'
  // sets a subscript. Hats are drawn as paths over the measured glyph once
  // the slide is laid out
  var ACC = [];
  function rich(t, parts) {
    var fs = parseFloat(t.getAttribute('font-size')), SH = 0.22 * fs, idx = 0, pend = 0;
    parts.forEach(function (p) {
      var a = {};
      for (var k in p[0]) a[k] = p[0][k];
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
          var sub = str[j + 1], skip = 1;
          if (sub === '{') { var e = str.indexOf('}', j); sub = str.slice(j + 2, e); skip = e - j; }
          out(seg); seg = '';
          out(sub, { dy: SH, 'font-size': 0.7 * fs });
          pend = -SH; j += skip; idx += sub.length;
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
  function label(x, y, parts, attrs, parent) {
    var a = { x: x, y: y, 'font-size': 22, fill: INK };
    for (var k in attrs) a[k] = attrs[k];
    return rich(mk('text', a, parent), parts);
  }

  var Z = { a: 0, am: 0, mu: 0, fz: 0, b: 0, bm: 0, xc: 0, c: 0, cm: 0, w: 0, wm: 0 };
  function st(o) { var s = {}; for (var k in Z) s[k] = Z[k]; for (k in o) s[k] = o[k]; return s; }
  var A3 = { a: K, am: 1, mu: 1 };
  function ext(base, o) { var s = {}; for (var k in base) s[k] = base[k]; for (k in o) s[k] = o[k]; return s; }
  var S4 = ext(A3, { fz: 1 }), S7 = ext(S4, { b: K, bm: 1 }), S8 = ext(S7, { xc: 1 }), S11 = ext(S8, { c: K, cm: 1 });
  var STAGES = [
    st({}),
    st({ a: 1 }),
    st({ a: K }),
    st(A3),
    st(S4),
    st(ext(S4, { b: 1 })),
    st(ext(S4, { b: K })),
    st(S7),
    st(S8),
    st(ext(S8, { c: 1 })),
    st(ext(S8, { c: K })),
    st(S11),
    st(ext(S11, { w: 1 })),
    st(ext(S11, { w: 1, wm: 1 }))
  ];
  var DUR = [0, 2200, 900 * (K - 1), 2200, 1600, 1600, 800 * (K - 1), 2200, 1300, 1600, 800 * (K - 1), 2200, 2000, 2200];
  var FROM = opts.from || 0, TO = opts.to == null ? STAGES.length - 1 : opts.to;

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'Left: a population distribution F. Middle: a strip of N units. Right: the distribution of the estimates. First, repeated samples from F change the values in the strip. Then the values are frozen and the randomness comes from which units are punched out of the strip: at random, then more often for one group, and finally with the observed units reweighted to fill the holes',
                        style: 'width: 100%; height: auto; max-height: 560px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  // ---- Y axis -------------------------------------------------------------------
  mk('line', { x1: AX, x2: AX, y1: Y0, y2: Y1 - 6, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  for (var v = Math.ceil(YL); v <= YH; v += 2) {
    mk('line', { x1: AX - 8, x2: AX, y1: py(v), y2: py(v), stroke: GREY, 'stroke-width': 2 }, svg);
    mk('text', { x: AX - 14, y: py(v) + 7, 'text-anchor': 'end', 'font-size': 20, fill: GREY }, svg).textContent = v;
  }
  mk('text', { x: AX, y: Y1 - 18, 'text-anchor': 'middle', 'font-size': 24, 'font-style': 'italic', fill: INK }, svg).textContent = 'Y';

  // ---- The population density, sideways -------------------------------------------
  function dens(y) {
    var D = d.dens, f = function (m) { var z = (y - m) / D.s; return Math.exp(-0.5 * z * z); };
    return (1 - D.w1) * f(D.m0) + D.w1 * f(D.m1);
  }
  var NG = 120, fmax = 0, gy = [];
  for (var g = 0; g <= NG; g++) { gy.push(lerp(YL, YH, g / NG)); fmax = Math.max(fmax, dens(gy[g])); }
  function dx(y) { return DX0 + dens(y) / fmax * (DX1 - DX0); }
  var gD = mk('g', {}, svg);
  mk('polygon', { points: [DX0 + ',' + py(YL)].concat(gy.map(function (y) { return dx(y) + ',' + py(y); }), [DX0 + ',' + py(YH)]).join(' '),
                  fill: GREY, 'fill-opacity': 0.22, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, gD);
  label((DX0 + DX1) / 2, 30, [[{ 'font-weight': 600 }, 'Population']], { 'text-anchor': 'middle' }, gD);
  label((DX0 + DX1) / 2, 58, [[{ 'font-style': 'italic' }, 'F']], { 'text-anchor': 'middle' }, gD);
  // Where a draw starts: inside the density at its own height
  function launch(y, s, i) { return DX0 + 4 + hash(s, i) * (dx(y) - DX0 - 4); }

  // ---- Histograms of the estimates, sideways -----------------------------------------
  var BW = 0.125, NB = Math.round((YH - YL) / BW);
  function makeHist(col) {
    var g = mk('g', {}, svg), bars = [];
    for (var b = 0; b < NB; b++)
      bars.push(mk('rect', { x: HX0, y: py(YL + (b + 1) * BW) + 0.5, height: (Y0 - Y1) / NB - 1, width: 0,
                             fill: col, 'fill-opacity': 0.5, stroke: col, 'stroke-width': 1 }, g));
    return { g: g, bars: bars };
  }
  function counts(est, k) {
    var c = []; for (var b = 0; b < NB; b++) c.push(0);
    for (var s = 0; s < k; s++) { var b2 = Math.floor((est[s] - YL) / BW); if (b2 >= 0 && b2 < NB) c[b2]++; }
    return c;
  }
  mk('line', { x1: HX0, x2: HX0, y1: Y0, y2: Y1, stroke: GREY, 'stroke-width': 2 }, svg);
  var hA = makeHist(INK), hB = makeHist(INK), hC = makeHist(GREY), hW = makeHist(GREEN);
  function drawHists(list) {
    // One scale for the histograms on screen together: 14px per draw until the
    // tallest bin would run out of room
    var cs = list.map(function (h) { return counts(h[1], h[2]); }), mx = 1;
    cs.forEach(function (c) { mx = Math.max(mx, Math.max.apply(null, c)); });
    var sc = Math.min(14, (HX1 - HX0 - 10) / mx);
    list.forEach(function (h, j) {
      h[0].bars.forEach(function (r, b) { r.setAttribute('width', cs[j][b] * sc); });
    });
  }

  // ---- The strip --------------------------------------------------------------------
  var gS = mk('g', {}, svg), cells = [], stems = [], dots = [], rtx = [];
  for (var i = 0; i < N; i++) {
    cells.push(mk('rect', { y: Y1 - 8, height: Y0 - Y1 + 8, fill: '#ffffff', stroke: '#c8c8c8', 'stroke-width': 1.5 }, gS));
  }

  // ---- The truth: mu (the mean of F) and mu_N (the mean of the N units), over the strip
  var gMu = mk('g', {}, svg);
  mk('line', { x1: AX, x2: HX1, y1: py(d.mu), y2: py(d.mu), stroke: RED, 'stroke-width': 3 }, gMu);
  label(HX1, py(d.mu) - 8, [[{ 'font-style': 'italic' }, 'μ']], { 'text-anchor': 'end', fill: RED, 'font-weight': 600 }, gMu);
  var gMuN = mk('g', {}, svg);
  mk('line', { x1: SX0, x2: HX1, y1: py(d.muN), y2: py(d.muN), stroke: RED, 'stroke-width': 3 }, gMuN);
  label(HX1, py(d.muN) - 8, [[{ 'font-style': 'italic' }, 'μ_N']], { 'text-anchor': 'end', fill: RED, 'font-weight': 600 }, gMuN);

  mk('line', { x1: SX0, x2: SX1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2 }, svg);
  for (i = 0; i < N; i++) {
    stems.push(mk('line', { y1: Y0, stroke: INK, 'stroke-width': 2 }, svg));
    dots.push(mk('circle', { r: 7 }, svg));
    rtx.push(mk('text', { y: RY, 'text-anchor': 'middle', 'font-size': 18, fill: INK }, svg));
  }
  var rLab = label(SX0 - 10, RY, [[{ 'font-style': 'italic' }, 'R_i']], { 'text-anchor': 'end', 'font-size': 20 }, svg);

  // ---- Estimate lines ----------------------------------------------------------------
  // (the IPW label sits under its line, so it can't collide with the
  // complete-case label above the other one)
  function estLine(col, lab, below) {
    var g = mk('g', {}, svg);
    var ln = mk('line', { x1: SX0, x2: HX0, stroke: col, 'stroke-width': 3, 'stroke-dasharray': '9 6' }, g);
    var t = label(SX1 + 8, 0, lab, { fill: col, 'font-weight': 600, 'font-size': 21,
                                     stroke: BG, 'stroke-width': 6, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, g);
    return { g: g, set: function (y, o) {
      ln.setAttribute('y1', py(y)); ln.setAttribute('y2', py(y));
      t.setAttribute('y', py(y) + (below ? 24 : -8)); g.setAttribute('opacity', o);
    } };
  }
  var eA = estLine(INK, [[{ 'font-style': 'italic' }, '^μ']]);
  var eB = estLine(INK, [[{ 'font-style': 'italic' }, '^μ']]);
  var eC = estLine(INK, [[{ 'font-style': 'italic' }, '^μ']]);
  var eW = estLine(GREEN, [[{ 'font-style': 'italic' }, '^μ_{IPW}']], true);

  // ---- Headers ------------------------------------------------------------------------
  function hdr(x, y, parts, attrs) { return label(x, y, parts, attrs, svg); }
  var tA = hdr(SX0, 30, [[{ 'font-weight': 600 }, '']]);                   // the counters are plain text
  var tB = hdr(SX0, 30, [[{ 'font-weight': 600 }, '']]);
  var tC = hdr(SX0, 30, [[{ 'font-weight': 600 }, '']]);
  var tA2 = hdr(SX0, 58, [[{}, 'i.i.d. draws from '], [{ 'font-style': 'italic' }, 'F']]);
  var tB2 = hdr(SX0, 58, [[{}, 'Fixed: '], [{ 'font-style': 'italic' }, 'Y_1'], [{}, ', …, '], [{ 'font-style': 'italic' }, 'Y_N'],
                          [{ dx: 10 }, '(SRS, '], [{ 'font-style': 'italic' }, 'n'], [{}, ' = ' + d.n + ')']]);
  var tC2 = hdr(SX0, 58, [[{ fill: BLUE, 'font-weight': 600 }, '● '], [{ 'font-style': 'italic' }, 'X'], [{}, ' = 0: π = ' + d.pi[0]],
                          [{ dx: 18, fill: GOLD, 'font-weight': 600 }, '● '], [{ 'font-style': 'italic' }, 'X'], [{}, ' = 1: π = ' + d.pi[1]]]);
  var tW = hdr(SX0, 30, [[{ 'font-weight': 600, fill: GREEN }, 'Weight each observed unit by 1/π('], [{ 'font-style': 'italic', 'font-weight': 600, fill: GREEN }, 'X_i'],
                         [{ 'font-weight': 600, fill: GREEN }, ')']]);
  var hT = hdr(HX0, 30, [[{ 'font-weight': 600 }, 'Estimates']]);
  function readout(est, col, name) {
    return hdr(HX0, 58, [[{ fill: col }, name + 'SD = ' + sd(est).toFixed(2)]], { 'font-size': 20 });
  }
  var rA = readout(d.estA, INK, ''), rB = readout(d.estB, INK, '');
  var biasC = mean(d.estC) - d.muN, biasW = mean(d.estW) - d.muN;
  function sgn(v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2); }
  var rC = hdr(HX0, 58, [[{ fill: GREY }, 'Bias ' + sgn(biasC)]], { 'font-size': 20 });
  var rW = hdr(HX0 + 100, 58, [[{ fill: GREEN }, 'IPW ' + sgn(biasW)]], { 'font-size': 20 });

  function setText(t, s) { t.firstChild.textContent = s; }

  function render(s) {
    var i, xs = [], ws = [];
    // ---- Scene A: which sample is on screen, and how far it has flown in
    var sa = Math.min(Math.floor(s.a), K), fa = s.a - sa;
    // ---- Response: SRS patterns (B), then pi(X) patterns (C)
    function obs(pat, p) {
      var k = Math.min(Math.floor(p), K), f = p - k, o = [];
      for (var i = 0; i < N; i++) {
        if (k === 0) o.push(lerp(1, pat[0][i], ease(stag(f, i))));
        else if (k < K && f > 0) o.push(lerp(pat[k - 1][i], pat[k][i], ease(f)));
        else o.push(pat[k - 1][i]);
      }
      return o;
    }
    function est(e, p, start) {
      var k = Math.min(Math.floor(p), K), f = p - k;
      if (k === 0) return [lerp(start, e[0], ease(f)), clamp(f * 2)];
      if (k < K && f > 0) return [lerp(e[k - 1], e[k], ease(f)), 1];
      return [e[k - 1], 1];
    }
    var oB = obs(d.br, s.b), oC = obs(d.cr, s.c), o = [];
    for (i = 0; i < N; i++) o.push(lerp(lerp(1, oB[i], s.fz), oC[i], s.xc));

    // ---- Cell widths: equal, then 1 / pi(X_i) for the observed (Hajek fills the strip)
    var R = d.cr[K - 1], tot = 0;
    for (i = 0; i < N; i++) tot += R[i] / d.pi[d.fx[i]];
    var ew = ease(s.w), x = SX0;
    for (i = 0; i < N; i++) {
      ws.push(lerp(CW, R[i] / d.pi[d.fx[i]] / tot * SW, ew));
      xs.push(x + ws[i] / 2); x += ws[i];
    }

    for (i = 0; i < N; i++) {
      var c = cells[i];
      c.setAttribute('x', xs[i] - ws[i] / 2); c.setAttribute('width', Math.max(0, ws[i]));
      c.setAttribute('fill-opacity', o[i]);
      c.setAttribute('stroke-dasharray', o[i] < 0.5 ? '5 4' : 'none');
      c.setAttribute('stroke-opacity', ws[i] < 1 ? 0 : 1);
      c.setAttribute('fill', s.w > 0 && R[i] ? mixCol('#ffffff', d.fx[i] ? '#f6ecd6' : '#dcecf3', ew) : '#ffffff');

      // Where the unit's value is, and how visible
      var yv, xv = xs[i], op;
      if (sa === 0) {                                          // the first sample flies in
        var t = stag(fa, i), e2 = ease(t);
        yv = d.ay[0][i]; xv = lerp(launch(yv, 0, i), xs[i], e2); op = t > 0 ? 1 : 0;
      } else if (sa < K && fa > 0) {                            // the old value leaves, a new one flies in
        var u = stag(fa, i);
        if (u < 0.3) { yv = d.ay[sa - 1][i]; op = 1 - u / 0.3; }
        else { yv = d.ay[sa][i]; xv = lerp(launch(yv, sa, i), xs[i], ease((u - 0.3) / 0.7)); op = 1; }
      } else { yv = d.ay[sa - 1][i]; op = 1; }
      op *= lerp(0.15, 1, o[i]) * (1 - ew * (1 - R[i]));
      var col = mixCol(INK, XCOL[d.fx[i]], s.xc);
      dots[i].setAttribute('cx', xv); dots[i].setAttribute('cy', py(yv));
      dots[i].setAttribute('fill', col); dots[i].setAttribute('opacity', op);
      stems[i].setAttribute('x1', xv); stems[i].setAttribute('x2', xv); stems[i].setAttribute('y2', py(yv));
      stems[i].setAttribute('stroke', col); stems[i].setAttribute('opacity', op * (Math.abs(xv - xs[i]) < 1 ? 1 : 0));

      rtx[i].setAttribute('x', xs[i]); rtx[i].textContent = o[i] >= 0.5 ? '1' : '0';
      rtx[i].setAttribute('fill', o[i] >= 0.5 ? INK : RED);
      // (a punched cell's 0 leaves before its cell collapses under the weights)
      rtx[i].setAttribute('opacity', s.fz * (ws[i] < 10 ? 0 : 1) * (R[i] ? 1 : 1 - clamp(3 * ew)));
    }
    rLab.setAttribute('opacity', s.fz);

    // ---- Density and truth
    gD.setAttribute('opacity', 1 - 0.85 * s.fz);
    gMu.setAttribute('opacity', s.mu * (1 - s.fz));
    gMuN.setAttribute('opacity', s.fz);

    // ---- Estimate lines (the last sample's mean becomes mu_N when frozen)
    var ea;
    if (sa === 0) ea = [d.estA[0], clamp((fa - 0.75) * 4)];
    else if (sa < K && fa > 0) ea = [lerp(d.estA[sa - 1], d.estA[sa], ease(clamp((fa - 0.55) / 0.45))), 1];
    else ea = [d.estA[sa - 1], 1];
    eA.set(ea[0], ea[1] * (1 - s.fz));
    var eb = est(d.estB, s.b, d.muN), ec = est(d.estC, s.c, d.muN);
    eB.set(eb[0], s.b > 0 ? eb[1] * (1 - s.xc) : 0);
    eC.set(ec[0], s.c > 0 ? ec[1] * (1 - 0.6 * ew) : 0);
    eW.set(d.estW[K - 1], ew);

    // ---- Histograms: a draw is counted once it has landed
    var S = d.estA.length;
    function nIn(p, m) { return Math.min(K, Math.floor(p)) + Math.round(m * (S - K)); }
    hA.g.setAttribute('opacity', 1 - s.fz);
    hB.g.setAttribute('opacity', s.fz * (1 - s.xc));
    hC.g.setAttribute('opacity', s.xc * (1 - 0.5 * s.wm));
    hW.g.setAttribute('opacity', s.w);
    if (s.fz < 1) drawHists([[hA, d.estA, nIn(s.a, s.am)]]);
    if (s.fz > 0 && s.xc < 1) drawHists([[hB, d.estB, nIn(s.b, s.bm)]]);
    if (s.xc > 0) drawHists([[hC, d.estC, nIn(s.c, s.cm)], [hW, d.estW, Math.round(ew * K) + Math.round(s.wm * (S - K))]]);

    // ---- Headers
    setText(tA, s.am > 0 ? 'Samples: ' + nIn(s.a, s.am) : 'Sample ' + Math.max(1, Math.min(K, Math.round(s.a))) + ': ' + N + ' units');
    setText(tB, s.bm > 0 ? 'Draws of R: ' + nIn(s.b, s.bm) : 'Draw ' + Math.max(1, Math.min(K, Math.round(s.b))) + ' of R');
    setText(tC, s.cm > 0 ? 'Draws of R: ' + nIn(s.c, s.cm) : 'Draw ' + Math.max(1, Math.min(K, Math.round(s.c))) + ' of R');
    if (s.b === 0) setText(tB, 'A finite population of ' + N + ' units');
    if (s.c === 0) setText(tC, 'Each unit also has a covariate X');
    // Headers that share a line hand over: the old one is gone by halfway,
    // the new one starts at halfway
    function outH(t) { return 1 - clamp(2 * t); }
    function inH(t) { return clamp(2 * t - 1); }
    tA.setAttribute('opacity', (s.a > 0 ? 1 : 0) * outH(s.fz));
    tA2.setAttribute('opacity', outH(s.fz));
    tB.setAttribute('opacity', inH(s.fz) * outH(s.xc));
    tB2.setAttribute('opacity', inH(s.fz) * outH(s.xc));
    tC.setAttribute('opacity', inH(s.xc) * outH(ew));
    tC2.setAttribute('opacity', inH(s.xc));
    tW.setAttribute('opacity', inH(ew));
    rA.setAttribute('opacity', s.am * (1 - s.fz));
    rB.setAttribute('opacity', s.bm * (1 - s.xc));
    rC.setAttribute('opacity', s.cm);
    rW.setAttribute('opacity', s.wm);
    placeAccents();
  }

  // ---- Stepping (stage = opts.from + visible .st-step fragments) ------------
  var cur = -1, raf = null;
  function mix(A, B, e) {
    var s = {};
    for (var k in A) s[k] = lerp(A[k], B[k], e);
    return s;
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
    return FROM + (slide ? slide.querySelectorAll('.fragment.st-step.visible').length : 0);
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
