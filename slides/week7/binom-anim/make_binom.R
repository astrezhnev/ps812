# ---------------------------------------------------------------------------
# The scaled error of the sample mean of n i.i.d. Bernoulli(p) draws, for the
# week 7 CLT animation (binom.js). With X_n ~ Binomial(n, p) the sum of the
# draws and sigma^2 = p(1 - p),
#   S_n = sqrt(n) (Ybar_n - p) = (X_n - n p) / sqrt(n)
# Cumulants add over independent draws and the r-th scales by c^r, so the r-th
# cumulant of S_n is n * kappa_r / n^(r/2). Standardized by sigma^r that is
#   variance          kappa_2 / sigma^2 = 1                (fixed)
#   skewness          kappa_3 / sigma^3 = gamma_1 / sqrt(n)
#   excess kurtosis   kappa_4 / sigma^4 = gamma_2 / n
# with gamma_1, gamma_2 those of a single draw; the normal has 1, 0, 0. binom.js
# draws these from the single-draw values (kappa) and the rates (rate). For
# each n we also keep
#   pmf  the PMF of S_n drawn as a histogram: each value (k - n p) / sqrt(n)
#        gets a bar of width 1 / sqrt(n), so its area is Pr(X_n = k) and the
#        bars sit on the same scale as the N(0, sigma^2) density
# on a common grid s in [-5, 5] * sigma, plus the N(0, sigma^2) density. Run:
#   Rscript make_binom.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages(library(jsonlite))

outfile <- "binom.json"
p <- 0.1                        # skewed enough that both cumulants start large
q <- 1 - p
sigma <- sqrt(p * q)
n_vals <- c(1, 2, 4, 10, 25, 50, 100, 200, 400)
s_lim <- 5 * sigma
s <- seq(-s_lim, s_lim, length.out = 801)

# Standardized cumulants of one draw, and how fast each shrinks in n
kappa <- c(1, (q - p) / sigma, (1 - 6 * p * q) / sigma^2)
rate <- c(0, 0.5, 1)

pmf <- lapply(n_vals, function(n) {
  k <- round(n * p + s * sqrt(n))       # the bar each grid point falls under
  ifelse(k >= 0 & k <= n, dbinom(pmax(k, 0), n, p) * sqrt(n), 0)
})

# Each histogram should hold (nearly) all its probability inside the grid
area <- sapply(pmf, function(h) sum(h) * diff(s[1:2]))
stopifnot(all(abs(area - 1) < 0.02))

# Check the formulas against the exact binomial moments of S_n / sigma
exact <- t(sapply(n_vals, function(n) {
  z <- ((0:n) - n * p) / sqrt(n) / sigma
  w <- dbinom(0:n, n, p)
  m <- sapply(2:4, function(r) sum(w * z^r))
  c(m[1], m[2] / m[1]^1.5, m[3] / m[1]^2 - 3)
}))
formula <- outer(n_vals, rate, function(n, r) n^-r) * rep(kappa, each = length(n_vals))
stopifnot(all(abs(exact - formula) < 1e-8))

out <- list(p = p, sigma2 = p * q, n = n_vals, s = s, slim = s_lim,
            pdf_ymax = 0.5 / sigma, cum_ymax = 6,
            kappa = round(kappa, 4), rate = rate,
            pmf = lapply(pmf, round, 5),
            pdf_lim = round(dnorm(s, sd = sigma), 5))
writeLines(toJSON(out, digits = NA, auto_unbox = TRUE), outfile)

print(data.frame(n = n_vals, hist_area = round(area, 4),
                 skewness = round(formula[, 2], 3), ex_kurtosis = round(formula[, 3], 3)))
