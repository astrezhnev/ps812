# ---------------------------------------------------------------------------
# Densities with the same mean (0) and variance (1), for the week 6
# animation that cycles through them (dists.js). Each is evaluated on a
# common grid so the curve can morph from one to the next; the script checks
# each mean and variance by numerical integration before writing. Run:
#   Rscript make_dists.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages(library(jsonlite))

outfile <- "dists.json"
x <- seq(-4, 4, length.out = 401)

a <- 0.9                      # bimodal mixture: two normals at +/- a
k <- 2.5                      # gamma shape for the skewed densities
b <- 1 / sqrt(2)              # Laplace scale
ct <- sqrt(3 / 5)             # t with 5 df, rescaled to variance 1

dens <- list(
  normal  = function(x) dnorm(x),
  uniform = function(x) dunif(x, -sqrt(3), sqrt(3)),
  bimodal = function(x) 0.5 * dnorm(x, -a, sqrt(1 - a^2)) + 0.5 * dnorm(x, a, sqrt(1 - a^2)),
  rskew   = function(x) sqrt(k) * dgamma(sqrt(k) * x + k, shape = k),
  laplace = function(x) exp(-abs(x) / b) / (2 * b),
  lskew   = function(x) sqrt(k) * dgamma(-sqrt(k) * x + k, shape = k),
  t5      = function(x) dt(x / ct, df = 5) / ct
)

# Check every density integrates to 1 with mean 0 and variance 1 (over the
# whole line, not just the plotted grid)
for (nm in names(dens)) {
  f <- dens[[nm]]
  m <- vapply(0:2, function(p) integrate(function(z) z^p * f(z), -Inf, Inf,
                                         rel.tol = 1e-8, subdivisions = 1000)$value, numeric(1))
  stopifnot(abs(m[1] - 1) < 1e-4, abs(m[2]) < 1e-4, abs(m[3] - 1) < 1e-4)
}

out <- list(
  x     = x,
  names = names(dens),
  y     = lapply(dens, function(f) round(f(x), 5))
)
writeLines(toJSON(out, auto_unbox = TRUE, digits = NA), outfile)
cat("Wrote", length(dens), "densities on", length(x), "points to", outfile, "\n")
