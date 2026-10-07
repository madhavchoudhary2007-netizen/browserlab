from __future__ import annotations

import random
from typing import Any
from .models import Condition
from .config import enabled_browsers


def build_schedule(cfg: dict[str, Any], suite: str, repetitions: int | None = None) -> list[Condition]:
    browsers = list(enabled_browsers(cfg))
    if not browsers:
        raise ValueError("No enabled browsers in config.yaml")

    seed = int(cfg.get("project", {}).get("seed", 1))
    rng = random.Random(seed + sum(ord(c) for c in suite))

    if suite == "core":
        section = cfg["core"]
        reps = int(repetitions or section["repetitions"])
        base = [(b, w, int(t), None) for b in browsers for w in section["workloads"] for t in section["tab_counts"]]
    elif suite == "lifecycle":
        section = cfg["lifecycle"]
        reps = int(repetitions or section["repetitions"])
        base = [(b, w, int(section["tab_count"]), None) for b in browsers for w in section["workloads"]]
    elif suite == "work":
        section = cfg["work_units"]
        reps = int(repetitions or section["repetitions"])
        base = [
            (b, w, int(t), int(section["compute_units"]))
            for b in browsers
            for w in section["workloads"]
            for t in section["tab_counts"]
        ]
    else:
        raise ValueError(f"Unknown suite: {suite}")

    schedule: list[Condition] = []
    for block in range(1, reps + 1):
        block_items = list(base)
        rng.shuffle(block_items)
        for ordinal, (browser, workload, tabs, units) in enumerate(block_items, start=1):
            schedule.append(
                Condition(
                    suite=suite,
                    browser=browser,
                    workload=workload,
                    tabs=tabs,
                    block=block,
                    ordinal=ordinal,
                    compute_units=units,
                )
            )
    return schedule
