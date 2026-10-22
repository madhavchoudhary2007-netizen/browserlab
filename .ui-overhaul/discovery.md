# Discovery (U1) - assumptions from code and docs
## Subject
BrowserLab measures how much memory browsers really use (process-tree physical footprint) across Chrome, Brave, Firefox and LibreWolf under controlled workloads (static, javascript, video; 1-30 tabs), then reports statistics honestly.
## Users (assumption)
A researcher/engineer running long, unattended benchmark sessions on their own Mac and later reading, comparing and exporting results. Technical, patient, cares about rigor more than flash; reads dense numbers.
## Primary jobs
1. Configure and start a run correctly (mode, workload, tabs, preflight) without breaking validity.
2. Trust a long run: see progress, pause/stop, know exactly what completed and what did not.
3. Read the result: what the data supports (exploratory vs inferential), integrity, memory over time, composition, problems.
4. Find, compare and export earlier sessions.
## What makes the current UI generic (evidence: shots/baseline)
- run-idle: a form of three identical bordered tiles, native selects, a flat sidebar; the one primary action is a muddy brown bar that looks disabled even when enabled; nothing says "instrument".
- results-report: stacked identical bordered boxes; monospace used for every metadata value; row of five equal ghost buttons competes with the data; the chart is pushed below the fold though it is the finding.
- One radius, one border, one grey for every surface; accent used for tab underline, tag, border, primary alike; no type hierarchy beyond size.
- The product's essence (a continuous trace of memory over time per browser) appears only inside charts, never in navigation, run state or identity. Browsers have colors in charts only.
