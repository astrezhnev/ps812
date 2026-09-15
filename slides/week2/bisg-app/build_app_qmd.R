# ---------------------------------------------------------------------------
# Generate ../bisg_app.qmd from the app sources in this folder.
#
# shinylive runs the app in the browser through WebAssembly, so every file the
# app opens has to be inlined into the page as a `## file:` block -- there is
# no server to read from disk.
#
# Run after editing app.R or regenerating the data:  Rscript build_app_qmd.R
# ---------------------------------------------------------------------------

app_dir <- "."
out     <- "../bisg_app.qmd"

files <- c("app.R", "bisg_names.csv", "bisg_geos.csv")
for (f in files) stopifnot(file.exists(file.path(app_dir, f)))

header <- c(
  "---",
  'title: "BISG: predicting race from surname and county"',
  "format:",
  "  html:",
  "    page-layout: custom",
  "    toc: false",
  "    embed-resources: false",
  "    include-in-header:",
  "      text: |",
  "        <style>",
  "          /* This page exists to be framed inside the week 2 slides, so the",
  "             site navbar, footer and title block are hidden. */",
  "          .navbar, .nav-footer, #title-block-header, header#title-block-header",
  "            { display:none !important; }",
  "          body { padding:0 !important; margin:0 !important; background:#F7F7F7; }",
  "          main, .page-columns, .content { padding:0 !important; margin:0 !important;",
  "            max-width:none !important; }",
  "        </style>",
  "filters:",
  "  - shinylive",
  "---",
  "",
  "<!-- GENERATED FILE -- do not edit by hand.",
  "     Edit bisg-app/app.R (or the data) and run:  Rscript bisg-app/build_app_qmd.R -->",
  "",
  "```{shinylive-r}",
  "#| standalone: true",
  "#| viewerHeight: 700",
  "#| components: [viewer]"
)

body <- unlist(lapply(files, function(f) {
  c(paste0("## file: ", f), readLines(file.path(app_dir, f), warn = FALSE), "")
}))

writeLines(c(header, "", body, "```"), out)

cat("wrote", normalizePath(out), "\n")
cat("size:", round(file.size(out) / 1e3, 1), "KB\n")
