# ---------------------------------------------------------------------------
# Build the slim CES extract used in the week 12 slides on missing data.
#
# Source data: 2024 Cooperative Election Study, Common Content
# (CCES24_Common_OUTPUT_vv_topost_final.dta, from the CES Dataverse:
# https://cces.gov.harvard.edu/)
#
# The full file is a ~1 GB Stata file with 694 variables; this script keeps
# family income, the common weight and a few demographics and writes a small
# CSV that can live in the repository. Drop the .dta next to this script (or
# pass its path as the first argument), then run:
#   Rscript prepare_data.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(dplyr)
  library(haven)
})

args    <- commandArgs(trailingOnly = TRUE)
infile  <- if (length(args) > 0) args[1] else "CCES24_Common_OUTPUT_vv_topost_final.dta"
outfile <- "ces24_income.csv"

stopifnot(file.exists(infile))

ces <- read_dta(infile, col_select = c(
  "commonweight", "faminc_new",
  "birthyr", "gender4", "educ", "race", "employ", "marstat", "pid7",
  "CC24_301", "ideo5", "newsint"
)) |>
  zap_labels()

# faminc_new runs 1-16 (less than $10,000 to $500,000 or more); 97 is "Prefer
# not to say", the explicit refusal option, and is kept as NA with refused = 1.
# The 23 respondents who skipped the question outright are dropped, as are
# respondents missing any covariate, so refusal is the only missingness left.
#   inc60: family income of $60,000 or more (faminc_new >= 7), the category
#   cutoff closest to the median among those who answer (48.5% are above it)
#   unsure: political (dis)engagement, the number of "not sure" or "don't know"
#   answers on four political items: the national economy over the past year
#   (CC24_301 = 6), party ID (pid7 = 8), ideology (ideo5 = 6) and interest in
#   government and public affairs (newsint = 7). Skips count as answers
lab <- function(x, labels) factor(labels[x], levels = labels)

ces_income <- ces |>
  filter(faminc_new %in% c(1:16, 97),
         gender4 %in% 1:4, educ %in% 1:6, race %in% 1:8,
         employ %in% 1:9, marstat %in% 1:6, pid7 %in% 1:8) |>
  transmute(
    weight  = round(as.numeric(commonweight), 4),
    refused = as.integer(faminc_new == 97),
    faminc  = if_else(faminc_new == 97, NA_integer_, as.integer(faminc_new)),
    inc60   = if_else(faminc_new == 97, NA_integer_, as.integer(faminc_new >= 7)),
    age     = as.integer(2024 - birthyr),
    gender  = lab(gender4, c("Man", "Woman", "Non-binary", "Other")),
    educ    = lab(educ, c("No HS", "High school", "Some college", "2-year",
                          "4-year", "Post-grad")),
    race    = lab(race, c("White", "Black", "Hispanic", "Asian", "Native American",
                          "Middle Eastern", "Two or more", "Other")),
    employ  = lab(employ, c("Full-time", "Part-time", "Laid off", "Unemployed",
                            "Retired", "Disabled", "Homemaker", "Student", "Other")),
    marstat = lab(marstat, c("Married", "Separated", "Divorced", "Widowed",
                             "Never married", "Domestic partnership")),
    pid7    = as.integer(pid7),             # 1 strong Democrat ... 7 strong Republican, 8 not sure
    unsure  = as.integer((CC24_301 %in% 6) + (pid7 %in% 8) + (ideo5 %in% 6) + (newsint %in% 7))
  )

write.csv(ces_income, outfile, row.names = FALSE)
cat("Wrote", nrow(ces_income), "rows to", outfile, "\n")
