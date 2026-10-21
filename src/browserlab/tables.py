"""Random-access paging over large append-only CSV files (read-only).

A one-pass index stores a byte offset every ``STRIDE`` records plus the
contiguous record range of each ``trial_id``, so pages and per-trial filters
cost O(STRIDE) after the first scan. Indexes are cached keyed by (path, mtime, size).
"""
from __future__ import annotations

import csv
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

STRIDE = 500
MAX_PAGE = 1000
_CACHE: dict[tuple[str, int, int], "CsvIndex"] = {}


@dataclass
class CsvIndex:
    path: Path
    columns: list[str]
    total: int
    offsets: list[int]                      # offsets[i] = byte offset of record i*STRIDE
    trial_ranges: dict[str, tuple[int, int]] = field(default_factory=dict)  # [start, end)
    trials_contiguous: bool = True


def _records(f) -> Iterator[tuple[list[str], int]]:
    """Yield (record, offset_after_record) using csv parsing over a binary file."""
    pos = 0

    def lines() -> Iterator[str]:
        nonlocal pos
        for raw in iter(f.readline, b""):
            pos += len(raw)
            yield raw.decode("utf-8")

    for rec in csv.reader(lines()):
        yield rec, pos


def build_index(path: Path) -> CsvIndex:
    st = path.stat()
    key = (str(path), st.st_mtime_ns, st.st_size)
    if key in _CACHE:
        return _CACHE[key]
    with path.open("rb") as f:
        it = _records(f)
        try:
            header, start = next(it)
        except StopIteration:
            idx = CsvIndex(path, [], 0, [])
            _CACHE[key] = idx
            return idx
        tcol = header.index("trial_id") if "trial_id" in header else None
        offsets, ranges, contiguous = [], {}, True
        total, last_trial, rec_start = 0, None, start
        for rec, end in it:
            if not rec:
                rec_start = end
                continue
            if total % STRIDE == 0:
                offsets.append(rec_start)
            if tcol is not None and tcol < len(rec):
                t = rec[tcol]
                if t != last_trial:
                    if t in ranges:  # trial reappears non-contiguously
                        contiguous = False
                    ranges.setdefault(t, (total, total + 1))
                else:
                    ranges[t] = (ranges[t][0], total + 1)
                last_trial = t
            total += 1
            rec_start = end
    idx = CsvIndex(path, header, total, offsets, ranges, contiguous)
    _CACHE[key] = idx
    return idx


def read_page(path: Path, offset: int, limit: int, trial_id: str | None = None) -> dict:
    idx = build_index(path)
    limit = max(0, min(int(limit), MAX_PAGE))
    lo, hi = 0, idx.total
    if trial_id is not None:
        if not idx.trials_contiguous:
            raise ValueError("trial rows are not contiguous in this file; filter unsupported")
        if trial_id not in idx.trial_ranges:
            return {"columns": idx.columns, "rows": [], "total": 0, "offset": 0}
        lo, hi = idx.trial_ranges[trial_id]
    start = lo + max(0, int(offset))
    end = min(hi, start + limit)
    rows: list[list[str | None]] = []
    if start < end:
        ck = start // STRIDE
        with path.open("rb") as f:
            f.seek(idx.offsets[ck])
            n = ck * STRIDE
            for rec, _ in _records(f):
                if not rec:
                    continue
                if n >= end:
                    break
                if n >= start:
                    rows.append([_cell(c) for c in rec])
                n += 1
    return {"columns": idx.columns, "rows": rows, "total": hi - lo, "offset": start - lo}


def _cell(v: str) -> str | None:
    if v == "" or v.lower() == "nan":
        return None
    return v


def trial_ids(path: Path) -> list[str]:
    return list(build_index(path).trial_ranges)


def finite(v: str | None) -> float | None:
    try:
        x = float(v) if v is not None else math.nan
    except ValueError:
        return None
    return x if math.isfinite(x) else None
