function (el, d) {
  // Many tests under the null, as darts, in the visual language of the week 8
  // interval animations. The N(0, 1) null density (ink) carries a rejection
  // region beyond +/- 1.96 (red). Each jelly bean color from xkcd 882 is one
  // test: its statistic falls onto the axis as a dart in that color, stacking
  // where darts land close together. With no correction, one dart (green)
  // lands in the rejection region by chance, while a bar on the right tracks
  // the family-wise error rate 1 - (1 - alpha)^m, the chance that at least
  // one of the m tests so far is a false positive, against a gold outline at
  // alpha. Then the darts are thrown again under Bonferroni: with m darts
  // thrown the region sits beyond z_{1 - alpha / 2m}, so it widens with
  // every throw and the error rate stays at alpha. Data from make_mt.R
  // (t_null, beans, alpha). One stage per .mt-step fragment; stepping
  // backwards runs each transition in reverse.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 440;
  var RED = '#c5050c', INK = '#333333', GOLD = '#d9a21b', GREY = '#9a9a9a';
  var X0 = 40, X1 = 760, Y0 = 395, Y1 = 115, L = 4, YMAX = 0.42;
  var TX = 830, TW = 140, TMAX = 0.7;              // error-rate bar: TW px for 70%
  var COL = { purple: '#7b3fa0', brown: '#8b5a2b', pink: '#f08cb4', blue: '#3b6fd8', teal: '#2a9d8f',
              salmon: '#f47c6a', red: '#d62728', turquoise: '#3fd0c4', magenta: '#d81b9a', yellow: '#e3be00',
              grey: '#8c8c8c', tan: '#c9a77c', cyan: '#3cc0e6', green: '#2ca02c', mauve: '#b784a7',
              beige: '#d6c49a', lilac: '#b79ad6', black: '#222222', peach: '#f5a97f', orange: '#f28e2b' };
  var A = d.alpha, M = d.beans.length, t = d.t_null, G = d.green - 1;

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, v) { return a + (b - a) * v; }
  function ease(v) { return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; }
  function px(v) { return X0 + (v + L) / (2 * L) * (X1 - X0); }
  function py(v) { return Y0 - v / YMAX * (Y0 - Y1); }
  function npdf(x) { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); }
  function ncdf(x) {                               // Abramowitz and Stegun 7.1.26
    var z = Math.abs(x) / Math.SQRT2, u = 1 / (1 + 0.3275911 * z);
    var e = 1 - u * (0.254829592 + u * (-0.284496736 + u * (1.421413741 + u * (-1.453152027 + u * 1.061405429)))) * Math.exp(-z * z);
    return x < 0 ? (1 - e) / 2 : (1 + e) / 2;
  }
  function nq(p) {                                 // quantile by bisection
    var a = -10, b = 10;
    for (var i = 0; i < 80; i++) { var m = (a + b) / 2; if (ncdf(m) < p) a = m; else b = m; }
    return (a + b) / 2;
  }
  function area(a, b) {
    var p = [px(a).toFixed(1) + ' ' + Y0];
    for (var x = a; x < b; x += 0.02) p.push(px(x).toFixed(1) + ' ' + py(npdf(x)).toFixed(1));
    p.push(px(b).toFixed(1) + ' ' + py(npdf(b)).toFixed(1), px(b).toFixed(1) + ' ' + Y0);
    return 'M' + p.join('L') + 'Z';
  }
  function pval(x) { return 2 * (1 - ncdf(Math.abs(x))); }

  // Where each dart comes to rest: stacked on earlier darts that landed close by
  var R = 8, rest = t.map(function (v, i) {
    var lvl = 0;
    for (var j = 0; j < i; j++) if (Math.abs(px(t[j]) - px(v)) < 2 * R) lvl++;
    return Y0 - R - 2 - lvl * (2 * R + 2);
  });

  // Stages: n darts thrown (continuous), bf = Bonferroni (0 or 1)
  var STAGES = [
    { n: 0,     bf: 0 },
    { n: 1,     bf: 0 },
    { n: G,     bf: 0 },                 // up to just before green
    { n: G + 1, bf: 0 },                 // green
    { n: M,     bf: 0 },
    { n: 0,     bf: 1 },                 // pick the darts back up
    { n: G,     bf: 1 },
    { n: G + 1, bf: 1 },
    { n: M,     bf: 1 }
  ];
  var DUR = [0, 900, 3200, 1300, 2200, 1600, 4200, 1300, 2600];

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'Twenty tests of true null hypotheses thrown as darts: with no correction one lands in the rejection region by chance and the chance of at least one false positive climbs to 64%; under Bonferroni the rejection region widens with each test and the chance stays at 5%',
                        style: 'width: 100%; height: auto; max-height: 480px; display: block; margin: 0 auto; font-family: inherit;' }, el);

  var cap = mk('text', { x: X0, y: 36, 'font-size': 26, 'font-weight': 600, fill: INK }, svg);
  var cap2 = mk('text', { x: X0, y: 66, 'font-size': 21, fill: GREY }, svg);
  var tails = [mk('path', { fill: RED, 'fill-opacity': 0.7 }, svg), mk('path', { fill: RED, 'fill-opacity': 0.7 }, svg)];
  mk('path', { d: area(-L, L), fill: '#0479a8', 'fill-opacity': 0.08 }, svg);
  mk('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  var pts = [];
  for (var v = -L; v <= L + 1e-9; v += 0.02) pts.push(px(v).toFixed(1) + ' ' + py(npdf(v)).toFixed(1));
  mk('path', { d: 'M' + pts.join('L'), fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
  var crit = [-1, 1].map(function (s) {
    return { s: s,
             ln: mk('line', { y1: Y0, y2: Y1 - 20, stroke: RED, 'stroke-width': 2.5, 'stroke-dasharray': '10 7' }, svg),
             lab: mk('text', { y: Y0 + 32, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 600, fill: RED }, svg) };
  });

  // Darts
  var darts = t.map(function (v, i) {
    var g = mk('g', {}, svg);
    return { g: g,
             dot: mk('circle', { cx: px(v), r: R, fill: COL[d.beans[i]] || INK, stroke: '#ffffff', 'stroke-width': 1.5 }, g),
             ring: mk('circle', { cx: px(v), r: R + 6, fill: 'none', stroke: RED, 'stroke-width': 3.5 }, g) };
  });
  // Labels carry a halo in the slide background so lines behind them break
  var HALO = { stroke: '#F7F7F7', 'stroke-width': 6, 'paint-order': 'stroke', 'stroke-linejoin': 'round' };
  function halo(a) { for (var k in HALO) a[k] = HALO[k]; return a; }
  var latest = mk('text', halo({ 'text-anchor': 'middle', 'font-size': 21 }), svg);
  var hitLab = mk('text', halo({ 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 600 }), svg);

  // Family-wise error rate
  var gT = mk('g', {}, svg);
  mk('text', { x: TX, y: 150, 'font-size': 20, fill: INK }, gT).textContent = 'P(at least one';
  mk('text', { x: TX, y: 174, 'font-size': 20, fill: INK }, gT).textContent = 'false positive)';
  var fw = mk('text', { x: TX, y: 228, 'font-size': 38, 'font-weight': 600, fill: RED }, gT);
  mk('rect', { x: TX, y: 250, width: TW, height: 26, fill: 'none', stroke: GREY, 'stroke-width': 1, 'stroke-opacity': 0.5 }, gT);
  var fwBar = mk('rect', { x: TX, y: 254, height: 18, fill: RED, 'fill-opacity': 0.75 }, gT);
  mk('rect', { x: TX, y: 247, width: TW * A / TMAX, height: 32, fill: 'none', stroke: GOLD, 'stroke-width': 3 }, gT);
  var mLab = mk('text', { x: TX, y: 312, 'font-size': 21, fill: GREY }, gT);

  function render(st) {
    var m = Math.max(1, st.n), bfz = nq(1 - A / (2 * m)), z = lerp(nq(1 - A / 2), bfz, st.bf);
    tails[0].setAttribute('d', area(-L, -Math.min(z, L)));
    tails[1].setAttribute('d', area(Math.min(z, L), L));
    crit.forEach(function (c) {
      var x = px(c.s * z);
      c.ln.setAttribute('x1', x); c.ln.setAttribute('x2', x);
      c.lab.setAttribute('x', x); c.lab.textContent = (c.s < 0 ? '−' : '') + z.toFixed(2);
    });
    cap.textContent = st.bf < 0.5 ? 'No correction: reject if |T| > 1.96' : 'Bonferroni: reject if p < α / m';
    cap2.textContent = st.bf < 0.5 ? 'each test on its own at α = ' + A : 'the region widens with every new test';

    var last = -1, hit = -1;
    darts.forEach(function (dt, i) {
      var f = clamp(st.n - i), e = ease(f), y = lerp(40, rest[i], e);
      dt.dot.setAttribute('cy', y.toFixed(1)); dt.ring.setAttribute('cy', y.toFixed(1));
      dt.g.setAttribute('opacity', f > 0 ? 1 : 0);
      var landed = f >= 1, rej = landed && Math.abs(t[i]) > z;
      dt.ring.setAttribute('opacity', rej ? 1 : 0);
      dt.dot.setAttribute('opacity', landed ? (rej ? 1 : 0.8) : 0.6);
      if (f > 0) last = i;
      if (i === G && landed) hit = i;
    });
    // Name the dart in flight (or the last to land), and green once it lands
    if (last >= 0 && last !== G && st.n < M) {
      latest.setAttribute('x', px(t[last])); latest.setAttribute('y', rest[last] - 22);
      latest.setAttribute('fill', COL[d.beans[last]]); latest.textContent = d.beans[last];
      latest.setAttribute('opacity', 1);
    } else latest.setAttribute('opacity', 0);
    if (hit >= 0) {
      var rj = Math.abs(t[G]) > z;
      hitLab.setAttribute('x', px(t[G])); hitLab.setAttribute('y', rest[G] - 34);
      hitLab.setAttribute('fill', rj ? RED : INK);
      hitLab.textContent = 'green: p = ' + pval(t[G]).toFixed(3) + (st.bf > 0.5 ? (rj ? ' < ' : ' > ') + 'α/' + Math.round(m) : '');
      hitLab.setAttribute('opacity', 1);
    } else hitLab.setAttribute('opacity', 0);

    var thrown = Math.floor(st.n + 1e-9), rate = thrown ? 1 - Math.pow(1 - lerp(A, A / thrown, st.bf), thrown) : 0;
    fw.textContent = (100 * rate).toFixed(0) + '%';
    fw.setAttribute('fill', rate > A + 0.005 ? RED : INK);
    fwBar.setAttribute('width', (TW * Math.min(rate, TMAX) / TMAX).toFixed(1));
    mLab.textContent = 'm = ' + thrown + (thrown === 1 ? ' test' : ' tests');
    gT.setAttribute('opacity', thrown ? 1 : 0.35);
  }

  // ---- Stepping (one stage per .mt-step fragment) ----------------------------
  var cur = -1, raf = null;
  function goTo(s, animate) {
    s = Math.max(0, Math.min(STAGES.length - 1, s));
    if (raf) { cancelAnimationFrame(raf); raf = null; render(STAGES[cur]); }
    if (s === cur) return;
    var prev = cur;
    cur = s;
    if (!animate || prev < 0 || Math.abs(s - prev) !== 1) { render(STAGES[s]); return; }
    var P = STAGES[prev], Q = STAGES[s], dur = DUR[Math.max(s, prev)], t0 = null;
    raf = requestAnimationFrame(function frame(now) {
      if (t0 === null) t0 = now;
      var e = Math.min(1, (now - t0) / dur);
      // darts fall one after another at a steady pace; the mode switches at once
      render({ n: lerp(P.n, Q.n, e), bf: P.bf === Q.bf ? Q.bf : (e < 0.5 ? P.bf : Q.bf) });
      raf = e < 1 ? requestAnimationFrame(frame) : null;
    });
  }

  // Reveal wiring, as in the week 7 CLT animation
  var slide = el.closest('section');
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.mt-step.visible').length : 0;
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
