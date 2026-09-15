# ---------------------------------------------------------------------------
# BISG: P(race | surname, county) as an application of Bayes' rule.
#
#   P(race | surname, county)  proportional to  P(surname | race) P(race | county)
#
# The county supplies the prior, the surname supplies the likelihood. Data
# prepared by prepare_data.R; see that file for sources. The numbers here
# reproduce wru::predict_race(census.geo = "county", year = "2020") to within
# 1e-5, which is the rounding in the CSVs.
#
# Deliberately base R + shiny only. Every extra package is another wasm
# download when this runs in the browser through shinylive.
# ---------------------------------------------------------------------------

library(shiny)

nm <- read.csv("bisg_names.csv", stringsAsFactors = FALSE)
gz <- read.csv("bisg_geos.csv", colClasses = c(fips = "character"),
               stringsAsFactors = FALSE)

ETH <- c("whi", "bla", "his", "asi", "oth")

# wru's national race margins, P(race). Used only for the surname-only
# prediction; the posterior does not depend on them.
RACE_MARGIN <- c(whi = 0.5783619, bla = 0.1205021, his = 0.1872988,
                 asi = 0.06106737, oth = 0.05276981)

# P(surname | race), one row per name; P(race | county), one row per county.
# Drop the CSV's column-name prefixes so both matrices are indexed by the bare
# race codes in ETH, which is how every lookup below addresses them.
CMAT <- as.matrix(nm[, paste0("c_", ETH)]); colnames(CMAT) <- ETH
RMAT <- as.matrix(gz[, paste0("r_", ETH)]); colnames(RMAT) <- ETH

# Five categorical hues, checked with the palette validator: all inside the
# lightness band, all above the chroma floor, worst adjacent CVD pair
# (Hispanic/Black) at deuteranope dE 11.3, all above 3:1 on white.
RACE <- list(
  whi = list(label = "White",    col = "#0479A8"),
  bla = list(label = "Black",    col = "#c5050c"),
  his = list(label = "Hispanic", col = "#C77400"),
  asi = list(label = "Asian",    col = "#6A3D9A"),
  oth = list(label = "Other",    col = "#5E7A2E")
)

normalise <- function(x) x / sum(x)

css <- "
@import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;700&family=Red+Hat+Text:wght@400;500;700&display=swap');
html, body { height:100%; }
body { font-family:'Red Hat Text',system-ui,sans-serif; background:#F7F7F7; color:#333;
       margin:0; padding:10px; font-size:14px; box-sizing:border-box; overflow:hidden; }
h1,h2,h3,h4 { font-family:'Red Hat Display',system-ui,sans-serif; margin:0 0 6px 0; }
.wrap { display:flex; gap:14px; align-items:stretch; height:100%; }
.left { flex:0 0 290px; }
.right { flex:1 1 auto; min-width:0; height:100%; }
.card { background:#fff; border:1px solid #e2e2e2; border-radius:8px; padding:12px;
        box-sizing:border-box; }
.right .card { height:100%; overflow-y:auto; }
.left .card { max-height:100%; overflow-y:auto; }
.who { font-size:12px; color:#666; margin:-2px 0 9px 0; line-height:1.45; }
.who b { color:#333; }
.res-row { margin-bottom:9px; }
.res-top { display:flex; justify-content:space-between; align-items:baseline; }
.res-lab { font-weight:700; font-size:13px; }
.res-val { font-family:'Red Hat Display',sans-serif; font-weight:700; font-size:20px; }
.bar-bg { background:#eee; border-radius:3px; height:9px; margin-top:3px; overflow:hidden; }
.bar-fg { height:9px; border-radius:3px; }
/* The two ingredient bars: 100% stacked, 2px of surface between segments. */
.ing { margin-top:10px; padding-top:9px; border-top:1px solid #eee; }
.ing-lab { font-weight:700; font-size:11px; text-transform:uppercase;
           letter-spacing:.05em; color:#777; margin-bottom:3px; }
.ing-lab span { text-transform:none; letter-spacing:0; font-weight:400; color:#999; }
.stack { display:flex; height:13px; border-radius:3px; overflow:hidden;
         background:#fff; margin-bottom:8px; }
.stack div { height:13px; box-shadow:inset -2px 0 0 #fff; }
.stack div:last-child { box-shadow:none; }
.nbox { margin-top:9px; padding-top:8px; border-top:1px solid #eee; font-size:11.5px;
        color:#777; line-height:1.5; }
.hdr { display:flex; justify-content:space-between; align-items:center; gap:10px;
       position:sticky; top:-12px; background:#fff; padding:2px 0 4px 0; z-index:2; }
.note { font-size:11px; color:#888; margin:2px 0 6px 0; line-height:1.35; }
.topic { font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:.05em;
         color:#777; margin:9px 0 4px 0; }
.btn-item { display:inline-block; margin:0 4px 4px 0; padding:4px 9px; border-radius:6px;
            border:1px solid #ccc; background:#fff; color:#444; cursor:pointer;
            font-family:'Red Hat Text',sans-serif; font-size:12px; line-height:1.25;
            text-align:left; white-space:nowrap; vertical-align:top; }
.btn-item:hover { border-color:#999; }
/* The surnames sit in an even grid with no headings: which group a name
   belongs to is the thing students are meant to work out by clicking. */
.name-grid { display:grid; grid-template-columns:repeat(5,1fr);
             gap:6px; margin-top:5px; }   /* 40 names -> a clean 5 x 8 */
.name-grid .btn-item { margin:0; width:100%; text-align:center; box-sizing:border-box; }
.btn-on { background:#5a3d8a; border-color:#4c3376; color:#fff; font-weight:500; }
.btn-geo { font-size:12.5px; }
.tag { display:block; font-size:10px; opacity:.85; margin-top:1px; white-space:normal; }
"

ui <- fluidPage(
  tags$head(tags$style(HTML(css))),
  div(class = "wrap",

    div(class = "left",
      div(class = "card",
        h4("P(race | surname, county)"),
        uiOutput("who"),
        uiOutput("shares")
      )
    ),

    div(class = "right",
      div(class = "card",
        div(class = "hdr", h4("Pick a surname and a county")),
        div(class = "note",
            "The county sets the prior, the surname supplies the likelihood."),
        uiOutput("geo_buttons"),
        uiOutput("name_buttons")
      )
    )
  )
)

server <- function(input, output, session) {

  # Resolve the starting selections before building the reactive store --
  # reading st$name here would be a read outside a reactive context.
  start_name <- which(nm$surname == "LEE")[1]
  start_geo  <- which(gz$geo == "Dane County")[1]
  if (is.na(start_name)) start_name <- 1L
  if (is.na(start_geo))  start_geo  <- 1L

  st <- reactiveValues(name = start_name, geo = start_geo)

  lapply(seq_len(nrow(nm)), function(j) {
    observeEvent(input[[paste0("nm_", j)]], { st$name <- j }, ignoreInit = TRUE)
  })
  lapply(seq_len(nrow(gz)), function(g) {
    observeEvent(input[[paste0("gz_", g)]], { st$geo <- g }, ignoreInit = TRUE)
  })

  post <- reactive(normalise(CMAT[st$name, ] * RMAT[st$geo, ]))
  sonly <- reactive(normalise(CMAT[st$name, ] * RACE_MARGIN))
  prior <- reactive(RMAT[st$geo, ])

  output$who <- renderUI({
    div(class = "who",
        "Someone named ", tags$b(nm$surname[st$name]),
        " living in ", tags$b(paste0(gz$geo[st$geo], ", ", gz$state[st$geo])))
  })

  stack_bar <- function(p) {
    div(class = "stack",
      lapply(ETH, function(k) {
        if (p[[k]] < 0.0005) return(NULL)
        div(style = paste0("width:", sprintf("%.2f", 100 * p[[k]]), "%;background:",
                           RACE[[k]]$col, ";"),
            title = sprintf("%s: %.1f%%", RACE[[k]]$label, 100 * p[[k]]))
      })
    )
  }

  output$shares <- renderUI({
    p <- post(); s <- sonly(); r <- prior()

    rows <- lapply(ETH, function(k) {
      share <- p[[k]]
      meta  <- RACE[[k]]
      div(class = "res-row",
        title = sprintf("%s: %.1f%%", meta$label, 100 * share),
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

    tagList(
      rows,
      div(class = "ing",
        div(class = "ing-lab", "Prior ", span("- county alone")),
        stack_bar(r),
        div(class = "ing-lab", "Surname alone ", span("- ignoring county")),
        stack_bar(s)
      ),
      div(class = "nbox",
        sprintf("County population %s (2020 Census).",
                format(round(gz$pop[st$geo]), big.mark = ",")), br(),
        "Posterior is proportional to P(surname | race) x P(race | county)."
      )
    )
  })

  output$geo_buttons <- renderUI({
    tagList(
      div(class = "topic", "County"),
      lapply(seq_len(nrow(gz)), function(g) {
        tags$button(
          id = paste0("gz_", g),
          class = paste("btn-item btn-geo action-button", if (g == st$geo) "btn-on" else ""),
          title = sprintf("%s, %s", gz$geo[g], gz$state[g]),
          gz$geo[g],
          span(class = "tag", gz$state[g])
        )
      })
    )
  })

  output$name_buttons <- renderUI({
    tagList(
      div(class = "topic", "Surname"),
      div(class = "name-grid",
        lapply(seq_len(nrow(nm)), function(j) {
          tags$button(
            id = paste0("nm_", j),
            class = paste("btn-item action-button", if (j == st$name) "btn-on" else ""),
            nm$surname[j]
          )
        })
      )
    )
  })
}

shinyApp(ui, server)
