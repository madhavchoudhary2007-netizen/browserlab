from __future__ import annotations

import time
from typing import Any


def open_tabs(driver: Any, url: str, count: int) -> list[str]:
    if count < 1:
        raise ValueError("tab count must be >= 1")
    driver.get(url)
    handles = [driver.current_window_handle]
    for _ in range(count - 1):
        driver.execute_script("window.open(arguments[0], '_blank');", url)
        time.sleep(0.05)
    # Selenium window handle order is stable enough for our own newly opened tabs.
    handles = driver.window_handles[:count]
    for h in handles:
        driver.switch_to.window(h)
        _wait_ready(driver)
    return handles


def _wait_ready(driver: Any, timeout: float = 20.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if driver.execute_script("return document.readyState") == "complete":
                return
        except Exception:
            pass
        time.sleep(0.1)
    raise TimeoutError("Page did not reach document.readyState=complete")


def collect_page_metrics(driver: Any, handles: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    script = r"""
const nav = performance.getEntriesByType('navigation')[0];
const b = window.__bench || {};
let video = null;
const v = document.querySelector('video');
if (v) {
  let q = null;
  if (v.getVideoPlaybackQuality) q = v.getVideoPlaybackQuality();
  video = {
    currentTime: v.currentTime || 0,
    duration: Number.isFinite(v.duration) ? v.duration : null,
    decodedFrames: q ? q.totalVideoFrames : (v.webkitDecodedFrameCount || null),
    droppedFrames: q ? q.droppedVideoFrames : (v.webkitDroppedFrameCount || null),
    paused: v.paused
  };
}
return {
  url: location.href,
  visibility: document.visibilityState,
  load_ms: nav ? nav.loadEventEnd - nav.startTime : null,
  page_perf_ms: performance.now(),
  bench: b,
  video: video
};
"""
    for idx, h in enumerate(handles):
        try:
            driver.switch_to.window(h)
            data = driver.execute_script(script)
            data["tab_index"] = idx
            rows.append(data)
        except Exception as exc:
            rows.append({"tab_index": idx, "error": repr(exc)})
    return rows


def background_all_workload_tabs(driver: Any, handles: list[str], blank_url: str = "about:blank") -> str:
    driver.execute_script("window.open(arguments[0], '_blank');", blank_url)
    control = driver.window_handles[-1]
    driver.switch_to.window(control)
    return control


def measure_reactivation(driver: Any, handles: list[str]) -> list[dict[str, float | int | str]]:
    rows = []
    for idx, h in enumerate(handles):
        t0 = time.perf_counter()
        try:
            driver.switch_to.window(h)
            visible = driver.execute_script("return document.visibilityState")
            # Force a tiny same-document round trip so the page is actually responsive.
            perf = driver.execute_script("return performance.now()")
            dt_ms = (time.perf_counter() - t0) * 1000.0
            rows.append({"tab_index": idx, "resume_roundtrip_ms": dt_ms, "visibility": visible, "page_perf_ms": perf})
        except Exception as exc:
            rows.append({"tab_index": idx, "resume_roundtrip_ms": float("nan"), "visibility": f"error:{exc!r}"})
    return rows
