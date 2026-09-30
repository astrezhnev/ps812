function (el, cfg) {
  // Stepped animation for the "BLP is a summary" slide: datasets that share a
  // BLP, one per stage, from datasaurus.json (built by make_datasaurus.R).
  //
  //   stages 0-3   Anscombe's quartet
  //   stages 4-7   four more of the Datasaurus dozen
  //   stage 8      the Datasaurus
  //   stages 9-    invented shapes on the dinosaur's means and BLP
  //
  // Within a chapter the points morph from one dataset into the next (the R
  // script lined up point i across datasets); between chapters the plot fades
  // out and back in on the new axes. Stages follow the slide's .ds-step
  // fragments, so the clicker and arrow keys step through them, and stepping
  // backwards runs the morphs in reverse.
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 540;
  var P = { l: 70, t: 12, w: 520, h: 470 };        // plot area
  var SIDE = 650;                                  // left edge of the side panel
  var BLUE = '#0479a8', INK = '#333333', GREY = '#888888';
  var stages = cfg.stages, chapters = cfg.chapters;

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(c0, c1, t) {
    var a = rgb(c0), b = rgb(c1);
    return '#' + [0, 1, 2].map(function (i) {
      return ('0' + Math.round(lerp(a[i], b[i], t)).toString(16)).slice(-2);
    }).join('');
  }
  function num(v, d) { return v.toFixed(d).replace(/^-/, '−'); }

  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                        'aria-label': 'Scatterplots that all share the same means and best linear predictor',
                        style: 'width: 100%; height: auto; display: block; font-family: inherit;' }, el);
  var clipId = 'ds-clip-' + Math.random().toString(36).slice(2);
  mk('rect', { x: P.l, y: P.t, width: P.w, height: P.h }, mk('clipPath', { id: clipId }, mk('defs', {}, svg)));

  var plot = mk('g', {}, svg);                     // everything that fades between chapters
  var side = mk('g', {}, svg);
  var nameT = mk('text', { x: SIDE, y: 70, 'font-size': 30, 'font-weight': 700, fill: INK }, side);
  var srcT = mk('text', { x: SIDE, y: 102, 'font-size': 18, fill: GREY }, side);
  var statT = [0, 1, 2].map(function (i) {
    return mk('text', { x: SIDE, y: 180 + 42 * i, 'font-size': 24, fill: INK }, side);
  });
  var blpT = mk('text', { x: SIDE, y: 180 + 42 * 3 + 14, 'font-size': 24, 'font-weight': 700, fill: BLUE }, side);

  var chap = null, sx, sy, dots = [], line;

  // Axes, BLP line and one circle per point for a chapter
  function build(c) {
    while (plot.firstChild) plot.removeChild(plot.firstChild);
    chap = c;
    var C = chapters[c];
    sx = function (v) { return P.l + (v - C.xlim[0]) / (C.xlim[1] - C.xlim[0]) * P.w; };
    sy = function (v) { return P.t + P.h - (v - C.ylim[0]) / (C.ylim[1] - C.ylim[0]) * P.h; };
    mk('rect', { x: P.l, y: P.t, width: P.w, height: P.h, fill: '#EFEFEF' }, plot);
    C.xticks.forEach(function (v) {
      mk('line', { x1: sx(v), x2: sx(v), y1: P.t, y2: P.t + P.h, stroke: '#FFFFFF', 'stroke-width': 1.5 }, plot);
      mk('text', { x: sx(v), y: P.t + P.h + 24, 'text-anchor': 'middle', 'font-size': 17, fill: GREY }, plot)
        .textContent = v;
    });
    C.yticks.forEach(function (v) {
      mk('line', { x1: P.l, x2: P.l + P.w, y1: sy(v), y2: sy(v), stroke: '#FFFFFF', 'stroke-width': 1.5 }, plot);
      mk('text', { x: P.l - 10, y: sy(v) + 6, 'text-anchor': 'end', 'font-size': 17, fill: GREY }, plot)
        .textContent = v;
    });
    mk('text', { x: P.l + P.w / 2, y: P.t + P.h + 52, 'text-anchor': 'middle', 'font-size': 20, fill: INK }, plot)
      .textContent = 'X';
    mk('text', { x: P.l - 50, y: P.t + P.h / 2, 'text-anchor': 'middle', 'font-size': 20, fill: INK }, plot)
      .textContent = 'Y';
    var g = mk('g', { 'clip-path': 'url(#' + clipId + ')' }, plot);
    var s0 = firstOf(c);
    dots = s0.x.map(function () { return mk('circle', { r: C.r, 'fill-opacity': 0.8 }, g); });
    line = mk('line', { x1: sx(C.xlim[0]), x2: sx(C.xlim[1]), stroke: BLUE, 'stroke-width': 3.5 }, g);
  }
  function firstOf(c) { for (var i = 0; i < stages.length; i++) if (stages[i].chapter === c) return stages[i]; }

  function label(s) {
    var st = stages[s].stats;
    nameT.textContent = stages[s].name;
    srcT.textContent = stages[s].source;
    statT[0].textContent = 'n = ' + st.n;
    statT[1].textContent = 'mean of X = ' + num(st.xbar, 2);
    statT[2].textContent = 'mean of Y = ' + num(st.ybar, 2);
    blpT.textContent = 'BLP: ' + num(st.a, 2) + (st.b < 0 ? ' − ' : ' + ') + Math.abs(st.b).toFixed(2) + ' X';
  }

  // Draw stage s, or the point t of the way there from `from`; remember where
  // the points are, in data units, so an interrupted morph carries on from
  // mid-flight
  function place(s, from, t) {
    var d = stages[s], col = from ? mix(from.color, d.color, t) : d.color;
    // The dozen's lines differ in the second decimal, so the line follows too
    var a = from ? lerp(from.a, d.stats.a, t) : d.stats.a;
    var b = from ? lerp(from.b, d.stats.b, t) : d.stats.b;
    var C = chapters[chap];
    line.setAttribute('y1', sy(a + b * C.xlim[0]));
    line.setAttribute('y2', sy(a + b * C.xlim[1]));
    var xs = [], ys = [];
    for (var i = 0; i < dots.length; i++) {
      xs.push(from ? lerp(from.x[i], d.x[i], t) : d.x[i]);
      ys.push(from ? lerp(from.y[i], d.y[i], t) : d.y[i]);
      dots[i].setAttribute('cx', sx(xs[i]));
      dots[i].setAttribute('cy', sy(ys[i]));
      dots[i].setAttribute('fill', col);
    }
    shown = { x: xs, y: ys, color: col, a: a, b: b };
  }

  var cur = -1, shown = null, raf = null;
  function goTo(s, animate) {
    if (s === cur && !raf) return;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    var prev = cur;
    cur = s;
    label(s);
    var same = prev >= 0 && stages[prev].chapter === stages[s].chapter && chap === stages[s].chapter;
    if (!animate || prev < 0) {
      if (chap !== stages[s].chapter) build(stages[s].chapter);
      plot.setAttribute('opacity', 1);
      place(s, null, 1);
      return;
    }
    var t0 = null;
    if (same) {
      var from = shown;
      var dur = 1600;
      var frame = function (now) {
        if (t0 === null) t0 = now;
        var u = Math.min(1, (now - t0) / dur);
        place(s, from, ease(u));
        raf = u < 1 ? requestAnimationFrame(frame) : null;
      };
      raf = requestAnimationFrame(frame);
    } else {
      // Fade out, switch axes, fade in
      var out = 450, inn = 650, swapped = false;
      var fade = function (now) {
        if (t0 === null) t0 = now;
        var e = now - t0;
        if (e < out) {
          plot.setAttribute('opacity', 1 - e / out);
        } else {
          if (!swapped) { build(stages[s].chapter); place(s, null, 1); swapped = true; }
          plot.setAttribute('opacity', Math.min(1, (e - out) / inn));
        }
        raf = e < out + inn ? requestAnimationFrame(fade) : null;
      };
      raf = requestAnimationFrame(fade);
    }
  }

  // Reveal wiring, as on the CEF slide
  var slide = el.closest('section');
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.ds-step.visible').length : 0;
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
      if (e.currentSlide === slide) goTo(fragmentStage(), false);
    });
  });

  goTo(fragmentStage(), false);
}
