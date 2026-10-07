suppressPackageStartupMessages({
  library(readr); library(dplyr); library(fitdistrplus)
})

infile <- "data/core/processed/trial_summary_core.csv"
if (!file.exists(infile)) stop("Missing core summary.")
dir.create("results/distributions", recursive=TRUE, showWarnings=FALSE)
d <- read_csv(infile, show_col_types=FALSE)

fit_one <- function(x) {
  x <- x[is.finite(x) & x > 0]
  if (length(x) < 5 || sd(x) == 0) return(NULL)
  fits <- list(
    normal = tryCatch(fitdist(x, "norm"), error=function(e) NULL),
    gamma = tryCatch(fitdist(x, "gamma"), error=function(e) NULL),
    weibull = tryCatch(fitdist(x, "weibull"), error=function(e) NULL)
  )
  fits <- fits[!vapply(fits, is.null, logical(1))]
  if (!length(fits)) return(NULL)
  aic <- vapply(fits, function(f) f$aic, numeric(1))
  best <- names(which.min(aic))
  f <- fits[[best]]
  chi_stat <- NA_real_; chi_df <- NA_integer_; chi_p <- NA_real_
  # Chi-square GOF only when expected counts can be >=5 with five equal-probability bins.
  if (length(x) >= 25) {
    probs <- seq(0, 1, length.out=6)
    if (best == "normal") q <- qnorm(probs, f$estimate[["mean"]], f$estimate[["sd"]])
    if (best == "gamma") q <- qgamma(probs, f$estimate[["shape"]], rate=f$estimate[["rate"]])
    if (best == "weibull") q <- qweibull(probs, f$estimate[["shape"]], f$estimate[["scale"]])
    q[1] <- -Inf; q[length(q)] <- Inf
    obs <- as.numeric(table(cut(x, breaks=q, include.lowest=TRUE)))
    exp <- rep(length(x)/5, 5)
    chi_stat <- sum((obs-exp)^2/exp)
    chi_df <- 5 - 1 - length(f$estimate)
    if (chi_df > 0) chi_p <- pchisq(chi_stat, df=chi_df, lower.tail=FALSE)
  }
  data.frame(
    n=length(x), best_distribution=best,
    normal_aic=if (!is.null(fits$normal)) fits$normal$aic else NA,
    gamma_aic=if (!is.null(fits$gamma)) fits$gamma$aic else NA,
    weibull_aic=if (!is.null(fits$weibull)) fits$weibull$aic else NA,
    chi_square=chi_stat, chi_square_df=chi_df, chi_square_p=chi_p
  )
}

groups <- split(d, interaction(d$browser, d$workload, d$tabs, drop=TRUE))
out <- lapply(groups, function(g) {
  r <- fit_one(g$mean_rss_mb)
  if (is.null(r)) return(NULL)
  cbind(browser=g$browser[1], workload=g$workload[1], tabs=g$tabs[1], r)
})
out <- bind_rows(out)
write_csv(out, "results/distributions/ram_distribution_fits.csv")
cat("Wrote distribution fits. Chi-square GOF is intentionally omitted for strata with n<25.\n")
