# Conditioning widget (week 2)

An R Shiny app that shows how the distribution of 3-category party ID changes
as you condition on stated policy preferences, using the CES Common Content
2025 (n = 17,000), weighted by `commonweight`.

It runs **in the browser** through [shinylive](https://posit-dev.github.io/r-shinylive/),
compiled to WebAssembly — there is no Shiny server, so it works on the static
course site.

## Files

| File | Role |
| --- | --- |
| `app.R` | The app itself. **Edit this.** |
| `items.csv` | The 38 support/oppose items: variable, topic group, button label, full question text. |
| `ces25_pid_policy.csv` | The committed data extract (~850 KB): party ID, weight, packed answer string, abortion response. |
| `prepare_data.R` | Rebuilds the extract from the full CES Stata file. |
| `build_app_qmd.R` | Regenerates `../ces_conditioning_app.qmd` from the three files above. |

## Workflow

After editing `app.R`:

```sh
Rscript build_app_qmd.R
quarto render ../ces_conditioning_app.qmd
```

`ces_conditioning_app.qmd` is **generated** — don't edit it by hand. shinylive
has no filesystem to read from, so every file the app opens has to be inlined
into that page as a `## file:` block; the build script is what keeps the
inlined copy in sync with the sources here.

The week 2 deck embeds the rendered page in an `<iframe>` on the
`{.app-slide}` slide, which keeps the deck itself `embed-resources: true`.
Because of that iframe, the widget only appears when the deck is served from
the site (or `quarto preview`) — not when `week2_conditional_probability.html`
is opened as a lone file.

## Rebuilding the data

Download `CES25_Common.dta` from
<https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/DFUGJR>
into this folder (it is gitignored — 59 MB), then:

```sh
Rscript prepare_data.R
Rscript build_app_qmd.R
```

`items.csv` is hand-maintained: the CES variable labels are truncated at 80
characters, so the button labels and full question text were written from the
questionnaire PDF in the same Dataverse release.
