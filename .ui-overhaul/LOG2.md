# LOG2 (pass 2)

## P0 setup (done)
- Branch ui-overhaul; tag ui-overhaul-final -> 7ebd506.
- Baseline: gate OK, typecheck/lint clean, vitest 15, build OK, e2e 85/85, pytest 122 (.venv/bin/python -m pytest).
- Gate: added .ui-overhaul/approved-exceptions.txt; frozen-check.sh accepts only those exact changed lines in that file (negative test with an extra permission failed the gate as intended).
- Baseline screenshots: .ui-overhaul/review2/before/{light,dark}/ (9 screens + run-ready/running x 4 sizes; states such as loading/error not yet in the manifest, to add in P2).
- Pre-existing user items (never stage/touch) = git status --short at start:
```
 M src/browserbench/runner.py
 M src/browserbench/workloads.py
?? .browserlab_home_run/
?? analysis/javascript_48trial_105s.csv
?? config.brave.template.yaml
?? config.chrome.template.yaml
?? config.firefox.template.yaml
?? config.javascript.boundary.rep2.yaml
?? config.javascript.boundary.rep23.yaml
?? config.javascript.core.rep23.yaml
?? config.javascript.mid.rep23.yaml
?? config.javascript.scaling.smoke.yaml
?? config.librewolf.stability.yaml
?? config.librewolf.template.rep23.yaml
?? config.librewolf.template.yaml
?? config.performance.instrumentation.5tab.yaml
?? config.performance.instrumentation.smoke.yaml
?? config.smoke.v012.yaml
?? config.stability.yaml
?? config.static.scaling.v013.yaml
?? config.video.policy.smoke.yaml
?? data_brave_template_pilot/
?? data_chrome_template_pilot/
?? data_firefox_template_pilot/
?? data_javascript_boundary_rep2/
?? data_javascript_core_rep23/
?? data_javascript_scaling_smoke/
?? data_librewolf_stability/
?? data_librewolf_template/
?? data_librewolf_template_rep23/
?? data_performance_instrumentation_5tab/
?? data_performance_instrumentation_smoke/
?? data_stability/
?? data_static_scaling_v013/
?? data_video_policy_smoke/
```
- Staging rule: git add explicit paths only.
