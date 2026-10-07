packages <- c("ggplot2", "dplyr", "readr", "tidyr", "fitdistrplus", "moments", "pwr", "broom")
missing <- packages[!vapply(packages, requireNamespace, logical(1), quietly=TRUE)]
if (length(missing) > 0) {
  install.packages(missing, repos="https://cloud.r-project.org")
}
cat("R packages ready.\n")
