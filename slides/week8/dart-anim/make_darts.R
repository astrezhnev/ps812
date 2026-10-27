# ---------------------------------------------------------------------------
# Repeated samples for the week 8 darts-and-rings animation (darts.js). Each
# sample is n i.i.d. draws from a skewed (exponential) population; from it we
# keep the sample mean mu_hat and its estimated standard error
# sigma_hat / sqrt(n). Everything is stored in units of the true standard
# error se = sigma / sqrt(n), centered on mu, so the animation can draw the
# N(0, 1) sampling distribution behind it:
#   err   (mu_hat - mu) / se        where each dart lands
#   sehat sigma_hat / (sqrt(n) se)  the half-width of a ring at z = 1
# The rings are mu_hat +/- z * sigma_hat / sqrt(n) for each z in `z`, and
# `cover` is their nominal coverage 2 Phi(z) - 1. The seed is the first one
# whose draws look typical: mean error near zero, mean squared error near one,
# and coverage counts near nominal at each z. Run:
#   Rscript make_darts.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages(library(jsonlite))

outfile <- "darts.json"
n    <- 50
reps <- 30
mu   <- 1                       # Exponential(1): mean 1, sd 1
se   <- 1 / sqrt(n)
z    <- c(1, 2, 0.5)
nominal <- 2 * pnorm(z) - 1

draw <- function(seed) {
  set.seed(seed)
  x <- matrix(rexp(n * reps, rate = 1), n, reps)
  list(err = (colMeans(x) - mu) / se, sehat = apply(x, 2, sd) / sqrt(n) / se)
}
typical <- function(s) {
  covered <- sapply(z, function(k) sum(abs(s$err) <= k * s$sehat))
  abs(mean(s$err)) < 0.08 && abs(mean(s$err^2) - 1) < 0.1 &&
    all(abs(covered - reps * nominal) <= 1) &&
    abs(s$err[1]) > 0.5 && abs(s$err[1]) < s$sehat[1]   # first dart visibly off, first ring covers
}
seed <- 1
while (!typical(draw(seed))) seed <- seed + 1
s <- draw(seed)

out <- list(seed = seed, n = n, err = round(s$err, 4), sehat = round(s$sehat, 4),
            z = z, cover = round(nominal, 4))
writeLines(toJSON(out, digits = NA, auto_unbox = TRUE), outfile)

cat("seed =", seed, " mean error =", round(mean(s$err), 3),
    " mean squared error =", round(mean(s$err^2), 3), "\n")
print(data.frame(z = z, nominal = round(nominal, 3),
                 covered = sapply(z, function(k) sum(abs(s$err) <= k * s$sehat))))
