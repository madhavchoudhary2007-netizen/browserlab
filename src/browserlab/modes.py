"""Quick / Standard / Full experiment modes mapped onto the browserbench scheduler."""
from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any

from browserbench.models import Condition
from browserbench.scheduler import build_schedule

BROWSERS = ("chrome", "brave", "firefox", "librewolf")
WORKLOADS = ("static", "javascript", "video")
TAB_LEVELS = (1, 5, 15, 30)


@dataclass(frozen=True)
class ModeSpec:
    name: str
    workloads: tuple[str, ...]
    tab_counts: tuple[int, ...]
    repetitions: int
    warmup_seconds: int
    measure_seconds: int
    allows_inference: bool


MODES: dict[str, ModeSpec] = {
    "quick": ModeSpec("quick", (), (), 1, 20, 30, False),
    "standard": ModeSpec("standard", WORKLOADS, (1, 30), 2, 20, 105, True),
    "full": ModeSpec("full", WORKLOADS, TAB_LEVELS, 5, 20, 105, True),
}


def mode_config(
    base_cfg: dict[str, Any],
    mode: str,
    workload: str | None = None,
    tabs: int | None = None,
    browsers: tuple[str, ...] = BROWSERS,
) -> dict[str, Any]:
    """Return a deep-copied config with core settings for ``mode``.

    Quick requires an explicit workload and tab level; other modes reject them.
    """
    if mode not in MODES:
        raise ValueError(f"Unknown mode: {mode}")
    spec = MODES[mode]
    if mode == "quick":
        if workload not in WORKLOADS or tabs not in TAB_LEVELS:
            raise ValueError("Quick mode needs workload in %s and tabs in %s" % (WORKLOADS, TAB_LEVELS))
        workloads, tab_counts = (workload,), (tabs,)
    else:
        if workload is not None or tabs is not None:
            raise ValueError(f"{mode} mode does not accept workload/tabs selection")
        workloads, tab_counts = spec.workloads, spec.tab_counts
    unknown = set(browsers) - set(BROWSERS)
    if unknown:
        raise ValueError(f"Unknown browsers: {sorted(unknown)}")
    cfg = copy.deepcopy(base_cfg)
    for name, data in cfg.get("browsers", {}).items():
        data["enabled"] = name in browsers
    cfg["core"] = {
        **cfg.get("core", {}),
        "workloads": list(workloads),
        "tab_counts": list(tab_counts),
        "repetitions": spec.repetitions,
        "warmup_seconds": spec.warmup_seconds,
        "measure_seconds": spec.measure_seconds,
    }
    return cfg


def plan(base_cfg: dict[str, Any], mode: str, **kw: Any) -> list[Condition]:
    cfg = mode_config(base_cfg, mode, **kw)
    return build_schedule(cfg, "core")


def is_complete_design(browsers: tuple[str, ...]) -> bool:
    return set(browsers) == set(BROWSERS)
