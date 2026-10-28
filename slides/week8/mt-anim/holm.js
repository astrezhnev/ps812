function (el, d) {
  // Bonferroni and Holm side by side on the twenty jelly bean tests, in the
  // visual language of the week 8 interval animations. Each test is a dot at
  // its rank (smallest p-value first) and its p-value, drawn on a -log10
  // scale so that smaller p-values sit higher. Three thresholds: no
  // correction (p < alpha, grey), Bonferroni (p < alpha / m, red) and Holm's
  // step-down staircase (the k-th smallest p-value against
  // alpha / (m - k + 1), gold), which rejects in rank order and stops at the
  // first p-value above its step. First with every null true (t_null): no
  // correction makes one false positive (green), both corrections make none.
  // Then three colors get real effects (t_alt, blue dots): no correction
  // adds green as a false positive, Bonferroni misses one real effect, Holm
  // finds all three. Finally the view zooms in on the thresholds, where the
  // difference between the two corrections lives. A scoreboard collects what
  // each procedure rejected. Data from make_mt.R. One stage per .hm-step
  // fragment; stepping backwards runs each transition in reverse.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 460;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GOLD = '#d9a21b', GREY = '#9a9a9a';
  var X0 = 125, X1 = 780, Y0 = 390, Y1 = 40;
  var A = d.alpha, M = d.beans.length, G = d.green - 1;
  var REAL = {}; d.real.forEach(function (k) { REAL[k - 1] = true; });

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, v) { return a + (b - a) * v; }
  function ease(v) { return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; }
  function ncdf(x) {                               // Abramowitz and Stegun 7.1.26
    var z = Math.abs(x) / Math.SQRT2, u = 1 / (1 + 0.3275911 * z);
    var e = 1 - u * (0.254829592 + u * (-0.284496736 + u * (1.421413741 + u * (-1.453152027 + u * 1.061405429)))) * Math.exp(-z * z);
    return x < 0 ? (1 - e) / 2 : (1 + e) / 2;
  }
  function lp(p) { return -Math.log(p) / Math.LN10; }

  // p-values, ranks and Holm's stopping point in each scenario
  function scenario(t) {
    var p = t.map(function (v) { return 2 * (1 - ncdf(Math.abs(v))); });
    var ord = p.map(function (_, i) { return i; }).sort(function (a, b) { return p[a] - p[b]; });
    var rank = []; ord.forEach(function (i, r) { rank[i] = r; });
    var stop = 0;
    while (stop < M && p[ord[stop]] <= A / (M - stop)) stop++;
    return { p: p, rank: rank, stop: stop };
  }
  var SC = [scenario(d.t_null), scenario(d.t_alt)];
  function rejects(sc, proc, i, hw) {              // proc: 1 none, 2 Bonferroni, 3 Holm
    var p = SC[sc].p[i], r = SC[sc].rank[i];
    if (proc === 1) return p < A;
    if (proc === 2) return p < A / M;
    if (proc === 3) return r < SC[sc].stop && r < hw;
    return false;
  }

  // Stages: scenario, procedure in force, thresholds shown, Holm's walk, zoom
  var STAGES = [
    { sc: 0, proc: 0, u: 0, b: 0, h: 0, hw: 0, z: 0 },
    { sc: 0, proc: 1, u: 1, b: 0, h: 0, hw: 0, z: 0 },
    { sc: 0, proc: 2, u: 1, b: 1, h: 0, hw: 0, z: 0 },
    { sc: 0, proc: 3, u: 1, b: 1, h: 1, hw: SC[0].stop + 1, z: 0 },
    { sc: 1, proc: 0, u: 1, b: 1, h: 1, hw: 0, z: 0 },
    { sc: 1, proc: 1, u: 1, b: 1, h: 1, hw: 0, z: 0 },
    { sc: 1, proc: 2, u: 1, b: 1, h: 1, hw: 0, z: 0 },
    { sc: 1, proc: 3, u: 1, b: 1, h: 1, hw: SC[1].stop + 1, z: 0 },
    { sc: 1, proc: 3, u: 1, b: 1, h: 1, hw: SC[1].stop + 1, z: 1 }
  ];
  var DUR = [0, 900, 900, 1800, 1600, 900, 900, 2600, 1800];
  // Scoreboard rows unlocked at each stage (none, Bonferroni, Holm)
  var BOARD = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1], [0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 1, 1]];

  // View: ranks and -log10 p, zooming in on the thresholds at the end
  var V0 = { x0: 0.4, x1: M + 0.6, y0: 0, y1: 3.6 }, V1 = { x0: 0.5, x1: 4.6, y0: 2.47, y1: 2.68 };
  var view;
  function sx(r) { return X0 + (r - view.x0) / (view.x1 - view.x0) * (X1 - X0); }
  function sy(v) { return Y0 - (v - view.y0) / (view.y1 - view.y0) * (Y0 - Y1); }

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'Twenty p-values sorted from smallest to largest against three thresholds: no correction, Bonferroni, and the Holm step-down staircase; with three real effects, Bonferroni finds two and Holm finds all three',
                        style: 'width: 100%; height: auto; max-height: 480px; display: block; margin: 0 auto; font-family: inherit;' }, el);
  var clip = mk('clipPath', { id: 'hm-clip-' + Math.random().toString(36).slice(2) }, mk('defs', {}, svg));
  mk('rect', { x: X0 - 14, y: Y1 - 14, width: X1 - X0 + 28, height: Y0 - Y1 + 14 }, clip);
  var plot = mk('g', { 'clip-path': 'url(#' + clip.id + ')' }, svg);

  // Axes
  mk('line', { x1: X0 - 14, x2: X1 + 14, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  mk('line', { x1: X0 - 14, x2: X0 - 14, y1: Y0, y2: Y1 - 14, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  mk('text', { x: (X0 + X1) / 2, y: Y0 + 56, 'text-anchor': 'middle', 'font-size': 21, fill: INK }, svg).textContent = 'rank of p-value (smallest first)';
  mk('text', { x: 24, y: (Y0 + Y1) / 2, 'text-anchor': 'middle', 'font-size': 21, fill: INK,
               transform: 'rotate(-90 24 ' + (Y0 + Y1) / 2 + ')' }, svg).textContent = 'p-value (log scale)';
  var TICKS = [[0.5, 0.1, 0.05, 0.01, 0.005, 0.001], [0.0033, 0.003, 0.0027, 0.0025, 0.0023]];
  var ticks = TICKS.map(function (set) {
    return set.map(function (p) {
      var tx = mk('text', { x: X0 - 22, 'text-anchor': 'end', 'font-size': 18, fill: GREY }, svg);
      tx.textContent = String(p);
      return { p: p, t: tx };
    });
  });
  var xt = [];
  for (var r = 1; r <= M; r++) {
    var e = mk('text', { y: Y0 + 26, 'text-anchor': 'middle', 'font-size': 17, fill: GREY }, svg);
    e.textContent = r;
    xt.push(e);
  }

  // Thresholds
  var uLine = mk('line', { stroke: GREY, 'stroke-width': 2.5, 'stroke-dasharray': '10 7' }, plot);
  var bLine = mk('line', { stroke: RED, 'stroke-width': 3 }, plot);
  var hPath = mk('path', { fill: 'none', stroke: GOLD, 'stroke-width': 3.5 }, plot);
  var uLab = mk('text', { 'font-size': 19, fill: GREY }, svg); uLab.textContent = 'no correction: α';
  var bLab = mk('text', { 'font-size': 19, fill: RED }, svg); bLab.textContent = 'Bonferroni: α / ' + M;
  var hLab = mk('text', { 'font-size': 19, fill: GOLD }, svg); hLab.textContent = 'Holm: α / (' + M + ' − k + 1)';

  // Dots
  var dots = d.beans.map(function (b, i) {
    var g = mk('g', {}, plot);
    return { g: g,
             ring: mk('circle', { r: 15, fill: 'none', 'stroke-width': 3.5 }, g),
             dot: mk('circle', { r: 9, 'stroke-width': 2.5 }, g),
             lab: mk('text', { 'font-size': 18 }, g),
             note: mk('text', { 'text-anchor': 'start', 'font-size': 18, 'font-weight': 600 }, g) };
  });

  // Scoreboard
  var gB = mk('g', {}, svg);
  var BX = 330, BY = 68;
  var legend = mk('g', {}, gB);
  mk('circle', { cx: BX + 8, cy: BY - 34, r: 8, fill: BLUE }, legend);
  mk('text', { x: BX + 24, y: BY - 28, 'font-size': 19, fill: BLUE }, legend).textContent =
    'real effect: ' + d.real.map(function (k) { return d.beans[k - 1]; }).join(', ');
  var rows = ['no correction', 'Bonferroni', 'Holm'].map(function (name, j) {
    var col = [GREY, RED, GOLD][j];
    var a = mk('text', { x: BX, y: BY + 26 * j, 'font-size': 19, 'font-weight': 600, fill: col }, gB);
    a.textContent = name;
    return { a: a, b: mk('text', { x: BX + 140, y: BY + 26 * j, 'font-size': 19, fill: INK }, gB) };
  });

  function render(st, S) {
    var z = ease(clamp(st.z));
    view = { x0: lerp(V0.x0, V1.x0, z), x1: lerp(V0.x1, V1.x1, z), y0: lerp(V0.y0, V1.y0, z), y1: lerp(V0.y1, V1.y1, z) };
    var sc = S.sc, proc = S.proc;
    // Ticks
    ticks.forEach(function (set, j) {
      set.forEach(function (tk) {
        var y = sy(lp(tk.p)), inside = y >= Y1 - 4 && y <= Y0 + 4;
        tk.t.setAttribute('y', y + 6);
        tk.t.setAttribute('opacity', inside ? (j ? z : 1 - z) : 0);
      });
    });
    xt.forEach(function (e, i) {
      var x = sx(i + 1);
      e.setAttribute('x', x);
      e.setAttribute('opacity', x >= X0 - 20 && x <= X1 + 20 ? 1 : 0);
    });
    // Thresholds, the one in force drawn strongest
    function op(v, k) { return v * (proc === k || proc === 0 ? 1 : 0.3); }
    var yu = sy(lp(A)), yb = sy(lp(A / M));
    uLine.setAttribute('x1', X0 - 14); uLine.setAttribute('x2', X1 + 14); uLine.setAttribute('y1', yu); uLine.setAttribute('y2', yu);
    bLine.setAttribute('x1', X0 - 14); bLine.setAttribute('x2', X1 + 14); bLine.setAttribute('y1', yb); bLine.setAttribute('y2', yb);
    uLine.setAttribute('opacity', op(st.u, 1)); bLine.setAttribute('opacity', op(st.b, 2));
    var hp = [];
    for (var k = 1; k <= M; k++) {
      var y = sy(lp(A / (M - k + 1)));
      hp.push((k === 1 ? 'M' : 'L') + sx(k - 0.5).toFixed(1) + ' ' + y.toFixed(1), 'L' + sx(k + 0.5).toFixed(1) + ' ' + y.toFixed(1));
    }
    hPath.setAttribute('d', hp.join(''));
    hPath.setAttribute('opacity', op(st.h, 3));
    function placeLab(lab, y, o) {
      var inside = y >= Y1 && y <= Y0;
      lab.setAttribute('x', X1 + 22); lab.setAttribute('y', y + 6);
      lab.setAttribute('opacity', inside ? o : 0);
    }
    placeLab(uLab, yu, op(st.u, 1));
    placeLab(bLab, yb - 4, op(st.b, 2));
    // Holm's label follows the staircase where it leaves the view
    var kEdge = Math.max(1, Math.min(M, Math.round(view.x1 - 0.1)));
    placeLab(hLab, sy(lp(A / (M - kEdge + 1))) + 18, op(st.h, 3));

    // Dots
    dots.forEach(function (dt, i) {
      var r0 = SC[0].rank[i] + 1, r1 = SC[1].rank[i] + 1, w = ease(clamp(st.sc));
      var x = sx(lerp(r0, r1, w)), y = sy(lerp(lp(SC[0].p[i]), lp(SC[1].p[i]), w));
      var real = sc === 1 && REAL[i], rej = rejects(sc, proc, i, st.hw);
      dt.dot.setAttribute('cx', x); dt.dot.setAttribute('cy', y);
      dt.dot.setAttribute('fill', real ? BLUE : '#ffffff');
      dt.dot.setAttribute('stroke', real ? BLUE : INK);
      dt.ring.setAttribute('cx', x); dt.ring.setAttribute('cy', y);
      dt.ring.setAttribute('stroke', REAL[i] && sc === 1 ? BLUE : RED);
      dt.ring.setAttribute('opacity', rej ? 1 : 0);
      var named = i === G || real;
      dt.lab.setAttribute('x', x + 20); dt.lab.setAttribute('y', y + 6);
      dt.lab.setAttribute('fill', real ? BLUE : INK);
      dt.lab.textContent = named ? d.beans[i] : '';
      dt.lab.setAttribute('opacity', i === G ? 1 : z);  // the real effects bunch up until the zoom
      // Notes: false positives, missed effects, and where Holm stops
      var note = '', col = RED, r = SC[sc].rank[i];
      if (proc && rej && !real) note = 'false positive';
      else if (proc && real && !rej && (proc !== 3 || st.hw > r)) { note = 'missed'; col = BLUE; }
      else if (proc === 3 && r === SC[sc].stop && st.hw > r + 0.5) { note = 'stop'; col = GOLD; }
      dt.note.setAttribute('x', x - 10); dt.note.setAttribute('y', y - 20);
      dt.note.setAttribute('fill', col); dt.note.textContent = note;
    });

    // Scoreboard
    rows.forEach(function (row, j) {
      var on = BOARD[S.idx][j], n = 0, fp = 0, miss = 0;
      dots.forEach(function (_, i) {
        var rj = rejects(sc, j + 1, i, M + 1);
        if (rj) n++;
        if (rj && !(sc === 1 && REAL[i])) fp++;
        if (sc === 1 && REAL[i] && !rj) miss++;
      });
      row.b.textContent = n + ' rejected' + (fp ? ', ' + fp + ' false' : '') + (miss ? ', ' + miss + ' missed' : '');
      row.a.setAttribute('opacity', on); row.b.setAttribute('opacity', on);
    });
    gB.setAttribute('opacity', 1 - z);
    legend.setAttribute('opacity', sc);
  }

  // ---- Stepping (one stage per .hm-step fragment) ----------------------------
  var cur = -1, raf = null;
  function disc(s) { return { sc: STAGES[s].sc, proc: STAGES[s].proc, idx: s }; }
  function goTo(s, animate) {
    s = Math.max(0, Math.min(STAGES.length - 1, s));
    if (raf) { cancelAnimationFrame(raf); raf = null; render(STAGES[cur], disc(cur)); }
    if (s === cur) return;
    var prev = cur;
    cur = s;
    if (!animate || prev < 0 || Math.abs(s - prev) !== 1) { render(STAGES[s], disc(s)); return; }
    var P = STAGES[prev], Q = STAGES[s], dur = DUR[Math.max(s, prev)], t0 = null;
    raf = requestAnimationFrame(function frame(now) {
      if (t0 === null) t0 = now;
      var e = Math.min(1, (now - t0) / dur), st = {};
      for (var k in P) st[k] = k === 'hw' ? lerp(P[k], Q[k], e) : lerp(P[k], Q[k], ease(e));
      st.sc = lerp(P.sc, Q.sc, e);                 // eased inside render
      render(st, disc(e < 0.5 && Q.hw <= P.hw ? prev : s));
      raf = e < 1 ? requestAnimationFrame(frame) : null;
    });
  }

  // Reveal wiring, as in the week 7 CLT animation
  var slide = el.closest('section');
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.hm-step.visible').length : 0;
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
  render(STAGES[0], disc(0));
  goTo(fragmentStage(), false);
}
