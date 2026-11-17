function (el, d) {
  // Leverage, outliers and influence, by hand. A small scatterplot with its
  // OLS line; one point (red) can be dragged anywhere in the plot. As it moves:
  //   - the solid line is the OLS fit with the red point, the dashed grey line
  //     the fit without it (leave-one-out)
  //   - a thin red segment is its residual from the full fit
  //   - the margin reports its leverage h_ii, residual e_i, leave-one-out
  //     prediction error e_i / (1 - h_ii), DFBETA for the slope and Cook's
  //     distance, each with a bar
  // Data: d.x, d.y (the fixed points), d.px, d.py (where the red point
  // starts), d.xlim, d.ylim. No fragments: the slide is a sandbox.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 480;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GREY = '#9a9a9a', GOLD = '#d9a21b';
  var X0 = 70, X1 = 620, Y0 = 420, Y1 = 30;
  var PX = 680;
  var XL = d.xlim[0], XH = d.xlim[1], YL = d.ylim[0], YH = d.ylim[1];
  var m = d.x.length, n = m + 1;

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function px(v) { return X0 + (v - XL) / (XH - XL) * (X1 - X0); }
  function py(v) { return Y0 - (v - YL) / (YH - YL) * (Y0 - Y1); }
  function ix(p) { return XL + (p - X0) / (X1 - X0) * (XH - XL); }
  function iy(p) { return YL + (Y0 - p) / (Y0 - Y1) * (YH - YL); }
  function f(v, k) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(k); }

  // OLS of y on (1, x)
  function ols(xs, ys) {
    var k = xs.length, mx = 0, my = 0, sxx = 0, sxy = 0;
    for (var i = 0; i < k; i++) { mx += xs[i]; my += ys[i]; }
    mx /= k; my /= k;
    for (i = 0; i < k; i++) { sxx += (xs[i] - mx) * (xs[i] - mx); sxy += (xs[i] - mx) * (ys[i] - my); }
    var b1 = sxy / sxx;
    return { b0: my - b1 * mx, b1: b1, mx: mx, sxx: sxx };
  }

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'A scatterplot with a least squares line and one red point that can be dragged. The margin reports the red point\'s leverage, residual, leave-one-out prediction error, DFBETA for the slope and Cook\'s distance.',
                        style: 'width: 100%; height: auto; max-height: 480px; display: block; margin: 0 auto; font-family: inherit; touch-action: none;' }, el);

  // Axes
  mk('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: INK, 'stroke-width': 2.5 }, svg);
  mk('line', { x1: X0, x2: X0, y1: Y0, y2: Y1, stroke: INK, 'stroke-width': 2.5 }, svg);
  for (var v = XL; v <= XH; v += 2) {
    mk('text', { x: px(v), y: Y0 + 28, 'text-anchor': 'middle', 'font-size': 18, fill: GREY }, svg).textContent = v;
  }
  for (v = YL; v <= YH; v += 2) {
    mk('text', { x: X0 - 12, y: py(v) + 6, 'text-anchor': 'end', 'font-size': 18, fill: GREY }, svg).textContent = v;
  }
  mk('text', { x: (X0 + X1) / 2, y: Y0 + 56, 'text-anchor': 'middle', 'font-size': 22, 'font-style': 'italic', fill: INK }, svg).textContent = 'X';
  mk('text', { x: X0 - 44, y: (Y0 + Y1) / 2, 'text-anchor': 'middle', 'font-size': 22, 'font-style': 'italic', fill: INK }, svg).textContent = 'Y';

  // The mean of X, where leverage is smallest
  var mxLine = mk('line', { y1: Y0, y2: Y1, stroke: GOLD, 'stroke-width': 2, 'stroke-dasharray': '4 6' }, svg);
  var mxLab = mk('text', { y: Y1 + 4, 'text-anchor': 'middle', 'font-size': 18, fill: GOLD }, svg);
  mxLab.textContent = 'mean of X';

  var cl = mk('clipPath', { id: 'infl-clip-' + Math.random().toString(36).slice(2) }, svg);
  mk('rect', { x: X0, y: Y1, width: X1 - X0, height: Y0 - Y1 }, cl);
  var gL = mk('g', { 'clip-path': 'url(#' + cl.id + ')' }, svg);
  var loo = mk('line', { stroke: GREY, 'stroke-width': 3, 'stroke-dasharray': '10 8' }, gL);
  var full = mk('line', { stroke: INK, 'stroke-width': 4 }, gL);
  var res = mk('line', { stroke: RED, 'stroke-width': 2.5 }, svg);

  d.x.forEach(function (x, i) {
    mk('circle', { cx: px(x), cy: py(d.y[i]), r: 7, fill: BLUE, 'fill-opacity': 0.75 }, svg);
  });
  var halo = mk('circle', { r: 22, fill: RED, 'fill-opacity': 0.12 }, svg);
  var dot = mk('circle', { r: 11, fill: RED, stroke: '#fff', 'stroke-width': 2, style: 'cursor: grab;' }, svg);
  mk('text', { x: X1 - 6, y: Y1 + 18, 'text-anchor': 'end', 'font-size': 17, fill: GREY, 'font-style': 'italic' }, svg).textContent = 'drag the red point';

  // Margin readout: a label, a value and a bar per quantity
  var rows = [
    { lab: 'Leverage hᵢᵢ', max: 1, col: GOLD },
    { lab: 'Residual êᵢ', max: (YH - YL) / 2, col: RED },
    { lab: 'LOO error êᵢ / (1 − hᵢᵢ)', max: (YH - YL), col: RED },
    { lab: 'DFBETA (slope): β̂₁ − β̂₁₍₋ᵢ₎', max: 1, col: BLUE },
    { lab: "Cook's distance Dᵢ", max: 1.5, col: INK }
  ];
  rows.forEach(function (r, k) {
    var y = 50 + k * 86;
    mk('text', { x: PX, y: y, 'font-size': 20, fill: GREY }, svg).textContent = r.lab;
    r.val = mk('text', { x: PX, y: y + 32, 'font-size': 26, 'font-weight': 600, fill: INK }, svg);
    mk('rect', { x: PX + 110, y: y + 14, width: 190, height: 18, fill: 'none', stroke: '#d9d9d9' }, svg);
    r.bar = mk('rect', { x: PX + 110, y: y + 14, height: 18, fill: r.col, 'fill-opacity': 0.55 }, svg);
  });

  var P = { x: d.px, y: d.py };
  var base = ols(d.x, d.y);   // the fit without the red point never changes
  function draw() {
    var xs = d.x.concat([P.x]), ys = d.y.concat([P.y]);
    var o = ols(xs, ys);
    var h = 1 / n + (P.x - o.mx) * (P.x - o.mx) / o.sxx;
    var e = P.y - o.b0 - o.b1 * P.x;
    var et = e / (1 - h);
    var dfb = o.b1 - base.b1;
    var ssr = 0;
    for (var i = 0; i < n; i++) { var r = ys[i] - o.b0 - o.b1 * xs[i]; ssr += r * r; }
    var k = 2, D = (n - k) / k * h * et * et / ssr;

    full.setAttribute('x1', px(XL)); full.setAttribute('y1', py(o.b0 + o.b1 * XL));
    full.setAttribute('x2', px(XH)); full.setAttribute('y2', py(o.b0 + o.b1 * XH));
    loo.setAttribute('x1', px(XL)); loo.setAttribute('y1', py(base.b0 + base.b1 * XL));
    loo.setAttribute('x2', px(XH)); loo.setAttribute('y2', py(base.b0 + base.b1 * XH));
    res.setAttribute('x1', px(P.x)); res.setAttribute('x2', px(P.x));
    res.setAttribute('y1', py(P.y)); res.setAttribute('y2', py(o.b0 + o.b1 * P.x));
    dot.setAttribute('cx', px(P.x)); dot.setAttribute('cy', py(P.y));
    halo.setAttribute('cx', px(P.x)); halo.setAttribute('cy', py(P.y));
    halo.setAttribute('r', 10 + 60 * Math.sqrt(Math.min(D, 2)));
    mxLine.setAttribute('x1', px(o.mx)); mxLine.setAttribute('x2', px(o.mx));
    mxLab.setAttribute('x', px(o.mx));

    var vals = [h, e, et, dfb, D], dig = [3, 2, 2, 3, 3];
    rows.forEach(function (r, j) {
      r.val.textContent = f(vals[j], dig[j]);
      r.bar.setAttribute('width', 190 * Math.min(1, Math.abs(vals[j]) / r.max));
    });
  }

  // Dragging: the red point follows the pointer, kept inside the plot
  var dragging = false;
  function toData(evt) {
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    var q = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: Math.max(XL, Math.min(XH, ix(q.x))), y: Math.max(YL, Math.min(YH, iy(q.y))) };
  }
  dot.addEventListener('pointerdown', function (evt) {
    dragging = true; dot.setPointerCapture(evt.pointerId); dot.style.cursor = 'grabbing';
    evt.stopPropagation(); evt.preventDefault();
  });
  dot.addEventListener('pointermove', function (evt) {
    if (!dragging) return;
    P = toData(evt); draw();
  });
  dot.addEventListener('pointerup', function () { dragging = false; dot.style.cursor = 'grab'; });
  // Keep the deck from treating a drag as a swipe or a click
  ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(function (t) {
    svg.addEventListener(t, function (evt) { evt.stopPropagation(); });
  });

  draw();
}
