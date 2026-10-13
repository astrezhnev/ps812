# ---------------------------------------------------------------------------
# Build the slim GSS extract used in the week 6 slides.
#
# Source data: 2024 General Social Survey Cross-section, Release 3 (GSS2024.dta)
#   https://gss.norc.org/get-the-data/stata  (2024_stata.zip, no login)
#
# The full release is a ~6 MB Stata file with ~1,000 variables; this script
# keeps recalled vote, partisanship, demographics and the design/weight
# variables and writes a small CSV that can live in the repository. Drop
# GSS2024.dta next to this script, then run:
#   Rscript prepare_data.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(dplyr)
  library(haven)
})

infile  <- "GSS2024.dta"
outfile <- "gss2024.csv"

stopifnot(file.exists(infile))

gss <- read_dta(infile, col_select = c(
  "id", "mode", "amerstatus", "wtssnrps_as", "vstrat", "vpsu",
  "vote20", "pres20", "vote16", "pres16", "whovote24",
  "partyid", "polviews", "age", "sex", "race", "hispanic",
  "educ", "degree", "region"
))

# zap_missing() turns the GSS missing codes (don't know, no answer, iap,
# skipped on web, ...) into NA before the labels become strings.
lab <- function(x) as.character(as_factor(zap_missing(x)))
num <- function(x) as.numeric(zap_labels(zap_missing(x)))

# 677 respondents come from an AmeriSpeak oversample of Hispanic, Black and
# AANHPI adults and have no WTSSNRPS; WTSSNRPS_AS is the nonresponse-adjusted
# post-stratification weight that covers all 3,986 cases.
#
# vote20/vote16: 1 = voted, 2 = did not vote, 3 = ineligible.
# pres20: 1 = Biden, 2 = Trump, 3 = other, 4 = didn't vote for president.
# pres16: 1 = Clinton, 2 = Trump, 3 = other, 4 = didn't vote for president.
gss2024 <- gss |>
  mutate(
    voted20   = case_when(vote20 == 1 ~ 1, vote20 == 2 ~ 0),
    biden20   = case_when(pres20 == 1 ~ 1, pres20 == 2 ~ 0),
    voted16   = case_when(vote16 == 1 ~ 1, vote16 == 2 ~ 0),
    clinton16 = case_when(pres16 == 1 ~ 1, pres16 == 2 ~ 0),
    across(c(mode, vote20, pres20, vote16, pres16, whovote24, partyid,
             polviews, sex, race, hispanic, degree, region), lab),
    amerspeak = as.numeric(amerstatus == 1),
    across(c(id, wtssnrps_as, vstrat, vpsu, age, educ), num)
  ) |>
  select(id, mode, amerspeak, weight = wtssnrps_as, vstrat, vpsu,
         voted20, biden20, vote20, pres20,
         voted16, clinton16, vote16, pres16, whovote24,
         partyid, polviews, age, sex, race, hispanic, educ, degree, region)

write.csv(gss2024, outfile, row.names = FALSE)
cat("Wrote", nrow(gss2024), "rows to", outfile, "\n")
