"""Read-only discovery of historical experiment datasets."""
from __future__ import annotations

import csv
import json
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any

# Explicit researcher classification; anything else is inferred conservatively.
CLASSIFICATION = {
    "data_static_scaling_v013": "exploratory",
    "data_javascript_core_rep23": "exploratory",
    "data_javascript_boundary_rep2": "pilot",
    "data_javascript_scaling_smoke": "pilot",
    "data_performance_instrumentation_5tab": "instrumentation-validation",
    "data_performance_instrumentation_smoke": "instrumentation-validation",
}


@dataclass
class ExperimentInfo:
    id: str
    path: str
    suite: str
    status: str
    scheduled_trials: int
    completed_trials: int
    browsers: list[str]
    workloads: list[str]
    tab_levels: list[int]
    repetitions: int | None
    warmup_seconds: int | None
    measure_seconds: int | None
    sample_interval_seconds: float | None
    protocol_key: str
    system: dict[str, Any] = field(default_factory=dict)
    browser_versions: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


def _count_rows(p: Path) -> int:
    if not p.exists():
        return 0
    with p.open(newline="", encoding="utf-8") as f:
        return max(sum(1 for _ in csv.reader(f)) - 1, 0)


def _load(p: Path) -> dict[str, Any]:
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def _classify(name: str, scheduled: int, done: int) -> str:
    if scheduled and done < scheduled:
        return "incomplete"
    if name in CLASSIFICATION:
        return CLASSIFICATION[name]
    if "smoke" in name or "pilot" in name or "stability" in name or "template" in name:
        return "pilot"
    return "unclassified"


def inspect_suite_dir(suite_dir: Path, name: str) -> ExperimentInfo:
    meta, state = _load(suite_dir / "experiment_metadata.json"), _load(suite_dir / "state.json")
    cfg = meta.get("config", {})
    suite = suite_dir.name
    sec = cfg.get({"core": "core", "lifecycle": "lifecycle", "work": "work_units"}.get(suite, "core"), {})
    scheduled = _count_rows(suite_dir / "schedule.csv")
    done = len(state.get("completed_trial_ids", []))
    browsers = sorted(b for b, d in meta.get("browsers", {}).items() if d.get("enabled"))
    tabs = sec.get("tab_counts") or ([sec["tab_count"]] if "tab_count" in sec else [])
    warm, meas = sec.get("warmup_seconds"), sec.get("measure_seconds", sec.get("active_measure_seconds"))
    interval = sec.get("sample_interval_seconds")
    has_footprint = _has_footprint(suite_dir / "raw" / "samples.csv")
    key = f"{suite}|w{warm}|m{meas}|i{interval}|mem={'footprint' if has_footprint else 'rss-only'}"
    warns = [] if has_footprint else ["No phys_footprint column: memory comparable only as RSS"]
    return ExperimentInfo(
        id=name, path=str(suite_dir), suite=suite, status=_classify(name, scheduled, done),
        scheduled_trials=scheduled, completed_trials=done, browsers=browsers,
        workloads=list(sec.get("workloads", [])), tab_levels=[int(t) for t in tabs],
        repetitions=sec.get("repetitions"), warmup_seconds=warm, measure_seconds=meas,
        sample_interval_seconds=interval, protocol_key=key, system=meta.get("system", {}), warnings=warns,
        browser_versions={b: d.get("detected_version", "") for b, d in meta.get("browsers", {}).items() if d.get("enabled")},
    )


def _has_footprint(samples: Path) -> bool:
    if not samples.exists():
        return False
    with samples.open(newline="", encoding="utf-8") as f:
        return "phys_footprint_mb" in (next(csv.reader(f), []))


def scan(root: Path) -> list[ExperimentInfo]:
    """Discover ``<root>/data_*/<suite>/`` datasets. Never writes."""
    out: list[ExperimentInfo] = []
    for d in sorted(root.glob("data_*")):
        for suite_dir in sorted(p for p in d.iterdir() if p.is_dir() and (p / "raw").is_dir()):
            out.append(inspect_suite_dir(suite_dir, d.name))
    return out


def compatible(a: ExperimentInfo, b: ExperimentInfo) -> tuple[bool, str]:
    if a.protocol_key == b.protocol_key:
        return True, "same protocol"
    return False, f"protocol differs: {a.protocol_key} vs {b.protocol_key}"


def to_json(infos: list[ExperimentInfo]) -> str:
    return json.dumps([asdict(i) for i in infos], indent=2)
