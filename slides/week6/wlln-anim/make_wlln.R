# ---------------------------------------------------------------------------
# Repeated sample means at growing n for the week 6 weak law of large numbers
# animation (wlln.js). Samples are i.i.d. draws (with replacement) from the
# same synthetic population as the earlier animations (pop-anim/population.json),
# so each Y_i is a draw from the population distribution. For each n we keep
# `reps` sample means, and for each epsilon the share of them that land at
# least epsilon from mu, next to Chebyshev's bound sigma^2 / (n epsilon^2).
# Run:
#   Rscript make_wlln.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages(library(jsonlite))

set.seed(2026)

outfile <- "wlln.json"
pop <- fromJSON("../pop-anim/population.json")
y <- pop$v
mu <- mean(y)
sigma2 <- mean((y - mu)^2)       # population variance (1/N): the variance of one draw

n_vals <- c(10, 40, 160, 640)
reps   <- 40
eps    <- c(0.1, 0.05)

ybar <- lapply(n_vals, function(n) replicate(reps, mean(sample(y, n, replace = TRUE))))

outside <- sapply(eps, function(e) sapply(ybar, function(v) mean(abs(v - mu) >= e)))
cheb    <- sapply(eps, function(e) pmin(1, sigma2 / (n_vals * e^2)))

out <- list(mu = mu, sigma2 = sigma2, n = n_vals, eps = eps, ybar = ybar,
            outside = outside, cheb = cheb)
writeLines(toJSON(out, digits = NA), outfile)

cat("mu =", round(mu, 3), " sigma^2 =", round(sigma2, 3), "\n")
for (k in seq_along(eps)) {
  cat("eps =", eps[k], "\n")
  print(data.frame(n = n_vals, outside = outside[, k], chebyshev = round(cheb[, k], 3)))
}
