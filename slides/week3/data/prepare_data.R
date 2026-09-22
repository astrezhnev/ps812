# ---------------------------------------------------------------------------
# Build the slim list-experiment extract used in the week 3 slides.
#
# Source data: Mexico 2012 Panel Study, Wave 2 (2012_stata.dta)
#
# The full release is a ~6 MB Stata file; this script keeps only the three
# list-experiment variables and writes a small CSV that can live in the
# repository. Drop 2012_stata.dta next to this script, then run:
#   Rscript prepare_data.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(dplyr)
  library(haven)
})

infile  <- "2012_stata.dta"
outfile <- "mexico_list.csv"

stopifnot(file.exists(infile))

mex <- read_dta(infile, col_select = c("w2_P35A", "w2_P35B", "w2_P35C", "w2_P41"))

# w2_P35C is the list assignment: 1 = control (3-item list), 2 = treated
# (4-item list with the vote-buying item). The count answered is in w2_P35A
# for control and w2_P35B for treated; 9 (don't know) and -1 (not asked) are
# missing. w2_P41 is the direct vote-buying question, with "don't know" (9)
# and 3 coded as "no".
mexico <- mex |>
  mutate(
    treat  = case_when(w2_P35C == 1 ~ 0, w2_P35C == 2 ~ 1),
    y      = as.numeric(case_when(w2_P35C == 1 ~ w2_P35A, w2_P35C == 2 ~ w2_P35B)),
    y      = if_else(y %in% c(9, -1), NA_real_, y),
    direct = case_when(w2_P41 %in% c(0, 3, 9) ~ 0, w2_P41 == 1 ~ 1)
  ) |>
  filter(!is.na(y), !is.na(treat), !is.na(direct)) |>
  select(y, treat, direct)

write.csv(mexico, outfile, row.names = FALSE)
cat("Wrote", nrow(mexico), "rows to", outfile, "\n")
