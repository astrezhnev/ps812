# ---------------------------------------------------------------------------
# Build the slim ANES extract used in the section 7 slides and exercise.
#
# Source data: 2024 ANES Time Series Study, full release
# (anes_timeseries_2024_stata_20260519.dta, from the Stata zip at
# https://electionstudies.org/data-center/2024-time-series-study/)
#
# The full release is a ~79 MB Stata file with 1,738 variables; this script
# keeps the pre-election feeling thermometers and a few demographics and writes
# a small CSV that can live in the repository. Drop the .dta next to this
# script, then run:
#   Rscript prepare_data.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(dplyr)
  library(haven)
})

infile  <- "anes_timeseries_2024_stata_20260519.dta"
outfile <- "anes24_therm.csv"

stopifnot(file.exists(infile))

therms <- c(ft_harris = "V241156", ft_trump  = "V241157",
            ft_biden  = "V241158", ft_rfk    = "V241159",
            ft_vance  = "V241164", ft_walz   = "V241165",
            ft_dem    = "V241166", ft_rep    = "V241167")

anes <- read_dta(infile, col_select = all_of(c("V240001", "V240107a",
                                               "V240002a", "V241458x",
                                               "V241551", "V241227x",
                                               unname(therms))))

# Every variable here is from the pre-election interview, so the weight is the
# pre-election full-sample weight (V240107a: fresh in-person + fresh web +
# panel + PAPI), as the user guide recommends. Negative codes (refused, don't
# know, inapplicable, missing) are set to NA. Thermometers run 0-100. Age is
# top-coded at 80. pid3 counts leaners (pid7 3 and 5) as partisans.
ft <- function(x) if_else(x %in% 0:100, as.integer(x), NA_integer_)

anes_therm <- anes |>
  transmute(
    id     = as.integer(V240001),
    weight = as.numeric(V240107a),
    mode   = case_when(V240002a == 1 ~ "Face-to-face",
                       V240002a == 2 ~ "Web",
                       V240002a == 3 ~ "Paper",
                       V240002a == 4 ~ "Phone"),
    age    = if_else(V241458x >= 18, as.integer(V241458x), NA_integer_),
    gender = case_when(V241551 == 1 ~ "Man",
                       V241551 == 2 ~ "Woman",
                       V241551 %in% 3:4 ~ "Other"),
    pid7   = if_else(V241227x %in% 1:7, as.integer(V241227x), NA_integer_),
    pid3   = case_when(pid7 %in% 1:3 ~ "Democrat",
                       pid7 == 4 ~ "Independent",
                       pid7 %in% 5:7 ~ "Republican"),
    across(all_of(unname(therms)), ft)
  ) |>
  rename(all_of(therms))

write.csv(anes_therm, outfile, row.names = FALSE)
cat("Wrote", nrow(anes_therm), "rows to", outfile, "\n")
