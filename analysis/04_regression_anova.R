suppressPackageStartupMessages({library(readr); library(dplyr); library(broom)})
infile <- "data/core/processed/trial_summary_core.csv"
if (!file.exists(infile)) stop("Missing core summary.")
dir.create("results/models", recursive=TRUE, showWarnings=FALSE)
d <- read_csv(infile, show_col_types=FALSE) %>% mutate(browser=factor(browser), workload=factor(workload), block=factor(block))

# Multiple linear regression: tab count is numerical; browser/workload are categorical.
model <- lm(mean_rss_mb ~ tabs + I(tabs^2) + browser + workload, data=d)
write_csv(tidy(model, conf.int=TRUE), "results/models/multiple_regression_coefficients.csv")
write_csv(glance(model), "results/models/multiple_regression_fit.csv")

png("results/models/regression_residuals_vs_fitted.png", width=1000, height=700)
plot(fitted(model), resid(model), xlab="Fitted RSS (MB)", ylab="Residual (MB)", main="Residuals vs fitted")
abline(h=0, lty=2)
dev.off()
png("results/models/regression_qq.png", width=1000, height=700)
qqnorm(resid(model)); qqline(resid(model))
dev.off()

# Syllabus-facing two-way ANOVA with randomized block adjustment, separately at each tab count.
anova_rows <- list(); ai <- 1
for (t in sort(unique(d$tabs))) {
  g <- d %>% filter(tabs==t)
  fit <- aov(mean_rss_mb ~ browser * workload + block, data=g)
  tb <- as.data.frame(summary(fit)[[1]])
  tb$term <- rownames(tb); rownames(tb) <- NULL
  tb$tabs <- t
  anova_rows[[ai]] <- tb; ai <- ai+1
}
write_csv(bind_rows(anova_rows), "results/models/two_way_anova_by_tabs.csv")

# One-way ANOVA for browser effect within each workload and tab level.
one_rows <- list(); oi <- 1
for (w in levels(d$workload)) for (t in sort(unique(d$tabs))) {
  g <- d %>% filter(workload==w, tabs==t)
  fit <- aov(mean_rss_mb ~ browser, data=g)
  tb <- as.data.frame(summary(fit)[[1]]); tb$term <- rownames(tb); rownames(tb) <- NULL
  tb$workload <- w; tb$tabs <- t
  one_rows[[oi]] <- tb; oi <- oi+1
}
write_csv(bind_rows(one_rows), "results/models/one_way_anova_browser.csv")
cat("Regression + one-way/two-way ANOVA outputs written to results/models.\n")
