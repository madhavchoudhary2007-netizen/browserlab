from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any


@dataclass(frozen=True)
class Condition:
    suite: str
    browser: str
    workload: str
    tabs: int
    block: int
    ordinal: int
    compute_units: int | None = None

    @property
    def trial_id(self) -> str:
        suffix = f"-u{self.compute_units}" if self.compute_units is not None else ""
        return (
            f"{self.suite}-b{self.block:03d}-o{self.ordinal:03d}-"
            f"{self.browser}-{self.workload}-t{self.tabs}{suffix}"
        )

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["trial_id"] = self.trial_id
        return d
