"""Generate git-ignored JSON fixtures for the mock-backed UI tests from real datasets (read-only).

Lifecycle data is a synthetic fixture (no real lifecycle experiment exists yet) and is named as such.
"""
from __future__ import annotations

import json
import sys
import tempfile
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests"))

from browserlab.analysis import analyze  # noqa: E402
from browserlab.compare import compare_sessions  # noqa: E402
from browserlab.lifecycle import analyze_lifecycle  # noqa: E402
from browserlab.library import scan  # noqa: E402
from test_lifecycle import lifecycle_csv  # noqa: E402

PUB = ROOT / "app" / "public"


def dump(name: str, obj: object) -> None:
    (PUB / name).write_text(json.dumps(obj, allow_nan=False))


def main() -> None:
    PUB.mkdir(exist_ok=True)
    for d in ("data_static_scaling_v013", "data_video_policy_smoke", "data_performance_instrumentation_5tab", "data_javascript_core_rep23"):
        c = ROOT / d / "core"
        dump(f"e2e-analysis-{d}.json", analyze(c / "processed/trial_summary_core.csv", d, c / "raw/page_metrics.csv"))
    infos = {i.id: i for i in scan(ROOT)}
    a, b = infos["data_javascript_boundary_rep2"], infos["data_javascript_scaling_smoke"]
    dump("e2e-compare.json", compare_sessions(asdict(a), Path(a.path) / "processed/trial_summary_core.csv",
                                              asdict(b), Path(b.path) / "processed/trial_summary_core.csv"))
    dump("e2e-lifecycle.json", analyze_lifecycle(lifecycle_csv(Path(tempfile.mkdtemp()) / "l.csv")))
    print("fixtures written to", PUB)


if __name__ == "__main__":
    main()
