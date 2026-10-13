function (el, pop, opts) {
  // Population -> outcome -> estimand -> sample -> sampling distribution, shared
  // by the week 6 slides "Defining the population", "Defining the estimand",
  // "Sampling design", "Estimators are random variables", "Unbiasedness of the
  // sample mean" and "Sampling variance of the sample mean". Every slide draws
  // the same synthetic population from population.json (built by
  // make_population.R) and steps through its own run of the keyframes below,
  // so each slide picks up where the previous one left off:
  //
  //   outline   the U.S. outline
  //   grey      a grey square pops in for every unit
  //   colored   each square pops to blue (Y_i = 1) or red (Y_i = 0)
  //   pie       copies of the squares fly into a pie of the population share,
  //             leaving the originals in place, along a faint arrow
  //   pieSmall  the pie shrinks to hover above the map
  //   selected  the units in the first simple random sample are picked out
  //   sampled   copies of the sampled units fly into a sample box
  //
  // then, for repeated sample r = 1, 2, ... of the first sample size
  // (keyframes "r:phase"; "k.r:phase" for the k-th sample size):
  //
  //   r:start   nothing of sample r yet (the same picture as (r-1):gone)
  //   r:sel     sample r is picked out on the map
  //   r:samp    copies of sample r fly into the sample box
  //   r:cmp     the map and box shrink left to make room (only used for r = 1)
  //   r:spie    copies of the sample fly into a pie of the sample share
  //   r:sdone   the sample pie shrinks into slot r of a column on the right
  //   r:gone    the sample vanishes, leaving its pie in the column
  //
  // then, once every sample of the first size is filed:
  //
  //   hfade     the map, units and sample box fade out; the population pie
  //             moves to the centre and grows
  //   hist      a baseline draws in, the population pie rises above it, and
  //             the sample pies drop onto it at their sample means, stacking
  //             like a histogram
  //   hlines    a dashed line marks the truth under the population pie and
  //             dotted lines mark where the sample means fall
  //   havg      copies of the dotted lines slide together to the average of
  //             the sample means and merge into one solid line, which lands
  //             (almost) on the dashed line at the truth
  //
  // and, to compare sample sizes:
  //
  //   m0        the histogram shrinks into the top row of a stack of rows
  //   back.k    the rows fade and the map returns, ready to sample at the
  //             next size (k is the size just finished, 1-based)
  //   hist.k    the map fades, earlier rows return, and the size-k sample
  //             pies drop into row k
  //   bands     a bar under each row spans its sample means
  //
  // Each keyframe is a full state; moving between neighbouring keyframes tweens
  // every quantity that differs, so stepping backwards runs the same animation
  // in reverse. opts.stages lists the slide's keyframes: the first is where the
  // slide starts, and each later entry is one click, either a keyframe name or
  // {chain: [names], speed: s} to play several keyframes on one click.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 560;
  var BLUE = '#0479a8', RED = '#c5050c', GREY = '#bdbdbd', INK = '#333333', GOLD = '#d9a21b';
  var SETS = pop.sets, NSET = SETS.length, REPS = SETS[0].samples.length;
  var N = pop.x.length, SQ = pop.cell - 1.8;
  var NMAX = Math.max.apply(null, SETS.map(function (st) { return st.n; }));
  var PIE_BIG = { x: 800, y: 300, r: 150 }, PIE_SMALL = { x: 250, y: 62, r: 40 };
  var MAP_C = { x: 330, y: 300 };                  // where the arrows leave the map
  var BOX0 = { x: 670, y: 170, s: 260 }, BOX1 = { x: 530, y: 250, s: 190 };   // sample box, before/after cmp
  var WORLD1 = { s: 0.82, x: 3.6, y: 44 };         // map, population pie: shrunk left
  var SPIE = { x: 745, y: 122, r: 72 };            // where each sample's pie forms: up and right of the box
  function slot(r) { return { x: 912, y: 40 + 52 * r, r: 22 }; }
  var CENTER = { x: 500, y: 270, r: 130 };         // population pie, centre stage
  var AXIS = { y: 470, x0: 90, x1: 910, scale: 1680 };   // px per unit share, centred on mu
  var HPOP = { x: 500, y: 92, r: 60 }, HR = 26, HGAP = 56;  // one histogram: population pie, pies, stacking
  var MPOP = { x: 500, y: 44, r: 30 }, ROWY = [205, 365, 525], RM = 11, MGAP = 24, MSCALE = 2400;  // stacked rows

  var BASE = { out: 0, pop: 0, col: 0, fly: 0, pie: 0, small: 0, dim: 0, set: 0, R: 0,
               sel: 0, samp: 0, cmp: 0, spie: 0, sdone: 0, gone: 0,
               hf: 0, hp: 0, hh: 0, hl: 0, ha: 0, ml: 0, nobox: 0, bd: 0 };
  function S(o) { var s = {}, k; for (k in BASE) s[k] = BASE[k]; for (k in o) s[k] = o[k]; return s; }
  function with_(s, o) { var t = S(s); for (var k in o) t[k] = o[k]; return t; }
  var NAMED = {
    outline:  S({ out: 1 }),
    grey:     S({ out: 1, pop: 1 }),
    colored:  S({ out: 1, pop: 1, col: 1 }),
    pie:      S({ out: 1, pop: 1, col: 1, fly: 1, pie: 1 }),
    pieSmall: S({ out: 1, pop: 1, col: 1, fly: 1, pie: 1, small: 1 }),
    selected: S({ out: 1, pop: 1, col: 1, fly: 1, pie: 1, small: 1, dim: 1, sel: 1 }),
    sampled:  S({ out: 1, pop: 1, col: 1, fly: 1, pie: 1, small: 1, dim: 1, sel: 1, samp: 1 })
  };
  var PHASES = ['start', 'sel', 'samp', 'cmp', 'spie', 'sdone', 'gone'];
  function stateOf(name) {
    if (NAMED[name]) return NAMED[name];
    var H1 = ['hfade', 'hist', 'hlines', 'havg'].indexOf(name);
    if (H1 >= 0) return with_(stateOf(REPS + ':sdone'),
      { hf: 1, hp: 1, hh: H1 >= 1 ? 1 : 0, hl: H1 >= 2 ? 1 : 0, ha: H1 >= 3 ? 1 : 0 });
    if (name === 'm0') return with_(stateOf('havg'), { ml: 1 });
    if (name === 'bands') return with_(stateOf('hist.' + NSET), { bd: 1 });
    var dot = name.split('.');
    if (dot[0] === 'hist') {
      var k = +dot[1];
      return with_(stateOf(k + '.' + REPS + ':sdone'), { hf: 1, hp: 1, hh: 1, hl: 1, ha: 1 });
    }
    if (dot[0] === 'back') {
      var kb = +dot[1];
      return with_(kb === 1 ? stateOf('m0') : stateOf('hist.' + kb), { hf: 0, hp: 0, nobox: 1, gone: 1 });
    }
    // Sampling rounds: "r:phase" (first size) or "k.r:phase"
    var m = name.split(':'), ph = PHASES.indexOf(m[1]), sr = m[0].split('.');
    var set = sr.length > 1 ? +sr[0] - 1 : 0, r = +sr[sr.length - 1] - 1;
    var s = S(NAMED.pieSmall);
    s.set = set; s.R = r; s.dim = 1; s.cmp = 1;
    s.sel = ph >= 1 ? 1 : 0; s.samp = ph >= 2 ? 1 : 0;
    s.spie = ph >= 4 ? 1 : 0; s.sdone = ph >= 5 ? 1 : 0; s.gone = ph >= 6 ? 1 : 0;
    if (set > 0) { s.ml = 1; s.hl = 1; s.ha = 1; }
    return s;
  }
  // Part of a transition (0-1) over which each quantity moves
  var WIN = { out: [0, 1], pop: [0, 1], col: [0, 1], fly: [0, 0.8], pie: [0.72, 1],
              small: [0, 1], dim: [0, 1], sel: [0, 0.8], samp: [0.15, 1], cmp: [0, 1],
              spie: [0, 0.75], sdone: [0, 1], gone: [0, 1],
              hf: [0, 0.6], hp: [0.25, 1], hh: [0.25, 1], hl: [0, 1], ha: [0, 1],
              ml: [0, 1], nobox: [0, 0.3], bd: [0, 1] };
  var SOLID = [0.7, 1];                            // a pie fades in over its copies
  var DUR = { outline: 800, grey: 1800, colored: 1500, pie: 2800, pieSmall: 1200,
              selected: 1100, sampled: 2400,
              start: 0, sel: 900, samp: 1600, cmp: 1100, spie: 1900, sdone: 1100, gone: 700,
              hfade: 1500, hist: 3000, hlines: 1600, havg: 2000,
              m0: 1600, back: 1500, bands: 1800 };
  var STAG = 0.3;                                  // each unit's share of the window

  // Seeded random numbers, so every slide lays the population out the same way
  var seed = 812;
  function rand() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function backOut(t) { var c = 1.9; return t <= 0 ? 0 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(c0, c1, t) {
    if (t <= 0) return c0;
    if (t >= 1) return c1;
    var a = rgb(c0), b = rgb(c1);
    return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(lerp(a[i], b[i], t)); }).join(',') + ')';
  }
  function tr(x, y, k) {
    return 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')' + (k === undefined ? '' : ' scale(' + k.toFixed(3) + ')');
  }
  function avg(v) { return v.reduce(function (a, b) { return a + b; }, 0) / v.length; }

  // Per-unit start delays for the staggered quantities (draw order matters:
  // it keeps the earlier slides' layout fixed)
  var D = {};
  ['pop', 'col', 'fly', 'sel'].forEach(function (k) {
    D[k] = []; for (var i = 0; i < N; i++) D[k].push(rand());
  });
  var Dsamp = [[SETS[0].samples[0].map(function () { return rand(); })]];

  // Spread copies over the wedges of a pie: blue over the blue share
  // (clockwise from twelve o'clock), red over the rest
  function pieTargets(ids, share, c, r0) {
    var out = new Array(ids.length), blue = [], red = [];
    ids.forEach(function (i, j) { (pop.v[i] ? blue : red).push(j); });
    function place(js, a0, a1) {
      js.forEach(function (j, r) {
        var th = a0 + (a1 - a0) * (r + rand()) / js.length;
        var rr = r0 * 0.94 * Math.sqrt(0.04 + 0.96 * rand());
        out[j] = { x: c.x + rr * Math.sin(th), y: c.y - rr * Math.cos(th) };
      });
    }
    place(blue, 0, 2 * Math.PI * share);
    place(red, 2 * Math.PI * share, 2 * Math.PI);
    return out;
  }
  var mu = pop.mu, all = [];
  for (var i0 = 0; i0 < N; i0++) all.push(i0);
  var target = pieTargets(all, mu, PIE_BIG, PIE_BIG.r);

  // Repeated samples at each size: membership, delays and pie targets
  var member = [], Dspie = [], spieT = [];
  SETS.forEach(function (st, s) {
    member.push([]); Dspie.push([]); spieT.push([]);
    if (s > 0) Dsamp.push([]);
    st.samples.forEach(function (ids, r) {
      var m = new Int16Array(N).fill(-1);
      ids.forEach(function (i, j) { m[i] = j; });
      member[s].push(m);
      if (s > 0 || r > 0) Dsamp[s].push(ids.map(function () { return rand(); }));
      Dspie[s].push(ids.map(function () { return rand(); }));
      spieT[s].push(pieTargets(ids, st.ybar[r], SPIE, SPIE.r));
    });
  });

  // Sample box for each size: 5 across for 25, 10 across above that
  function boxFor(s, c) {
    var n = SETS[s].n, cols = n <= 25 ? 5 : 10;
    if (s === 0) {
      var side = lerp(BOX0.s, BOX1.s, c), cl = side / cols;
      return { x: lerp(BOX0.x, BOX1.x, c), y: lerp(BOX0.y, BOX1.y, c), w: side, h: side, cols: cols, cell: cl };
    }
    var cell = BOX1.s / cols, h = Math.ceil(n / cols) * cell;
    return { x: BOX1.x, y: BOX1.y + (BOX1.s - h) / 2, w: BOX1.s, h: h, cols: cols, cell: cell };
  }

  // ---- Scene ---------------------------------------------------------------
  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'A population of units on a map of the United States, their outcomes, the population share, and repeated random samples of several sizes with their sample shares',
                        style: 'width: 100%; height: auto; max-height: 580px; display: block; font-family: inherit;' }, el);

  function arrow(parent) {
    var g = mk('g', { 'pointer-events': 'none' }, parent);
    var p = mk('path', { fill: 'none', stroke: INK, 'stroke-width': 14, 'stroke-linecap': 'round',
                         pathLength: 1, 'stroke-dasharray': '1 1' }, g);
    var h = mk('polygon', { fill: INK }, g);
    return { g: g, p: p, h: h };
  }
  // Arrow from P0 into a target, either a circle {x, y, r} or a rectangle
  // {x, y, w, h}: a symmetric curve that bows by `bend` radians in the middle
  // (positive bows to the left of the direction of travel) and ends heading
  // straight at the target's centre, its tip just short of the edge. Drawn the
  // fraction t of the way.
  var HEAD = 24, HEADW = 17, GAP = 8;
  function unit(dx, dy) { var L = Math.sqrt(dx * dx + dy * dy) || 1; return { x: dx / L, y: dy / L }; }
  function rot(v, a) { var c = Math.cos(a), s = Math.sin(a); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; }
  function setArrow(a, P0, tgt, bend, t, alpha) {
    var circ = tgt.r !== undefined;
    var c = circ ? { x: tgt.x, y: tgt.y } : { x: tgt.x + tgt.w / 2, y: tgt.y + tgt.h / 2 };
    var dEnd = rot(unit(c.x - P0.x, c.y - P0.y), bend);
    var R = circ ? tgt.r : Math.min(tgt.w / 2 / (Math.abs(dEnd.x) || 1e-9), tgt.h / 2 / (Math.abs(dEnd.y) || 1e-9));
    var P1 = { x: c.x - dEnd.x * (R + GAP + HEAD), y: c.y - dEnd.y * (R + GAP + HEAD) };
    var L = Math.sqrt((P1.x - P0.x) * (P1.x - P0.x) + (P1.y - P0.y) * (P1.y - P0.y)) / 3;
    var dStart = rot(unit(P1.x - P0.x, P1.y - P0.y), -bend);
    var C1 = { x: P0.x + dStart.x * L, y: P0.y + dStart.y * L }, C2 = { x: P1.x - dEnd.x * L, y: P1.y - dEnd.y * L };
    a.g.setAttribute('opacity', t > 0 ? alpha : 0);
    a.p.setAttribute('d', 'M' + P0.x.toFixed(1) + ' ' + P0.y.toFixed(1) + 'C' + C1.x.toFixed(1) + ' ' + C1.y.toFixed(1) + ' ' +
                          C2.x.toFixed(1) + ' ' + C2.y.toFixed(1) + ' ' + P1.x.toFixed(1) + ' ' + P1.y.toFixed(1));
    a.p.setAttribute('stroke-dashoffset', 1 - t);
    var v = 1 - t, b0 = v * v * v, b1 = 3 * v * v * t, b2 = 3 * v * t * t, b3 = t * t * t;
    var x = b0 * P0.x + b1 * C1.x + b2 * C2.x + b3 * P1.x, y = b0 * P0.y + b1 * C1.y + b2 * C2.y + b3 * P1.y;
    var tan = unit(3 * v * v * (C1.x - P0.x) + 6 * v * t * (C2.x - C1.x) + 3 * t * t * (P1.x - C2.x),
                   3 * v * v * (C1.y - P0.y) + 6 * v * t * (C2.y - C1.y) + 3 * t * t * (P1.y - C2.y));
    a.h.setAttribute('points', [[x + tan.x * HEAD, y + tan.y * HEAD], [x - tan.y * HEADW, y + tan.x * HEADW],
                                [x + tan.y * HEADW, y - tan.x * HEADW]]
      .map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' '));
  }
  function wedge(c, r, a0, a1) {
    if (a1 - a0 >= 2 * Math.PI - 1e-9) return 'M' + (c.x - r) + ' ' + c.y + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + -2 * r + ' 0Z';
    if (a1 - a0 <= 1e-9) return '';
    var p = function (a) { return (c.x + r * Math.sin(a)).toFixed(2) + ' ' + (c.y - r * Math.cos(a)).toFixed(2); };
    return 'M' + c.x + ' ' + c.y + 'L' + p(a0) + 'A' + r + ' ' + r + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + p(a1) + 'Z';
  }
  function setPie(wb, wr, c, r, share) {
    wb.setAttribute('d', wedge(c, r, 0, 2 * Math.PI * share));
    wr.setAttribute('d', wedge(c, r, 2 * Math.PI * share, 2 * Math.PI));
  }

  // The "world": map, population units and the copies that build the
  // population pie, which shrink left together on the repeated-sampling slide
  var world = mk('g', {}, svg);
  var outline = mk('path', { d: pop.outline.join(''), fill: 'none', stroke: INK, 'stroke-width': 1.6,
                             'stroke-linejoin': 'round' }, world);
  var gUnits = mk('g', {}, world);
  var units = pop.x.map(function (x, i) {
    return mk('rect', { x: -SQ / 2, y: -SQ / 2, width: SQ, height: SQ, fill: GREY,
                        transform: tr(x, pop.y[i], 0) }, gUnits);
  });
  // Faint arrow over the map that tracks the copies as they move
  var arrPie = arrow(world);
  var gCopies = mk('g', {}, world);
  var copies = pop.x.map(function (x, i) {
    return mk('rect', { x: -SQ / 2, y: -SQ / 2, width: SQ, height: SQ, fill: pop.v[i] ? BLUE : RED }, gCopies);
  });

  // Sample box, the current sample's copies, its pie and the column of pies
  var arrSamp = arrow(svg), arrSpie = arrow(svg);
  var boxRect = mk('rect', { fill: '#FFFFFF', stroke: INK, 'stroke-width': 2 }, svg);
  var gSamp = mk('g', {}, svg), gSpCopies = mk('g', {}, svg), sampEls = [], spEls = [];
  for (var j0 = 0; j0 < NMAX; j0++) {
    sampEls.push(mk('rect', { x: -SQ / 2, y: -SQ / 2, width: SQ, height: SQ }, gSamp));
    spEls.push(mk('rect', { x: -SQ / 2, y: -SQ / 2, width: SQ, height: SQ }, gSpCopies));
  }

  // Histogram: baselines, a dashed line at the truth, dotted lines at the
  // first size's sample means (one per distinct value), the gold average, and
  // a bar under each row spanning its sample means
  var gHist = mk('g', {}, svg);
  var axes = SETS.map(function () {
    return mk('line', { stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, gHist);
  });
  var bands = SETS.map(function () {
    return mk('line', { stroke: '#9a9a9a', 'stroke-width': 10, 'stroke-linecap': 'round' }, gHist);
  });
  var avgLine = mk('line', { stroke: GOLD, 'stroke-width': 7, 'stroke-linecap': 'round' }, gHist);
  var muLine = mk('line', { stroke: INK, 'stroke-width': 2.5, 'stroke-dasharray': '12 8' }, gHist);
  function hx(v) { return CENTER.x + (v - mu) * AXIS.scale; }
  function mx(v) { return CENTER.x + (v - mu) * MSCALE; }
  var ybar0 = SETS[0].ybar;
  var stackOf = [], tops = {};
  ybar0.forEach(function (v) {
    var key = v.toFixed(6);
    tops[key] = (tops[key] === undefined ? -1 : tops[key]) + 1;
    stackOf.push(tops[key]);
  });
  var dotLines = Object.keys(tops).map(function (key, q) {
    return { x: hx(+key), top: HPOP.y + HPOP.r + 8, d: q / Object.keys(tops).length,
             el: mk('line', { stroke: '#777777', 'stroke-width': 3.5, 'stroke-linecap': 'round',
                              'stroke-dasharray': '0.1 9' }, gHist) };
  });
  // Copies of each sample's dotted line that slide to the average
  var avgMean = avg(ybar0);
  var ghosts = ybar0.map(function () {
    return mk('line', { stroke: GOLD, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-dasharray': '0.1 9' }, gHist);
  });
  function histPos(r) { return { x: hx(ybar0[r]), y: AXIS.y - HR - 4 - stackOf[r] * HGAP, r: HR }; }
  // Stacked rows: pies sit at their sample means and stack only where they
  // would overlap, as in a dot plot
  var rowLevel = SETS.map(function (st) {
    var placed = [];
    return st.ybar.map(function (v) {
      var x = mx(v), L = 0;
      while (placed.some(function (q) { return q.L === L && Math.abs(q.x - x) < 2 * RM + 1; })) L++;
      placed.push({ x: x, L: L });
      return L;
    });
  });
  function rowPos(s, r) { return { x: mx(SETS[s].ybar[r]), y: ROWY[s] - RM - 3 - rowLevel[s][r] * MGAP, r: RM }; }

  var gPie = mk('g', {}, svg);
  var wedgeB = mk('path', { fill: BLUE }, gPie), wedgeR = mk('path', { fill: RED }, gPie);

  var samplePies = SETS.map(function (st) {
    return st.samples.map(function () {
      var g = mk('g', {}, svg);
      return { g: g, b: mk('path', { fill: BLUE }, g), r: mk('path', { fill: RED }, g) };
    });
  });

  // ---- Drawing a state -----------------------------------------------------
  // Draw the point w (0-1) of the way from state lo to state hi (same set and
  // round)
  var drawn = '';
  function render(lo, hi, w, full) {
    function g(k, win) {                         // a quantity shared by all units
      var a = lo[k], b = hi[k];
      if (a === b) return a;
      win = win || WIN[k];
      return lerp(a, b, ease(clamp((w - win[0]) / (win[1] - win[0]))));
    }
    function u(k, d) {                           // one unit's staggered value
      var a = lo[k], b = hi[k];
      if (a === b) return a;
      var W0 = WIN[k], span = W0[1] - W0[0], s0 = W0[0] + d * (1 - STAG) * span;
      return lerp(a, b, clamp((w - s0) / (STAG * span)));
    }
    function changed() {
      for (var q = 0; q < arguments.length; q++) if (full || lo[arguments[q]] !== hi[arguments[q]]) return true;
      return false;
    }
    var set = hi.set, R = hi.R, ST = SETS[set], key = set + '/' + R, newR = full || drawn !== key;
    drawn = key;

    // Layout: the world shrinks left, the box moves to the middle
    var c = g('cmp');
    var ws = lerp(1, WORLD1.s, c), wx = lerp(0, WORLD1.x, c), wy = lerp(0, WORLD1.y, c);
    function screen(p) { return { x: ws * p.x + wx, y: ws * p.y + wy }; }
    world.setAttribute('transform', 'translate(' + wx.toFixed(2) + ' ' + wy.toFixed(2) + ') scale(' + ws.toFixed(4) + ')');
    var box = boxFor(set, c), boxScale = 0.78 * box.cell / SQ;
    function cell(j) { return { x: box.x + box.cell * (j % box.cols + 0.5), y: box.y + box.cell * (Math.floor(j / box.cols) + 0.5) }; }

    outline.setAttribute('opacity', g('out'));
    var hf = g('hf'), nobox = g('nobox'), ml = g('ml');
    world.setAttribute('opacity', 1 - hf);

    // Original units: pop in, pop to their color, then the current sample
    // stands out against the rest
    var dim = g('dim'), gone = g('gone');
    if (newR || changed('pop', 'col', 'dim', 'sel', 'gone')) {
      var mem = member[set][R];
      for (var i = 0; i < N; i++) {
        var p = u('pop', D.pop[i]), cl = u('col', D.col[i]), j = mem[i];
        var raw = j >= 0 ? u('sel', D.sel[i]) : 0, sl = raw * (1 - gone);
        var k = backOut(p) * (1 + 0.7 * Math.sin(Math.PI * cl)) * (1 + 0.9 * Math.sin(Math.PI * raw) + 0.35 * sl);
        var hl = Math.min(1, raw * 3) * (1 - gone);
        var e = units[i];
        e.setAttribute('transform', tr(pop.x[i], pop.y[i], k));
        e.setAttribute('fill', mix(GREY, pop.v[i] ? BLUE : RED, cl));
        e.setAttribute('opacity', (1 - 0.7 * dim * (1 - hl)).toFixed(3));
        e.setAttribute('stroke', sl > 0 ? INK : 'none');
        e.setAttribute('stroke-width', (1.2 * sl).toFixed(2));
      }
    }

    // Population pie: copies fly in, the solid pie fades in over them, it
    // shrinks to hover above the map, then moves to centre stage and up over
    // the histogram (one row) or the stack of rows
    var pieOn = g('pie'), sm = g('small');
    var pw = screen({ x: lerp(PIE_BIG.x, PIE_SMALL.x, sm), y: lerp(PIE_BIG.y, PIE_SMALL.y, sm) });
    var pwr = ws * lerp(PIE_BIG.r, PIE_SMALL.r, sm), hp = g('hp'), hu = g('hh', [0, 0.45]);
    var p1 = { x: lerp(lerp(pw.x, CENTER.x, hp), HPOP.x, hu), y: lerp(lerp(pw.y, CENTER.y, hp), HPOP.y, hu),
               r: lerp(lerp(pwr, CENTER.r, hp), HPOP.r, hu) };
    var p2 = { x: lerp(pw.x, MPOP.x, hp), y: lerp(pw.y, MPOP.y, hp), r: lerp(pwr, MPOP.r, hp) };
    gPie.setAttribute('opacity', pieOn);
    setPie(wedgeB, wedgeR, { x: lerp(p1.x, p2.x, ml), y: lerp(p1.y, p2.y, ml) }, lerp(p1.r, p2.r, ml), mu);
    var flying = lo.fly !== hi.fly || lo.pie !== hi.pie;
    gCopies.setAttribute('display', flying ? 'inline' : 'none');
    if (flying) {
      for (var i2 = 0; i2 < N; i2++) {
        var f = u('fly', D.fly[i2]), t = ease(f);
        copies[i2].setAttribute('transform', tr(lerp(pop.x[i2], target[i2].x, t), lerp(pop.y[i2], target[i2].y, t)));
        copies[i2].setAttribute('opacity', f > 0 ? 1 - pieOn : 0);
      }
    }
    setArrow(arrPie, MAP_C, PIE_BIG, 0.55, clamp(g('fly') * 1.3), 0.35 * (1 - sm));

    // Sample box: fades in with the first sample of each size and stays
    var smp = g('samp'), show = (1 - hf) * (1 - nobox);
    boxRect.setAttribute('x', box.x); boxRect.setAttribute('y', box.y);
    boxRect.setAttribute('width', box.w); boxRect.setAttribute('height', box.h);
    boxRect.setAttribute('opacity', (R > 0 || lo.R > 0 ? 1 : clamp(smp * 4)) * show);
    gSamp.setAttribute('opacity', show);

    // Copies of the current sample fly from the map into the box, and pop
    // out again when the sample is done
    var ids = ST.samples[R];
    if (newR || changed('samp', 'cmp', 'gone')) {
      sampEls.forEach(function (el2, j) {
        if (j >= ids.length) { el2.setAttribute('opacity', 0); return; }
        var i = ids[j], f = u('samp', Dsamp[set][R][j]), t = ease(f), from = screen({ x: pop.x[i], y: pop.y[i] }), to = cell(j);
        if (newR) el2.setAttribute('fill', pop.v[i] ? BLUE : RED);
        el2.setAttribute('transform', tr(lerp(from.x, to.x, t), lerp(from.y, to.y, t),
                                         lerp(ws, boxScale, t) * (1 - gone)));
        el2.setAttribute('opacity', f > 0 && gone < 1 ? 1 : 0);
      });
    }
    setArrow(arrSamp, screen(MAP_C), { x: box.x, y: box.y, w: box.w, h: box.h }, -0.6, clamp(smp * 1.4),
             0.35 * (1 - gone) * show);

    // Copies of the boxed sample fly into a pie of the sample share
    var solid = g('spie', SOLID), sd = g('sdone');
    var spFlying = lo.spie !== hi.spie, spScale = Math.min(3.2, 0.8 * Math.sqrt(Math.PI * SPIE.r * SPIE.r / ST.n) / SQ);
    gSpCopies.setAttribute('display', spFlying ? 'inline' : 'none');
    if (spFlying) {
      spEls.forEach(function (el3, j) {
        if (j >= ids.length) { el3.setAttribute('opacity', 0); return; }
        var i = ids[j], f = u('spie', Dspie[set][R][j]), t = ease(f), from = cell(j), to = spieT[set][R][j];
        el3.setAttribute('fill', pop.v[i] ? BLUE : RED);
        el3.setAttribute('transform', tr(lerp(from.x, to.x, t), lerp(from.y, to.y, t), lerp(boxScale, spScale, t)));
        el3.setAttribute('opacity', f > 0 ? 1 - solid : 0);
      });
    }
    setArrow(arrSpie, { x: box.x + 0.45 * box.w, y: box.y - 10 }, SPIE, 0.5, clamp(g('spie') * 1.4), 0.35 * (1 - sd));

    // Sample pies. Earlier sizes sit in their rows whenever the map is away.
    // For the current size, earlier samples sit in the column; the current
    // one forms, shrinks into its slot, and on "hist" every pie drops into the
    // histogram (one row for the first size, its own row after that)
    samplePies.forEach(function (pies, s) {
      pies.forEach(function (sp, r) {
        if (s > set || (s === set && (r > R || (r === R && solid === 0)))) { sp.g.setAttribute('opacity', 0); return; }
        if (s < set) {
          sp.g.setAttribute('opacity', hf);
          var q0 = rowPos(s, r);
          setPie(sp.b, sp.r, q0, q0.r, SETS[s].ybar[r]);
          return;
        }
        var s0 = slot(r), q = r < R ? 1 : sd;
        var c0 = { x: lerp(SPIE.x, s0.x, q), y: lerp(SPIE.y, s0.y, q), r: lerp(SPIE.r, s0.r, q) };
        var hq = ease(u('hh', r / REPS)), h1 = rowPos(s, r);
        if (s === 0) {
          var hs = histPos(r);
          h1 = { x: lerp(hs.x, h1.x, ml), y: lerp(hs.y, h1.y, ml), r: lerp(hs.r, h1.r, ml) };
        }
        sp.g.setAttribute('opacity', (r < R ? 1 : solid) * (1 - hq * (1 - hf)));
        setPie(sp.b, sp.r, { x: lerp(c0.x, h1.x, hq), y: lerp(c0.y, h1.y, hq) }, lerp(c0.r, h1.r, hq), ST.ybar[r]);
      });
    });
    renderHist(g, set, hf, ml);
  }

  function renderHist(g, set, hf, ml) {
    // Baselines: the current size's draws in on "hist"; earlier ones are
    // already there whenever the map is away
    var ax = g('hh', [0, 0.35]);
    axes.forEach(function (a, s) {
      var y = s === 0 ? lerp(AXIS.y, ROWY[0], ml) : ROWY[s];
      var len = s < set ? 1 : s === set ? ax : 0;
      a.setAttribute('x1', AXIS.x0); a.setAttribute('x2', lerp(AXIS.x0, AXIS.x1, len));
      a.setAttribute('y1', y); a.setAttribute('y2', y);
      a.setAttribute('opacity', len > 0 ? hf : 0);
    });
    // Dashed line at the truth, from the population pie down to the lowest
    // baseline on show
    var hl = g('hl'), x = CENTER.x;
    var top = lerp(HPOP.y + HPOP.r, MPOP.y + MPOP.r, ml) + 8;
    var bottom = set === 0 ? lerp(AXIS.y, ROWY[0], ml) : lerp(ROWY[set - 1], ROWY[set], ax);
    muLine.setAttribute('x1', x); muLine.setAttribute('x2', x);
    muLine.setAttribute('y1', bottom); muLine.setAttribute('y2', lerp(bottom, top, ease(clamp(hl * 1.6))));
    muLine.setAttribute('opacity', hl > 0 ? hf : 0);
    // First size only: dotted lines at the sample means and the gold average
    var one = 1 - ml, ha = g('ha'), slide = ease(clamp(ha / 0.75)), merge = clamp((ha - 0.6) / 0.4);
    var lineTop = HPOP.y + HPOP.r + 8, ax0 = hx(avgMean);
    ghosts.forEach(function (gl, r) {
      var gx = lerp(hx(ybar0[r]), ax0, slide);
      gl.setAttribute('x1', gx); gl.setAttribute('x2', gx);
      gl.setAttribute('y1', AXIS.y); gl.setAttribute('y2', lineTop);
      gl.setAttribute('opacity', ha > 0 ? (1 - merge) * one : 0);
    });
    avgLine.setAttribute('x1', ax0); avgLine.setAttribute('x2', ax0);
    avgLine.setAttribute('y1', AXIS.y); avgLine.setAttribute('y2', lineTop);
    avgLine.setAttribute('opacity', merge * one * hf);
    dotLines.forEach(function (dl) {
      var t = ease(clamp((hl - 0.3 - 0.4 * dl.d) / 0.3));
      dl.el.setAttribute('x1', dl.x); dl.el.setAttribute('x2', dl.x);
      dl.el.setAttribute('y1', AXIS.y); dl.el.setAttribute('y2', lerp(AXIS.y, dl.top, t));
      dl.el.setAttribute('opacity', t > 0 ? one * hf : 0);
    });
    // Bars under each row, growing out from the truth to the most extreme
    // sample means
    var bd = g('bd');
    bands.forEach(function (b, s) {
      var yb = SETS[s].ybar, lo = mx(Math.min.apply(null, yb)), hi = mx(Math.max.apply(null, yb)), y = ROWY[s] + 16;
      b.setAttribute('x1', lerp(x, lo, bd)); b.setAttribute('x2', lerp(x, hi, bd));
      b.setAttribute('y1', y); b.setAttribute('y2', y);
      b.setAttribute('opacity', bd > 0 && s <= set ? hf : 0);
    });
  }

  // ---- Stepping ------------------------------------------------------------
  var kf = [], kspeed = [], clickEnd = [];
  opts.stages.forEach(function (st) {
    var names = typeof st === 'string' ? [st] : st.chain, sp = typeof st === 'string' ? 1 : (st.speed || 1);
    names.forEach(function (nm) { kf.push(nm); kspeed.push(sp); });
    clickEnd.push(kf.length - 1);
  });
  var states = kf.map(stateOf);
  function durOf(k) {
    var nm = kf[k];
    nm = nm.indexOf(':') >= 0 ? nm.split(':')[1] : nm.split('.')[0];
    return DUR[nm] * kspeed[k];
  }

  var curK = -1, curClick = -1, goal = -1, raf = null;
  function jump(k) { curK = goal = k; render(states[k], states[k], 1, true); }
  function playTo(target) {
    goal = target;
    var dir = target > curK ? 1 : -1;
    (function seg() {
      if (curK === target) { raf = null; return; }
      var nxt = curK + dir, lo = states[Math.min(curK, nxt)], hi = states[Math.max(curK, nxt)];
      var dur = lo.set !== hi.set || lo.R !== hi.R ? 0 : durOf(Math.max(curK, nxt));
      if (!dur) { jump(nxt); goal = target; seg(); return; }
      var t0 = null;
      raf = requestAnimationFrame(function frame(now) {
        if (t0 === null) t0 = now;
        var e = Math.min(1, (now - t0) / dur);
        render(lo, hi, dir > 0 ? e : 1 - e);
        if (e < 1) raf = requestAnimationFrame(frame);
        else { curK = nxt; seg(); }
      });
    })();
  }
  function goTo(click, animate) {
    click = Math.max(0, Math.min(clickEnd.length - 1, click));
    if (raf) { cancelAnimationFrame(raf); raf = null; jump(goal); }   // finish the last click at once
    var target = clickEnd[click], prev = curClick;
    curClick = click;
    if (target === curK) return;
    if (!animate || curK < 0 || Math.abs(click - prev) !== 1) jump(target);
    else playTo(target);
  }

  // Reveal wiring, as on the week 4 Datasaurus slide
  var slide = el.closest('section');
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.pop-step.visible').length : 0;
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
      if (e.currentSlide === slide) {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        curK = -1; curClick = -1;
        goTo(fragmentStage(), false);
      }
    });
  });

  jump(0);
  goTo(fragmentStage(), false);
}
