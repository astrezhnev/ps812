# ---------------------------------------------------------------------------
# Build the slim ANES extract used in the week 9 slides on regression.
#
# Source data: 2024 ANES Time Series Study, full release
# (anes_timeseries_2024_stata_20260519.dta, from the Stata zip at
# https://electionstudies.org/data-center/2024-time-series-study/)
#
# The full release is a ~79 MB Stata file with 1,738 variables; this script
# keeps the Trump and Harris feeling thermometers, the four-item hostile
# sexism battery, the three racial resentment items and a few political and
# demographic covariates, and writes a small CSV that can live in the
# repository. Drop the .dta next to this script, then run:
#   Rscript prepare_data.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(dplyr)
  library(haven)
})

infile  <- "anes_timeseries_2024_stata_20260519.dta"
outfile <- "anes24_sexism.csv"

stopifnot(file.exists(infile))

anes <- read_dta(infile, col_select = c(
  "V240001", "V240107b",                         # id, post-election weight
  "V241157", "V241156", "V242067",               # Trump and Harris thermometers, vote
  "V241607", "V241608", "V242280", "V242281",    # hostile sexism
  "V242300", "V242301", "V242302",               # racial resentment
  "V241227x", "V241177", "V241465x", "V241458x", # party ID, ideology, education, age
  "V241551", "V241501x", "V241294x"              # gender, race, economy
)) |>
  zap_labels()

# Negative codes (refused, don't know, inapplicable, missing) are set to NA.
# The scales use items from both waves, so the weight is the post-election
# full-sample weight (V240107b: fresh in-person + fresh web + panel).
#
# Hostile sexism (Glick and Fiske's ambivalent sexism inventory, as fielded
# by the ANES). Each item runs from 1 (agree strongly / always) to 5
# (disagree strongly / never); reversed and rescaled to 0-1, then averaged,
# so 1 is the most sexist answer to every item. Two items are pre-election
#   V241607  women interpret innocent remarks as sexist
#   V241608  women seek to gain power by getting control over men
# and two are post-election
#   V242280  women demanding equality seek special favors
#   V242281  women complaining about discrimination cause more problems
#
# Racial resentment uses the three Kinder-Sanders items the 2024 ANES fielded
# (special favors, slavery and discrimination, gotten less than deserve),
# coded so 1 is the most resentful answer to every item.
#
# Age is top-coded at 80. pid7 runs from 1 (strong Democrat) to 7 (strong
# Republican) and ideo7 from 1 (extremely liberal) to 7 (extremely
# conservative). econ runs from 1 (national economy much better over the
# past year) to 5 (much worse).
ok  <- function(x, r) if_else(x %in% r, as.numeric(x), NA_real_)
rev <- function(x) (5 - ok(x, 1:5)) / 4

anes_sexism <- anes |>
  transmute(
    id         = as.integer(V240001),
    weight     = as.numeric(V240107b),
    ft_trump   = ok(V241157, 0:100),
    ft_harris  = ok(V241156, 0:100),
    trump_vote = case_when(V242067 == 2 ~ 1, V242067 %in% c(1, 3:6) ~ 0),
    hs_remarks = rev(V241607),
    hs_power   = rev(V241608),
    hs_favors  = rev(V242280),
    hs_complain = rev(V242281),
    hostile_sexism = (hs_remarks + hs_power + hs_favors + hs_complain) / 4,
    racial_resentment = ((6 - ok(V242300, 1:5)) + ok(V242301, 1:5) +
                           ok(V242302, 1:5) - 3) / 12,
    pid7    = ok(V241227x, 1:7),
    ideo7   = ok(V241177, 1:7),
    educ    = case_when(V241465x == 1 ~ "Less than high school",
                        V241465x == 2 ~ "High school",
                        V241465x == 3 ~ "Some college",
                        V241465x == 4 ~ "Bachelor's degree",
                        V241465x == 5 ~ "Graduate degree"),
    college = if_else(V241465x %in% 1:5, as.numeric(V241465x >= 4), NA_real_),
    age     = if_else(V241458x >= 18, as.numeric(V241458x), NA_real_),
    gender  = case_when(V241551 == 1 ~ "Man",
                        V241551 == 2 ~ "Woman",
                        V241551 %in% 3:4 ~ "Other"),
    race    = case_when(V241501x == 1 ~ "White",
                        V241501x == 2 ~ "Black",
                        V241501x == 3 ~ "Hispanic",
                        V241501x == 4 ~ "Asian or Pacific Islander",
                        V241501x %in% 5:6 ~ "Other or multiple"),
    econ    = ok(V241294x, 1:5)
  )

write.csv(anes_sexism, outfile, row.names = FALSE)
cat("Wrote", nrow(anes_sexism), "rows to", outfile, "\n")
