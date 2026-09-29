function (el, x, cfg) {
  // Stepped animation for the "one variable to two" slide, attached to the
  // plotly widget with htmlwidgets::onRender().
  //
  //   stage 0      last week's N(0, 1) density, seen head-on so it reads as 2D
  //   stage 1      camera swings into 3D; Y's marginal grows on the side wall
  //   stage 2      the joint density rises out of the floor at rho = rhos[0]
  //   stage 2 + k  the surface morphs to rho = rhos[k]; the marginals stay put
  //
  // Stages follow the slide's .bvn-step fragments, so the clicker, arrow keys
  // and a click on the plot (a drag rotates it instead) all step through them,
  // and stepping backwards runs the animation in reverse.
  var gd = el;
  var g = [].concat(cfg.grid), n = g.length;
  var rhos = [].concat(cfg.rhos);
  var nStages = 2 + rhos.length;
  var TR = { surf: 0, yFill: 3, yLine: 4 };   // trace order set in the R chunk

  // Camera azimuth / elevation in degrees. With an orthographic camera plotly
  // ignores the eye's distance, so zoom scales the scene's aspect ratio instead.
  var VIEWS = [
    { az: -90, el: 4, zoom: 2.3 },    // looking along +y at the x-z wall
    { az: -62, el: 34, zoom: 1.2 }
  ];
  var EYE_R = 1.25, Z_ASPECT = 0.7;

  var phi = g.map(function (v) { return Math.exp(-v * v / 2) / Math.sqrt(2 * Math.PI); });
  var zeros = g.map(function () { return 0; });

  // Bivariate standard normal density on the grid, scaled by h. plotly wants
  // z[i][j] at (x = g[j], y = g[i]), so rows are y.
  function density(rho, h) {
    var c = 1 - rho * rho, k = h / (2 * Math.PI * Math.sqrt(c)), z = new Array(n);
    for (var i = 0; i < n; i++) {
      var y = g[i], row = z[i] = new Array(n);
      for (var j = 0; j < n; j++) {
        var xx = g[j];
        row[j] = k * Math.exp(-(xx * xx - 2 * rho * xx * y + y * y) / (2 * c));
      }
    }
    return z;
  }

  function stageState(s) {
    return {
      view: s >= 1 ? 1 : 0,
      yMarg: s >= 1 ? 1 : 0,
      surf: s >= 2 ? 1 : 0,
      rho: rhos[Math.max(0, s - 2)]
    };
  }

  function clamp(u) { return Math.max(0, Math.min(1, u)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function camera(v) {
    var a = v.az * Math.PI / 180, e = v.el * Math.PI / 180;
    return {
      eye: { x: EYE_R * Math.cos(e) * Math.cos(a), y: EYE_R * Math.cos(e) * Math.sin(a), z: EYE_R * Math.sin(e) },
      up: { x: 0, y: 0, z: 1 }, center: { x: 0, y: 0, z: 0 }, projection: { type: 'orthographic' }
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
    var v = liveView(), p = v.camera.eye;
    var r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    return { az: Math.atan2(p.y, p.x) * 180 / Math.PI, el: Math.asin(p.z / r) * 180 / Math.PI,
             zoom: v.aspect.x };
  }

  // Caption overlay
  var CAPTIONS = [
    'Last week: <i>X</i> ∼ N(0, 1)',
    'A second random variable: <i>Y</i> ∼ N(0, 1)',
    'The <strong>joint</strong> density of (<i>X</i>, <i>Y</i>)'
  ];
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  var cap = document.createElement('div');
  cap.className = 'bvn-caption';
  cap.innerHTML = '<div class="bvn-main"></div><div class="bvn-rho"></div><div class="bvn-note"></div>';
  el.appendChild(cap);
  var capMain = cap.querySelector('.bvn-main'),
      capRho = cap.querySelector('.bvn-rho'),
      capNote = cap.querySelector('.bvn-note');

  function setCaption(s) {
    capMain.innerHTML = CAPTIONS[Math.min(s, CAPTIONS.length - 1)];
    capNote.textContent = s >= 3 ? 'Same marginals on the walls, different joint distribution' : '';
  }
  function fmtRho(r) {
    return 'ρ = ' + (r < -0.005 ? '−' : '') + Math.abs(r).toFixed(2);
  }

  // Push a state to the plot, touching only what changed since the last frame
  var cur = null, drawn = {};
  function draw(st, view) {
    var z = [], vis = [], idx = [], lay = {};
    if (st.surf !== drawn.surf || st.rho !== drawn.rho) {
      idx.push(TR.surf); z.push(density(st.rho, st.surf)); vis.push(st.surf > 0);
    }
    if (st.yMarg !== drawn.yMarg) {
      var line = phi.map(function (v) { return v * st.yMarg; }), on = st.yMarg > 0;
      idx.push(TR.yFill, TR.yLine); z.push(zeros.concat(line), line); vis.push(on, on);
      if (on !== (drawn.yMarg > 0)) {
        lay['scene.yaxis.showticklabels'] = on;
        lay['scene.yaxis.title.text'] = on ? 'y' : '';
        lay['scene.annotations[1].visible'] = on;
      }
    }
    if (view) {
      lay['scene.camera'] = camera(view);
      lay['scene.aspectratio'] = { x: view.zoom, y: view.zoom, z: Z_ASPECT * view.zoom };
    } else if (idx.length) {
      var live = liveView();
      lay['scene.camera'] = live.camera;
      lay['scene.aspectratio'] = live.aspect;
    }
    capRho.textContent = st.surf > 0 ? fmtRho(st.rho) : '';
    cur = drawn = st;
    if (idx.length) Plotly.update(gd, { z: z, visible: vis }, lay, idx);
    else if (Object.keys(lay).length) Plotly.relayout(gd, lay);
  }

  var camView = null, raf = null;
  function goTo(s, animate) {
    s = Math.max(0, Math.min(nStages - 1, s));
    var to = stageState(s), from = cur;
    var moveCam = to.view !== camView;
    camView = to.view;
    setCaption(s);
    if (raf) cancelAnimationFrame(raf);
    raf = null;

    if (!animate || !from) { draw(to, VIEWS[to.view]); return; }

    var v0 = moveCam ? currentView() : null, v1 = VIEWS[to.view];
    if (v0) {  // swing the short way round
      var d = ((v1.az - v0.az) % 360 + 540) % 360 - 180;
      v1 = { az: v0.az + d, el: v1.el, zoom: v1.zoom };
    }
    // Y's marginal grows after the camera has mostly turned, and shrinks
    // before it turns back
    var grow = to.yMarg > from.yMarg;
    var dur = moveCam ? 1800 : 1100, t0 = null;

    function frame(now) {
      if (t0 === null) t0 = now;
      var u = Math.min(1, (now - t0) / dur), e = ease(u);
      var ey = moveCam ? ease(clamp(grow ? (u - 0.35) / 0.65 : u / 0.65)) : e;
      draw({
        view: to.view,
        yMarg: lerp(from.yMarg, to.yMarg, ey),
        surf: lerp(from.surf, to.surf, e),
        rho: lerp(from.rho, to.rho, e)
      }, v0 ? { az: lerp(v0.az, v1.az, e), el: lerp(v0.el, v1.el, e), zoom: lerp(v0.zoom, v1.zoom, e) } : null);
      raf = u < 1 ? requestAnimationFrame(frame) : null;
    }
    raf = requestAnimationFrame(frame);
  }

  // Reveal wiring. Reveal's events bubble to document, which is also safe to
  // listen on before Reveal has initialised.
  var slide = el.closest('section');
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.bvn-step.visible').length : 0;
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
