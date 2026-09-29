# Bivariate normal slicing widget (week 4)

An R Shiny app for the bivariate normal. Sliders set the two means, the two
SDs and the correlation ρ. A 3D panel draws the joint density with each
marginal standing on a back wall, and a vertical slice at X = x (or Y = y)
cuts through the surface. The lower panel rescales that cross-section to area 1
and plots it against the marginal of the other variable. It also reports the
conditional SD against the marginal SD: their ratio is √(1 − ρ²), so a highly
correlated pair gives a much tighter conditional distribution. An optional
dashed line on the floor traces the conditional mean E[Y | X = x], and the
slice slider has a play button that sweeps the slice across the surface.

It runs **in the browser** through [shinylive](https://posit-dev.github.io/r-shinylive/),
compiled to WebAssembly, so it works on the static course site.

The 3D panel is drawn by plotly.js (the 3D-only `plotly.js-gl3d-dist-min`
bundle, loaded from jsDelivr), not by the plotly R package, which would add
ggplot2, data.table, httr and more to the in-browser download. R computes every
number and sends the arrays to the page; the JavaScript in `app.R` only draws
them.

## Files

| File | Role |
| --- | --- |
| `app.R` | The app itself. **Edit this.** |
| `build_app_qmd.R` | Regenerates `../bivariate_normal_app.qmd` from `app.R`. |

## Workflow

After editing `app.R`:

```sh
Rscript build_app_qmd.R
quarto render ../bivariate_normal_app.qmd
```

`bivariate_normal_app.qmd` is **generated**, so don't edit it by hand:
shinylive has no filesystem, so the app is inlined into that page as a
`## file:` block.

The week 4 deck frames the rendered page in an `<iframe>` on the
`{.app-slide}` slide, so the widget only appears when the deck is served from
the site (or `quarto preview`), not when the deck's `.html` is opened on its own.
