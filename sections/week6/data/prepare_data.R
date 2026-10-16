# ---------------------------------------------------------------------------
# Build the slim CES extract used in the section 6 slides and exercise.
#
# Source data: 2025 Cooperative Election Study, Common Content
# (CES25_Common.dta, the same file used in section 2)
#
# The full release is a ~59 MB Stata file; this script keeps a handful of
# demographic and political variables and writes a small CSV that can live in
# the repository. Drop CES25_Common.dta next to this script, then run:
#   Rscript prepare_data.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(dplyr)
  library(haven)
})

infile  <- "CES25_Common.dta"
outfile <- "ces25_viz.csv"

stopifnot(file.exists(infile))

ces <- read_dta(infile, col_select = c("commonweight", "birthyr", "gender4",
                                       "educ", "pid3", "pid7", "CC25_330a",
                                       "CC25_312a", "inputstate"))

# The survey was fielded in fall 2025, so age = 2025 - birth year.
# pid7 8 (not sure) and ideo7 8 (not sure) are set to missing. Trump approval
# (CC25_312a) is 1-4 from strongly approve to strongly disapprove, with 5 = not
# sure set to missing; trump_approve is 1 for strongly or somewhat approve.
ces_viz <- ces |>
  transmute(
    weight        = commonweight,
    age           = 2025 - birthyr,
    gender        = case_when(gender4 == 1 ~ "Man",
                              gender4 == 2 ~ "Woman",
                              gender4 %in% 3:4 ~ "Other"),
    college       = as.integer(educ >= 5),
    pid3          = case_when(pid3 == 1 ~ "Democrat",
                              pid3 == 2 ~ "Republican",
                              pid3 %in% 3:5 ~ "Independent/Other"),
    pid7          = if_else(pid7 %in% 1:7, as.integer(pid7), NA_integer_),
    ideo7         = if_else(CC25_330a %in% 1:7, as.integer(CC25_330a), NA_integer_),
    trump_approve = case_when(CC25_312a %in% 1:2 ~ 1L,
                              CC25_312a %in% 3:4 ~ 0L),
    state         = as.character(as_factor(inputstate))
  )

write.csv(ces_viz, outfile, row.names = FALSE)
cat("Wrote", nrow(ces_viz), "rows to", outfile, "\n")
