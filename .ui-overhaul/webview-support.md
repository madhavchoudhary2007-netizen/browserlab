# WebView support notes
Target runtime: Tauri 2 on macOS = WKWebView (Safari engine). Test runner: Playwright with installed Google Chrome (Chromium), so Safari-specific gaps are NOT covered by the parity suite; treat as risk.
Rely on only with fallbacks (to verify in U3): OKLCH colors (Safari 15.4+; provide sRGB fallbacks), `color-mix()`, CSS nesting avoided, `@layer`, container queries (16+), `:has()` (15.4+, progressive only), `dialog` element, `clamp()`, logical properties, `prefers-reduced-motion`, `forced-colors`, View Transitions API NOT assumed.
Avoid: large backdrop-filter, animated filters, scroll-driven animations, `@property` dependence.
Windows/Linux not targeted by this app (macOS Apple Silicon only).
