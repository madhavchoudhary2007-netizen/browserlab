# Design review rubric (pass 4, cycle 1)

You are reviewing the visual and interaction design of BrowserLab, a desktop app that runs real browsers through a workload while measuring memory, then shows the results. You have only this rubric, MANIFEST.txt and the images listed in it. You have not seen the code or anyone's earlier opinion. Judge what you can see.

Rules
1. Open every file listed under REQUIRED in MANIFEST.txt (screens and motion frames). The images are unmodified full-size screenshots (100 %, no scaling by the author). Window sizes are 960x640, 1280x800, 1920x1080 and 2560x1440, light and dark.
2. Begin your answer with a list "Files opened:" naming every file you opened. A review that skips REQUIRED files is invalid and will be rerun.
3. Score each of the ten lines below from 0 to 5 (0 = broken, 3 = competent but ordinary, 5 = exceptional), with one to three sentences of evidence that name a screen, theme and size.
4. Then write two lists:
   - "Blocking at real size": defects you can verify in a full-size image (clipped or overlapping text, text below readable size, contrast you can see is poor, misalignment, broken layout, something unreadable). Each item gives the file and the pixel region (x, y, width, height) where it can be seen. Only list what you can point at.
   - "Taste notes": opinions and preferences. These are not defects.
5. Do not guess about code, performance or anything you cannot see.

Rubric lines
1. Distinctiveness: does it look like a specific product with its own identity rather than a template?
2. Subject fit: does the look suit a tool for measuring browser memory in an experiment?
3. Hierarchy and focus: is it clear what matters most on each screen and what to do next?
4. Typography: type scale, weight, numerals, line length, readability at each size.
5. Color and contrast: palette discipline, accent use, readability in light and dark.
6. Purposeful motion: do the motion frames show movement that carries meaning (the pen drawing the measurement), without clutter?
7. Craft: alignment, spacing, edges, consistency of detail, behaviour at small and very large windows.
8. Usability: can a researcher run, read and compare experiments without friction? States and empty states.
9. Signature moment: is there one memorable moment, and is it earned?
10. Consistency: do screens, themes and sizes feel like one product?

Output format
Files opened: (list)
Scores: one line per rubric item, "N. Name: score/5, evidence".
Total and mean.
Blocking at real size: (list or "none")
Taste notes: (list)
