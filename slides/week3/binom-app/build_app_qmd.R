# ---------------------------------------------------------------------------
# Generate ../binomial_app.qmd from the app sources in this folder.
#
# shinylive runs the app in the browser through WebAssembly, so every file the
# app opens has to be inlined into the page as a `## file:` block -- there is
# no server to read from disk.
#
# Run after editing app.R or regenerating the data:  Rscript build_app_qmd.R
# ---------------------------------------------------------------------------

app_dir <- "."
out     <- "../binomial_app.qmd"

# Inlined name -> source path. The data is read straight from the week 3 data
# folder so the slides and the app share one copy of the extract.
files <- c("app.R" = "app.R", "mexico_list.csv" = "../data/mexico_list.csv")
for (f in files) stopifnot(file.exists(file.path(app_dir, f)))

header <- c(
  "---",
  'title: "Fitting a Binomial to the list experiment"',
  "format:",
  "  html:",
  "    page-layout: custom",
  "    toc: false",
  "    embed-resources: false",
  "    include-in-header:",
  "      text: |",
  "        <style>",
  "          /* This page exists to be framed inside the week 3 slides, so the",
  "             site navbar, footer and title block are hidden. */",
  "          .navbar, .nav-footer, #title-block-header, header#title-block-header",
  "            { display:none !important; }",
  "          body { padding:0 !important; margin:0 !important; background:#F7F7F7; }",
  "          main, .page-columns, .content { padding:0 !important; margin:0 !important;",
  "            max-width:none !important; }",
  "          /* shinylive sizes its viewer to a fixed `viewerHeight`, which overflows",
  "             the frame whenever the slide gives this page less room than that. The",
  "             overflow is unreachable: a wheel over the app scrolls the app's own",
  "             panels, and scroll chaining stops at the iframe boundary. So pin the",
  "             widget to whatever viewport it lands in and let the app scroll its",
  "             panels inside, which is what its own layout is built to do. */",
  "          html, body { height:100%; overflow:hidden; }",
  "          .shinylive-wrapper, .shinylive-container {",
  "            height:100vh !important; height:100dvh !important; min-height:0 !important;",
  "            margin:0 !important; padding:0 !important; border:0 !important;",
  "            border-radius:0 !important; box-shadow:none !important; }",
  "          .shinylive-container > div { height:100% !important; min-height:0 !important; }",
  "          iframe.app-frame { display:block; border:0 !important;",
  "            height:100vh !important; height:100dvh !important; }",
  "        </style>",
  "filters:",
  "  - shinylive",
  "---",
  "",
  "<!-- GENERATED FILE -- do not edit by hand.",
  "     Edit binom-app/app.R (or the data) and run:  Rscript binom-app/build_app_qmd.R -->",
  "",
  "```{shinylive-r}",
  "#| standalone: true",
  "#| viewerHeight: 700",
  "#| components: [viewer]"
)

body <- unlist(lapply(names(files), function(f) {
  c(paste0("## file: ", f), readLines(file.path(app_dir, files[[f]]), warn = FALSE), "")
}))

writeLines(c(header, "", body, "```"), out)

cat("wrote", normalizePath(out), "\n")
cat("size:", round(file.size(out) / 1e3, 1), "KB\n")
