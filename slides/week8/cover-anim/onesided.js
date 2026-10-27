function (el, d) {
  // Two-sided against one-sided 95% intervals from the same repeated samples,
  // side by side, in the visual language of coverage.js. Left: estimate +/-
  // z2 SE; right: everything up to estimate + z1 SE, so its bars run off the
  // bottom of the panel toward -infinity. Each sample's interval falls into
  // place in both panels at once, blue if it covers mu and red if it misses,
  // with a count under each panel; then the covering ones fade back so the
  // misses stand out. Data from the ci-sim chunk of week8_inference.qmd (mu,
  // lower, upper, covers, upper1, covers1, z2, z1). One stage per .os-step
  // fragment; stepping backwards runs each transition in reverse.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 540;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GREY = '#9a9a9a';
  var Y0 = 440, Y1 = 100;                          // plot box, shared by both panels
  var PW = 370, PX = [80, 530];                    // panel width, left edges
  var BOT = Y0 + 40;                               // where the one-sided bars end, past the fade
  var N = d.lower.length;
  var lo = Math.min.apply(null, d.lower), hi = Math.max.apply(null, d.upper), pad = 0.06 * (hi - lo);
  lo -= pad; hi += pad;

  // Stages: truth alone, one interval, 20, all 100, misses highlighted
  var STAGES = [
    { one: 0, few: 0, rest: 0, dim: 0 },
    { one: 1, few: 0, rest: 0, dim: 0 },
    { one: 1, few: 1, rest: 0, dim: 0 },
    { one: 1, few: 1, rest: 1, dim: 0 },
    { one: 1, few: 1, rest: 1, dim: 1 }
  ];
  var DUR = [0, 1100, 2600, 4200, 900];
  var EASED = { dim: 1 };                          // the rest are eased per interval
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
  function py(v) { return Y0 - (v - lo) / (hi - lo) * (Y0 - Y1); }
  // Which transition interval i falls in, and when within it
  function fall(st, i) {
    if (i === 0) return win(st.one, 0, 0.7);
    var k = i < FEW ? 'few' : 'rest', a = i < FEW ? 1 : FEW, b = i < FEW ? FEW - 1 : N - 1;
    var s = 0.85 * (i - a) / Math.max(1, b - a);
    return win(st[k], s, s + 0.15);
  }

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'The same samples give two-sided intervals and one-sided upper bounds; both cover the truth about 95 times in 100, but the one-sided bounds are lower and run down to minus infinity',
                        style: 'width: 100%; height: auto; max-height: 540px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  // The one-sided bars fade out at the bottom of their panel: a mask with a
  // gradient, in user space so it doesn't move with the falling bars
  var uid = 'os' + Math.random().toString(36).slice(2, 8);
  var defs = mk('defs', {}, svg);
  var grad = mk('linearGradient', { id: uid + 'g', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: Y0 - 70, y2: Y0 + 15 }, defs);
  mk('stop', { offset: 0, 'stop-color': '#fff' }, grad);
  mk('stop', { offset: 1, 'stop-color': '#000' }, grad);
  var mask = mk('mask', { id: uid + 'm', maskUnits: 'userSpaceOnUse', x: 0, y: -300, width: W, height: H + 600 }, defs);
  mk('rect', { x: 0, y: -300, width: W, height: H + 600, fill: 'url(#' + uid + 'g)' }, mask);

  var panels = [
    { x0: PX[0], lower: d.lower, upper: d.upper, covers: d.covers,
      title: 'Two-sided', sub: 'estimate ± ' + d.z2 + ' SE' },
    { x0: PX[1], lower: null, upper: d.upper1, covers: d.covers1,
      title: 'One-sided', sub: '−∞ up to estimate + ' + d.z1 + ' SE' }
  ];
  var truth = mk('g', {}, svg);
  panels.forEach(function (p) {
    var cx = p.x0 + PW / 2, col = PW / N;
    mk('text', { x: cx, y: 34, 'text-anchor': 'middle', 'font-size': 28, fill: INK }, svg).textContent = p.title;
    mk('text', { x: cx, y: 68, 'text-anchor': 'middle', 'font-size': 21, fill: GREY }, svg).textContent = p.sub;
    mk('line', { x1: p.x0 - 10, x2: p.x0 + PW + 10, y1: py(d.mu), y2: py(d.mu), stroke: INK, 'stroke-width': 2.5,
                 'stroke-dasharray': '12 8' }, truth);
    var lab = mk('text', { x: p.x0 - 22, y: py(d.mu) + 9, 'text-anchor': 'end', 'font-size': 28, fill: INK }, truth);
    mk('tspan', { 'font-style': 'italic' }, lab).textContent = 'μ';
    var g = mk('g', p.lower ? {} : { mask: 'url(#' + uid + 'm)' }, svg);
    p.bars = p.upper.map(function (u, i) {
      var x = p.x0 + (i + 0.5) * col;
      return mk('line', { x1: x, x2: x, 'stroke-width': Math.min(4, 0.7 * col), 'stroke-linecap': 'round' }, g);
    });
    p.tally = mk('text', { x: cx, y: Y0 + 72, 'text-anchor': 'middle', 'font-size': 24, fill: GREY }, svg);
    p.count = mk('tspan', { 'font-size': 34, fill: BLUE }, p.tally);
    p.denom = mk('tspan', {}, p.tally);
  });
  mk('text', { x: PX[1] + PW + 16, y: Y0 - 4, 'font-size': 26, fill: GREY }, svg).textContent = '↓ −∞';

  function render(st) {
    var shown = 0;
    panels.forEach(function (p) { p.cov = 0; });
    for (var i = 0; i < N; i++) {
      var f = fall(st, i), drop = (1 - ease(f)) * 260;
      var op = f > 0 ? (f < 1 ? 0.6 : 1) : 0;
      if (f >= 1) shown++;
      panels.forEach(function (p) {
        var b = p.bars[i], c = p.covers[i];
        b.setAttribute('y1', (py(p.upper[i]) - drop).toFixed(1));
        b.setAttribute('y2', p.lower ? (py(p.lower[i]) - drop).toFixed(1) : BOT);
        b.setAttribute('stroke', f < 1 ? INK : c ? BLUE : RED);
        b.setAttribute('opacity', (op * lerp(1, c ? 0.3 : 1, st.dim)).toFixed(3));   // covering ones fade back
        if (f >= 1 && c) p.cov++;
      });
    }
    panels.forEach(function (p) {
      p.count.textContent = p.cov;
      p.denom.textContent = ' of ' + shown + ' cover';
      p.tally.setAttribute('opacity', shown ? 1 : 0);
    });
  }

  // ---- Stepping (one stage per .os-step fragment) ----------------------------
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
    return slide ? slide.querySelectorAll('.fragment.os-step.visible').length : 0;
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
