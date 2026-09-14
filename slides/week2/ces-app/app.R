# ---------------------------------------------------------------------------
# Conditioning on policy preferences: P(party ID | policy positions)
#
# CES Common Content 2025 (n = 17,000), weighted by commonweight.
# Data prepared by prepare_data.R; see that file for the Dataverse source.
#
# Deliberately base R + shiny only. Every extra package is another wasm
# download when this runs in the browser through shinylive.
# ---------------------------------------------------------------------------

library(shiny)

items <- read.csv("items.csv", stringsAsFactors = FALSE)
dat   <- read.csv("ces25_pid_policy.csv", colClasses = "character")
dat$w <- as.numeric(dat$w)

n_items <- nrow(items)

# Split the packed answer string into a respondent-by-item character matrix
# once at startup, so each recomputation is a handful of vector comparisons
# rather than 38 substr() calls over 17,000 rows.
A <- matrix(unlist(strsplit(dat$a, "", fixed = TRUE)),
            ncol = n_items, byrow = TRUE)

topics <- unique(items$topic)

ABORTION <- list(
  question = "Which one of the opinions on this page best agrees with your view on abortion?",
  options  = c(
    "1" = "Never permitted",
    "2" = "Only rape, incest, or life of the woman",
    "3" = "Other reasons, once need is established",
    "4" = "Always a matter of personal choice"
  )
)

# Wasserstein distance needs a metric on the support. Party ID is categorical,
# but the three categories have a natural left-to-right order, so we place them
# on an ordinal scale with unit spacing and use the 1-Wasserstein distance:
# W1 = sum over cut points of |F_conditional - F_unconditional|. This runs from
# 0 (identical) to 2 (all mass moved from one end of the scale to the other).
PID_ORDER <- c("D", "I", "R")

w1 <- function(p, q) sum(abs(cumsum(p)[-length(p)] - cumsum(q)[-length(q)]))

pid_dist <- function(w, p) {
  vapply(PID_ORDER, function(k) sum(w[p == k]), numeric(1)) / sum(w)
}

# The unconditional distribution every conditional one is compared against.
P_UNCOND <- pid_dist(dat$w, dat$pid)

PARTY <- list(
  R = list(label = "Republican",          col = "#c5050c"),
  D = list(label = "Democrat",            col = "#0479A8"),
  I = list(label = "Independent / Other", col = "#8a8a8a")
)

# Button states for the support/oppose items: 0 = not conditioned on,
# 1 = condition on Support, 2 = condition on Oppose. Clicking cycles 0-1-2-0.
STATE_LAB <- c("not conditioned", "Support", "Oppose")
STATE_CLS <- c("btn-off", "btn-support", "btn-oppose")

css <- "
@import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;700&family=Red+Hat+Text:wght@400;500;700&display=swap');
html, body { height:100%; }
body { font-family:'Red Hat Text',system-ui,sans-serif; background:#F7F7F7; color:#333;
       margin:0; padding:10px; font-size:14px; box-sizing:border-box; overflow:hidden; }
h1,h2,h3,h4 { font-family:'Red Hat Display',system-ui,sans-serif; margin:0 0 6px 0; }
/* The panels fill whatever height the slide gives the iframe; the button list
   scrolls inside its own card rather than scrolling the whole page. */
.wrap { display:flex; gap:14px; align-items:stretch; height:100%; }
.left { flex:0 0 240px; }
.right { flex:1 1 auto; min-width:0; height:100%; }
.card { background:#fff; border:1px solid #e2e2e2; border-radius:8px; padding:12px;
        box-sizing:border-box; }
.right .card { height:100%; overflow-y:auto; }
.left .card { max-height:100%; overflow-y:auto; }
.res-row { margin-bottom:10px; }
.res-top { display:flex; justify-content:space-between; align-items:baseline; }
.res-lab { font-weight:700; font-size:13px; }
.res-val { font-family:'Red Hat Display',sans-serif; font-weight:700; font-size:20px; }
.bar-bg { background:#eee; border-radius:3px; height:8px; margin-top:3px; overflow:hidden; }
.bar-fg { height:8px; border-radius:3px; }
.wass { margin-top:9px; padding-top:8px; border-top:1px solid #eee; }
.wass-top { display:flex; justify-content:space-between; align-items:baseline; }
.wass-lab { font-weight:700; font-size:12px; color:#444; }
.wass-val { font-family:'Red Hat Display',sans-serif; font-weight:700; font-size:17px;
            color:#5a3d8a; }
.wass-bar { background:#eee; border-radius:3px; height:5px; margin-top:3px; overflow:hidden; }
.wass-fg { height:5px; border-radius:3px; background:#5a3d8a; }
.wass-sub { font-size:10.5px; color:#999; margin-top:3px; line-height:1.35; }
.nbox { margin-top:9px; padding-top:8px; border-top:1px solid #eee; font-size:12px; color:#666; line-height:1.5; }
.undef { color:#c5050c; font-weight:700; font-family:'Red Hat Display',sans-serif;
         font-size:17px; line-height:1.3; }
.topic { font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:.05em;
         color:#777; margin:7px 0 4px 0; }
.btn-item { display:inline-block; margin:0 4px 4px 0; padding:4px 8px; border-radius:6px;
            border:1px solid #ccc; background:#fff; color:#444; cursor:pointer;
            font-family:'Red Hat Text',sans-serif; font-size:12px; line-height:1.25;
            text-align:left; max-width:290px; white-space:normal; vertical-align:top; }
.btn-item:hover { border-color:#999; }
.btn-off {}
.btn-support { background:#1f7a5c; border-color:#1a6b50; color:#fff; font-weight:500; }
.btn-oppose  { background:#a8431f; border-color:#93391a; color:#fff; font-weight:500; }
.btn-on      { background:#5a3d8a; border-color:#4c3376; color:#fff; font-weight:500; }
.tag { display:block; font-size:10px; opacity:.85; margin-top:1px; }
.hdr { display:flex; justify-content:space-between; align-items:center; gap:10px;
        position:sticky; top:-12px; background:#fff; padding:2px 0 4px 0; z-index:2; }
.reset { padding:5px 12px; border-radius:6px; border:1px solid #c5050c; background:#fff;
         color:#c5050c; font-weight:700; cursor:pointer; font-size:12px; }
.reset:hover { background:#c5050c; color:#fff; }
.note { font-size:11px; color:#888; margin:2px 0 4px 0; line-height:1.35; }
"

ui <- fluidPage(
  tags$head(tags$style(HTML(css))),
  div(class = "wrap",

    div(class = "left",
      div(class = "card",
        h4("P(Party ID | conditions)"),
        uiOutput("shares")
      )
    ),

    div(class = "right",
      div(class = "card",
        div(class = "hdr",
          h4("Condition on policy positions"),
          actionButton("reset", "Reset", class = "reset")
        ),
        div(class = "note",
          "Click to cycle Support → Oppose → off. Abortion options are independent ",
          "toggles: select any combination."),

        uiOutput("buttons")
      )
    )
  )
)

server <- function(input, output, session) {

  st <- reactiveValues(
    item = rep(0L, n_items),      # 0 none / 1 support / 2 oppose
    ab   = character(0)           # selected abortion option codes
  )

  # One observer per item button, cycling 0 -> 1 -> 2 -> 0.
  lapply(seq_len(n_items), function(j) {
    observeEvent(input[[paste0("it_", j)]], {
      st$item[j] <- (st$item[j] + 1L) %% 3L
    }, ignoreInit = TRUE)
  })

  lapply(names(ABORTION$options), function(k) {
    observeEvent(input[[paste0("ab_", k)]], {
      st$ab <- if (k %in% st$ab) setdiff(st$ab, k) else c(st$ab, k)
    }, ignoreInit = TRUE)
  })

  observeEvent(input$reset, {
    st$item <- rep(0L, n_items)
    st$ab   <- character(0)
  })

  # Rows still in the conditioning set. A respondent who did not answer a
  # conditioning item is "." and so matches neither Support nor Oppose.
  keep <- reactive({
    idx <- rep(TRUE, nrow(dat))
    on <- which(st$item != 0L)
    for (j in on) {
      idx <- idx & (A[, j] == if (st$item[j] == 1L) "1" else "0")
    }
    if (length(st$ab)) idx <- idx & (dat$ab %in% st$ab)
    idx
  })

  output$shares <- renderUI({
    idx <- keep()
    n   <- sum(idx)

    if (n == 0L) {
      return(tagList(
        div(class = "undef", "Undefined"),
        div(class = "nbox", "No respondents satisfy these conditions")
      ))
    }

    w  <- dat$w[idx]
    p  <- dat$pid[idx]
    tw <- sum(w)

    rows <- lapply(c("R", "D", "I"), function(k) {
      share <- sum(w[p == k]) / tw
      meta  <- PARTY[[k]]
      div(class = "res-row",
        div(class = "res-top",
          span(class = "res-lab", style = paste0("color:", meta$col), meta$label),
          span(class = "res-val", sprintf("%.1f%%", 100 * share))
        ),
        div(class = "bar-bg",
          div(class = "bar-fg",
              style = paste0("width:", sprintf("%.1f", 100 * share), "%;background:", meta$col))
        )
      )
    })

    dist_val <- w1(pid_dist(w, p), P_UNCOND)

    n_cond <- sum(st$item != 0L) + (length(st$ab) > 0)

    tagList(
      rows,
      div(class = "wass",
        div(class = "wass-top",
          span(class = "wass-lab", "Wasserstein distance"),
          span(class = "wass-val", sprintf("%.3f", dist_val))
        ),
        div(class = "wass-bar",
          div(class = "wass-fg",
              style = paste0("width:", sprintf("%.1f", 100 * dist_val / 2), "%"))
        ),
        div(class = "wass-sub",
            "from the unconditional distribution, on the ordered scale ",
            "Democrat–Independent–Republican (0 to 2)")
      ),
      div(class = "nbox",
        sprintf("%s respondent%s (%.1f%% of sample)", format(n, big.mark = ","),
                if (n == 1L) "" else "s", 100 * n / nrow(dat)), br(),
        sprintf("%s condition%s applied", n_cond, if (n_cond == 1) "" else "s"), br(),
        "Weighted by commonweight."
      )
    )
  })

  output$buttons <- renderUI({
    blocks <- lapply(topics, function(tp) {
      js <- which(items$topic == tp)
      tagList(
        div(class = "topic", tp),
        lapply(js, function(j) {
          s <- st$item[j]
          tags$button(
            id = paste0("it_", j),
            class = paste("btn-item action-button", STATE_CLS[s + 1L]),
            title = items$question[j],
            items$short[j],
            if (s > 0) span(class = "tag", STATE_LAB[s + 1L])
          )
        })
      )
    })

    ab_block <- tagList(
      div(class = "topic", "Abortion"),
      lapply(names(ABORTION$options), function(k) {
        on <- k %in% st$ab
        tags$button(
          id = paste0("ab_", k),
          class = paste("btn-item action-button", if (on) "btn-on" else "btn-off"),
          title = ABORTION$question,
          ABORTION$options[[k]],
          if (on) span(class = "tag", "in conditioning set")
        )
      })
    )

    after <- match("Immigration", topics)
    tagList(blocks[seq_len(after)], ab_block, blocks[-seq_len(after)])
  })
}

shinyApp(ui, server)
