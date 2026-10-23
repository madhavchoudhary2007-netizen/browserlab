# LOG4: pass 4 (brief: .ui-overhaul/BRIEF4.md, pages: .ui-overhaul/pass4/G1-G7.md)

## R0 setup (2026-10-23)
- Branch ui-overhaul, HEAD 6875a9c (latest UI commit ffe45eb). base-ref = 0cc5773.
- `git status --short` at start (owner's items; none are mine; BRIEF4.md and pass4/ are new and mine):
     M src/browserbench/runner.py
     M src/browserbench/workloads.py
    ?? .browserlab_home_run/
    ?? .ui-overhaul/BRIEF4.md
    ?? .ui-overhaul/pass4/
    ?? .ui-overhaul/review2/lib-dark/
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
- Baseline gates at 6875a9c: typecheck, lint, vitest 20, build (JS 1,049.38 kB), e2e 129, contrast, frozen-check OK.
- ADR written: .ui-overhaul/adr/ADR-ui-pass4.md (accent teal, orange pen only, new DONE definition, one review cycle).
- Decision: G5's `rg "ink blue"` check applies to app/src and living docs. Saved briefs (BRIEF2/3/4, pass3/pass4 pages), logs, final reports, handoffs and review packs are historical records and keep the old wording verbatim (they quote it); the ADR explains the retirement.
- e2e edit (layout): responsive.spec.ts 'content width is controlled' cap is now 120rem from 2200 px (was 90rem from 1600); assertion kept, new cap for G1.

## G1 done (wide windows)
- New check app/e2e/p4-wide.spec.ts (1920x1080, 2560x1440): width coverage >= 65% on Run, Library, Compare, Settings; Run sheet within 2 px and right column within 8 px across idle/ready/running; layout shift on start <= 0.05; axe clean light and dark. Honest note: the coverage and stability checks already passed before the layout work (strict text/control-only coverage was 67-94%; the sheet and column were already stable from pass 3 F4), so no red phase existed for them; they now guard the behaviour. The real change is the visible use of space.
- Changes: Library at 80rem list width gets Browsers and Workload columns (second line removed); Compare at >=1600 puts the table left and the summary/notes in a 22rem column; Settings two columns at >=1600; main content cap 120rem from 2200 px (e2e cap edit logged above). Run right column keeps width; trial list not possible (data not received), run plan summary stays, request logged in requests.md.
- Before/after full-size screenshots: .ui-overhaul/review4/g1/ (before = pass-3 state captured earlier in the session, same layout).
- Gates: typecheck, lint, vitest 20, build (JS 1,049.70 kB, CSS 44.51 kB), e2e 137 (129 + 8 new), contrast OK, frozen-check OK.
