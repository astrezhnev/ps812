# CLT approximation widget (week 7)

An R Shiny app for checking how well the central limit theorem's normal
approximation describes the sampling distribution of a sample mean.

- **Population:** set by its mean and variance. Discrete: Bernoulli and
  Poisson. Continuous: normal, uniform, exponential, gamma, log-normal and
  Pareto. Bernoulli, Poisson and exponential have a variance fixed by the mean
  (μ(1 − μ), μ and μ²), so their variance slider is greyed out and follows the
  mean. The others have a free variance. The set runs from populations where
  the CLT is close almost at once (uniform, normal) to ones where it is slow
  even at large n (log-normal, and Pareto, whose variance is finite but whose
  tail is heavy).
- **Sampling design:** a simple random sample of n i.i.d. draws by default. A
  dropdown switches to a clustered sample of G clusters of m units
  (n = G × m) with intra-cluster correlation ρ, or to a **serially
  correlated** sample of n units in a row (a time series, or units along a
  line) with corr(Yᵢ, Yⱼ) = ρ^|i−j|.

Pressing **Simulate** repeats the sampling R times and plots the R sample
means against the CLT normal, N(μ, σ²/n). Under a clustered or serially
correlated design it plots two normal curves instead:

- the **adjusted CLT** normal, N(μ, σ² · deff / n), which has the sample
  mean's true variance under the design, and
- the **i.i.d. CLT** normal, N(μ, σ²/n), which ignores the dependence.

The design effect is deff = 1 + (m − 1)ρ under clustering and
deff = 1 + 2 Σₖ (1 − k/n) ρᵏ under serial correlation. The serial one tends to
(1 + ρ)/(1 − ρ) as n grows, so for any ρ < 1 the CLT still holds, just with
fewer effective observations. At ρ = 1 every unit equals the first, so
Ȳ = Y₁ has the population's own shape whatever n is: the CLT fails.

Both use the true σ², so neither involves a t distribution.

The app reports the Kolmogorov–Smirnov distance (the largest vertical gap
between the simulated CDF and each normal CDF) and marks where it is reached
on a CDF panel. It reads each distance against 1.36/√R, the level that
simulation noise alone stays under 95% of the time when the fit is perfect:
either "within noise" or a multiple of that level. For a discrete population
the sample mean lives on a lattice with spacing 1/n, so the KS distance can't
reach zero for small n even when the shape is close to normal.

KS mostly reflects the center of the distribution, while inference lives in
the tails. So the app also reports **tail coverage**: how often the interval
Ȳ ± 1.96 SE covers μ (target 95%), and how the misses split between Ȳ too
low and Ȳ too high (2.5% each if the approximation holds). A skewed sampling
distribution shows up as lopsided misses even when total coverage looks fine.
Under clustering, coverage is reported for both the cluster-adjusted and the
i.i.d. SE. The noise level shown, 1.96·√(0.05·0.95/R), is the simulation
error in a 95% coverage rate.

The lower-right panel switches between the CDFs (with the KS gap marked) and
a **Q-Q plot**: the simulated quantiles of Ȳ against the CLT normal's, both in
SEs from μ. On the normal the points follow the solid line; skew bends them,
and heavy tails give an S-shape. Under clustering the i.i.d. CLT normal is the
flatter dashed line, with slope (i.i.d. SE)/(cluster-adjusted SE).

Clustering keeps each response's distribution equal to the population's and
makes the correlation between two units in the same cluster exactly ρ. Where
the family allows it, each response is a cluster component shared within the
cluster plus a unit component of its own:

| Population | Response |
| --- | --- |
| Normal(μ, σ²) | μ + N(0, ρσ²) + N(0, (1 − ρ)σ²) |
| Poisson(λ) | Pois(ρλ) + Pois((1 − ρ)λ) |
| Exponential(rate) | Gamma(ρ, rate) + Gamma(1 − ρ, rate) |
| Gamma(k, rate) | Gamma(ρk, rate) + Gamma((1 − ρ)k, rate) |
| Bernoulli(p) | Bern(p_g), with the cluster's p_g ~ Beta(p(1 − ρ)/ρ, (1 − p)(1 − ρ)/ρ) |
| Log-normal | exp of a normal random-effects model on the log scale, with log-scale ICC r = log(1 + ρ(e^{s²} − 1))/s² so the ICC on the original scale is ρ |

The uniform and the Pareto have no such split. There each unit gives its
cluster's shared draw with probability √ρ and a draw of its own otherwise, so
two units in a cluster share a draw (and so correlate) with probability ρ.

Serial correlation likewise keeps each response's distribution equal to the
population's, with corr(Yᵢ, Yⱼ) = ρ^|i−j| exactly. Each response is built from
the one before:

| Population | Yᵢ given Yᵢ₋₁ |
| --- | --- |
| Normal(μ, σ²) | μ + ρ(Yᵢ₋₁ − μ) + N(0, (1 − ρ²)σ²) |
| Poisson(λ) | Binomial(Yᵢ₋₁, ρ) + Pois((1 − ρ)λ) |
| Gamma(k, rate), exponential (k = 1) | Beta(ρk, (1 − ρ)k) · Yᵢ₋₁ + Gamma((1 − ρ)k, rate) |
| Bernoulli, uniform, log-normal, Pareto | Yᵢ₋₁ with probability ρ, a fresh draw otherwise |

A run is capped at 10⁷ draws, so for large n the app runs fewer samples than
requested and says so.

It runs **in the browser** through [shinylive](https://posit-dev.github.io/r-shinylive/),
compiled to WebAssembly, so it works on the static course site. It uses only
base R and shiny, since every extra package is another download.

## Files

| File | Role |
| --- | --- |
| `app.R` | The app itself. **Edit this.** |
| `build_app_qmd.R` | Regenerates `../clt_app.qmd` from `app.R`. |

## Workflow

After editing `app.R`:

```sh
Rscript build_app_qmd.R
quarto render ../clt_app.qmd
```

`clt_app.qmd` is **generated**, so don't edit it by hand: shinylive has no
filesystem, so the app is inlined into that page as a `## file:` block.

The week 7 deck frames the rendered page in an `<iframe>` on the
`{.app-slide}` slide, so the widget only appears when the deck is served from
the site (or `quarto preview`), not when the deck's `.html` is opened on its own.
