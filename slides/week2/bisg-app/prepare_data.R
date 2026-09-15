# ---------------------------------------------------------------------------
# Build the small BISG lookup tables used by the week 2 widget.
#
# BISG (Bayesian Improved Surname Geocoding) is Bayes' rule with two
# ingredients:
#
#   P(race | surname, county)  proportional to  P(surname | race) P(race | county)
#
#   * P(race | county) -- the racial composition of the county. 2020 Census
#     Decennial DHC, table P12 by race iteration. NEEDS A CENSUS API KEY.
#   * P(surname | race) -- how common the surname is within each race group.
#     This is wru's own dictionary (wru-data-census_last_c.rds), downloaded
#     from the package's GitHub release. No API key needed.
#
# Using wru's dictionary rather than the bundled `surnames2010` table matters:
# `surnames2010` holds P(race | surname), and inverting it with the national
# race margins does NOT reproduce the dictionary (max discrepancy ~0.05, e.g.
# SMITH is 0.709 white in surnames2010 but 0.663 implied by the dictionary).
# Only the dictionary reproduces wru::predict_race() exactly.
#
# Run with a key in the environment:
#   export CENSUS_API_KEY=...
#   Rscript prepare_data.R
#
# Writes bisg_names.csv and bisg_geos.csv -- a few KB, both committed.
# ---------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(wru)
  library(jsonlite)
})

key <- Sys.getenv("CENSUS_API_KEY")
if (!nzchar(key)) stop("Set CENSUS_API_KEY in the environment before running.")

ETH <- c("whi", "bla", "his", "asi", "oth")

# wru's hardcoded national race margins, P(race). Only used to show the
# surname-only prediction; the posterior itself does not depend on them.
RACE_MARGIN <- c(whi = 0.5783619, bla = 0.1205021, his = 0.1872988,
                 asi = 0.06106737, oth = 0.05276981)

# ---------------------------------------------------------------------------
# 1. Geography:  P(race | county)
# ---------------------------------------------------------------------------

# The 2020 DHC race iterations wru uses. I = white alone not Hispanic,
# J = Black alone NH, H = Hispanic of any race, L + M = Asian and NHPI alone
# NH, K + N + O = AIAN alone NH, some other race alone NH, two or more NH.
VARS <- c(whi = "P12I_001N", bla = "P12J_001N", his = "P12H_001N",
          asi1 = "P12L_001N", asi2 = "P12M_001N",
          oth1 = "P12K_001N", oth2 = "P12N_001N", oth3 = "P12O_001N")

# Six counties chosen to span the composition space: a white-majority college
# county, a mixed metro in the same state, a majority-Black county, a nearly
# uniformly Hispanic border county, an Asian-majority county, and the most
# evenly divided large county in the country.
WANT <- c(
  "Dane County, Wisconsin",
  "Milwaukee County, Wisconsin",
  "Prince George's County, Maryland",
  "Hidalgo County, Texas",
  "Honolulu County, Hawaii",
  "Queens County, New York"
)
STATES <- c("55", "24", "48", "15", "36")

fetch_counties <- function(state_fips) {
  url <- sprintf(
    "https://api.census.gov/data/2020/dec/dhc?get=NAME,%s&for=county:*&in=state:%s&key=%s",
    paste(VARS, collapse = ","), state_fips, key)

  # The API answers a bad request with an HTML error page, not JSON, which
  # otherwise surfaces as an unreadable lexer error out of fromJSON().
  txt <- paste(readLines(url, warn = FALSE), collapse = "\n")
  if (!startsWith(trimws(txt), "[")) {
    hint <- if (grepl("Invalid Key", txt, fixed = TRUE)) {
      paste0("the Census API rejected the key as invalid. CENSUS_API_KEY is ",
             "currently set to \"", key, "\" -- set it to your real key ",
             "(https://api.census.gov/data/key_signup.html).")
    } else {
      paste0("the Census API returned something other than JSON:\n",
             substr(txt, 1, 200))
    }
    stop("state ", state_fips, ": ", hint, call. = FALSE)
  }

  j <- fromJSON(txt)
  d <- as.data.frame(j[-1, ], stringsAsFactors = FALSE)
  names(d) <- j[1, ]
  for (v in VARS) d[[v]] <- as.numeric(d[[v]])
  d
}

cen <- do.call(rbind, lapply(STATES, fetch_counties))

missing <- setdiff(WANT, cen$NAME)
if (length(missing)) stop("county not found in API response: ", paste(missing, collapse = "; "))
cen <- cen[match(WANT, cen$NAME), ]

counts <- data.frame(
  whi = cen[[VARS["whi"]]],
  bla = cen[[VARS["bla"]]],
  his = cen[[VARS["his"]]],
  asi = cen[[VARS["asi1"]]] + cen[[VARS["asi2"]]],
  oth = cen[[VARS["oth1"]]] + cen[[VARS["oth2"]]] + cen[[VARS["oth3"]]]
)
pop <- rowSums(counts)
r <- counts / pop

geos <- data.frame(
  geo   = sub(",.*$", "", cen$NAME),           # "Dane County"
  state = sub("^.*, ", "", cen$NAME),
  fips  = paste0(cen$state, cen$county),
  pop   = pop,
  round(r, 6),
  stringsAsFactors = FALSE
)
names(geos)[5:9] <- paste0("r_", ETH)

write.csv(geos, "bisg_geos.csv", row.names = FALSE)

# ---------------------------------------------------------------------------
# 2. Surnames:  P(surname | race)
# ---------------------------------------------------------------------------

wru:::wru_data_preflight()   # downloads the dictionaries into tempdir()
dict_path <- file.path(tempdir(), "wru-data-census_last_c.rds")
if (!file.exists(dict_path)) stop("wru name dictionary did not download")
cdict <- readRDS(dict_path)

SURNAMES <- c(
  "SMITH", "JOHNSON", "WILLIAMS", "BROWN", "JONES", "DAVIS", "MILLER", "ANDERSON",
  "MURPHY", "OCONNOR", "OLSON", "SCHNEIDER", "YODER", "KOWALSKI", "COHEN",
  "WASHINGTON", "JEFFERSON", "BOOKER", "BANKS", "MOSLEY", "PIERRE", "JOSEPH",
  "GARCIA", "RODRIGUEZ", "HERNANDEZ", "LOPEZ", "MARTINEZ", "RIVERA", "CASTILLO",
  "NGUYEN", "TRAN", "KIM", "PARK", "PATEL", "WANG", "CHEN", "CHOI",
  "LEE", "ALI", "BEGAY", "YAZZIE"
)

idx <- match(SURNAMES, cdict$last_name)
if (anyNA(idx)) stop("surname not in dictionary: ",
                     paste(SURNAMES[is.na(idx)], collapse = ", "))
cmat <- as.matrix(cdict[idx, paste0("c_", ETH, "_last")])

# Surname-only prediction, exactly as wru does it with surname.only = TRUE:
# P(race | surname) proportional to P(surname | race) P(race).
sonly <- sweep(cmat, 2, RACE_MARGIN, `*`)
sonly <- sonly / rowSums(sonly)

# Group names for the menu by what the surname alone implies. Anything whose
# strongest category is under 0.6 is genuinely split and gets its own group --
# those are the names where the county does the most work.
modal <- ETH[max.col(sonly)]
group <- ifelse(apply(sonly, 1, max) < 0.6, "split", modal)

names_out <- data.frame(
  surname = SURNAMES,
  group   = group,
  signif(cmat, 7),
  stringsAsFactors = FALSE
)
names(names_out)[3:7] <- paste0("c_", ETH)

write.csv(names_out, "bisg_names.csv", row.names = FALSE)

cat("wrote bisg_geos.csv  (", nrow(geos), "counties )\n")
cat("wrote bisg_names.csv (", nrow(names_out), "surnames )\n")
cat("combined size:", file.size("bisg_geos.csv") + file.size("bisg_names.csv"), "bytes\n")
