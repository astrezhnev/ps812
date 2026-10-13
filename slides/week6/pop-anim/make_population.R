# ---------------------------------------------------------------------------
# Build the synthetic population drawn by population.js on the week 6
# population, estimand and sampling slides.
#
# Each unit is a small square on a grid clipped to the U.S. outline (usmap's
# equal-area projection, lower 48 states and DC). Every unit gets a
# turnout indicator Y_i ~ Bernoulli(0.67), roughly the 2020 rate. Repeated
# simple random samples of n units are drawn once here, so every slide shows
# the same population, the same outcomes and the same samples; the first is
# the one on the "Sampling design" slide, the rest are the repeated samples on
# "Estimators are random variables". Larger samples (n = 50, 100) for the
# "Sampling variance" slide are drawn afterwards, so the n = 25 draws are
# unchanged. Run:
#   Rscript make_population.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(sf)
  library(usmap)
  library(jsonlite)
})

set.seed(812)

outfile <- "population.json"

# Canvas layout, in SVG units (population.js uses a 1000 x 560 viewBox)
map_box <- c(x0 = 20, y0 = 110, x1 = 600, y1 = 510)
cell    <- 9      # grid spacing; squares are drawn a little smaller
p_vote  <- 0.67
n_samp  <- c(25, 50, 100)   # sample sizes: 5 x 5, 10 x 5 and 10 x 10 boxes
n_reps  <- 10               # repeated samples at each size

us <- st_union(us_map(regions = "states", exclude = c("AK", "HI", "PR")))
bb <- st_bbox(us)

# Map units to SVG units, keeping the aspect ratio and centring in map_box
sc <- min((map_box["x1"] - map_box["x0"]) / (bb["xmax"] - bb["xmin"]),
          (map_box["y1"] - map_box["y0"]) / (bb["ymax"] - bb["ymin"]))
ox <- map_box["x0"] + ((map_box["x1"] - map_box["x0"]) - sc * (bb["xmax"] - bb["xmin"])) / 2
oy <- map_box["y0"] + ((map_box["y1"] - map_box["y0"]) - sc * (bb["ymax"] - bb["ymin"])) / 2
to_x <- function(x) unname(ox + sc * (x - bb["xmin"]))
to_y <- function(y) unname(oy + sc * (bb["ymax"] - y))   # SVG y runs down

# Outline: one SVG path per polygon ring, dropping specks smaller than a cell
rings <- st_cast(st_cast(st_simplify(us, dTolerance = 6000), "POLYGON"), "LINESTRING")
rings <- rings[as.numeric(st_area(st_cast(rings, "POLYGON"))) * sc^2 > cell^2 / 2]
outline <- vapply(seq_along(rings), function(k) {
  xy <- st_coordinates(rings[k])
  paste0("M", paste(sprintf("%.1f %.1f", to_x(xy[, 1]), to_y(xy[, 2])), collapse = "L"), "Z")
}, character(1))

# Grid of cell centres over the map box; keep those inside the outline
gx <- seq(map_box["x0"] + cell / 2, map_box["x1"], by = cell)
gy <- seq(map_box["y0"] + cell / 2, map_box["y1"], by = cell)
grid <- expand.grid(x = gx, y = gy)
pts <- st_as_sf(data.frame(mx = bb["xmin"] + (grid$x - ox) / sc,
                           my = bb["ymax"] - (grid$y - oy) / sc),
                coords = c("mx", "my"), crs = st_crs(us))
inside <- lengths(st_intersects(pts, us)) > 0
units <- grid[inside, ]

N <- nrow(units)
y <- rbinom(N, 1, p_vote)
# 0-based for JavaScript; all n = 25 draws come first, so they are unchanged
# from earlier versions of this script
draw_set <- function(n) {
  samples <- lapply(seq_len(n_reps), function(r) sort(sample.int(N, n)) - 1)
  list(n = n, samples = samples,
       ybar = vapply(samples, function(s) mean(y[s + 1]), numeric(1)))
}
sets <- list(draw_set(n_samp[1]))

# The larger-sample sets get their own seed, picked from a search over seeds
# 1-5000 for a representative draw: at n = 50 and 100 the ten sample means
# average within 0.008 of mu, fall on both sides of it (at least four each),
# and their SD and range each shrink by at least 20% from n = 25 to 50 to 100;
# of those, this seed's SDs (0.079, 0.056, 0.040) sit closest to the
# 1/sqrt(n) pattern. Ten draws is a small
# sample of samples, and other seeds can make a row look off-centre (the draw
# that followed the n = 25 set put eight of ten n = 50 means below mu).
set.seed(1495)
sets <- c(sets, lapply(n_samp[-1], draw_set))

pop <- list(
  cell    = cell,
  outline = I(outline),                          # keep an array even with one ring
  x       = round(units$x, 1),
  y       = round(units$y, 1),
  v       = y,
  mu      = mean(y),
  sets    = sets
)

writeLines(toJSON(pop, auto_unbox = TRUE, digits = NA), outfile)
cat("Wrote", N, "units (mu =", round(mean(y), 3), ") to", outfile, "\n")
for (st in sets) cat("  n =", st$n, ": ybar =", paste(round(st$ybar, 3), collapse = ", "),
                     "( sd", round(sd(st$ybar), 3), ")\n")
