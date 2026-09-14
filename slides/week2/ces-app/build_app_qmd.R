# ---------------------------------------------------------------------------
# Generate ../ces_conditioning_app.qmd from the app sources in this folder.
#
# shinylive runs the app in the browser through WebAssembly, which means every
# file the app opens has to be inlined into the page as a `## file:` block --
# there is no server to read from disk. Keeping app.R, items.csv and the data
# as normal files here and generating the wrapper keeps the inlined copy from
# drifting out of sync with the sources.
#
# Run after editing app.R or regenerating the data:  Rscript build_app_qmd.R
# ---------------------------------------------------------------------------

app_dir <- "."
out     <- "../ces_conditioning_app.qmd"

files <- c("app.R", "items.csv", "ces25_pid_policy.csv")
for (f in files) stopifnot(file.exists(file.path(app_dir, f)))

header <- c(
  "---",
  'title: "Conditioning on policy preferences"',
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
  "     Edit ces-app/app.R (or the data) and run:  Rscript ces-app/build_app_qmd.R -->",
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
cat("size:", round(file.size(out) / 1e6, 2), "MB\n")
