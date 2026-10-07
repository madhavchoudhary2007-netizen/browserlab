suppressPackageStartupMessages({library(readr); library(dplyr); library(ggplot2)})
infile <- "data/lifecycle/processed/trial_summary_lifecycle.csv"
if (!file.exists(infile)) {
  cat("Lifecycle data not present; skipping.\n")
} else {
dir.create("results/lifecycle", recursive=TRUE, showWarnings=FALSE)
d <- read_csv(infile, show_col_types=FALSE)

ratio_cols <- grep("^reclamation_ratio_", names(d), value=TRUE)
if (length(ratio_cols)) {
  s <- d %>% group_by(browser, workload) %>% summarise(across(all_of(ratio_cols), ~mean(.x,na.rm=TRUE)), mean_resume_ms=mean(mean_resume_roundtrip_ms,na.rm=TRUE), .groups="drop")
  write_csv(s, "results/lifecycle/reclamation_summary.csv")
  long <- tidyr::pivot_longer(d, cols=all_of(ratio_cols), names_to="checkpoint", values_to="reclamation_ratio")
  p <- ggplot(long, aes(x=checkpoint, y=reclamation_ratio, group=browser, linetype=browser)) + geom_point() + geom_line() + facet_wrap(~workload) + theme_bw() + labs(y="Memory reclamation ratio", x="Idle checkpoint")
  ggsave("results/lifecycle/reclamation.png", p, width=10, height=6, dpi=160)
}
cat("Lifecycle analysis complete.\n")
}
