# Inline population.js and population.json on a slide, as on the week 4
# Datasaurus slide, with one empty .pop-step fragment per click so the clicker
# steps the animation. `stages` is this slide's run of the keyframes listed at
# the top of population.js: the first entry is where the slide starts, and each
# later entry is one click, either a keyframe name or
# list(chain = I(c(...)), speed = s) to play several keyframes on one click.
pop_anim <- function(stages) {
  if (is.character(stages)) stages <- as.list(stages)
  js   <- readLines("pop-anim/population.js")
  data <- readLines("pop-anim/population.json", warn = FALSE)
  opts <- jsonlite::toJSON(list(stages = stages), auto_unbox = TRUE)
  cat("```{=html}",
      '<div class="pop-anim"></div>',
      "<script>",
      "(", js, ")(document.currentScript.previousElementSibling,", data, ",", opts, ");",
      "</script>",
      rep('<span class="fragment pop-step"></span>', length(stages) - 1),
      "```", sep = "\n")
}

# One full round of repeated sampling: the previous sample vanishes, sample r
# is drawn, boxed, turned into a pie and filed in the column. `set` is the
# 1-based sample size (1 = n of 25, 2 = 50, 3 = 100); the first round at a new
# size has no previous sample to clear.
sampling_round <- function(r, set = 1) {
  pre <- if (set == 1) "" else paste0(set, ".")
  this <- sprintf("%s%d:%s", pre, r, c("start", "sel", "samp", "spie", "sdone"))
  if (r == 1) this else c(sprintf("%s%d:gone", pre, r - 1), this)
}
