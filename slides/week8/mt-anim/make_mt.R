# ---------------------------------------------------------------------------
# Test statistics for the week 8 multiple testing animations (darts.js-style
# mtest.js and holm.js). Twenty jelly bean colors, in the order of xkcd 882,
# each tested for a link with acne at alpha = 0.05 using T ~ N(0, 1) under
# the null:
#   t_null  all twenty nulls true. The seed is the first one where exactly one
#           test lands beyond +/- 1.96 -- green, the 14th, as in the comic --
#           and only just (|T| < 2.5, so Bonferroni and Holm both retain it),
#           and the three tests given real effects below sit well inside.
#   t_alt   the same draws, but three colors have real effects. Their
#           statistics are set by hand so the corrections disagree: with 20
#           tests Bonferroni rejects when p < 0.0025, so it keeps only the two
#           strongest, while Holm's step-down thresholds 0.05 / 20, 0.05 / 19,
#           0.05 / 18 reject all three before stopping at green.
# Run:
#   Rscript make_mt.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages(library(jsonlite))

outfile <- "mt.json"
beans <- c("purple", "brown", "pink", "blue", "teal", "salmon", "red",
           "turquoise", "magenta", "yellow", "grey", "tan", "cyan", "green",
           "mauve", "beige", "lilac", "black", "peach", "orange")
m <- length(beans)
alpha <- 0.05
green <- 14
real <- c(4, 9, 17)                       # blue, magenta, lilac
t_real <- c(3.07, 3.35, 3.00)             # p = 0.0021, 0.0008, 0.0027

ok <- function(t) {
  hit <- abs(t) > qnorm(1 - alpha / 2)
  sum(hit) == 1 && hit[green] && t[green] > 2 && t[green] < 2.5 &&
    all(abs(t[-green]) < 1.8) && all(abs(t[real]) < 1.2)
}
seed <- 1
repeat { set.seed(seed); t <- rnorm(m); if (ok(t)) break; seed <- seed + 1 }
t_alt <- t
t_alt[real] <- t_real

# Check the story: p-values and what each procedure rejects
p <- 2 * pnorm(-abs(t_alt))
stopifnot(sum(p.adjust(p, "bonferroni") < alpha) == 2,
          sum(p.adjust(p, "holm") < alpha) == 3,
          sum(p < alpha) == 4)

write_json(list(seed = seed, alpha = alpha, beans = beans, green = green,
                real = real, t_null = round(t, 4), t_alt = round(t_alt, 4)),
           outfile, auto_unbox = TRUE, digits = NA)
cat("seed", seed, "\n")
print(data.frame(bean = beans, t_null = round(t, 2), t_alt = round(t_alt, 2), p_alt = signif(p, 2)))
