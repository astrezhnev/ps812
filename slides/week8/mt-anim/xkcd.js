function (el, d) {
  // xkcd 882 ("Significant"), frame by frame: the comic is one tall image
  // and each stage pans and zooms the viewport onto one region of it -- the
  // three opening panels, each row of the twenty colors, a close-up on
  // green, the newspaper, and finally the whole strip; the rest of the image
  // is clipped away. The image is the <img> inside el; d.width and d.height
  // are its size and d.frames lists the regions as [x, y, width, height] in
  // image pixels. One stage per .xk-step fragment.
  var img = el.querySelector('img');
  var PAD = 0.04;
  img.style.position = 'absolute';
  img.style.left = '0';
  img.style.top = '0';
  img.style.maxWidth = 'none';
  img.style.maxHeight = 'none';
  img.style.margin = '0';
  img.style.transformOrigin = '0 0';

  function place(s, animate) {
    var f = d.frames[s], W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return;
    var k = Math.min(W / f[2], H / f[3]) * (1 - PAD);
    var tx = W / 2 - k * (f[0] + f[2] / 2), ty = H / 2 - k * (f[1] + f[3] / 2);
    var ease = '1.1s cubic-bezier(0.65, 0, 0.35, 1)';
    img.style.transition = animate ? 'transform ' + ease + ', clip-path ' + ease : 'none';
    // Show only the frame: clip the image (in its own pixels) to the region
    img.style.clipPath = 'inset(' + f[1] + 'px ' + (d.width - f[0] - f[2]) + 'px ' +
                         (d.height - f[1] - f[3]) + 'px ' + f[0] + 'px)';
    img.style.width = d.width + 'px';
    img.style.transform = 'translate(' + tx.toFixed(1) + 'px, ' + ty.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
  }

  var slide = el.closest('section'), cur = -1;
  function fragmentStage() {
    return slide ? slide.querySelectorAll('.fragment.xk-step.visible').length : 0;
  }
  function goTo(s, animate) {
    s = Math.max(0, Math.min(d.frames.length - 1, s));
    if (s === cur) return;
    place(s, animate && cur >= 0);
    cur = s;
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
      if (e.currentSlide === slide) { cur = -1; goTo(fragmentStage(), false); }
    });
  });
  if (img.complete) goTo(fragmentStage(), false);
  else img.addEventListener('load', function () { cur = -1; goTo(fragmentStage(), false); });
}
