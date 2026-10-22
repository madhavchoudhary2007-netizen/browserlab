# ADR: UI pass 2 direction

Status: accepted (decided by the lead engineer under BRIEF2; no owner input available).

## Concept
BrowserLab is a recording instrument: runs are inked onto paper by a pen, and everything else is the quiet bench around it.

## Option A: the pen sheet is the app's main surface
```
+------+---------------------------------------------+
| rail | [graph-paper sheet, full width of content]   |
| nav  |  value axis (mono)    pen -> /               |
|      |  ~~~~~ink~~~~~~~~~~~~~~                      |
|      | readouts (mono)   Pause Stop                 |
|      | plan / preflight / launch below the sheet    |
+------+---------------------------------------------+
```
Roles: sheet = paper tint + grid; type UI Instrument Sans, mono for axes and big numbers. Motion: pen only. Refuses: decorative paper texture on every screen.
Risk: the Run view when idle has no data, so the sheet is empty and the launch controls compete with it; Results and Library are not about a live pen, so the idea stops at Run.

## Option B: paper and ink only inside data surfaces, calm chrome around
```
+------+---------------------------------------------+
| rail | plain page (flat tint)                       |
| nav  |  [ launch / plan panel ]   [ paper sheet ]   |
|      |                              pen + trace      |
|      |  report: header, then paper-grid chart       |
+------+---------------------------------------------+
```
Roles: chrome plain (flat surfaces, 1px borders); every chart and the Run sheet get the faint paper grid and mono axis labels. Motion: pen only (live sweep, report replay). Refuses: grid or ink on buttons, nav, lists.
Risk: less bold; the pen can look like a widget unless the sheet is large.

## Decision: B, with the Run sheet sized as the dominant element (A's strength)
Reasons: (1) the avoid list bans decorating every surface (identical cards, glass, motion on every section); B keeps chrome quiet so the pen is the single bold element, which is what the brief asks (boldness in one place). (2) Library, Settings and Compare have no live signal; forcing paper there would be decoration. (3) A launch panel plus a large sheet at 1280x800 is leaner than stacking launch controls under a sheet. (4) At >=1600 px the sheet becomes the main column and the launch/plan panel the side column.

## Rules fixed by this ADR
- Ink blue (existing --pen token, renamed in prose "ink") is the only UI accent.
- Pen orange exists as `--pen-body` and is used only on the pen illustration (body fill). Never on buttons, links, text or status.
- Light surfaces separate by whitespace, then a 1px border, then a tint; no shadow stacks. The existing raised-button shadow remains only on buttons (user requirement from pass 1: buttons must look like buttons).
- Avoid-list items knowingly used: none intentionally. Mono is used for axes and large readouts only. Cards: panels differ by role (sheet, launch panel, list) and are not identical cards.
- Copy: sentence case, one name per action (Export, Exported; Save PNG, Saved).
- The pen is an original flat vector per BRIEF2 section 7.
- Remove one decoration before finishing (candidate: the arrival tear-off line, replaced by the pen replay).

## Amendment: typeface (measured, pass 2 P4)
Startup proxy (mock engine, built frontend, Chrome headless, p50 of 20 loads): base-ref ready 60 ms; pass 1 (bundled Instrument Sans + Spline Sans Mono) ready 81-88 ms (+35-45 %), almost all of it two full layouts at about 8 ms each caused by loading the web fonts (system font: 2.6 ms total, same as base). A preload link and static (non-variable) font instances did not help. Decision: the UI and mono faces are now the macOS system fonts (SF Pro / SF Mono via -apple-system, ui-monospace); both @fontsource packages are removed; the pen sheet mounts only when visible. Result: ready 63-64 ms vs 60 ms (+4-7 %), within the 10 % budget. The identity now rests on the pen, not on a typeface.
