function (el, x, cfg) {
  // Stepped animation for the "one variable to two" slide, attached to the
  // plotly widget with htmlwidgets::onRender().
  //
  //   stages 0-5   last week's N(0, 1) density, seen head-on so it reads as
  //                2D, stepping through cfg.walk: the mean moves up, down, and
  //                back to 0, then the SD widens, narrows, and returns to 1
  //   next         camera swings into 3D; Y's marginal grows on the side wall
  //   next         the joint density rises out of the floor at rho = rhos[0],
  //                and the marginals fade back to thin, faint curves so the
  //                surface is what the eye goes to
  //   then         one stage per remaining rho; the marginals stay put
  //
  // Stages follow the slide's .bvn-step fragments, so the clicker, arrow keys
  // and a click on the plot (a drag rotates it instead) all step through them,
  // and stepping backwards runs the animation in reverse. The slide title
  // changes with the stages too.
  var gd = el;
  var g = [].concat(cfg.grid), n = g.length;
  var rhos = [].concat(cfg.rhos);
  var walk = [].concat(cfg.walk);                  // [{mu, sd}, ...], starting at N(0, 1)
  var S3D = walk.length, SJOINT = S3D + 1;         // first 3D stage, first joint stage
  var nStages = SJOINT + rhos.length;
  // Trace order set in the R chunk: surface, X's fill and line, Y's fill and line

  // How far the marginals recede once the joint density is up
  var BOLD = { width: 7, line: 1, fill: 0.15, label: 1 },
      QUIET = { width: 3.5, line: 0.45, fill: 0.06, label: 0.55 };

  // Camera azimuth / elevation in degrees. With an orthographic camera plotly
  // ignores the eye's distance, so zoom scales the scene's aspect ratio instead.
  var VIEWS = [
    // Looking along +y at the x-z wall. Dead-on (-90, 0) leaves plotly free to
    // put the density labels on either side and shows no floor; half a degree
    // round pins them to the left, and a degree up keeps x's labels below with
    // the floor still only a hairline.
    { az: -89.5, el: 1, zoom: 2.3 },
    { az: -62, el: 34, zoom: 1.2 }
  ];
  var EYE_R = 1.25, Z_ASPECT = 0.7;

  function dnorm(v, mu, sd) {
    var u = (v - mu) / sd;
    return Math.exp(-u * u / 2) / (sd * Math.sqrt(2 * Math.PI));
  }
  var phi = g.map(function (v) { return dnorm(v, 0, 1); });
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
    var w = walk[Math.min(s, walk.length - 1)];
    return {
      view: s >= S3D ? 1 : 0,
      // The 2D stages need headroom for the narrowest curve; 3D doesn't
      zTop: s >= S3D ? cfg.ztop3d : cfg.ztop2d,
      mu: w.mu, sd: w.sd,
      yMarg: s >= S3D ? 1 : 0,
      surf: s >= SJOINT ? 1 : 0,
      rho: rhos[Math.max(0, s - SJOINT)]
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

  // The slide title: one for the 2D stages, one for the swing into 3D, one after
  var slide = el.closest('section');
  var title = slide && slide.querySelector('h2');
  function setTitle(s) {
    if (title) title.textContent = s < S3D ? 'From one random variable...' :
                                   s === S3D ? '...to two!' : 'Joint distributions';
  }

  // Push a state to the plot. All five traces go in one update: attributes a
  // trace type doesn't have (cmax on a line, line.width on a mesh) are ignored.
  var cur = null, drawn = {}, surfZ = null;
  function draw(st, view) {
    if (!surfZ || st.surf !== drawn.surf || st.rho !== drawn.rho) surfZ = density(st.rho, st.surf);
    var q = st.surf;
    var xl = g.map(function (v) { return dnorm(v, st.mu, st.sd); }),
        yl = phi.map(function (v) { return v * st.yMarg; });
    var fill = lerp(BOLD.fill, QUIET.fill, q), line = lerp(BOLD.line, QUIET.line, q),
        width = lerp(BOLD.width, QUIET.width, q), yOn = st.yMarg > 0;
    // The colour scale spans the surface's own height, so its peak is always
    // the darkest purple on screen
    var peak = Math.max(1e-6, q / (2 * Math.PI * Math.sqrt(1 - st.rho * st.rho)));
    var upd = {
      z: [surfZ, zeros.concat(xl), xl, zeros.concat(yl), yl],
      visible: [q > 0, true, true, yOn, yOn],
      opacity: [1, fill, line, fill, line],
      cmax: [peak, peak, peak, peak, peak],
      'line.width': [width, width, width, width, width]
    };
    var lay = {
      'scene.zaxis.range': [0, st.zTop],
      // X's label rides along about 1.25 SDs to the right of its mean
      'scene.annotations[0].x': Math.min(st.mu + 1.25 * st.sd, g[n - 1] - 0.3),
      'scene.annotations[0].z': 0.75 * dnorm(0, 0, st.sd)
    };
    lay['scene.annotations[0].opacity'] = lay['scene.annotations[1].opacity'] =
      lerp(BOLD.label, QUIET.label, q);
    if (yOn !== (drawn.yMarg > 0)) {
      lay['scene.yaxis.showticklabels'] = yOn;
      lay['scene.yaxis.title.text'] = yOn ? 'y' : '';
      lay['scene.annotations[1].visible'] = yOn;
    }
    if (view) {
      lay['scene.camera'] = camera(view);
      lay['scene.aspectratio'] = { x: view.zoom, y: view.zoom, z: Z_ASPECT * view.zoom };
    } else {
      var live = liveView();
      lay['scene.camera'] = live.camera;
      lay['scene.aspectratio'] = live.aspect;
    }
    cur = drawn = st;
    Plotly.update(gd, upd, lay, [0, 1, 2, 3, 4]);
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
        zTop: lerp(from.zTop, to.zTop, e),
        mu: lerp(from.mu, to.mu, e), sd: lerp(from.sd, to.sd, e),
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
