# BISG widget (week 2)

An R Shiny app showing **Bayesian Improved Surname Geocoding** as a direct
application of Bayes' rule:

```
P(race | surname, county)  ∝  P(surname | race) · P(race | county)
```

Pick one of 40 surnames and one of 6 counties; the left panel shows the
posterior over the five race categories wru uses (White, Black, Hispanic,
Asian, Other), with the county-only prior and the surname-only prediction
underneath as 100% stacked bars.

It runs **in the browser** through [shinylive](https://posit-dev.github.io/r-shinylive/),
compiled to WebAssembly — no Shiny server, so it works on the static course site.

## Files

| File | Role |
| --- | --- |
| `app.R` | The app itself. **Edit this.** |
| `bisg_names.csv` | 40 surnames and their `P(surname | race)`, in menu order. ~3 KB. |
| `bisg_geos.csv` | 6 counties: `P(race | county)` and population. ~0.7 KB. |
| `prepare_data.R` | Rebuilds both CSVs. Needs a Census API key. |
| `build_app_qmd.R` | Regenerates `../bisg_app.qmd` from the files above. |

## Workflow

After editing `app.R`:

```sh
Rscript build_app_qmd.R
quarto render ../bisg_app.qmd
```

`bisg_app.qmd` is **generated** — don't edit it by hand.

## Rebuilding the data

```sh
export CENSUS_API_KEY=your_key_here
Rscript prepare_data.R
Rscript build_app_qmd.R
```

The key is read from the environment and never written into the repo.

### Where the two ingredients come from

**`P(race | county)` — needs the API key.** 2020 Census Decennial DHC, table
P12 by race iteration, the same variables `wru` itself requests:

| wru category | DHC variables |
| --- | --- |
| White | `P12I_001N` (White alone, not Hispanic) |
| Black | `P12J_001N` (Black alone, not Hispanic) |
| Hispanic | `P12H_001N` (Hispanic of any race) |
| Asian | `P12L_001N` + `P12M_001N` (Asian, NHPI alone NH) |
| Other | `P12K_001N` + `P12N_001N` + `P12O_001N` (AIAN, other, two or more, NH) |

The Census API **requires a key** — an unkeyed request 302-redirects to
`missing_key.html`. Get one at <https://api.census.gov/data/key_signup.html>.

**`P(surname | race)` — no key.** `wru`'s own dictionary
(`wru-data-census_last_c.rds`), pulled from the package's GitHub release by
`wru:::wru_data_preflight()`.

> This is **not** the `wru::surnames2010` table bundled with the package. That
> table holds `P(race | surname)`, and inverting it with the national race
> margins does not reproduce the dictionary — the worst case among the names
> used here is SMITH, 0.709 White in `surnames2010` against 0.663 implied by
> the dictionary. Only the dictionary reproduces `wru::predict_race()`.

### Verification

The CSV-driven arithmetic in `app.R` was checked against
`wru::predict_race(census.geo = "county", year = "2020")` over all
40 × 6 = 240 combinations: **maximum absolute difference 9.1e-06**, which is
the rounding applied when writing the CSVs.

## Why the CSVs are tiny

BISG needs only two small tables, not a person-level file: five numbers per
surname and five per county. 40 names + 6 counties is under 4 KB total, so
both are committed and the app needs no network access at runtime.

## Choosing the counties

Picked to span the composition space, so the prior visibly moves the answer:

| County | White | Black | Hispanic | Asian | Other |
| --- | --- | --- | --- | --- | --- |
| Dane, WI | .76 | .05 | .07 | .06 | .05 |
| Milwaukee, WI | .49 | .26 | .16 | .05 | .05 |
| Prince George's, MD | .11 | .59 | .21 | .04 | .04 |
| Hidalgo, TX | .06 | .00 | .92 | .01 | .01 |
| Honolulu, HI | .17 | .02 | .09 | .52 | .20 |
| Queens, NY | .23 | .16 | .28 | .27 | .06 |

The teaching case is **LEE**, which the surname alone leaves genuinely split
(49% Asian, 28% White, 14% Black). The county resolves it: 51% Asian in Dane,
59% *Black* in Prince George's, 92% Asian in Honolulu.

## Menu order

The surnames are presented as one unlabelled grid, deliberately: which group a
name points to is what students are meant to discover by clicking, so the menu
must not announce it. `prepare_data.R` shuffles the list under a fixed seed
(812) and writes it to the CSV in that order, with LEE first because the app
opens on it. The seed keeps the grid stable across rebuilds. The list is kept
at exactly 40 so the menu fills a clean 5 x 8 grid.
