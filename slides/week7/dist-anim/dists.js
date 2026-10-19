function (el, cfg, opts) {
  // Cycles through densities that share a mean (0) and variance (1), from
  // dists.json (built by make_dists.R). The curve morphs from one density to
  // the next on a common grid while the markers for the mean (dashed line)
  // and one SD either side (bar under the axis) stay put. Plays on a loop
  // while its slide is showing and pauses otherwise; inside a fragment it
  // starts over from the first density each time the fragment appears.
  // opts.maxHeight caps the drawing's height on the slide, in px.
  var NS = 'http://www.w3.org/2000/svg';
  var BLUE = '#0479a8', INK = '#333333';
  var P = { x0: 80, x1: 920, y0: 420, y1: 60, xlim: [-4, 4], ymax: 0.75 };
  var HOLD = 2200, MORPH = 1300;
  var xs = cfg.x, ys = cfg.names.map(function (nm) { return cfg.y[nm]; }), K = ys.length;

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function sx(v) { return P.x0 + (v - P.xlim[0]) / (P.xlim[1] - P.xlim[0]) * (P.x1 - P.x0); }
  function sy(v) { return P.y0 - v / P.ymax * (P.y0 - P.y1); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  opts = opts || {};
  var svg = mk('svg', { viewBox: '50 40 900 415', role: 'img',   // cropped to the plot
                        'aria-label': 'A density curve that changes shape while its mean and standard deviation stay the same',
                        style: 'width: 100%; height: auto; max-height: ' + (opts.maxHeight || 560) + 'px; display: block; margin: 0 auto;' }, el);
  var area = mk('path', { fill: BLUE, 'fill-opacity': 0.18, stroke: 'none' }, svg);
  var curve = mk('path', { fill: 'none', stroke: BLUE, 'stroke-width': 4, 'stroke-linejoin': 'round' }, svg);
  mk('line', { x1: P.x0, x2: P.x1, y1: P.y0, y2: P.y0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  mk('line', { x1: sx(0), x2: sx(0), y1: P.y0, y2: P.y1, stroke: INK, 'stroke-width': 2.5, 'stroke-dasharray': '12 8' }, svg);
  mk('line', { x1: sx(-1), x2: sx(1), y1: P.y0 + 22, y2: P.y0 + 22, stroke: '#9a9a9a', 'stroke-width': 10,
               'stroke-linecap': 'round' }, svg);

  // Draw the point t of the way from density a to density b
  function draw(a, b, t) {
    var pts = xs.map(function (x, i) {
      return sx(x).toFixed(1) + ' ' + sy(ys[a][i] + (ys[b][i] - ys[a][i]) * t).toFixed(1);
    });
    curve.setAttribute('d', 'M' + pts.join('L'));
    area.setAttribute('d', 'M' + sx(xs[0]) + ' ' + P.y0 + 'L' + pts.join('L') + 'L' + sx(xs[xs.length - 1]) + ' ' + P.y0 + 'Z');
  }

  // Hold each density, then morph to the next; loop
  var raf = null, t0 = null;
  function frame(now) {
    if (t0 === null) t0 = now;
    var e = (now - t0) % (K * (HOLD + MORPH)), k = Math.floor(e / (HOLD + MORPH)), r = e - k * (HOLD + MORPH);
    draw(k, (k + 1) % K, r < HOLD ? 0 : ease((r - HOLD) / MORPH));
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf) { t0 = null; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } draw(0, 0, 0); }

  // Reveal wiring: run only while this slide is showing
  var slide = el.closest('section');
  ['ready', 'slidechanged'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (e.currentSlide === slide) start(); else stop();
    });
  });
  var frag = el.closest('.fragment');
  if (frag) document.addEventListener('fragmentshown', function (e) {
    if (e.fragment === frag) t0 = null;
  });
  draw(0, 0, 0);
  if (window.Reveal && Reveal.getCurrentSlide && Reveal.getCurrentSlide() === slide) start();
}
