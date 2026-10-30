# ---------------------------------------------------------------------------
# Simulate the sanctions vignette pilot used in the section 8 slides and
# exercise. The data are made up.
#
# Vignette: The United States is engaged in trade negotiations with the
# European Union. After the talks stalled, the United States [imposed economic
# sanctions on the EU / decided to take no action].
#
# Outcome: "How much do you approve of the way the U.S. government handled
# this situation?" (0-100 slider)
#
# 200 respondents, 100 per condition (complete randomization). Republicans
# start out more approving and respond more to sanctions, so the treated group
# is noisier than the control group. Run:
#   Rscript make_data.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages(library(dplyr))

set.seed(9)

n <- 200

pilot <- tibble(
  id    = 1:n,
  rep   = rbinom(n, 1, 0.5),
  treat = sample(rep(0:1, each = n / 2))
) |>
  mutate(
    y0      = 35 + 20 * rep + rnorm(n, 0, 14),
    tau_i   = 2 + 6 * rep + rnorm(n, 0, 12),
    support = round(if_else(treat == 1, y0 + tau_i, y0)),
    support = pmin(pmax(support, 0), 100),
    approve = as.integer(support > 50),
    party   = if_else(rep == 1, "Republican", "Democrat"),
    condition = if_else(treat == 1, "Sanctions", "No action")
  ) |>
  select(id, party, condition, treat, support, approve)

write.csv(pilot, "sanctions_pilot.csv", row.names = FALSE)
