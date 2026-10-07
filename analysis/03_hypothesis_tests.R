suppressPackageStartupMessages({library(readr); library(dplyr)})
infile <- "data/core/processed/trial_summary_core.csv"
if (!file.exists(infile)) stop("Missing core summary.")
dir.create("results/hypothesis_tests", recursive=TRUE, showWarnings=FALSE)
d <- read_csv(infile, show_col_types=FALSE)

pair_rows <- list(); idx <- 1
for (w in unique(d$workload)) for (t in sort(unique(d$tabs))) {
  g <- d %>% filter(workload==w, tabs==t)
  bs <- sort(unique(g$browser))
  if (length(bs)<2) next
  for (i in 1:(length(bs)-1)) for (j in (i+1):length(bs)) {
    x <- g$mean_rss_mb[g$browser==bs[i]]; y <- g$mean_rss_mb[g$browser==bs[j]]
    if (sum(is.finite(x))<2 || sum(is.finite(y))<2) next
    tt <- t.test(x, y, var.equal=FALSE)
    ft <- tryCatch(var.test(x,y), error=function(e) NULL)
    pair_rows[[idx]] <- data.frame(
      workload=w, tabs=t, browser_a=bs[i], browser_b=bs[j],
      mean_a=mean(x,na.rm=TRUE), mean_b=mean(y,na.rm=TRUE),
      mean_difference=mean(x,na.rm=TRUE)-mean(y,na.rm=TRUE),
      t_stat=unname(tt$statistic), t_df=unname(tt$parameter), t_p=tt$p.value,
      ci_low=tt$conf.int[1], ci_high=tt$conf.int[2],
      f_stat=if(!is.null(ft)) unname(ft$statistic) else NA,
      f_p=if(!is.null(ft)) ft$p.value else NA
    ); idx <- idx+1
  }
}
out <- bind_rows(pair_rows) %>%
  mutate(t_p_holm=p.adjust(t_p, method="holm"), f_p_holm=p.adjust(f_p, method="holm"))
write_csv(out, "results/hypothesis_tests/pairwise_ram_tests.csv")
cat("Welch t-tests and two-sample F variance tests written with Holm multiplicity correction.\n")
