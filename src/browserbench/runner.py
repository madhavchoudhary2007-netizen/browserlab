from __future__ import annotations

import json
import math
import statistics
import time
import traceback
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import psutil

from .browsers import browser_version, launch_browser, matching_processes
from .config import enabled_browsers
from .energy import EnergySampler
from .models import Condition
from .monitor import ProcessMonitor
from .scheduler import build_schedule
from .server import WorkloadServer
from .storage import Storage
from .system import (
    assert_safe,
    available_memory_percent,
    macos_metadata,
    power_status,
    thermal_pressure,
)
from .workloads import (
    background_all_workload_tabs,
    collect_page_metrics,
    measure_reactivation,
    open_tabs,
)


def _nanmean(values: list[float]) -> float:
    vals = [float(v) for v in values if v is not None and not math.isnan(float(v))]
    return statistics.fmean(vals) if vals else math.nan


def _flatten_page_metrics(metrics: list[dict[str, Any]]) -> dict[str, Any]:
    loads = []
    drops = []
    decoded = []
    js_ops = []
    compute_units = []
    build_ms = []
    for m in metrics:
        if isinstance(m.get("load_ms"), (int, float)):
            loads.append(float(m["load_ms"]))
        b = m.get("bench") or {}
        if isinstance(b.get("operations"), (int, float)):
            js_ops.append(float(b["operations"]))
        if isinstance(b.get("completed_units"), (int, float)):
            compute_units.append(float(b["completed_units"]))
        if isinstance(b.get("build_ms"), (int, float)):
            build_ms.append(float(b["build_ms"]))
        v = m.get("video") or {}
        if isinstance(v.get("droppedFrames"), (int, float)):
            drops.append(float(v["droppedFrames"]))
        if isinstance(v.get("decodedFrames"), (int, float)):
            decoded.append(float(v["decodedFrames"]))
    return {
        "mean_load_ms": _nanmean(loads),
        "mean_static_build_ms": _nanmean(build_ms),
        "total_js_operations": sum(js_ops) if js_ops else math.nan,
        "total_compute_units": sum(compute_units) if compute_units else math.nan,
        "total_video_dropped_frames": sum(drops) if drops else math.nan,
        "total_video_decoded_frames": sum(decoded) if decoded else math.nan,
    }



def _finite_float(value: Any) -> float:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return math.nan

    return out if math.isfinite(out) else math.nan


def _measurement_performance_delta(
    before: list[dict[str, Any]],
    after: list[dict[str, Any]],
) -> dict[str, Any]:
    """Calculate workload performance from before/after page counters.

    Each tab uses its own performance.now() interval. This avoids bias from
    Selenium visiting many tabs sequentially before and after measurement.
    """

    before_by_tab = {
        int(r["tab_index"]): r
        for r in before
        if isinstance(r.get("tab_index"), (int, float))
    }

    after_by_tab = {
        int(r["tab_index"]): r
        for r in after
        if isinstance(r.get("tab_index"), (int, float))
    }

    common_tabs = sorted(
        set(before_by_tab)
        & set(after_by_tab)
    )

    intervals: list[float] = []

    js_rates: list[float] = []
    js_delta_total = 0.0

    video_decode_rates: list[float] = []
    video_drop_rates: list[float] = []

    video_decoded_delta_total = 0.0
    video_dropped_delta_total = 0.0

    valid_js_tabs = 0
    valid_video_tabs = 0

    for tab in common_tabs:
        start = before_by_tab[tab]
        end = after_by_tab[tab]

        t0 = _finite_float(
            start.get("page_perf_ms")
        )

        t1 = _finite_float(
            end.get("page_perf_ms")
        )

        if (
            not math.isfinite(t0)
            or not math.isfinite(t1)
        ):
            continue

        elapsed = (
            t1 - t0
        ) / 1000.0

        if elapsed <= 0:
            continue

        intervals.append(elapsed)

        # ----------------------------------------------------
        # JavaScript workload
        # ----------------------------------------------------

        b0 = start.get("bench") or {}
        b1 = end.get("bench") or {}

        if (
            b0.get("type") == "javascript"
            and b1.get("type") == "javascript"
        ):
            op0 = _finite_float(
                b0.get("operations")
            )

            op1 = _finite_float(
                b1.get("operations")
            )

            if (
                math.isfinite(op0)
                and math.isfinite(op1)
                and op1 >= op0
            ):
                delta = op1 - op0

                js_delta_total += delta
                js_rates.append(
                    delta / elapsed
                )

                valid_js_tabs += 1

        # ----------------------------------------------------
        # Video workload
        # ----------------------------------------------------

        v0 = start.get("video") or {}
        v1 = end.get("video") or {}

        d0 = _finite_float(
            v0.get("decodedFrames")
        )

        d1 = _finite_float(
            v1.get("decodedFrames")
        )

        r0 = _finite_float(
            v0.get("droppedFrames")
        )

        r1 = _finite_float(
            v1.get("droppedFrames")
        )

        if (
            math.isfinite(d0)
            and math.isfinite(d1)
            and d1 >= d0
        ):
            decoded_delta = d1 - d0

            if (
                math.isfinite(r0)
                and math.isfinite(r1)
                and r1 >= r0
            ):
                dropped_delta = r1 - r0
            else:
                dropped_delta = math.nan

            video_decoded_delta_total += (
                decoded_delta
            )

            video_decode_rates.append(
                decoded_delta / elapsed
            )

            if math.isfinite(
                dropped_delta
            ):
                video_dropped_delta_total += (
                    dropped_delta
                )

                video_drop_rates.append(
                    dropped_delta / elapsed
                )

            valid_video_tabs += 1

    interval_mean = (
        statistics.fmean(intervals)
        if intervals
        else math.nan
    )

    interval_min = (
        min(intervals)
        if intervals
        else math.nan
    )

    interval_max = (
        max(intervals)
        if intervals
        else math.nan
    )

    js_rate_total = (
        sum(js_rates)
        if js_rates
        else math.nan
    )

    js_rate_mean = (
        statistics.fmean(js_rates)
        if js_rates
        else math.nan
    )

    video_decode_fps_total = (
        sum(video_decode_rates)
        if video_decode_rates
        else math.nan
    )

    video_decode_fps_mean = (
        statistics.fmean(
            video_decode_rates
        )
        if video_decode_rates
        else math.nan
    )

    video_dropped_fps_total = (
        sum(video_drop_rates)
        if video_drop_rates
        else math.nan
    )

    if (
        valid_video_tabs > 0
        and video_decoded_delta_total > 0
    ):
        video_drop_pct = (
            100.0
            * video_dropped_delta_total
            / video_decoded_delta_total
        )
    else:
        video_drop_pct = math.nan

    return {
        # Auditability
        "measurement_perf_valid_tabs":
            len(intervals),

        "measurement_perf_interval_mean_sec":
            interval_mean,

        "measurement_perf_interval_min_sec":
            interval_min,

        "measurement_perf_interval_max_sec":
            interval_max,

        "measurement_perf_interval_span_sec":
            (
                interval_max - interval_min
                if intervals
                else math.nan
            ),

        # JavaScript
        "measurement_js_valid_tabs":
            valid_js_tabs,

        "measurement_js_operations_delta":
            (
                js_delta_total
                if valid_js_tabs
                else math.nan
            ),

        "measurement_js_ops_per_sec_total":
            js_rate_total,

        "measurement_js_ops_per_sec_mean_per_tab":
            js_rate_mean,

        # Video
        "measurement_video_valid_tabs":
            valid_video_tabs,

        "measurement_video_decoded_frames_delta":
            (
                video_decoded_delta_total
                if valid_video_tabs
                else math.nan
            ),

        "measurement_video_dropped_frames_delta":
            (
                video_dropped_delta_total
                if valid_video_tabs
                else math.nan
            ),

        "measurement_video_decoded_fps_total":
            video_decode_fps_total,

        "measurement_video_decoded_fps_mean_per_tab":
            video_decode_fps_mean,

        "measurement_video_dropped_fps_total":
            video_dropped_fps_total,

        "measurement_video_drop_pct":
            video_drop_pct,
    }

def _phase_frame(rows: list[dict[str, Any]], phase: str | None = None) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    if phase is not None:
        df = df[df["phase"] == phase]
    return df


def _integrate_energy(df: pd.DataFrame, idle_power_w: float | None) -> tuple[float, float]:
    if df.empty or "combined_power_w" not in df:
        return math.nan, math.nan
    p = pd.to_numeric(df["combined_power_w"], errors="coerce").to_numpy(dtype=float)
    t = pd.to_numeric(df["elapsed_sec"], errors="coerce").to_numpy(dtype=float)
    mask = np.isfinite(p) & np.isfinite(t)
    if mask.sum() < 2:
        return math.nan, math.nan
    p, t = p[mask], t[mask]
    raw = float(np.trapezoid(p, t))
    if idle_power_w is None or not math.isfinite(float(idle_power_w)):
        return raw, math.nan
    excess = np.maximum(0.0, p - float(idle_power_w))
    above_idle = float(np.trapezoid(excess, t))
    return raw, above_idle


def _resource_summary(rows: list[dict[str, Any]], phase: str, idle_power_w: float | None) -> dict[str, Any]:
    df = _phase_frame(rows, phase)
    if df.empty:
        return {}
    raw_e, excess_e = _integrate_energy(df, idle_power_w)
    out: dict[str, Any] = {
        "sample_count": int(len(df)),
        "mean_rss_mb": float(df["rss_mb"].mean()),
        "median_rss_mb": float(df["rss_mb"].median()),
        "sd_rss_mb": float(df["rss_mb"].std(ddof=1)) if len(df) > 1 else 0.0,
        "peak_rss_mb": float(df["rss_mb"].max()),
        "mean_cpu_pct_total": float(df["cpu_pct_total"].mean()),
        "peak_cpu_pct_total": float(df["cpu_pct_total"].max()),
        "mean_cpu_pct_normalized": float(df["cpu_pct_normalized"].mean()),
        "mean_process_count": float(df["process_count"].mean()),
        "peak_process_count": int(df["process_count"].max()),
        "mean_renderer_count": float(df["renderer_count"].mean()),
        "compute_energy_j_raw": raw_e,
        "compute_energy_j_above_idle": excess_e,
    }
    if "phys_footprint_mb" in df:
        fp = pd.to_numeric(
            df["phys_footprint_mb"],
            errors="coerce",
        ).dropna()
    else:
        fp = pd.Series(dtype=float)

    if not fp.empty:
        out["mean_phys_footprint_mb"] = float(fp.mean())
        out["median_phys_footprint_mb"] = float(fp.median())
        out["sd_phys_footprint_mb"] = (
            float(fp.std(ddof=1))
            if len(fp) > 1
            else 0.0
        )
        out["peak_phys_footprint_mb"] = float(fp.max())
    else:
        out["mean_phys_footprint_mb"] = math.nan
        out["median_phys_footprint_mb"] = math.nan
        out["sd_phys_footprint_mb"] = math.nan
        out["peak_phys_footprint_mb"] = math.nan

    if "uss_mb" in df and pd.to_numeric(df["uss_mb"], errors="coerce").notna().any():
        out["mean_uss_mb"] = float(pd.to_numeric(df["uss_mb"], errors="coerce").mean())
        out["peak_uss_mb"] = float(pd.to_numeric(df["uss_mb"], errors="coerce").max())
    else:
        out["mean_uss_mb"] = math.nan
        out["peak_uss_mb"] = math.nan
    return out


def _measure_idle_power(energy: EnergySampler | None, seconds: int) -> float:
    if not energy or seconds <= 0:
        return math.nan
    values: list[float] = []
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        snap = energy.latest()
        val = snap.get("combined_w")
        if isinstance(val, (int, float)):
            values.append(float(val))
        time.sleep(1.0)
    return statistics.median(values) if values else math.nan


def _trial_monitor(cfg: dict[str, Any], cond: Condition, session, energy, interval: float) -> ProcessMonitor:
    if session.service_pid is None:
        raise RuntimeError("Could not determine WebDriver service PID")
    return ProcessMonitor(
        service_pid=session.service_pid,
        trial_id=cond.trial_id,
        block=cond.block,
        browser=cond.browser,
        workload=cond.workload,
        tabs=cond.tabs,
        sample_interval=interval,
        safety_cfg=cfg["safety"],
        energy_sampler=energy,
        save_per_process=bool(cfg.get("collection", {}).get("save_per_process_samples", True)),
        collect_uss=bool(cfg.get("collection", {}).get("collect_uss", False)),
    )


def _common_summary(cond: Condition, cfg: dict[str, Any], session, started: float, idle_power_w: float) -> dict[str, Any]:
    pwr = power_status()
    return {
        **cond.to_dict(),
        "browser_engine": cfg["browsers"][cond.browser]["engine"],
        "browser_version": browser_version(session.binary),
        "profile_mode": session.profile_mode,
        "started_unix": started,
        "ended_unix": time.time(),
        "duration_sec": time.time() - started,
        "idle_compute_power_w": idle_power_w,
        "ac_power_end": pwr.get("ac_power"),
        "battery_pct_end": pwr.get("battery_pct"),
    }


def run_core_trial(cfg: dict[str, Any], cond: Condition, server: WorkloadServer, energy, idle_power_w: float):
    section = cfg["core"]
    url = server.url(cond.workload, duty=0.20) if cond.workload == "javascript" else server.url(cond.workload)
    session = launch_browser(cond.browser, cfg["browsers"][cond.browser])
    started = time.time()
    monitor = _trial_monitor(cfg, cond, session, energy, float(section["sample_interval_seconds"]))
    handles: list[str] = []
    try:
        handles = open_tabs(session.driver, url, cond.tabs)

        # Core multi-tab workloads deliberately keep the final workload
        # tab foreground during warmup and measurement. Other tabs remain
        # subject to each browser's native background-tab policy.
        foreground_tab_index = len(handles) - 1
        foreground_handle = handles[foreground_tab_index]

        session.driver.switch_to.window(
            foreground_handle
        )

        monitor.collect(
            float(section["warmup_seconds"]),
            "warmup",
        )

        # Read cumulative workload counters immediately before
        # the resource-measurement interval.
        metrics_before = collect_page_metrics(
            session.driver,
            handles,
        )

        # Reading all tab counters temporarily activates each tab.
        # Restore the designated foreground tab before timed measurement.
        session.driver.switch_to.window(
            foreground_handle
        )

        monitor.collect(
            float(section["measure_seconds"]),
            "measure",
        )

        # Read them again afterwards. Performance is derived
        # from counter deltas rather than cumulative page-life
        # totals.
        metrics_after = collect_page_metrics(
            session.driver,
            handles,
        )

        performance_delta = (
            _measurement_performance_delta(
                metrics_before,
                metrics_after,
            )
        )

        summary = {
            **_common_summary(
                cond,
                cfg,
                session,
                started,
                idle_power_w,
            ),

            **_resource_summary(
                monitor.rows,
                "measure",
                idle_power_w,
            ),

            # Retain old end-of-trial cumulative metrics for
            # compatibility with existing output.
            **_flatten_page_metrics(
                metrics_after
            ),

            # New primary performance endpoints.
            **performance_delta,

            "measurement_foreground_tab_index":
                foreground_tab_index,
        }

        # Preserve BOTH raw snapshots for audit/recalculation.
        page_metrics = [
            {
                **m,
                "snapshot":
                    "measurement_start",
            }
            for m in metrics_before
        ] + [
            {
                **m,
                "snapshot":
                    "measurement_end",
            }
            for m in metrics_after
        ]

        return (
            summary,
            monitor.rows,
            monitor.process_rows,
            page_metrics,
        )
    finally:
        session.close()


def _metric_at_end(
    rows: list[dict[str, Any]],
    phase: str,
    key: str,
) -> float:
    candidates = [
        r
        for r in rows
        if r["phase"] == phase
    ]

    if not candidates:
        return math.nan

    try:
        value = float(
            candidates[-1].get(
                key,
                math.nan,
            )
        )
    except (TypeError, ValueError):
        return math.nan

    return value


def run_lifecycle_trial(cfg: dict[str, Any], cond: Condition, server: WorkloadServer, energy, idle_power_w: float):
    section = cfg["lifecycle"]
    url = server.url(cond.workload, duty=0.15) if cond.workload == "javascript" else server.url(cond.workload)
    session = launch_browser(cond.browser, cfg["browsers"][cond.browser])
    started = time.time()
    monitor = _trial_monitor(cfg, cond, session, energy, float(section["sample_interval_seconds"]))
    try:
        handles = open_tabs(session.driver, url, cond.tabs)
        monitor.collect(float(section["warmup_seconds"]), "warmup")
        monitor.collect(float(section["active_measure_seconds"]), "active")
        active_end_phys = _metric_at_end(
            monitor.rows,
            "active",
            "phys_footprint_mb",
        )

        active_end_rss = _metric_at_end(
            monitor.rows,
            "active",
            "rss_mb",
        )
        background_all_workload_tabs(session.driver, handles)

        prev = 0
        idle_phys_values: dict[int, float] = {}
        idle_rss_values: dict[int, float] = {}
        for checkpoint in [int(x) for x in section["idle_checkpoints_seconds"]]:
            interval = checkpoint - prev
            monitor.collect(interval, f"idle_{checkpoint}s")
            phase_name = f"idle_{checkpoint}s"

            idle_phys_values[checkpoint] = _metric_at_end(
                monitor.rows,
                phase_name,
                "phys_footprint_mb",
            )

            idle_rss_values[checkpoint] = _metric_at_end(
                monitor.rows,
                phase_name,
                "rss_mb",
            )
            prev = checkpoint

        reactivation = measure_reactivation(session.driver, handles)
        monitor.collect(5, "reactivated")
        metrics = collect_page_metrics(session.driver, handles)
        summary = {
            **_common_summary(cond, cfg, session, started, idle_power_w),
            **{f"active_{k}": v for k, v in _resource_summary(monitor.rows, "active", idle_power_w).items()},
            "active_end_phys_footprint_mb": active_end_phys,
            "active_end_rss_mb": active_end_rss,
            "mean_resume_roundtrip_ms": _nanmean([r.get("resume_roundtrip_ms", math.nan) for r in reactivation]),
            "max_resume_roundtrip_ms": max([r.get("resume_roundtrip_ms", math.nan) for r in reactivation], default=math.nan),
            **_flatten_page_metrics(metrics),
        }
        for cp, phys in idle_phys_values.items():
            rss = idle_rss_values.get(
                cp,
                math.nan,
            )

            summary[
                f"idle_{cp}s_phys_footprint_mb"
            ] = phys

            summary[
                f"idle_{cp}s_rss_mb"
            ] = rss

            if (
                math.isfinite(active_end_phys)
                and active_end_phys > 0
                and math.isfinite(phys)
            ):
                summary[
                    f"reclamation_ratio_{cp}s"
                ] = (
                    active_end_phys - phys
                ) / active_end_phys
            else:
                summary[
                    f"reclamation_ratio_{cp}s"
                ] = math.nan

            if (
                math.isfinite(active_end_rss)
                and active_end_rss > 0
                and math.isfinite(rss)
            ):
                summary[
                    f"rss_reclamation_ratio_{cp}s"
                ] = (
                    active_end_rss - rss
                ) / active_end_rss
            else:
                summary[
                    f"rss_reclamation_ratio_{cp}s"
                ] = math.nan
        return summary, monitor.rows, monitor.process_rows, metrics, reactivation
    finally:
        session.close()


def run_work_trial(cfg: dict[str, Any], cond: Condition, server: WorkloadServer, energy, idle_power_w: float):
    section = cfg["work_units"]
    url = server.url("compute", units=cond.compute_units or section["compute_units"])
    session = launch_browser(cond.browser, cfg["browsers"][cond.browser])
    started = time.time()
    monitor = _trial_monitor(cfg, cond, session, energy, float(section["sample_interval_seconds"]))
    try:
        handles = open_tabs(session.driver, url, cond.tabs)
        monitor.collect(float(section["warmup_seconds"]), "warmup")
        before = collect_page_metrics(session.driver, handles)
        before_units = _flatten_page_metrics(before)["total_compute_units"]
        monitor.collect(float(section["measure_seconds"]), "measure")
        after = collect_page_metrics(session.driver, handles)
        after_units = _flatten_page_metrics(after)["total_compute_units"]
        completed = (after_units - before_units) if math.isfinite(before_units) and math.isfinite(after_units) else math.nan
        resources = _resource_summary(monitor.rows, "measure", idle_power_w)
        energy_j = resources.get("compute_energy_j_above_idle", math.nan)
        summary = {
            **_common_summary(cond, cfg, session, started, idle_power_w),
            **resources,
            **_flatten_page_metrics(after),
            "measured_completed_units": completed,
            "units_per_second": completed / float(section["measure_seconds"]) if math.isfinite(completed) else math.nan,
            "joules_above_idle_per_unit": energy_j / completed if math.isfinite(energy_j) and completed > 0 else math.nan,
        }
        return summary, monitor.rows, monitor.process_rows, after
    finally:
        session.close()



def _validate_configured_trial_duration(cfg: dict[str, Any], suite: str) -> None:
    limit = float(cfg["safety"].get("max_trial_seconds", 420))
    if suite == "core":
        s = cfg["core"]
        expected = float(s["warmup_seconds"]) + float(s["measure_seconds"]) + 30.0
    elif suite == "lifecycle":
        s = cfg["lifecycle"]
        expected = float(s["warmup_seconds"]) + float(s["active_measure_seconds"]) + max(map(float, s["idle_checkpoints_seconds"])) + 15.0
    else:
        s = cfg["work_units"]
        expected = float(s["warmup_seconds"]) + float(s["measure_seconds"]) + 30.0
    if expected > limit:
        raise RuntimeError(f"Configured {suite} trial may take about {expected:.0f}s, above safety max_trial_seconds={limit:.0f}s")


def _adaptive_recovery_cooldown(
    cfg: dict[str, Any],
    cond: Condition,
) -> dict[str, Any]:
    """Wait until the system has sufficiently recovered between trials."""

    rcfg = cfg.get("recovery_cooldown", {})

    if not bool(rcfg.get("enabled", False)):
        return {
            "enabled": False,
            "elapsed_seconds": 0.0,
            "recovered": False,
            "reason": "disabled",
        }

    minimum_seconds = max(
        0.0,
        float(rcfg.get("minimum_seconds", 5.0)),
    )

    maximum_seconds = max(
        minimum_seconds,
        float(rcfg.get("maximum_seconds", 20.0)),
    )

    poll_seconds = max(
        0.5,
        float(rcfg.get("poll_seconds", 1.0)),
    )

    consecutive_required = max(
        1,
        int(rcfg.get("consecutive_passes", 2)),
    )

    cpu_threshold = max(
        0.0,
        float(rcfg.get("system_cpu_max_pct", 15.0)),
    )

    minimum_memory = float(
        cfg.get("safety", {}).get(
            "minimum_available_memory_percent",
            20.0,
        )
    )

    memory_margin = max(
        0.0,
        float(
            rcfg.get(
                "memory_margin_pct_points",
                5.0,
            )
        ),
    )

    # Use an absolute safety/repeatability floor rather than
    # forcing macOS to recreate the exact previous free-memory
    # percentage. Reclaimable caches should not cause needless
    # cooldown delays.
    memory_target = min(
        100.0,
        minimum_memory + memory_margin,
    )

    require_nominal_thermal = bool(
        rcfg.get("require_nominal_thermal", True)
    )

    binary = str(
        Path(
            cfg["browsers"][cond.browser]["binary"]
        )
        .expanduser()
        .resolve()
    )

    started = time.monotonic()

    if minimum_seconds > 0:
        time.sleep(minimum_seconds)

    consecutive = 0
    last: dict[str, Any] = {}

    while True:

        cpu_pct = float(
            psutil.cpu_percent(
                interval=poll_seconds,
            )
        )

        mem_pct = float(
            available_memory_percent()
        )

        thermal = thermal_pressure()

        browser_processes = len(
            matching_processes(binary)
        )

        browser_ok = browser_processes == 0
        cpu_ok = cpu_pct <= cpu_threshold
        memory_ok = mem_pct >= memory_target

        if require_nominal_thermal:
            thermal_ok = thermal == "nominal"
        else:
            thermal_ok = thermal not in {
                "serious",
                "critical",
            }

        recovered_now = (
            browser_ok
            and cpu_ok
            and memory_ok
            and thermal_ok
        )

        if recovered_now:
            consecutive += 1
        else:
            consecutive = 0

        elapsed = time.monotonic() - started

        last = {
            "enabled": True,
            "elapsed_seconds": elapsed,
            "system_cpu_pct": cpu_pct,
            "available_memory_pct": mem_pct,
            "memory_target_pct": memory_target,
            "thermal_pressure": thermal,
            "browser_processes": browser_processes,
            "browser_ok": browser_ok,
            "cpu_ok": cpu_ok,
            "memory_ok": memory_ok,
            "thermal_ok": thermal_ok,
            "consecutive_passes": consecutive,
        }

        if consecutive >= consecutive_required:
            last.update(
                {
                    "recovered": True,
                    "reason": "recovered",
                    "elapsed_seconds":
                        time.monotonic() - started,
                }
            )
            return last

        if elapsed >= maximum_seconds:
            last.update(
                {
                    "recovered": False,
                    "reason": "maximum_timeout",
                    "elapsed_seconds":
                        time.monotonic() - started,
                }
            )
            return last

def run_suite(cfg: dict[str, Any], suite: str, repetitions: int | None = None, resume: bool = True) -> Path:
    _validate_configured_trial_duration(cfg, suite)
    root = Path(cfg["_project_root"])
    out = root / cfg.get("project", {}).get("output_dir", "data") / suite
    storage = Storage(out)
    storage.root.mkdir(parents=True, exist_ok=True)

    assert_safe(cfg, out)
    schedule = build_schedule(cfg, suite=suite, repetitions=repetitions)
    storage.write_schedule([c.to_dict() for c in schedule])
    completed = storage.load_completed() if resume else set()

    metadata_path = out / "experiment_metadata.json"
    if not metadata_path.exists():
        with metadata_path.open("w", encoding="utf-8") as f:
            json.dump({
                "system": macos_metadata(),
                "browsers": {
                    k: {**v, "detected_version": browser_version(v["binary"]) if Path(v["binary"]).exists() else "missing"}
                    for k, v in enabled_browsers(cfg).items()
                },
                "config": {k: v for k, v in cfg.items() if not k.startswith("_")},
            }, f, indent=2)

    server = WorkloadServer(
        directory=root / "workloads",
        host=cfg.get("server", {}).get("host", "127.0.0.1"),
        port=int(cfg.get("server", {}).get("port", 0)),
    )
    server.start()

    energy = None
    if cfg.get("energy", {}).get("enabled", False):
        energy = EnergySampler(
            interval_ms=int(cfg["energy"].get("sample_interval_ms", 1000)),
            raw_log=storage.logs_dir / "powermetrics.log",
        )
        energy.start()

    total = len(schedule)
    last_block = None
    idle_power_w = math.nan
    max_retries = int(cfg["safety"].get("max_retries", 1))
    baseline_seconds = int(cfg.get("collection", {}).get("block_idle_baseline_seconds", 8))

    try:
        for idx, cond in enumerate(schedule, start=1):
            if cond.trial_id in completed:
                print(f"[{idx}/{total}] SKIP completed {cond.trial_id}")
                continue
            if cond.block != last_block:
                print(f"\n=== BLOCK {cond.block} ===")
                assert_safe(cfg, out, cond.tabs)
                idle_power_w = _measure_idle_power(energy, baseline_seconds)
                last_block = cond.block

            success = False
            for attempt in range(max_retries + 1):
                try:
                    snap = assert_safe(cfg, out, cond.tabs)

                    print(
                        f"[{idx}/{total}] {cond.trial_id} attempt={attempt+1} "
                        f"mem_available={snap['available_memory_pct']}% thermal={snap['thermal_pressure']}"
                    )
                    if suite == "core":
                        summary, raw, proc, page = run_core_trial(cfg, cond, server, energy, idle_power_w)
                        extra = []
                    elif suite == "lifecycle":
                        summary, raw, proc, page, extra = run_lifecycle_trial(cfg, cond, server, energy, idle_power_w)
                    elif suite == "work":
                        summary, raw, proc, page = run_work_trial(cfg, cond, server, energy, idle_power_w)
                        extra = []
                    else:
                        raise ValueError(suite)

                    storage.append_csv(storage.raw_dir / "samples.csv", raw)
                    storage.append_csv(storage.raw_dir / "process_samples.csv", proc)
                    storage.append_csv(storage.summary_dir / f"trial_summary_{suite}.csv", [summary])
                    page_rows = [
                        {"trial_id": cond.trial_id, "tab_index": p.get("tab_index"), "json": json.dumps(p, separators=(",", ":"))}
                        for p in page
                    ]
                    storage.append_csv(storage.raw_dir / "page_metrics.csv", page_rows)
                    if suite == "lifecycle" and extra:
                        storage.append_csv(
                            storage.raw_dir / "reactivation.csv",
                            [{"trial_id": cond.trial_id, **r} for r in extra],
                        )
                    completed.add(cond.trial_id)
                    storage.save_completed(completed)
                    success = True
                    print(f"    OK -> {storage.summary_dir / f'trial_summary_{suite}.csv'}")
                    break
                except KeyboardInterrupt:
                    raise
                except Exception as exc:
                    err = {
                        "trial_id": cond.trial_id,
                        "attempt": attempt + 1,
                        "error": repr(exc),
                        "traceback": traceback.format_exc(),
                        "time": time.time(),
                    }
                    with (storage.logs_dir / "errors.jsonl").open("a", encoding="utf-8") as f:
                        f.write(json.dumps(err) + "\n")
                    print(f"    FAILED: {exc}")
                    if attempt < max_retries:
                        print("    Cooling down before retry...")
                        time.sleep(max(30, int(cfg.get("core", {}).get("cooldown_seconds", 25))))
            if not success:
                print(f"    GAVE UP after {max_retries + 1} attempt(s); trial remains incomplete for resume.")

            # No recovery delay is required after the final
            # scheduled condition because no subsequent trial
            # can be contaminated.
            if idx == total:
                continue

            section_name = "work_units" if suite == "work" else suite

            recovery_cfg = cfg.get(
                "recovery_cooldown",
                {},
            )

            if recovery_cfg.get("enabled", False):

                recovery = _adaptive_recovery_cooldown(
                    cfg,
                    cond,
                )

                print(
                    "    recovery "
                    f"{recovery['elapsed_seconds']:.1f}s "
                    f"status={recovery['reason']} "
                    f"cpu={recovery.get('system_cpu_pct', float('nan')):.1f}% "
                    f"mem={recovery.get('available_memory_pct', float('nan')):.1f}% "
                    f"target={recovery.get('memory_target_pct', float('nan')):.1f}% "
                    f"thermal={recovery.get('thermal_pressure', 'unknown')} "
                    f"browser_procs={recovery.get('browser_processes', -1)}"
                )

                with (
                    storage.logs_dir
                    / "recovery_cooldown.jsonl"
                ).open(
                    "a",
                    encoding="utf-8",
                ) as f:

                    f.write(
                        json.dumps(
                            {
                                "trial_id": cond.trial_id,
                                "block": cond.block,
                                "browser": cond.browser,
                                "workload": cond.workload,
                                "tabs": cond.tabs,
                                **recovery,
                            }
                        )
                        + "\n"
                    )

                if not recovery["recovered"]:
                    print(
                        "    WARNING: adaptive recovery "
                        "reached its maximum timeout; "
                        "the next assert_safe() will still "
                        "protect the following trial."
                    )

            else:
                cooldown = int(
                    cfg[section_name].get(
                        "cooldown_seconds",
                        25,
                    )
                )

                if cooldown > 0:
                    time.sleep(cooldown)
    finally:
        if energy:
            energy.stop()
        server.stop()

    return out
