# ---------------------------------------------------------------------------
# The scaled error of the sample mean of n i.i.d. Bernoulli(p) draws, for the
# week 7 CLT animation (binom.js). With X_n ~ Binomial(n, p) the sum of the
# draws and sigma^2 = p(1 - p),
#   S_n = sqrt(n) (Ybar_n - p) = (X_n - n p) / sqrt(n)
# For each n we keep, on common grids so the curves can morph from one n to
# the next:
#   mgf  the MGF of S_n, [M_W(t / sqrt(n))]^n with W = Y - p, on a grid of t
#   pmf  the PMF of S_n drawn as a histogram: each value (k - n p) / sqrt(n)
#        gets a bar of width 1 / sqrt(n), so its area is Pr(X_n = k) and the
#        bars sit on the same scale as the N(0, sigma^2) density
# plus the two limits, e^(sigma^2 t^2 / 2) and the N(0, sigma^2) density. The
# grids span t in [-2, 2] / sigma and s in [-4, 4] * sigma, so the picture has
# the same shape for any p. Run:
#   Rscript make_binom.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages(library(jsonlite))

outfile <- "binom.json"
p <- 0.2
sigma <- sqrt(p * (1 - p))
n_vals <- c(1, 2, 4, 10, 25, 100, 400)
t_lim <- 2 / sigma
s_lim <- 4 * sigma
t <- seq(-t_lim, t_lim, length.out = 401)
s <- seq(-s_lim, s_lim, length.out = 801)
mgf_cap <- 15                   # off the top of the plot; keeps the paths short

# MGF of one centered draw W = Y - p
M_W <- function(u) (1 - p) * exp(-u * p) + p * exp(u * (1 - p))

mgf <- lapply(n_vals, function(n) pmin(M_W(t / sqrt(n))^n, mgf_cap))

pmf <- lapply(n_vals, function(n) {
  k <- round(n * p + s * sqrt(n))       # the bar each grid point falls under
  ifelse(k >= 0 & k <= n, dbinom(pmax(k, 0), n, p) * sqrt(n), 0)
})

# Each histogram should hold (nearly) all its probability inside the grid
area <- sapply(pmf, function(h) sum(h) * diff(s[1:2]))
stopifnot(all(abs(area - 1) < 0.02))

out <- list(p = p, sigma2 = p * (1 - p), n = n_vals, t = t, s = s,
            tlim = t_lim, slim = s_lim, mgf_ymax = 10, pdf_ymax = 0.5 / sigma,
            mgf = lapply(mgf, round, 4), pmf = lapply(pmf, round, 5),
            mgf_lim = round(exp(sigma^2 * t^2 / 2), 4),
            pdf_lim = round(dnorm(s, sd = sigma), 5))
writeLines(toJSON(out, digits = NA, auto_unbox = TRUE), outfile)

lim <- exp(sigma^2 * t^2 / 2)
gap <- sapply(mgf, function(m) max(abs(m - lim)[abs(t) <= 1 / sigma]))
print(data.frame(n = n_vals, hist_area = round(area, 4), mgf_gap = round(gap, 4)))
