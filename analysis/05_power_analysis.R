suppressPackageStartupMessages({library(readr); library(dplyr); library(pwr)})
infile <- "data/core/processed/trial_summary_core.csv"
if (!file.exists(infile)) stop("Missing pilot/core summary.")
dir.create("results/power", recursive=TRUE, showWarnings=FALSE)
d <- read_csv(infile, show_col_types=FALSE)

cohen_f <- function(g) {
  g <- g[is.finite(g$mean_rss_mb),]
  means <- tapply(g$mean_rss_mb, g$browser, mean)
  ns <- tapply(g$mean_rss_mb, g$browser, length)
  k <- length(means); N <- sum(ns)
  if (k < 2 || N <= k) return(NA_real_)
  grand <- weighted.mean(means, ns)
  ss_between <- sum(ns * (means-grand)^2)
  ss_within <- sum(tapply(g$mean_rss_mb, g$browser, function(x) sum((x-mean(x))^2)))
  var_within <- ss_within/(N-k)
  if (!is.finite(var_within) || var_within <= 0) return(NA_real_)
  sqrt((ss_between/N)/var_within)
}

rows <- list(); i <- 1
for (w in unique(d$workload)) for (t in sort(unique(d$tabs))) {
  g <- d %>% filter(workload==w, tabs==t)
  f <- cohen_f(g)
  k <- length(unique(g$browser))
  nreq <- if (is.finite(f) && f>0) ceiling(pwr.anova.test(k=k, f=f, sig.level=0.05, power=0.80)$n) else NA
  rows[[i]] <- data.frame(workload=w,tabs=t,k=k,observed_cohen_f=f,estimated_n_per_browser=nreq); i <- i+1
}
out <- bind_rows(rows)
write_csv(out, "results/power/pilot_observed_effects.csv")

k <- length(unique(d$browser))
targets <- data.frame(target_f=c(0.10,0.25,0.40))
targets$n_per_browser <- sapply(targets$target_f, function(f) ceiling(pwr.anova.test(k=k,f=f,sig.level=0.05,power=0.80)$n))
write_csv(targets, "results/power/reference_power_targets.csv")
cat("Power-analysis tables written. Treat pilot-observed effect sizes as estimates, not guarantees; choose the final repetition count before the confirmatory run.\n")
