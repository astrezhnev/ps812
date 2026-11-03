function (el, x, cfg) {
  // Stepped animation for the two-covariate regression slide, attached to the
  // plotly widget with htmlwidgets::onRender(), in the manner of the week 4
  // CEF animation (cef-anim/cef_joint.js).
  //
  //   stage 0   the 3D scatterplot of Y against the two covariates
  //   stage 1   a surface fades in and bends from cfg.from into cfg.beta,
  //             each the coefficients of b0 + b1 x + b2 y + b3 xy: from a
  //             flat plane at the mean of Y to the OLS plane, or from the OLS
  //             plane to the fit with an interaction
  //   stage 2   lines along the surface where the second covariate is held
  //             fixed: each has slope b1 + b3 y
  //
  // While the slide is up the camera swings slowly back and forth so the
  // depth reads; a drag on the plot takes over the camera (turntable) and
  // stops the swing until the slide is next entered. Stages follow the
  // slide's .pl-step fragments, so the clicker, arrow keys and a click on the
  // plot all step through them, and stepping backwards runs them in reverse.
  // The slide title is cfg.titles[stage] ("" keeps the slide's own heading).
  var gd = el;
  var g = [].concat(cfg.grid);
  var B = cfg.beta, F = cfg.from;
  // Trace order set in the R chunk: points, plane, fixed-y lines
  var T_PLANE = 1, T_SLICE = 2;
  var nStages = cfg.titles.length;
  var PLANE_OP = 0.35;

  // Camera azimuth / elevation in degrees, orthographic as in week 4. The
  // swing is a slow sine about AZ, so the axes never turn their backs.
  var AZ = -125, EL = 22, SWING = 28, PERIOD = 14000, EYE_R = 1.25;

  function clamp(u) { return Math.max(0, Math.min(1, u)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function camera(az) {
    var a = az * Math.PI / 180, e = EL * Math.PI / 180;
    return {
      eye: { x: EYE_R * Math.cos(e) * Math.cos(a), y: EYE_R * Math.cos(e) * Math.sin(a), z: EYE_R * Math.sin(e) },
      up: { x: 0, y: 0, z: 1 }, center: { x: 0, y: 0, z: -0.05 }, projection: { type: 'orthographic' }
    };
  }
  // plotly only writes a drag back to the layout some time after it ends,
  // and a restyle before then snaps the camera back to the stale layout copy,
  // so read the live scene instead (as in week 4)
  function liveCamera() {
    var s = gd._fullLayout.scene._scene;
    return s && s.getCamera ? s.getCamera() : gd.layout.scene.camera;
  }

  function stageState(s) {
    return { plane: s >= 1 ? 1 : 0, slice: s >= 2 ? 1 : 0 };
  }

  var slide = el.closest('section');
  var title = slide && slide.querySelector('h2');
  var heading = title ? title.textContent : '';
  function setTitle(s) { if (title) title.textContent = cfg.titles[s] || heading; }

  // The surface at tilt t: cfg.from (t = 0) to cfg.beta (t = 1). Rows are y,
  // as plotly wants.
  function surf(c, xv, yv) { return c[0] + c[1] * xv + c[2] * yv + c[3] * xv * yv; }
  function planeZ(t) {
    return g.map(function (yv) {
      return g.map(function (xv) { return lerp(surf(F, xv, yv), surf(B, xv, yv), t); });
    });
  }

  // Push a state to the plot. The plane fades in over the first part of its
  // stage and then tilts, so the viewer sees it start flat.
  var cur = null;
  function draw(st) {
    var fade = clamp(st.plane / 0.3), tilt = ease(clamp((st.plane - 0.3) / 0.7));
    cur = st;
    Plotly.restyle(gd, { z: [planeZ(tilt)] }, [T_PLANE]);
    Plotly.update(gd,
      { opacity: [PLANE_OP * fade, st.slice], visible: [st.plane > 0, st.slice > 0] },
      { 'scene.camera': liveCamera() }, [T_PLANE, T_SLICE]);
  }

  var raf = null;
  function goTo(s, animate) {
    s = Math.max(0, Math.min(nStages - 1, s));
    var to = stageState(s), from = cur;
    setTitle(s);
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (!animate || !from) { draw(to); return; }
    var dur = to.plane !== from.plane ? 2200 : 900, t0 = null;
    raf = requestAnimationFrame(function frame(now) {
      if (t0 === null) t0 = now;
      var u = Math.min(1, (now - t0) / dur);
      // The plane's own fade-then-tilt does the easing; the lines just fade
      draw({ plane: lerp(from.plane, to.plane, u), slice: lerp(from.slice, to.slice, ease(u)) });
      raf = u < 1 ? requestAnimationFrame(frame) : null;
    });
  }

  // ---- The swing -----------------------------------------------------------
  // About 30 camera updates a second, only while this slide is current and
  // the viewer hasn't taken the camera
  var spin = null, held = false, spinT0 = null, last = 0;
  function spinFrame(now) {
    if (held || !onThisSlide()) { spin = null; return; }
    if (spinT0 === null) spinT0 = now;
    if (now - last > 33) {
      last = now;
      var az = AZ + SWING * Math.sin(2 * Math.PI * (now - spinT0) / PERIOD);
      Plotly.relayout(gd, { 'scene.camera': camera(az) });
    }
    spin = requestAnimationFrame(spinFrame);
  }
  function startSpin() {
    if (spin) cancelAnimationFrame(spin);
    held = false; spinT0 = null; last = 0;
    spin = requestAnimationFrame(spinFrame);
  }

  // ---- Reveal wiring, as in week 4 ------------------------------------------
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.pl-step.visible').length : 0;
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
      if (e.currentSlide === slide) {
        Plotly.Plots.resize(gd);
        Plotly.relayout(gd, { 'scene.camera': camera(AZ) });
        cur = null;
        goTo(fragmentStage(), false);
        startSpin();
      }
    });
  });

  // A drag takes the camera; a click (not a drag) advances the deck like the
  // clicker does
  var down = null;
  el.addEventListener('pointerdown', function (e) {
    down = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, true);
  el.addEventListener('pointermove', function (e) {
    if (down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) >= 6) held = true;
  }, true);
  el.addEventListener('pointerup', function (e) {
    var click = down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) < 6 &&
                Date.now() - down.t < 500;
    down = null;
    if (click && window.Reveal) Reveal.next();
  }, true);

  Plotly.relayout(gd, { 'scene.camera': camera(AZ) });
  goTo(fragmentStage(), false);
  if (onThisSlide()) startSpin();
}
