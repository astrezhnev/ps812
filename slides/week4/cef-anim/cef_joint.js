function (el, x, cfg) {
  // Stepped animation for the Clinton 2016 / non-Hispanic white slide,
  // attached to the plotly widget with htmlwidgets::onRender().
  //
  //   stage 0   looking straight down: the county scatterplot
  //   stage 1   still from above, the joint density's contour lines appear on
  //             the floor and the points fade back
  //   stage 2   camera swings into 3D; the density surface rises out of the
  //             floor, carrying each contour line up to its own height
  //   stage 3   the CEF is traced across the surface, left to right
  //   stage 4   camera swings back overhead, where the picture is a contour
  //             plot with the CEF drawn through it
  //   stage 5   the BLP is traced in alongside it
  //
  // Stages follow the slide's .cef-step fragments, so the clicker, arrow keys
  // and a click on the plot (a drag rotates it instead) all step through them,
  // and stepping backwards runs the animation in reverse. The slide title is
  // cfg.titles[stage].
  var gd = el;
  var g = [].concat(cfg.grid), n = g.length;
  var dens = cfg.density;                          // rows are y, as plotly wants
  var levels = [].concat(cfg.levels), nLev = levels.length;
  var LIFT = cfg.lift;                             // keeps lines just above the surface
  // Trace order set in the R chunk: surface, points, one per contour level,
  // CEF, BLP
  var T_SURF = 0, T_PTS = 1, T_LEV = 2, T_CEF = 2 + nLev, T_BLP = 3 + nLev;
  var nStages = cfg.titles.length;

  var PTS = { on: 0.55, faded: 0.18 };

  // Camera azimuth / elevation in degrees. With an orthographic camera plotly
  // ignores the eye's distance, so zoom scales the scene's aspect ratio instead.
  // cy slides the camera along y, which moves the picture up the screen.
  var VIEWS = [
    // Overhead. Straight down (el = 90) leaves the "up" direction undefined;
    // a couple of degrees off vertical, from the -y side, keeps y pointing up
    // the screen and the x axis's labels below. cy makes room for its title.
    { az: -90, el: 88, zoom: 1.7, cy: -0.1 },
    { az: -118, el: 26, zoom: 1.45, cy: 0 }
  ];
  var EYE_R = 1.25, Z_ASPECT = cfg.zaspect;

  function stageState(s) {
    return {
      view: (s === 2 || s === 3) ? 1 : 0,
      lev: s >= 1 ? 1 : 0,                         // contour lines' opacity
      pts: s >= 1 ? PTS.faded : PTS.on,           // scaled down as the surface rises
      h: s >= 2 ? 1 : 0,                           // surface height, 0 = flat
      cef: s >= 3 ? 1 : 0,                         // share of the CEF drawn
      blp: s >= 5 ? 1 : 0
    };
  }

  function clamp(u) { return Math.max(0, Math.min(1, u)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function camera(v) {
    var a = v.az * Math.PI / 180, e = v.el * Math.PI / 180;
    return {
      eye: { x: EYE_R * Math.cos(e) * Math.cos(a), y: EYE_R * Math.cos(e) * Math.sin(a) + v.cy, z: EYE_R * Math.sin(e) },
      up: { x: 0, y: 0, z: 1 }, center: { x: 0, y: v.cy, z: 0 }, projection: { type: 'orthographic' }
    };
  }
  // Where the viewer has rotated / zoomed to. plotly only writes a drag back to
  // the layout some time after it ends, and a restyle before then snaps the
  // camera back to the stale layout copy, so read the live scene instead.
  function liveView() {
    var fl = gd._fullLayout.scene, s = fl._scene;
    return {
      camera: s && s.getCamera ? s.getCamera() : gd.layout.scene.camera,
      aspect: s && s.glplot && s.glplot.getAspectratio ? s.glplot.getAspectratio() : fl.aspectratio
    };
  }
  function currentView() {
    var v = liveView(), c = v.camera.center || { x: 0, y: 0, z: 0 };
    var p = { x: v.camera.eye.x - c.x, y: v.camera.eye.y - c.y, z: v.camera.eye.z - c.z };
    var r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    return { az: Math.atan2(p.y, p.x) * 180 / Math.PI, el: Math.asin(p.z / r) * 180 / Math.PI,
             zoom: v.aspect.x, cy: c.y };
  }

  var slide = el.closest('section');
  var title = slide && slide.querySelector('h2');
  // An empty entry in cfg.titles keeps the slide's own heading from the .qmd
  var heading = title ? title.textContent : '';
  function setTitle(s) { if (title) title.textContent = cfg.titles[s] || heading; }

  // The first share u of a curve {x, y, z}, ending on an interpolated point so
  // the line grows smoothly rather than a grid step at a time. z is scaled by
  // the surface height h.
  function partial(c, u, h) {
    var m = c.x.length, k = u * (m - 1), i = Math.floor(k), f = k - i;
    var px = c.x.slice(0, i + 1), py = c.y.slice(0, i + 1),
        pz = c.z.slice(0, i + 1).map(function (v) { return v * h + LIFT; });
    if (i < m - 1 && f > 0) {
      px.push(lerp(c.x[i], c.x[i + 1], f));
      py.push(lerp(c.y[i], c.y[i + 1], f));
      pz.push(lerp(c.z[i], c.z[i + 1], f) * h + LIFT);
    }
    return { x: px, y: py, z: pz };
  }

  // Push a state to the plot, every trace in one update
  var cur = null;
  function draw(st, view) {
    var surfZ = dens.map(function (row) { return row.map(function (v) { return v * st.h; }); });
    var X = [g], Y = [g], Z = [surfZ], vis = [st.h > 0], op = [1];
    X.push(cfg.points.x); Y.push(cfg.points.y);
    Z.push(cfg.points.x.map(function () { return 0; }));
    // The points sit on the floor, under the surface, so they go as it rises
    vis.push(st.h < 1); op.push(st.pts * (1 - st.h));
    cfg.contours.forEach(function (c, j) {
      var z = levels[j] * st.h + LIFT;
      X.push(c.x); Y.push(c.y);
      Z.push(c.x.map(function (v) { return v === null ? null : z; }));
      vis.push(st.lev > 0); op.push(st.lev);
    });
    [[cfg.cef, st.cef], [cfg.blp, st.blp]].forEach(function (cu) {
      var p = partial(cu[0], cu[1], st.h);
      X.push(p.x); Y.push(p.y); Z.push(p.z);
      vis.push(cu[1] > 0); op.push(1);
    });
    var idx = X.map(function (_, i) { return i; });

    var lay = {
      'scene.annotations[0].visible': st.cef >= 1,
      'scene.annotations[1].visible': st.blp >= 1
    };
    if (view) {
      lay['scene.camera'] = camera(view);
      lay['scene.aspectratio'] = { x: view.zoom, y: view.zoom, z: Z_ASPECT * view.zoom };
    } else {
      var live = liveView();
      lay['scene.camera'] = live.camera;
      lay['scene.aspectratio'] = live.aspect;
    }
    cur = st;
    Plotly.update(gd, { x: X, y: Y, z: Z, visible: vis, opacity: op }, lay, idx);
  }

  var camView = null, raf = null;
  function goTo(s, animate) {
    s = Math.max(0, Math.min(nStages - 1, s));
    var to = stageState(s), from = cur;
    var moveCam = to.view !== camView;
    camView = to.view;
    setTitle(s);
    if (raf) cancelAnimationFrame(raf);
    raf = null;

    if (!animate || !from) { draw(to, VIEWS[to.view]); return; }

    var v0 = moveCam ? currentView() : null, v1 = VIEWS[to.view];
    if (v0) {  // swing the short way round
      var d = ((v1.az - v0.az) % 360 + 540) % 360 - 180;
      v1 = { az: v0.az + d, el: v1.el, zoom: v1.zoom, cy: v1.cy };
    }
    // Tracing a curve takes longer than a fade, so the eye can follow it
    var tracing = to.cef !== from.cef || to.blp !== from.blp;
    var dur = tracing ? 2400 : moveCam ? 1800 : 1100, t0 = null;
    // Rising into 3D, the surface lifts once the camera has mostly turned
    var rise = to.h > from.h;

    function frame(now) {
      if (t0 === null) t0 = now;
      var u = Math.min(1, (now - t0) / dur), e = ease(u);
      var eh = moveCam && rise ? ease(clamp((u - 0.3) / 0.7)) : e;
      draw({
        lev: lerp(from.lev, to.lev, e),
        pts: lerp(from.pts, to.pts, e),
        h: lerp(from.h, to.h, eh),
        // curves are traced at an even pace, not eased
        cef: lerp(from.cef, to.cef, u),
        blp: lerp(from.blp, to.blp, u)
      }, v0 ? { az: lerp(v0.az, v1.az, e), el: lerp(v0.el, v1.el, e), zoom: lerp(v0.zoom, v1.zoom, e),
                cy: lerp(v0.cy, v1.cy, e) } : null);
      raf = u < 1 ? requestAnimationFrame(frame) : null;
    }
    raf = requestAnimationFrame(frame);
  }

  // Reveal wiring. Reveal's events bubble to document, which is also safe to
  // listen on before Reveal has initialised.
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.cef-step.visible').length : 0;
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
      if (e.currentSlide === slide) { Plotly.Plots.resize(gd); goTo(fragmentStage(), false); }
    });
  });

  // A click (not a drag) on the plot advances the deck like the clicker does
  var down = null;
  el.addEventListener('pointerdown', function (e) {
    down = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, true);
  el.addEventListener('pointerup', function (e) {
    var click = down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) < 6 &&
                Date.now() - down.t < 500;
    down = null;
    if (click && window.Reveal) Reveal.next();
  }, true);

  goTo(fragmentStage(), false);
}
