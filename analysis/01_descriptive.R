suppressPackageStartupMessages({
  library(readr); library(dplyr); library(ggplot2); library(moments)
})

infile <- "data/core/processed/trial_summary_core.csv"
if (!file.exists(infile)) stop("Missing ", infile, ". Run the core/pilot experiment first.")
dir.create("results/descriptive", recursive=TRUE, showWarnings=FALSE)

d <- read_csv(infile, show_col_types=FALSE)
req <- c("browser","workload","tabs","mean_rss_mb","mean_cpu_pct_total","block")
stopifnot(all(req %in% names(d)))

summary_tbl <- d %>%
  group_by(browser, workload, tabs) %>%
  summarise(
    n=n(),
    mean_ram_mb=mean(mean_rss_mb, na.rm=TRUE),
    median_ram_mb=median(mean_rss_mb, na.rm=TRUE),
    sd_ram_mb=sd(mean_rss_mb, na.rm=TRUE),
    variance_ram=var(mean_rss_mb, na.rm=TRUE),
    skewness_ram=ifelse(n()>=3, moments::skewness(mean_rss_mb, na.rm=TRUE), NA_real_),
    kurtosis_ram=ifelse(n()>=4, moments::kurtosis(mean_rss_mb, na.rm=TRUE), NA_real_),
    mean_cpu=mean(mean_cpu_pct_total, na.rm=TRUE),
    sd_cpu=sd(mean_cpu_pct_total, na.rm=TRUE),
    .groups="drop"
  )
write_csv(summary_tbl, "results/descriptive/group_summary.csv")

p1 <- ggplot(d, aes(x=browser, y=mean_rss_mb)) +
  geom_boxplot() + facet_grid(workload ~ tabs, scales="free_y") +
  labs(title="Mean browser-process-tree RSS by condition", x="Browser", y="Mean RSS (MB)") +
  theme_bw()
ggsave("results/descriptive/ram_boxplots.png", p1, width=13, height=8, dpi=160)

ram_scaling <- summary_tbl %>% group_by(browser, workload, tabs) %>%
  summarise(mean_ram=mean(mean_ram_mb), se=sd_ram_mb/sqrt(n), .groups="drop")
p2 <- ggplot(ram_scaling, aes(x=tabs, y=mean_ram, group=browser, linetype=browser)) +
  geom_line() + geom_point() +
  facet_wrap(~workload, scales="free_y") +
  labs(title="Resource scaling with tab count", x="Tabs", y="Mean RSS (MB)") + theme_bw()
ggsave("results/descriptive/ram_scaling.png", p2, width=11, height=6, dpi=160)

cat("Wrote descriptive results to results/descriptive\n")
