scripts <- c(
  "analysis/01_descriptive.R",
  "analysis/02_distributions.R",
  "analysis/03_hypothesis_tests.R",
  "analysis/04_regression_anova.R",
  "analysis/05_power_analysis.R",
  "analysis/06_lifecycle.R",
  "analysis/07_work_efficiency.R"
)
for (s in scripts) {
  cat("\n=== ", s, " ===\n", sep="")
  source(s, echo=FALSE)
}
