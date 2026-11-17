function (el, d, opts) {
  // One regression, two pictures. A single scene that every 3D slide in the
  // deck steps through:
  //
  // Data space: one axis per variable (X1, X2, Y), one point per observation
  //   0   the cloud of points
  //   1   the OLS plane fades in
  //   2   the residuals grow out of it as vertical segments
  //   3   the points drop along them onto the plane: the fitted values
  // The flip
  //   4   three observations are picked out, with their rows of the data
  //   5   the picture turns inside out: one axis per OBSERVATION, and each
  //       column of the three rows (centered at the sample means) becomes a
  //       vector, X1 and X2
  // Observation space, after Blackwell (2025), Figure 7.4
  //   6   the column space C(X): every b1 X1 + b2 X2
  //   7   the outcome vector Y, off the plane
  //   8   the projection: Y-hat in the plane, e-hat at a right angle to it
  //   9   Y-hat taken apart as b1-hat X1 + b2-hat X2
  // Frisch-Waugh-Lovell, back in data space with the whole cloud
  //   10  the camera turns back to the cloud and its OLS plane; a red line
  //       along the plane in the X1 direction has slope b1-hat
  //   11  partial X2 out of Y: the fit of Y on X2 (a gold plane, tilted only
  //       along X2) fades in, then each point moves up or down by its
  //       residual, so the plane flattens out at the mean of Y
  //   12  partial X2 out of X1: the fit of X1 on X2 (a gold vertical
  //       curtain) fades in, then each point slides along X1 by its residual
  //   13  the camera turns to look straight down the X2 axis: Y-tilde against
  //       X1-tilde, whose fitted line has slope b1-hat again
  //
  // A slide shows stages opts.from to opts.to, one per .rg-step fragment;
  // stepping backwards runs each transition in reverse. opts.stages swaps in
  // a different list of states (the R-squared slide tilts a flat plane at
  // the mean of Y into the OLS plane), and opts.readout reports the sum of
  // squared residuals about the current plane. The camera swings slowly
  // while the slide is up; a drag turns it by hand until the slide is next
  // entered.
  //
  // Data: d.x1, d.x2, d.y (the sample), d.beta (OLS: b0, b1, b2), d.idx (the
  // three observations, 0-based, in the order they become axes 1, 2, 3).
  opts = opts || {};
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 520;
  var BLUE = '#0479a8', RED = '#c5050c', INK = '#333333', GOLD = '#b8860b',
      GREY = '#9a9a9a', WALL = '#EFEFEF', GRID = '#d9d9d9';

  // ---- Small helpers ------------------------------------------------------------
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function unit(a) { return mul(a, 1 / Math.sqrt(dot(a, a))); }
  function vlerp(a, b, t) { return add(a, mul(sub(b, a), t)); }
  function clamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function f2(v) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2); }
  function mean(a) { var s = 0; a.forEach(function (v) { s += v; }); return s / a.length; }
  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---- Camera: orthographic, one azimuth for both pictures ------------------------
  // The data space is seen from the low corner of the plane, so its tilt
  // reads; the observation space from where both covariate vectors point to
  // the right. The camera turns from one to the other in the flip
  // For FWL's last step it turns to look straight down the X2 axis
  var AZ_A = opts.azA == null ? -125 : opts.azA, AZ_B = -45, AZ_SIDE = -90, EL = 24, EL_SIDE = 0,
      SWING = 14, PERIOD = 16000;
  var az = AZ_A, elev = EL, off = 0, zoom = 0;
  function cam() {
    var a = az * Math.PI / 180, e = elev * Math.PI / 180;
    return { sa: Math.sin(a), ca: Math.cos(a), se: Math.sin(e), ce: Math.cos(e) };
  }
  function projWith(c, sc, cx, cy) {
    return function (p) {
      var u = -p[0] * c.sa + p[1] * c.ca;
      var v = p[2] * c.ce - (p[0] * c.ca + p[1] * c.sa) * c.se;
      return [cx + sc * u, cy - sc * v];
    };
  }
  var C = cam(), pA, pB;
  function setCam() {
    C = cam();
    pA = projWith(C, lerp(104, 150, zoom), 460, lerp(280, 290, zoom));   // data space (zoomed in side on)
    pB = projWith(C, 90, 250, 370);        // observation space
  }
  setCam();
  function toward() { return [C.ca * C.ce, C.sa * C.ce, C.se]; }   // points at the viewer

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'A 3D scatterplot of Y against X1 and X2 with its least squares plane, residuals and fitted values. Three observations are picked out and the picture is turned inside out: each observation becomes an axis and each variable a vector. The fitted values are the projection of the outcome vector onto the plane the covariate vectors span, with the residual at a right angle; back in the cloud, partialling X2 out of Y and X1 and then looking down the X2 axis recovers the same slope on X1.',
                        style: 'width: 100%; height: auto; max-height: 520px; display: block; margin: 0 auto; font-family: inherit; touch-action: none; cursor: grab;' }, el);

  // Labels. A '~' after a character puts a tilde over it: combining tildes
  // land beside the subscript in this font, so the tilde is its own text,
  // centered over the character it marks
  function label(parent, text, color, size, weight, style, anchor) {
    var t = mk('text', { fill: color, 'font-size': size || 26, 'font-weight': weight || 600,
                         'text-anchor': anchor || 'middle', 'font-style': style || 'normal' }, parent);
    t.size = size || 26; t.color = color; t.acc = []; t.accIdx = [];
    setText(t, text);
    return t;
  }
  function setText(t, str) {
    var out = '', idx = [];
    for (var i = 0; i < str.length; i++) {
      if (str[i] === '~') idx.push(out.length - 1); else out += str[i];
    }
    if (t.textContent === out && t.accIdx.join() === idx.join()) return;
    t.textContent = out; t.accIdx = idx;
    while (t.acc.length < idx.length) {
      var a = mk('text', { fill: t.color, 'font-size': t.size, 'font-weight': 600, 'text-anchor': 'middle' }, t.parentNode);
      a.textContent = '~';
      t.acc.push(a);
    }
    t.acc.forEach(function (a, k) { a.style.display = k < idx.length ? '' : 'none'; });
  }
  function placeAccents(t, op) {
    t.accIdx.forEach(function (ci, k) {
      var a = t.acc[k];
      try {
        var ext = t.getExtentOfChar(ci);
        a.setAttribute('x', ext.x + ext.width / 2);
        a.setAttribute('y', ext.y + 0.42 * t.size);
      } catch (err) { /* not laid out yet (hidden slide) */ }
      a.setAttribute('opacity', op);
    });
  }
  function put(T, xy, dx, dy, op) {
    T.setAttribute('x', xy[0] + (dx || 0)); T.setAttribute('y', xy[1] + (dy || 0));
    T.setAttribute('opacity', op);
    if (T.accIdx.length) placeAccents(T, op);
  }
  function polyPts(P, pts) {
    P.setAttribute('points', pts.map(function (a) { return a[0].toFixed(1) + ',' + a[1].toFixed(1); }).join(' '));
  }
  function line(parent, color, w, dash) {
    var a = { stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' };
    if (dash) a['stroke-dasharray'] = dash;
    return mk('line', a, parent);
  }
  function setLine(S, a, b, op) {
    S.setAttribute('x1', a[0]); S.setAttribute('y1', a[1]);
    S.setAttribute('x2', b[0]); S.setAttribute('y2', b[1]);
    S.setAttribute('opacity', op);
  }

  // =================================================================================
  // Data space
  // =================================================================================
  var n = d.y.length, B = d.beta, YBAR = mean(d.y);
  var L = 1.5, HZ = 1.1;                                        // half-widths of the box
  function wx(v) { return (v - 5) / 5 * L; }                    // X1, X2 run 0 to 10
  function wz(v) { return (v - 50) / 50 * HZ; }                 // Y runs 0 to 100
  function fit(c, x1, x2) { return c[0] + c[1] * x1 + c[2] * x2; }
  function coefAt(t) { return [lerp(YBAR, B[0], t), B[1] * t, B[2] * t]; }

  var gA = mk('g', {}, svg);
  var gWalls = mk('g', {}, gA), gBack = mk('g', {}, gA), gPlane = mk('g', {}, gA),
      gFront = mk('g', {}, gA), gTicks = mk('g', {}, gA);

  // The box: three back faces with grids, drawn as plotly would
  var FACES = [
    { n: [-1, 0, 0], c: function (s, t) { return [-L, s * L, t * HZ]; }, gs: 'x2', gt: 'y' },
    { n: [1, 0, 0], c: function (s, t) { return [L, s * L, t * HZ]; }, gs: 'x2', gt: 'y' },
    { n: [0, -1, 0], c: function (s, t) { return [s * L, -L, t * HZ]; }, gs: 'x1', gt: 'y' },
    { n: [0, 1, 0], c: function (s, t) { return [s * L, L, t * HZ]; }, gs: 'x1', gt: 'y' },
    { n: [0, 0, -1], c: function (s, t) { return [s * L, t * L, -HZ]; }, gs: 'x1', gt: 'x2' }
  ];
  var TICKS = { x1: [0, 5, 10].map(wx).map(function (v) { return v / L; }),
                x2: [0, 5, 10].map(wx).map(function (v) { return v / L; }),
                y: [0, 25, 50, 75, 100].map(wz).map(function (v) { return v / HZ; }) };
  FACES.forEach(function (f) {
    f.g = mk('g', {}, gWalls);
    f.poly = mk('polygon', { fill: WALL, stroke: GRID, 'stroke-width': 1 }, f.g);
    f.gl = [];
    TICKS[f.gs].forEach(function () { f.gl.push({ s: true, ln: line(f.g, GRID, 1) }); });
    TICKS[f.gt].forEach(function () { f.gl.push({ s: false, ln: line(f.g, GRID, 1) }); });
  });
  var tickLab = { x1: [], x2: [], y: [] };
  ['x1', 'x2'].forEach(function (k) {
    [0, 5, 10].forEach(function (v) { tickLab[k].push(label(gTicks, String(v), GREY, 16, 400)); });
  });
  [0, 25, 50, 75, 100].forEach(function (v) { tickLab.y.push(label(gTicks, String(v), GREY, 16, 400, null, 'end')); });
  var axLab = { x1: label(gTicks, 'X₁', INK, 22, 600), x2: label(gTicks, 'X₂', INK, 22, 600), y: label(gTicks, 'Y', INK, 22, 600) };

  function drawBox(op, opX2) {
    var dv = toward();
    FACES.forEach(function (f) {
      var back = dot(f.n, dv) < 0;
      f.g.style.display = back ? '' : 'none';
      if (!back) return;
      polyPts(f.poly, [f.c(-1, -1), f.c(1, -1), f.c(1, 1), f.c(-1, 1)].map(pA));
      var k = 0;
      TICKS[f.gs].forEach(function (s) { setLine(f.gl[k++].ln, pA(f.c(s, -1)), pA(f.c(s, 1)), 1); });
      TICKS[f.gt].forEach(function (t) { setLine(f.gl[k++].ln, pA(f.c(-1, t)), pA(f.c(1, t)), 1); });
    });
    // Tick labels on the front edges of the floor, and on the left-most
    // vertical edge
    var yFront = dv[1] > 0 ? L : -L, xFront = dv[0] > 0 ? L : -L;
    [0, 5, 10].forEach(function (v, j) {
      put(tickLab.x1[j], pA([wx(v), yFront * 1.14, -HZ]), 0, 18, op);
      put(tickLab.x2[j], pA([xFront * 1.14, wx(v), -HZ]), 0, 18, opX2);
    });
    put(axLab.x1, pA([0, yFront * 1.35, -HZ]), 0, 26 + 18 * zoom, op);
    put(axLab.x2, pA([xFront * 1.35, 0, -HZ]), 0, 26, opX2);
    var best = null;
    [[-L, -L], [-L, L], [L, -L], [L, L]].forEach(function (c) {
      var u = pA([c[0], c[1], 0])[0];
      if (!best || u < best.u) best = { u: u, c: c };
    });
    [0, 25, 50, 75, 100].forEach(function (v, j) {
      put(tickLab.y[j], pA([best.c[0], best.c[1], wz(v)]), -10, 5, op);
    });
    put(axLab.y, pA([best.c[0], best.c[1], 0]), -50, 0, op);
  }

  // The plane, clipped to the box's Y range: a convex polygon in (X1, X2)
  // cut by fit >= 0 and fit <= 100
  var plane = mk('polygon', { fill: BLUE, 'fill-opacity': 0.3, stroke: BLUE, 'stroke-opacity': 0.6, 'stroke-width': 1.5 }, gPlane);
  function clipPoly(poly, g) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length], ga = g(a), gb = g(b);
      if (ga >= 0) out.push(a);
      if ((ga >= 0) !== (gb >= 0)) { var t = ga / (ga - gb); out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]); }
    }
    return out;
  }
  function drawPlane(c, op, P) {
    P = P || plane;
    var poly = [[0, 0], [10, 0], [10, 10], [0, 10]];
    poly = clipPoly(poly, function (p) { return fit(c, p[0], p[1]); });
    poly = clipPoly(poly, function (p) { return 100 - fit(c, p[0], p[1]); });
    polyPts(P, poly.map(function (p) { return pA([wx(p[0]), wx(p[1]), wz(fit(c, p[0], p[1]))]); }));
    P.setAttribute('opacity', op);
  }

  // ---- Frisch-Waugh-Lovell in data space ------------------------------------------
  function ols1(yv, xv) {             // bivariate OLS: [intercept, slope]
    var mx = mean(xv), my = mean(yv), sxy = 0, sxx = 0;
    for (var i = 0; i < xv.length; i++) { sxy += (xv[i] - mx) * (yv[i] - my); sxx += (xv[i] - mx) * (xv[i] - mx); }
    return [my - sxy / sxx * mx, sxy / sxx];
  }
  var X1BAR = mean(d.x1), X2BAR = mean(d.x2);
  var GY = ols1(d.y, d.x2), GX = ols1(d.x1, d.x2);     // Y on X2, X1 on X2
  // The residualized variables, shifted back to their means so they stay in the box
  var YT_A = d.y.map(function (v, i) { return YBAR + v - GY[0] - GY[1] * d.x2[i]; });
  var XT_A = d.x1.map(function (v, i) { return X1BAR + v - GX[0] - GX[1] * d.x2[i]; });
  var BFA = ols1(YT_A, XT_A)[1];                        // equals B[1]
  var gYplane = mk('polygon', { fill: GOLD, 'fill-opacity': 0.28, stroke: GOLD, 'stroke-opacity': 0.7, 'stroke-width': 1.5 }, gPlane);
  var curtain = mk('polygon', { fill: GOLD, 'fill-opacity': 0.22, stroke: GOLD, 'stroke-opacity': 0.7, 'stroke-width': 1.5 }, gPlane);
  var fwlPlane = mk('polygon', { fill: RED, 'fill-opacity': 0.22, stroke: RED, 'stroke-opacity': 0.8, 'stroke-width': 2.5 }, gPlane);
  var slope = line(gTicks, RED, 5), slopeLab = label(gTicks, 'slope β̂₁ = ' + f2(B[1]), RED, 22, 700, null, 'start');
  var gFW = mk('g', {}, gA);
  var fwA = label(gFW, 'Full regression: β̂₁ = ' + f2(B[1]), BLUE, 22, 600, null, 'start');
  var fwB = label(gFW, 'Ỹ on X~₁: slope ' + f2(BFA), RED, 22, 600, null, 'start');
  var fwNote = label(gFW, 'each residual is shifted back to its variable\'s mean', GREY, 17, 400, 'italic', 'start');

  function drawFWL(st) {
    var py = clamp(st.py), px = clamp(st.px), fp = clamp(st.fp);
    var mvY = ease(clamp((py - 0.35) / 0.65)), mvX = ease(clamp((px - 0.35) / 0.65));
    // Y on X2: tilted only along X2, flattening to the mean as the points move
    drawPlane([lerp(GY[0], YBAR, mvY), 0, lerp(GY[1], 0, mvY)], clamp(py / 0.3) * (1 - clamp(px / 0.3)), gYplane);
    // X1 on X2: a vertical curtain x1 = a + b x2, straightening to x1 = mean
    var cx0 = lerp(GX[0], X1BAR, mvX), cx1 = lerp(GX[1], 0, mvX);
    polyPts(curtain, [[cx0, 0, 0], [cx0 + 10 * cx1, 10, 0], [cx0 + 10 * cx1, 10, 100], [cx0, 0, 100]].map(function (q) {
      return pA([wx(q[0]), wx(q[1]), wz(q[2])]);
    }));
    curtain.setAttribute('opacity', clamp(px / 0.3) * (1 - clamp(fp / 0.3)));
    // The fit of Y-tilde on X1-tilde: flat along X2, so a line seen side on
    drawPlane([YBAR - BFA * X1BAR, BFA, 0], ease(clamp(fp / 0.4)), fwlPlane);
    // The slope along X1 of the full OLS plane, at the mean of X2
    var sl = ease(clamp(st.sl));
    var s0 = pA([wx(0), wx(X2BAR), wz(fit(B, 0, X2BAR))]), s1 = pA([wx(10), wx(X2BAR), wz(fit(B, 10, X2BAR))]);
    setLine(slope, s0, s1, sl);
    put(slopeLab, s1, 12, 6, sl);
    var ro = clamp((fp - 0.6) * 2.5);
    put(fwA, [40, 50], 0, 0, ro);
    put(fwB, [40, 84], 0, 0, ro);
    put(fwNote, [40, 112], 0, 0, ro);
    // Once the points have moved, the axes hold the residualized variables
    setText(axLab.x1, mvX > 0.5 ? 'X~₁' : 'X₁');
    setText(axLab.y, mvY > 0.5 ? 'Ỹ' : 'Y');
    return { mvX: mvX, mvY: mvY };
  }

  // Points, each with its residual segment, in front of or behind the plane
  var HL = d.idx;
  var LOFF = [[18, 8], [-18, 8], [0, -16]];   // label offsets for the three rows
  var pts = [];
  for (var i = 0; i < n; i++) {
    var hi = HL.indexOf(i);
    var g = mk('g', {}, gBack);
    pts.push({ g: g, side: 0, hl: hi,
               res: line(g, RED, hi >= 0 ? 3.5 : 2.5),
               dot: mk('circle', { r: hi >= 0 ? 7 : 5.5, fill: INK, 'fill-opacity': 0.85 }, g),
               lab: hi >= 0 ? label(g, String(hi + 1), RED, 22, 700) : null });
  }

  function drawPoints(st, c, mv) {
    var dr = ease(clamp(st.dr)), rs = clamp(st.rs), hl = ease(clamp(st.hl));
    var dv = toward();
    var nrm = [-c[1] * (wz(1) - wz(0)) / (wx(1) - wx(0)), -c[2] * (wz(1) - wz(0)) / (wx(1) - wx(0)), 1];
    var viewerAbove = dot(nrm, dv) > 0;
    pts.forEach(function (P, i) {
      var x1 = lerp(d.x1[i], XT_A[i], mv.mvX), y0 = lerp(d.y[i], YT_A[i], mv.mvY);
      var f = fit(c, x1, d.x2[i]), y = lerp(y0, f, dr);
      var q = pA([wx(x1), wx(d.x2[i]), wz(y)]), qf = pA([wx(x1), wx(d.x2[i]), wz(f)]);
      var qe = [lerp(qf[0], q[0], rs), lerp(qf[1], q[1], rs)];
      // A point on the viewer's side of the plane is drawn in front of it
      var front = st.pl < 0.05 || ((d.y[i] >= f) === viewerAbove);
      var side = front ? 1 : -1;
      if (side !== P.side) { (front ? gFront : gBack).appendChild(P.g); P.side = side; }
      P.dot.setAttribute('cx', q[0]); P.dot.setAttribute('cy', q[1]);
      setLine(P.res, qf, qe, rs > 0.01 ? 1 : 0);
      var isH = P.hl >= 0;
      P.dot.setAttribute('fill', isH ? (hl > 0.5 ? RED : INK) : INK);
      if (isH) P.dot.setAttribute('r', lerp(5.5, 7, hl));
      P.g.setAttribute('opacity', isH ? 1 : lerp(1, 0.18, hl));
      if (P.lab) put(P.lab, q, LOFF[P.hl][0], LOFF[P.hl][1], hl);
    });
  }

  // Readout (R-squared slide)
  var gRA = mk('g', {}, gA);
  var raLab = label(gRA, '', INK, 22, 400, null, 'start');
  var raBar = mk('rect', { x: 40, y: 74, height: 14, fill: RED, 'fill-opacity': 0.45 }, gRA);
  var raR2 = label(gRA, '', INK, 22, 600, null, 'start');
  var TSS = 0, SSR = 0;
  for (i = 0; i < n; i++) {
    TSS += (d.y[i] - YBAR) * (d.y[i] - YBAR);
    var r = d.y[i] - fit(B, d.x1[i], d.x2[i]);
    SSR += r * r;
  }
  function fmtInt(v) { return Math.round(v).toLocaleString('en-US'); }
  function drawReadout(st, c) {
    if (!opts.readout) { gRA.setAttribute('opacity', 0); return; }
    var ss = 0;
    for (var i = 0; i < n; i++) { var r = d.y[i] - fit(c, d.x1[i], d.x2[i]); ss += r * r; }
    var t = clamp(st.tilt), show = clamp(st.rs);
    gRA.setAttribute('opacity', show);
    setText(raLab, (t < 0.02 ? 'Σ (Yᵢ − Ȳ)² = ' : 'Σ (Yᵢ − plane)² = ') + fmtInt(ss) +
                   (t < 0.02 ? '   (TSS)' : t > 0.98 ? '   (SSR)' : ''));
    put(raLab, [40, 60], 0, 0, 1);
    raBar.setAttribute('width', (320 * ss / TSS).toFixed(1));
    setText(raR2, t > 0.98 ? 'R² = 1 − SSR / TSS = ' + (1 - SSR / TSS).toFixed(2) : '');
    put(raR2, [40, 120], 0, 0, 1);
  }

  // =================================================================================
  // The data table for the three observations
  // =================================================================================
  var gTb = mk('g', {}, svg);
  var TX = 735, TY = 40, CW = [60, 70, 70, 70];
  mk('rect', { x: TX - 12, y: TY - 30, width: 286, height: 168, rx: 6, fill: '#fff', stroke: GRID }, gTb);
  var heads = ['', 'X₁', 'X₂', 'Y'];
  var colX = [TX + 20, TX + 100, TX + 170, TX + 240];
  var headT = heads.map(function (h, j) { return label(gTb, h, j ? BLUE : INK, 22, 700, null, j ? 'end' : 'middle'); });
  headT[3].setAttribute('fill', INK);
  headT.forEach(function (t, j) { put(t, [colX[j], TY], 0, 0, 1); });
  mk('line', { x1: TX - 4, x2: TX + 266, y1: TY + 10, y2: TY + 10, stroke: GRID, 'stroke-width': 1.5 }, gTb);
  HL.forEach(function (ix, r) {
    var y = TY + 40 + r * 32;
    put(label(gTb, 'i = ' + (r + 1), RED, 20, 700), [colX[0], y], 0, 0, 1);
    [d.x1[ix], d.x2[ix], d.y[ix]].forEach(function (v, j) {
      put(label(gTb, v.toFixed(1), INK, 20, 400, null, 'end'), [colX[j + 1], y], 0, 0, 1);
    });
  });
  var tbNote = label(gTb, 'each column → a vector in ℝ³', GREY, 17, 400, 'italic');
  put(tbNote, [TX + 131, TY + 154], 0, 0, 1);
  // Brackets under each column, shown in the flip
  var colBox = [1, 2, 3].map(function (j) {
    return mk('rect', { x: colX[j] - 52, y: TY - 22, width: 60, height: 130, rx: 5, fill: 'none',
                        stroke: j === 3 ? INK : BLUE, 'stroke-width': 2.5 }, gTb);
  });

  // =================================================================================
  // Observation space
  // =================================================================================
  // The three rows' columns, centered at the sample means (the stand-in for an
  // intercept) and scaled to a common length: rescaling a column changes its
  // coefficient but not the plane, the projection or the right angles
  function col(v) {
    var m = mean(v), a = HL.map(function (ix) { return v[ix] - m; });
    return mul(unit(a), 3.2);
  }
  var X1 = col(d.x1), X2 = col(d.x2), Y = col(d.y), O = [0, 0, 0];
  var a11 = dot(X1, X1), a12 = dot(X1, X2), a22 = dot(X2, X2);
  var c1 = dot(X1, Y), c2 = dot(X2, Y), det = a11 * a22 - a12 * a12;
  var B1 = (a22 * c1 - a12 * c2) / det, B2 = (a11 * c2 - a12 * c1) / det;
  var YH = add(mul(X1, B1), mul(X2, B2));

  var gB = mk('g', {}, svg);
  var gBax = mk('g', {}, gB), gBpl = mk('g', {}, gB), gBdc = mk('g', {}, gB),
      gBv = mk('g', {}, gB), gBlab = mk('g', {}, gB), gBro = mk('g', {}, gB);
  function arrow(parent, color, w, dash) {
    var g = mk('g', {}, parent);
    return { g: g, ln: line(g, color, w, dash), hd: mk('polygon', { fill: color }, g) };
  }
  function setArrow(A, p, q, t, op) {
    var a = pB(p), b = pB(vlerp(p, q, clamp(t)));
    var dx = b[0] - a[0], dy = b[1] - a[1], Ln = Math.sqrt(dx * dx + dy * dy);
    A.g.setAttribute('opacity', t > 0.001 ? op : 0);
    if (Ln < 1) { setLine(A.ln, a, a, 0); A.hd.setAttribute('points', ''); return; }
    var ux = dx / Ln, uy = dy / Ln, HLn = Math.min(18, Ln * 0.5), HW = 8;
    var bx = b[0] - ux * HLn, by = b[1] - uy * HLn;
    setLine(A.ln, a, [bx + ux * 2, by + uy * 2], 1);
    A.hd.setAttribute('points', [b[0], b[1], bx - uy * HW, by + ux * HW, bx + uy * HW, by - ux * HW].join(' '));
  }
  function setSegB(S, p, q, t, op) { setLine(S, pB(p), pB(vlerp(p, q, clamp(t))), t > 0.001 ? op : 0); }
  function rightAngle(R, corner, a, b, s, op) {
    var p1 = add(corner, mul(unit(a), s)), p3 = add(corner, mul(unit(b), s)), p2 = add(p1, mul(unit(b), s));
    R.setAttribute('points', [pB(p1), pB(p2), pB(p3)].map(function (q) { return q.join(','); }).join(' '));
    R.setAttribute('opacity', op);
  }

  var AXL = 3.9;
  var bAxes = [0, 1, 2].map(function () { return line(gBax, GREY, 1.5, '5 5'); });
  var bAxLab = ['i = 1', 'i = 2', 'i = 3'].map(function (s) { return label(gBax, s, RED, 20, 600, 'italic'); });
  var cPlane = mk('polygon', { fill: BLUE, 'fill-opacity': 0.16, stroke: BLUE, 'stroke-opacity': 0.5, 'stroke-width': 1.5 }, gBpl);
  var cLab = label(gBpl, 'C(X)', BLUE, 24, 600);
  var dc1 = line(gBdc, BLUE, 2.5, '7 6'), dc2 = line(gBdc, BLUE, 2.5, '7 6');
  var dcLab1 = label(gBdc, 'β̂₁X₁', BLUE, 21), dcLab2 = label(gBdc, 'β̂₂X₂', BLUE, 21);
  var aX1 = arrow(gBv, BLUE, 4), aX2 = arrow(gBv, BLUE, 4), aY = arrow(gBv, INK, 4);
  var aYH = arrow(gBv, BLUE, 4), aE = arrow(gBv, RED, 4);
  var rt = mk('polyline', { fill: 'none', stroke: RED, 'stroke-width': 2 }, gBv);
  var lX1 = label(gBlab, 'X₁', BLUE), lX2 = label(gBlab, 'X₂', BLUE), lY = label(gBlab, 'Y', INK);
  var lYH = label(gBlab, 'Ŷ = Xβ̂', BLUE, 24), lE = label(gBlab, 'ê = Y − Xβ̂', RED, 24);

  function drawB(st) {
    var on = ease(clamp(st.B));
    gB.setAttribute('opacity', on);
    if (on < 0.001) { gB.style.display = 'none'; return; }
    gB.style.display = '';
    var fade = 1, fadeC = 1;

    [[AXL, 0, 0], [0, AXL, 0], [0, 0, 3.05]].forEach(function (p, k) {
      setSegB(bAxes[k], O, p, ease(clamp(st.B)), 1);
      put(bAxLab[k], pB(mul(p, 1.08)), 0, 8, on);
    });

    var cx = ease(clamp(st.cx)), lo = -0.12, hi = 1.12;
    polyPts(cPlane, [add(mul(X1, lo), mul(X2, lo)), add(mul(X1, hi), mul(X2, lo)),
                     add(mul(X1, hi), mul(X2, hi)), add(mul(X1, lo), mul(X2, hi))].map(pB));
    cPlane.setAttribute('opacity', cx * fadeC);
    put(cLab, pB(add(mul(X1, 1.12), mul(X2, 0.5))), 36, 12, cx * fadeC);

    var xt = ease(clamp(st.x));
    setArrow(aX1, O, X1, xt, fadeC);
    setArrow(aX2, O, X2, xt, 1);
    put(lX1, pB(X1), 18, 30, xt * fadeC);
    put(lX2, pB(X2), -30, -12, xt);

    var yt = ease(clamp(st.y));
    setArrow(aY, O, Y, yt, fade);
    put(lY, pB(Y), -14, -12, clamp(st.y * 2 - 1) * fade);

    var pr = clamp(st.pr), prE = ease(clamp(pr / 0.55)), prH = ease(clamp((pr - 0.45) / 0.55));
    setArrow(aE, YH, Y, prE, fade);
    setArrow(aYH, O, YH, prH, fade);
    rightAngle(rt, YH, sub(Y, YH), mul(YH, -1), 0.22, clamp((pr - 0.8) * 5) * fade);
    put(lE, pB(vlerp(YH, Y, 0.62)), 100, 0, clamp((pr - 0.3) * 3) * fade);
    put(lYH, pB(YH), 78, 22, clamp((pr - 0.8) * 5) * fade);

    var dc = ease(clamp(st.dc)), P1 = mul(X1, B1);
    setSegB(dc1, O, P1, dc, 1);
    setSegB(dc2, P1, YH, dc, 1);
    put(dcLab1, pB(mul(P1, 0.55)), 6, 30, dc);
    put(dcLab2, pB(vlerp(P1, YH, 0.5)), -6, -16, dc);

  }

  // =================================================================================
  // States and stepping
  // =================================================================================
  var KEYS = ['cam', 'A', 'pl', 'tilt', 'rs', 'dr', 'hl', 'tb', 'B', 'x', 'cx', 'y', 'pr', 'dc',
              'sl', 'py', 'px', 'fp', 'side'];
  function S(o) { var s = {}; KEYS.forEach(function (k) { s[k] = o[k] || 0; }); return s; }
  var MAIN = [
    S({ A: 1 }),
    S({ A: 1, pl: 1, tilt: 1 }),
    S({ A: 1, pl: 1, tilt: 1, rs: 1 }),
    S({ A: 1, pl: 1, tilt: 1, rs: 1, dr: 1 }),
    S({ A: 1, pl: 0.35, tilt: 1, hl: 1, tb: 1 }),
    S({ cam: 1, hl: 1, tb: 1, B: 1, x: 1 }),
    S({ cam: 1, tb: 1, B: 1, x: 1, cx: 1 }),
    S({ cam: 1, tb: 1, B: 1, x: 1, cx: 1, y: 1 }),
    S({ cam: 1, tb: 1, B: 1, x: 1, cx: 1, y: 1, pr: 1 }),
    S({ cam: 1, tb: 1, B: 1, x: 1, cx: 1, y: 1, pr: 1, dc: 1 }),
    S({ A: 1, pl: 1, tilt: 1, sl: 1 }),
    S({ A: 1, tilt: 1, py: 1 }),
    S({ A: 1, tilt: 1, py: 1, px: 1 }),
    S({ A: 1, tilt: 1, py: 1, px: 1, fp: 1, side: 1 })
  ];
  var DUR = [0, 1100, 1000, 1400, 1400, 2200, 900, 900, 1600, 1400, 2200, 2800, 2800, 2600];
  var STAGES = opts.stages ? opts.stages.map(S) : MAIN;
  var FROM = opts.from || 0, TO = opts.to == null ? STAGES.length - 1 : opts.to;

  var state = STAGES[FROM];
  function render(st) {
    state = st;
    var sd = ease(clamp(st.side));
    az = lerp(lerp(AZ_A, AZ_B, ease(clamp(st.cam))), AZ_SIDE, sd) + off * (1 - sd);
    elev = lerp(EL, EL_SIDE, sd); zoom = sd;
    setCam();
    var aOn = ease(clamp(st.A));
    gA.style.display = aOn > 0.001 ? '' : 'none';
    gA.setAttribute('opacity', aOn);
    if (aOn > 0.001) {
      var c = coefAt(ease(clamp(st.tilt)));
      drawBox(1, 1 - sd);
      drawPlane(c, ease(clamp(st.pl)));
      var mv = drawFWL(st);
      drawPoints(st, c, mv);
      drawReadout(st, c);
    }
    // In the flip, the brackets mark the columns that become vectors
    gTb.setAttribute('opacity', ease(clamp(st.tb)));
    var flip = ease(clamp(st.B));
    colBox.forEach(function (b) { b.setAttribute('opacity', flip); });
    tbNote.setAttribute('opacity', flip);
    drawB(st);
  }

  var cur = -1, raf = null;
  function mix(A, B, e) { var st = {}; for (var k in A) st[k] = lerp(A[k], B[k], e); return st; }
  function goTo(s, animate) {
    s = Math.max(FROM, Math.min(TO, s));
    if (raf) { cancelAnimationFrame(raf); raf = null; render(STAGES[cur]); }
    if (s === cur) return;
    var prev = cur;
    cur = s;
    if (!animate || prev < 0 || Math.abs(s - prev) !== 1) { render(STAGES[s]); return; }
    var A = STAGES[prev], Bs = STAGES[s], t0 = null;
    var dur = opts.stages ? 900 + 1800 * Math.abs(Bs.tilt - A.tilt) : DUR[Math.max(s, prev)];
    raf = requestAnimationFrame(function frame(now) {
      if (t0 === null) t0 = now;
      var e = Math.min(1, (now - t0) / dur);
      render(mix(A, Bs, e));
      raf = e < 1 ? requestAnimationFrame(frame) : null;
    });
  }

  // ---- The swing, and a drag to turn the camera by hand ----------------------------
  var spin = null, held = false, spinT0 = null, last = 0;
  function spinFrame(now) {
    if (held || !onThisSlide()) { spin = null; return; }
    if (spinT0 === null) spinT0 = now;
    if (now - last > 33) {
      last = now;
      off = SWING * Math.sin(2 * Math.PI * (now - spinT0) / PERIOD);
      if (!raf) render(state);
    }
    spin = requestAnimationFrame(spinFrame);
  }
  function startSpin() {
    if (spin) cancelAnimationFrame(spin);
    held = false; spinT0 = null; last = 0; off = 0;
    spin = requestAnimationFrame(spinFrame);
  }
  var drag = null;
  svg.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, off: off }; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x) > 4) held = true;
    if (held) { off = drag.off - (e.clientX - drag.x) * 0.4; if (!raf) render(state); }
  });
  svg.addEventListener('pointerup', function () { drag = null; });

  // ---- Reveal wiring, as in the week 10 animations -------------------------------------
  var slide = el.closest('section');
  function fragmentStage() {
    return FROM + (slide ? slide.querySelectorAll('.fragment.rg-step.visible').length : 0);
  }
  function onThisSlide() {
    return window.Reveal && Reveal.getCurrentSlide && Reveal.getCurrentSlide() === slide;
  }
  ['fragmentshown', 'fragmenthidden'].forEach(function (type) {
    document.addEventListener(type, function () { if (onThisSlide()) goTo(fragmentStage(), true); });
  });
  ['ready', 'slidechanged'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (e.currentSlide === slide) {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        cur = -1; goTo(fragmentStage(), false); startSpin();
      }
    });
  });
  render(STAGES[FROM]);
  goTo(fragmentStage(), false);
}
