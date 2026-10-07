from __future__ import annotations

from pathlib import Path
from typing import Any
import copy
import yaml


DEFAULT_CONFIG = Path("config.yaml")


def load_config(path: str | Path = DEFAULT_CONFIG) -> dict[str, Any]:
    p = Path(path).expanduser().resolve()
    if not p.exists():
        raise FileNotFoundError(f"Config not found: {p}")
    with p.open("r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    cfg["_config_path"] = str(p)
    cfg["_project_root"] = str(p.parent)
    return cfg


def enabled_browsers(cfg: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        name: data
        for name, data in cfg.get("browsers", {}).items()
        if data.get("enabled", False)
    }


def with_overrides(
    cfg: dict[str, Any],
    repetitions: int | None = None,
    measure_seconds: int | None = None,
) -> dict[str, Any]:
    out = copy.deepcopy(cfg)
    if repetitions is not None:
        for section in ("core", "lifecycle", "work_units"):
            if section in out:
                out[section]["repetitions"] = int(repetitions)
    if measure_seconds is not None and "core" in out:
        out["core"]["measure_seconds"] = int(measure_seconds)
    return out
