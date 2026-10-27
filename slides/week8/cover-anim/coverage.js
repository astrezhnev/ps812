function (el, d) {
  // Coverage of repeated 95% intervals, in the visual language of the week 8
  // darts-and-rings animation. A dashed line marks the truth mu; intervals
  // from repeated samples fall into place one per column, turning blue if
  // they cover mu and red if they miss, while a count tallies the share that
  // cover. Then the covering ones fade back so the misses stand out, and
  // finally the colors and the truth fade away and one interval is picked
  // out as "ours": in practice we see one interval, not its color. Data from
  // the ci-sim chunk of week8_inference.qmd (mu, lower, upper, covers, ours,
  // and optionally n, shown above the tally).
  // One stage per .cv-step fragment; stepping backwards runs each transition
  // in reverse.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 500;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GREY = '#9a9a9a';
  var X0 = 70, X1 = 850, Y0 = 470, Y1 = 30;       // plot box
  var TX = 935;                                    // tally
  var N = d.lower.length;
  var lo = Math.min.apply(null, d.lower), hi = Math.max.apply(null, d.upper), pad = 0.06 * (hi - lo);
  lo -= pad; hi += pad;

  // Stages: truth alone, one interval, 20, all 100, misses highlighted, ours
  var STAGES = [
    { one: 0, few: 0, rest: 0, dim: 0, ours: 0 },
    { one: 1, few: 0, rest: 0, dim: 0, ours: 0 },
    { one: 1, few: 1, rest: 0, dim: 0, ours: 0 },
    { one: 1, few: 1, rest: 1, dim: 0, ours: 0 },
    { one: 1, few: 1, rest: 1, dim: 1, ours: 0 },
    { one: 1, few: 1, rest: 1, dim: 1, ours: 1 }
  ];
  var DUR = [0, 1100, 2600, 4200, 900, 1500];
  var EASED = { dim: 1, ours: 1 };                 // the rest are eased per interval
  var FEW = 20;

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
  function px(i) { return X0 + (i + 0.5) * (X1 - X0) / N; }
  function py(v) { return Y0 - (v - lo) / (hi - lo) * (Y0 - Y1); }
  // Which transition interval i falls in, and when within it
  function fall(st, i) {
    if (i === 0) return win(st.one, 0, 0.7);
    var k = i < FEW ? 'few' : 'rest', a = i < FEW ? 1 : FEW, b = i < FEW ? FEW - 1 : N - 1;
    var s = 0.85 * (i - a) / Math.max(1, b - a);
    return win(st[k], s, s + 0.15);
  }

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'Confidence intervals from repeated samples fall into place; about 95 in 100 cover the truth, and in practice we see only one of them',
                        style: 'width: 100%; height: auto; max-height: 540px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  var truth = mk('g', {}, svg);
  mk('line', { x1: X0 - 10, x2: X1 + 10, y1: py(d.mu), y2: py(d.mu), stroke: INK, 'stroke-width': 2.5,
               'stroke-dasharray': '12 8' }, truth);
  var lab = mk('text', { x: X0 - 22, y: py(d.mu) + 9, 'text-anchor': 'end', 'font-size': 28, fill: INK }, truth);
  mk('tspan', { 'font-style': 'italic' }, lab).textContent = 'μ';
  mk('line', { x1: X0 - 10, x2: X1 + 10, y1: Y0 + 12, y2: Y0 + 12, stroke: INK, 'stroke-width': 2.5,
               'stroke-linecap': 'round' }, svg);

  var gInt = mk('g', {}, svg);
  var bars = d.lower.map(function (l, i) {
    return mk('line', { x1: px(i), x2: px(i), 'stroke-width': 4, 'stroke-linecap': 'round' }, gInt);
  });
  var ourBar = bars[d.ours - 1];

  var tally = mk('g', {}, svg);
  var count = mk('text', { x: TX, y: py(d.mu) - 10, 'text-anchor': 'middle', 'font-size': 34, fill: BLUE }, tally);
  var denom = mk('text', { x: TX, y: py(d.mu) + 34, 'text-anchor': 'middle', 'font-size': 24, fill: GREY }, tally);
  if (d.n) {                                       // flag the sample size when it isn't the usual one
    var nLab = mk('text', { x: TX, y: Y1 + 10, 'text-anchor': 'middle', 'font-size': 30, fill: INK }, svg);
    mk('tspan', { 'font-style': 'italic' }, nLab).textContent = 'n';
    mk('tspan', {}, nLab).textContent = ' = ' + d.n;
  }

  function render(st) {
    var shown = 0, cov = 0, dm = st.dim, ou = st.ours;
    bars.forEach(function (b, i) {
      var f = fall(st, i), t = ease(f), drop = (1 - t) * 260;
      var mine = b === ourBar, c = d.covers[i];
      b.setAttribute('y1', (py(d.upper[i]) - drop).toFixed(1));
      b.setAttribute('y2', (py(d.lower[i]) - drop).toFixed(1));
      b.setAttribute('stroke', f < 1 ? INK : ou > 0.5 ? (mine ? INK : GREY) : c ? BLUE : RED);
      var op = f > 0 ? (f < 1 ? 0.6 : 1) : 0;
      op *= lerp(1, c ? 0.3 : 1, dm);              // covering ones fade back
      op = lerp(op, mine ? 1 : 0.18, ou);          // then everything but ours
      b.setAttribute('opacity', op.toFixed(3));
      b.setAttribute('stroke-width', mine ? lerp(4, 7, ou) : 4);
      if (f >= 1) { shown++; if (c) cov++; }
    });
    truth.setAttribute('opacity', 1 - 0.85 * ou);
    count.textContent = cov;
    denom.textContent = 'of ' + shown;
    tally.setAttribute('opacity', shown ? 1 - ou : 0);
  }

  // ---- Stepping (one stage per .cv-step fragment) ----------------------------
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

  // Reveal wiring, as in the darts-and-rings animation
  var slide = el.closest('section');
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.cv-step.visible').length : 0;
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
