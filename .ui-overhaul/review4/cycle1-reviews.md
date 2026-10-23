# Review cycle 1 (two fresh-context reviewers, full-size pack)
Each reviewer opened every REQUIRED file (88 screens + 32 motion frames) and listed them; both reviews valid. Not rerun for a better number.

| Rubric line | A | B |
|---|---|---|
| Distinctiveness | 4 | 4 |
| Subject fit | 4 | 4 |
| Hierarchy and focus | 3 | 3 |
| Typography | 4 | 4 |
| Color and contrast | 4 | 4 |
| Purposeful motion | 4 | 4 |
| Craft | 3 | 3 |
| Usability | 3 | 4 |
| Signature moment | 4 | 4 |
| Consistency | 4 | 4 |
| Total /50 | 37 | 38 |
Mean 3.75 / 5 (37.5 / 50); spread 1 point.

## Blocking at real size (both or either reviewer) and what was done
1. Compare-empty: hover reason covered the Open Library button (A, B) -> FIXED: reason now drawn under the nav item inside the rail width (p4-paper.spec.ts "never covers page content").
2. Library at 1280 cut the workload off (A, B) -> FIXED for the detail line (wraps to 2 lines; p4-review.spec.ts). The session name still truncates with a title tooltip (existing library-rows.spec.ts, unchanged); REJECTED further change: full ids stay available on hover and in the row.
3. Chart tick labels about 10 px at 2560 (A, B) -> FIXED: ticks follow the root size (p4-review.spec.ts, >=16 px at 2560).
4. Export button shadow at 960 light (A, B) -> REJECTED as a capture artifact: the screenshot leaves the pointer over the button, which lifts by design (ds.css hover). Its position below the heading is layout, left as is.
5. Replaying button low contrast (A) -> FIXED: pulse animates a ring, opacity stays 1 (p4-review.spec.ts).
6. Empty-trace note crossed by gridlines (B) -> FIXED: the note has a paper backing.
7. Live reading numeral far from its unit (B) -> FIXED: numeral right-aligned in its fixed-width box. The 6 px heading baseline difference at 1920 is REJECTED as a taste item (different font sizes sharing a row).

## Taste notes (not acted on)
Left-anchored layouts at 1920/2560 beyond the G1 widening, sidebar mini-trace empty state, compare bars scale, brave series in light, checkbox fill in dark, palette scrim, Compare nav dashed outline. Recorded for the owner.
