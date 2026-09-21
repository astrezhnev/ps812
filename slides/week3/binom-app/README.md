# Binomial fitting widget (week 3)

An R Shiny app that puts the list-experiment counts from the 2012 Mexico Panel
Study (Wave 2) next to a Binomial(J, π) with π set by a slider, for the 3-item
control list and the 4-item treated list. Each list gets its PMF and CDF, plus
two measures of fit: the overlap of the two PMFs and the largest vertical gap
between the two CDFs.

It runs **in the browser** through [shinylive](https://posit-dev.github.io/r-shinylive/),
compiled to WebAssembly, so it works on the static course site.

## Files

| File | Role |
| --- | --- |
| `app.R` | The app itself. **Edit this.** |
| `build_app_qmd.R` | Regenerates `../binomial_app.qmd` from `app.R` and `../data/mexico_list.csv`. |

The data is the same extract the slides load, built by `../data/prepare_data.R`.

## Workflow

After editing `app.R` or the data:

```sh
Rscript build_app_qmd.R
quarto render ../binomial_app.qmd
```

`binomial_app.qmd` is **generated**, so don't edit it by hand: shinylive has no
filesystem, so the app and its data are inlined into that page as `## file:`
blocks.

The week 3 deck frames the rendered page in an `<iframe>` on the
`{.app-slide}` slide, so the widget only appears when the deck is served from
the site (or `quarto preview`), not when the deck's `.html` is opened on its own.
