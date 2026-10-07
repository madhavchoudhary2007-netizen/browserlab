suppressPackageStartupMessages({library(readr); library(dplyr); library(ggplot2)})
infile <- "data/work/processed/trial_summary_work.csv"
if (!file.exists(infile)) {
  cat("Work-unit data not present; skipping.\n")
} else {
dir.create("results/work_efficiency", recursive=TRUE, showWarnings=FALSE)
d <- read_csv(infile, show_col_types=FALSE)
s <- d %>% group_by(browser,tabs) %>% summarise(n=n(),mean_units_s=mean(units_per_second,na.rm=TRUE),sd_units_s=sd(units_per_second,na.rm=TRUE),mean_j_per_unit=mean(joules_above_idle_per_unit,na.rm=TRUE),.groups="drop")
write_csv(s,"results/work_efficiency/summary.csv")
p <- ggplot(s,aes(x=tabs,y=mean_units_s,group=browser,linetype=browser))+geom_line()+geom_point()+theme_bw()+labs(x="Tabs",y="Completed work units/s")
ggsave("results/work_efficiency/throughput_scaling.png",p,width=9,height=6,dpi=160)
cat("Work-efficiency analysis complete.\n")
}
