# Concepts (U2)
Common constraint: light and dark themes are designed separately; OKLCH tokens with sRGB fallbacks; bundled fonts; one accent hue; no data is invented (live trace is the existing 1 Hz display sample).

## A. Chart recorder: "the pen"
**Concept:** BrowserLab is a paper chart recorder for browser memory: every surface is a calm chart sheet, and a single moving pen line is the product's identity.
**Palette (light / dark):** Sheet #E8EDEE / #10161B; Graphite #3E4C57 / #9AA9B4; Ink #0E1A22 / #E6EEF2; Grid #C3CED3 / #26323B; Pen teal #00767F / #3CC4CF (the only accent).
**Type:** Instrument Sans (UI, headings, weights 500/650); Spline Sans Mono used only for tabular readouts of numbers (not labels). Key numbers set large with tabular figures.
**Wireframe:**
```
+--------+-----------------------------------------+
| ~~pen~ |  Run   Library   Results   Settings     |  rail: pen trace idles as a flat line, draws live RSS during a run
| Run    |-----------------------------------------|
| Library|  MEMORY FOOTPRINT        4/4 trials     |
| Results|  [ big readout: 1,284 MB  chrome ]      |
| Settings|  ~~~~/\_/\~~~~ strip chart (hero) ~~~   |
|        |  mode (segmented)  [Start experiment]   |
+--------+-----------------------------------------+
```
Key screen = Report: hero chart first, verdict sentence ("Exploratory: ...") as a caption, stats table under it, exports in a menu.
**Motion:** pen draws left-to-right (transform scaleX on a clip), 200-320 ms ease-out for state changes, springs on press only; reduced motion = opacity fades <=150 ms.
**Signature:** the pen: a live trace in the rail that follows the real run, and on completion the chart sheet "tears off" into the Report (shared-element transition of the chart).
**Refuses:** card grids, gradient washes, eyebrow labels, decorative dividers, monospace labels.

## B. Specimen sheets: "the cabinet"
**Concept:** Each browser is a specimen with its own fixed identity color and a labelled sheet, and results are filed in a cabinet of drawers.
**Palette:** Drawer #D9D6CF / #1A1814 (warm grey, not cream), Label #F3F1EC, Brown-black ink #231F1A, Tab orange #C75B12 accent, Brave/Chrome/Firefox/LibreWolf identity swatches (data colors only).
**Type:** Bricolage Grotesque display + Source Sans 3 body.
**Wireframe:** left = drawer list of sessions by date; right = sheet per browser side by side.
**Motion:** drawers slide (transform) open; sheets lift.
**Signature:** drawer-open transition from Library into Results.
**Refuses:** charts first. Risk: reads as skeuomorphic; warm grey + orange edges toward the "clay accent" default.

## C. Flight deck: "mission control"
**Concept:** A dense, dark telemetry console where a run is a mission with phases (warm-up, measure, cooldown) shown as a timeline strip.
**Palette:** Deck #0B0F14, Panel #131A22, Telemetry #8FA3B5, Signal amber #F2A93B accent, Alert #FF5D5D.
**Type:** Barlow Semi Condensed + IBM Plex Mono.
**Wireframe:** top timeline of phases; grid of live gauges per browser.
**Signature:** phase timeline with a scrubbing cursor.
**Refuses:** light theme as first-class. Risk: near-black with a single warm accent is a listed default; long runs (hours) read as dashboard noise; mono everywhere.

## Scoring (0-5)
| | Distinct | Subject fit | Main job | A11y feasible | WebView | Cost | Total |
|---|---|---|---|---|---|---|---|
| A | 4 | 5 | 5 | 4 | 4 | 3 | 25 |
| B | 3 | 3 | 3 | 4 | 5 | 3 | 21 |
| C | 3 | 3 | 3 | 3 | 4 | 3 | 19 |

## Decision: A, the chart recorder
Chosen because the concept could only describe this product (memory-over-time instrument), puts the finding (the trace) first in Report and Run, and its signature reuses data the app already emits (1 Hz RSS display sample, which stays a display aid and never a replicate). Rejected B (skeuomorphic, off-subject, warm default risk) and C (listed generic default, dashboard fatigue). Watch-outs: teal-on-pale must hit 4.5:1 (#00767F on #E8EDEE verify in U3; adjust lightness if not); signature animates only when a run is live, stops when hidden.
