# ---------------------------------------------------------------------------
# Build the slim CES 2025 extract used by the conditioning widget.
#
# Source data: CES Common Content, 2025 (n = 17,000)
#   https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/DFUGJR
#
# The full release is a 59 MB Stata file with 341 variables, which is far too
# large to commit. This script keeps only what the widget needs -- 3-category
# party ID, the common weight, and the 38 support/oppose policy items -- and
# writes a ~1 MB CSV that can live in the repository.
#
# Download CES25_Common.dta from the Dataverse link above, drop it next to this
# script, then run:  Rscript prepare_data.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(dplyr)
  library(haven)
})

infile  <- "CES25_Common.dta"
outfile <- "ces25_pid_policy.csv"

stopifnot(file.exists(infile))

# The 38 items whose value labels are exactly Support / Oppose, in codebook
# order. Short labels are what fit on a button; `question` is the full stem.
items <- read.csv("items.csv", stringsAsFactors = FALSE)

# CC25_324 is the 4-category abortion item, kept separately because it is a
# single choice among four positions rather than a support/oppose pair.
abortion_var <- "CC25_324"

ces <- read_dta(infile,
                col_select = c("pid3", "commonweight", all_of(items$var), all_of(abortion_var)))

# 3-category party ID. pid3 is 1=Democrat, 2=Republican, 3=Independent,
# 4=Other, 5=Not sure, 8=skipped, 9=not asked. Independent / Other / Not sure
# are coarsened into a single category; genuine non-response is dropped.
pid_raw <- as.integer(ces$pid3)
pid <- ifelse(pid_raw == 1L, "D",
       ifelse(pid_raw == 2L, "R",
       ifelse(pid_raw %in% 3:5, "I", NA_character_)))

# Each policy item: 1 = Support, 2 = Oppose, everything else (8 skipped,
# 9 not asked, NA) is treated as missing and never matches a condition.
ans <- vapply(items$var, function(v) {
  x <- as.integer(ces[[v]])
  ifelse(is.na(x), ".", ifelse(x == 1L, "1", ifelse(x == 2L, "0", ".")))
}, character(nrow(ces)))

# Pack the 38 answers into one fixed-width string per respondent. This keeps
# the file about a third the size of 38 separate columns and makes the lookup
# in the app a simple substring comparison.
pattern <- apply(ans, 1, paste0, collapse = "")

# Abortion: 1 = never permitted, 2 = rape/incest/life only, 3 = other reasons
# once need is established, 4 = always a matter of personal choice. 8 and 9 are
# non-response and become ".".
ab_raw <- as.integer(ces[[abortion_var]])
ab <- ifelse(is.na(ab_raw) | !ab_raw %in% 1:4, ".", as.character(ab_raw))

w <- as.numeric(ces$commonweight)

keep <- !is.na(pid) & !is.na(w) & w > 0
out <- data.frame(
  pid = pid[keep],
  w   = round(w[keep], 4),
  a   = pattern[keep],
  ab  = ab[keep],
  stringsAsFactors = FALSE
)

write.csv(out, outfile, row.names = FALSE, quote = FALSE)

cat("respondents kept:", nrow(out), "of", nrow(ces), "\n")
cat("file size:", round(file.size(outfile) / 1e6, 2), "MB\n")
