# ---------------------------------------------------------------------------
# Builds lie_slices.svg, the law of iterated expectations figure for week 4,
# in the style of week 2's total_probability.svg.
#
# Top: the (X, Y) space cut into slices X = x1, x2, x3, each as wide as
# P(X = x). Dots are draws of Y within each slice; the bar in each slice sits
# at E[Y | X = x], so its shaded area is E[Y | X = x] P(X = x). The dashed line
# is the overall E[Y].
# Bottom: the three shaded areas added up, then rearranged into one rectangle
# of width 1 and height E[Y].
#
# Run from this directory:  Rscript make_lie_slices.R
# ---------------------------------------------------------------------------

set.seed(812)

p    <- c(0.30, 0.45, 0.25)   # P(X = x)
m    <- c(0.30, 0.70, 0.40)   # E[Y | X = x], as a share of the panel height
cols <- c("#0479A8", "#c5050c", "#6A3D9A")
ey   <- sum(p * m)            # E[Y]

# Top panel geometry
x0 <- 30; pw <- 820           # left edge and width
y0 <- 25; ph <- 240           # top edge and height
base <- y0 + ph               # the panel's floor (Y = 0)
edges <- x0 + pw * c(0, cumsum(p))
yat <- function(v) base - v * ph

sub <- function(i) sprintf('<tspan font-size="13" dy="5">%d</tspan><tspan dy="-5"></tspan>', i)
num <- function(v) formatC(v, format = "f", digits = 2)

out <- c(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 490" role="img" aria-label="The (X, Y) space is cut into three slices, one for each value of X, each as wide as P(X = x). A bar in each slice sits at the conditional mean of Y, so its shaded area is E[Y | X = x] times P(X = x). Below, the three shaded areas are added together and rearranged into a single rectangle of width one and height E[Y]." font-family="Red Hat Text, sans-serif">',
  '<title>Law of iterated expectations</title>',
  sprintf('<rect x="%g" y="%g" width="%g" height="%g" fill="none" stroke="#888888" stroke-width="1.5"/>', x0, y0, pw, ph)
)

# Draws of Y in each slice, around the conditional mean, as faint dots
for (i in seq_along(p)) {
  n  <- round(120 * p[i])
  xs <- runif(n, edges[i] + 12, edges[i + 1] - 12)
  ys <- pmin(pmax(rnorm(n, m[i], 0.13), 0.04), 0.96)
  out <- c(out, sprintf('<circle cx="%.1f" cy="%.1f" r="3.2" fill="#333333" fill-opacity="0.28"/>',
                        xs, yat(ys)))
}

# Shaded area under each conditional mean, and the mean itself
for (i in seq_along(p)) {
  out <- c(out,
    sprintf('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" fill-opacity="0.30"/>',
            edges[i], yat(m[i]), edges[i + 1] - edges[i], m[i] * ph, cols[i]),
    sprintf('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="4"/>',
            edges[i], yat(m[i]), edges[i + 1], yat(m[i]), cols[i]),
    sprintf('<text x="%.1f" y="%.1f" text-anchor="middle" font-size="17" fill="%s" paint-order="stroke" stroke="#F7F7F7" stroke-width="4">E[Y | X = x%s]</text>',
            (edges[i] + edges[i + 1]) / 2, yat(m[i]) - 9, cols[i], sub(i)))
}

# Slice dividers, the overall mean, and labels
out <- c(out,
  sprintf('<line x1="%.1f" y1="%g" x2="%.1f" y2="%g" stroke="#888888" stroke-width="1.5"/>',
          edges[2:3], y0, edges[2:3], base),
  sprintf('<line x1="%g" y1="%.1f" x2="%g" y2="%.1f" stroke="#333333" stroke-width="2" stroke-dasharray="8 6"/>',
          x0, yat(ey), x0 + pw, yat(ey)),
  sprintf('<text x="%g" y="%.1f" text-anchor="end" font-size="18" font-weight="700" fill="#333333" paint-order="stroke" stroke="#F7F7F7" stroke-width="4">E[Y]</text>',
          x0 + pw - 8, yat(ey) - 8),
  sprintf('<text x="%g" y="%g" font-size="20" fill="#888888">Y</text>', x0 + 12, y0 + 24),
  sprintf('<text x="%.1f" y="%g" text-anchor="middle" font-size="18" fill="#333333">P(X = x%s)</text>',
          (edges[-4] + edges[-1]) / 2, base + 26, sapply(seq_along(p), sub))
)

# Bottom row: the three areas, added, then rearranged into width 1 x E[Y]
s <- 0.4; floor2 <- 450; gap <- 40
pieces_x <- numeric(3); cur <- x0
for (i in seq_along(p)) {
  w <- pw * p[i] * s; h <- ph * m[i] * s
  pieces_x[i] <- cur
  out <- c(out,
    sprintf('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" fill-opacity="0.55"/>',
            cur, floor2 - h, w, h, cols[i]),
    sprintf('<text x="%.1f" y="%g" text-anchor="middle" font-size="15" fill="#333333">%s &#215; %s</text>',
            cur + w / 2, floor2 + 22, num(m[i]), num(p[i])))
  cur <- cur + w
  out <- c(out, sprintf('<text x="%.1f" y="%g" text-anchor="middle" font-size="30" fill="#333333">%s</text>',
                        cur + gap / 2, floor2 - 18, if (i < 3) "+" else "="))
  cur <- cur + gap
}

# The same three areas as strips of one rectangle of height E[Y]
h <- ph * ey * s
share <- p * m / ey
for (i in seq_along(p)) {
  w <- pw * s * share[i]
  out <- c(out, sprintf('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" fill-opacity="0.55"/>',
                        cur, floor2 - h, w, h, cols[i]))
  cur <- cur + w
}
left <- cur - pw * s
out <- c(out,
  sprintf('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="#333333" stroke-width="2"/>',
          left, floor2 - h, pw * s, h),
  sprintf('<text x="%.1f" y="%.1f" text-anchor="middle" font-size="17" font-weight="700" fill="#333333">E[Y] = %s</text>',
          left + pw * s / 2, floor2 - h - 10, formatC(ey, format = "f", digits = 3)),
  sprintf('<text x="%.1f" y="%g" text-anchor="middle" font-size="15" fill="#333333">width 1</text>',
          left + pw * s / 2, floor2 + 22),
  '</svg>')

writeLines(out, "lie_slices.svg")
cat("Wrote lie_slices.svg; E[Y] =", ey, "\n")
