# ---------------------------------------------------------------------------
# Builds datasaurus.json, the data behind the "BLP is a summary" animation in
# week 4 (drawn by datasaurus.js).
#
# Two chapters, each a run of datasets that share the same BLP:
#   1. Anscombe's quartet (Anscombe 1973), 11 points each, y-hat = 3 + 0.5 x
#   2. The Datasaurus dozen (Matejka and Fitzmaurice 2017), 142 points: four
#      of its figures, which match the dinosaur's stats to two decimals (so
#      its BLP nearly), then the dinosaur itself, then shapes invented for
#      this course, each moved onto the dinosaur's means and BLP exactly
#
# An invented shape is drawn, sampled down to 142 evenly spread points, then
# rotated until its OLS slope matches the dinosaur's, scaled, and shifted onto
# the dinosaur's means. Rotating, scaling and shifting leave the picture
# undistorted, and together fix the intercept too. SDs and the correlation are
# left free: only the line is matched.
#
# Within a chapter the points of each dataset are ordered to match the one
# before it (a minimum-distance assignment), so the animation can morph point
# i into point i.
#
# Needs datasauRus, clue, ragg, png, maps, jsonlite.
# Run from this directory:  Rscript make_datasaurus.R [--preview]
# ---------------------------------------------------------------------------

library(datasauRus)

set.seed(812)
N <- 142
preview <- "--preview" %in% commandArgs(TRUE)

dino <- subset(datasaurus_dozen, dataset == "dino")[, c("x", "y")]
blp  <- function(d) coef(lm(y ~ x, data = d))
target <- list(xbar = mean(dino$x), ybar = mean(dino$y), b = unname(blp(dino)[2]))

# --- Sampling a shape down to N points -------------------------------------

# Farthest-point sampling: start anywhere, then keep adding the candidate
# farthest from everything picked so far. Spreads points evenly over a shape.
fps <- function(cand, n = N) {
  pick <- integer(n)
  pick[1] <- sample(nrow(cand), 1)
  d <- (cand[, 1] - cand[pick[1], 1])^2 + (cand[, 2] - cand[pick[1], 2])^2
  for (k in 2:n) {
    pick[k] <- which.max(d)
    d <- pmin(d, (cand[, 1] - cand[pick[k], 1])^2 + (cand[, 2] - cand[pick[k], 2])^2)
  }
  data.frame(x = cand[pick, 1], y = cand[pick, 2])
}

# Draw with grid on a blank raster and return the inked pixels as candidate
# points (y flipped so up is up)
ink <- function(draw, width = 1200, height = 800, step = 2) {
  f <- tempfile(fileext = ".png")
  ragg::agg_png(f, width = width, height = height, background = "white")
  grid::grid.newpage()
  draw()
  invisible(dev.off())
  img <- png::readPNG(f)
  on <- which(img[, , 1] < 0.5, arr.ind = TRUE)
  on <- on[on[, 1] %% step == 0 & on[, 2] %% step == 0, ]
  cbind(on[, 2], -on[, 1])
}

# Points spaced evenly by arc length along a closed polyline
along <- function(x, y, n) {
  x <- c(x, x[1]); y <- c(y, y[1])
  s <- c(0, cumsum(sqrt(diff(x)^2 + diff(y)^2)))
  keep <- !duplicated(s)                   # drop repeated vertices
  x <- x[keep]; y <- y[keep]; s <- s[keep]
  at <- seq(0, max(s), length.out = n + 1)[-(n + 1)]
  data.frame(x = approx(s, x, at)$y, y = approx(s, y, at)$y)
}

# Move a shape onto the dinosaur's BLP slope, scale it to the given width, and
# shift it onto the dinosaur's means. How the slope is fixed:
#   "rotate"  the smallest rotation that gives the slope, which leaves the
#             picture undistorted (a near-round shape can't rotate that far,
#             so it rotates as far as helps and shears off the small rest)
#   "shear"   slide points up or down in proportion to x, for a shape whose
#             slope is close but which would have to turn a long way
#   "none"    for a shape built to have the slope already
place <- function(d, width, how = "rotate") {
  d$x <- d$x - mean(d$x); d$y <- d$y - mean(d$y)
  shear <- function(r) { r$y <- r$y + (target$b - blp(r)[2]) * r$x; r }
  rot <- function(th) data.frame(x = d$x * cos(th) - d$y * sin(th),
                                 y = d$x * sin(th) + d$y * cos(th))
  r <- d
  if (how == "shear") r <- shear(d)
  if (how == "rotate") {
    gap <- function(th) blp(rot(th))[2] - target$b
    grid <- seq(-pi / 2, pi / 2, length.out = 721)[-c(1, 721)]
    g <- sapply(grid, gap)
    cross <- which(diff(sign(g)) != 0)
    if (length(cross)) {
      i <- cross[which.min(abs(grid[cross]))]
      r <- rot(uniroot(gap, grid[c(i, i + 1)], tol = 1e-12)$root)
    } else {
      r <- shear(rot(grid[which.min(abs(g))]))
    }
  }
  s <- width / diff(range(r$x))
  data.frame(x = target$xbar + s * r$x, y = target$ybar + s * r$y)
}

# --- The invented shapes ---------------------------------------------------

# Wisconsin's outline, with a marker on Madison
wi <- maps::map("state", "wisconsin", plot = FALSE, fill = TRUE)
k <- cos(44.6 * pi / 180)                  # squash longitude to true shape
madison <- c(-89.40 * k, 43.07)
ring <- 10
wisconsin <- rbind(
  along(wi$x * k, wi$y, N - ring - 1),
  data.frame(x = madison[1] + 0.13 * cos(2 * pi * (1:ring) / ring),
             y = madison[2] + 0.13 * sin(2 * pi * (1:ring) / ring)),
  data.frame(x = madison[1], y = madison[2])
)

# The shrug
shrug <- fps(ink(function() grid::grid.text(
  "¯\\_(ツ)_/¯", gp = grid::gpar(fontfamily = "Noto Sans CJK JP", fontsize = 150)),
  width = 1600, height = 400))

# Clawd, the Claude Code mascot, from its block-character pixel art
#    ▐▛███▜▌
#   ▝▜█████▛▘
#     ▘▘ ▝▝
# Each quadrant pixel is twice as tall as wide, so it gets two points, one
# above the other: 108 points, with the eyes left as holes
clawd_px <- c(
  "...############...",
  "...##.######.##...",
  ".################.",
  "...############...",
  "....#.#....#.#...."
)
m <- do.call(rbind, strsplit(clawd_px, "")) == "#"
cell <- which(m, arr.ind = TRUE)
clawd <- data.frame(x = rep(cell[, "col"], 2),
                    y = c(-2 * cell[, "row"], -2 * cell[, "row"] - 1))

# The other 34 points are a heart floating over Clawd's head. Clawd alone has
# no slope; the heart slides left until the pair has the dinosaur's slope, so
# Clawd stays level.
t <- seq(0, 2 * pi, length.out = 400)
heart <- along(16 * sin(t)^3, 13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t),
               N - nrow(clawd))
heart <- data.frame(x = heart$x / 8, y = heart$y / 8)
with_heart <- function(h) rbind(clawd, data.frame(x = heart$x + h, y = heart$y + 1.5))
h <- uniroot(function(h) blp(with_heart(h))[2] - target$b, c(0, mean(clawd$x)), tol = 1e-12)$root
clawd <- with_heart(h)

shapes <- list(
  list(name = "Wisconsin", source = "", pts = place(wisconsin, 60, "shear")),
  list(name = "¯\\_(ツ)_/¯", source = "", pts = place(shrug, 90)),
  list(name = "Clawd", source = "", pts = place(clawd, 80, "none"), color = "#D97757")
)

if (preview) {
  png("preview.png", width = 1500, height = 900)
  par(mfrow = c(2, 3), mar = c(3, 3, 3, 1))
  plot(dino, asp = 1, xlim = c(0, 110), ylim = c(-5, 105), pch = 19, main = "dino")
  abline(blp(dino), col = "blue")
  for (s in shapes) {
    plot(s$pts, asp = 1, xlim = c(0, 110), ylim = c(-5, 105), pch = 19, main = s$name,
         col = if (is.null(s$color)) "black" else s$color)
    abline(blp(s$pts), col = "blue")
  }
  dev.off()
}

# --- Stages ------------------------------------------------------------------

# Reorder each dataset's points to match the one before, so point i morphs
# into point i along the shortest total path
match_to <- function(prev, d) {
  cost <- outer(prev$x, d$x, "-")^2 + outer(prev$y, d$y, "-")^2
  d[as.integer(clue::solve_LSAP(cost)), ]
}

stage <- function(name, source, pts, chapter, color = "#333333") {
  fit <- blp(pts)
  list(name = name, source = source, chapter = chapter, color = color,
       x = round(pts$x, 3), y = round(pts$y, 3),
       stats = list(n = nrow(pts), xbar = mean(pts$x), ybar = mean(pts$y),
                    a = unname(fit[1]), b = unname(fit[2])))
}

ans <- lapply(1:4, function(i) data.frame(x = anscombe[[paste0("x", i)]],
                                          y = anscombe[[paste0("y", i)]]))
# I to III share their x values, so keep the rows lined up (each point just
# moves up or down); IV is matched
ans[[4]] <- match_to(ans[[3]], ans[[4]])

# More of the Datasaurus dozen lead up to the dinosaur. They share its means,
# SDs and correlation to two decimals, so their BLPs agree with its to about
# a tenth in the intercept and a hundredth in the slope
mf <- "Matejka and Fitzmaurice (2017)"
dozen <- c(star = "The star", bullseye = "The bullseye", x_shape = "The X", circle = "The circle")
saurus <- lapply(names(dozen), function(d)
  list(name = dozen[[d]], source = mf,
       pts = subset(datasaurus_dozen, dataset == d)[, c("x", "y")]))
saurus <- c(saurus, list(list(name = "The Datasaurus", source = mf, pts = dino)), shapes)
for (i in seq_along(saurus)[-1])
  saurus[[i]]$pts <- match_to(saurus[[i - 1]]$pts, saurus[[i]]$pts)

stages <- c(
  lapply(1:4, function(i) stage(paste("Anscombe's quartet", as.roman(i)), "Anscombe (1973)",
                                ans[[i]], 0)),
  lapply(saurus, function(s) stage(s$name, s$source, s$pts, 1,
                                   if (is.null(s$color)) "#333333" else s$color))
)

cfg <- list(
  chapters = list(
    list(xlim = c(2, 20), ylim = c(2, 14), xticks = seq(4, 20, 4), yticks = seq(4, 14, 2), r = 9),
    list(xlim = c(0, 110), ylim = c(-5, 105), xticks = seq(0, 100, 25), yticks = seq(0, 100, 25), r = 5)
  ),
  stages = stages
)
jsonlite::write_json(cfg, "datasaurus.json", auto_unbox = TRUE, digits = NA)
for (s in stages) cat(sprintf("%-28s n = %3d  xbar = %6.2f  ybar = %6.2f  y-hat = %6.2f %+.3f x\n",
                              s$name, s$stats$n, s$stats$xbar, s$stats$ybar, s$stats$a, s$stats$b))
