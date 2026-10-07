from __future__ import annotations

import csv
import json
import os
from pathlib import Path
from typing import Iterable, Mapping, Any


class Storage:
    def __init__(self, root: Path):
        self.root = root
        self.raw_dir = root / "raw"
        self.summary_dir = root / "processed"
        self.logs_dir = root / "logs"
        for d in (self.raw_dir, self.summary_dir, self.logs_dir):
            d.mkdir(parents=True, exist_ok=True)
        self.state_path = root / "state.json"
        self.schedule_path = root / "schedule.csv"

    def load_completed(self) -> set[str]:
        if not self.state_path.exists():
            return set()
        with self.state_path.open("r", encoding="utf-8") as f:
            obj = json.load(f)
        return set(obj.get("completed_trial_ids", []))

    def save_completed(self, completed: set[str]) -> None:
        tmp = self.state_path.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump({"completed_trial_ids": sorted(completed)}, f, indent=2)
        os.replace(tmp, self.state_path)

    def write_schedule(self, rows: Iterable[Mapping[str, Any]]) -> None:
        rows = list(rows)
        if not rows:
            return
        with self.schedule_path.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)

    @staticmethod
    def append_csv(path: Path, rows: Iterable[Mapping[str, Any]]) -> None:
        rows = list(rows)
        if not rows:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        exists = path.exists() and path.stat().st_size > 0
        fieldnames: list[str] = []
        seen = set()
        for row in rows:
            for k in row.keys():
                if k not in seen:
                    seen.add(k)
                    fieldnames.append(k)
        if exists:
            with path.open("r", newline="", encoding="utf-8") as f:
                reader = csv.reader(f)
                old_header = next(reader, [])
            if old_header:
                fieldnames = old_header
        with path.open("a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            if not exists:
                w.writeheader()
            w.writerows(rows)
