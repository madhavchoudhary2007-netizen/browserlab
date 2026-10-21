"""Newline-delimited JSON-RPC over stdio. One request/response per line; events pushed as {"event": ...}."""
from __future__ import annotations

import json
import os
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Callable, TextIO

import yaml
from dataclasses import asdict

from .library import scan, to_json
from .modes import BROWSERS, MODES, TAB_LEVELS, WORKLOADS, mode_config, plan
from . import settings as st
from .paths import default_project_root, workloads_dir
from .preflight import run_preflight
from . import tables
from .analysis import analyze
from .export import ExportError, FORMATS, validate_dest, write_export
from .runctl import RunController, engine_argv, prepare_run_dir

PROTOCOL_VERSION = 1
BASE = Path(__file__).with_name("protocol_base.yaml")


class RpcError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _enum(params: dict[str, Any], key: str, allowed: tuple[Any, ...], required: bool = True) -> Any:
    v = params.get(key)
    if v is None and not required:
        return None
    if v not in allowed:
        raise RpcError("invalid_params", f"{key} must be one of {list(allowed)}")
    return v


def _browsers(params: dict[str, Any]) -> tuple[str, ...]:
    b = params.get("browsers", list(BROWSERS))
    if not isinstance(b, list) or not b or any(x not in BROWSERS for x in b):
        raise RpcError("invalid_params", f"browsers must be a non-empty subset of {list(BROWSERS)}")
    return tuple(b)


class Server:
    def __init__(self, out: TextIO, home: Path, project_root: Path, python: str = sys.executable,
                 argv_factory: Callable[[Path], list[str]] | None = None) -> None:
        self.out, self.home, self.project_root, self.python = out, home, project_root, python
        self.argv_factory = argv_factory or (lambda cfg: engine_argv(self.python, cfg))
        self._wlock = threading.Lock()
        self.run: RunController | None = None
        self.setup: tuple[str, Any] | None = None  # (browser, Popen) of an active baseline-profile setup
        self.run_id: str | None = None

    def send(self, obj: dict[str, Any]) -> None:
        with self._wlock:
            self.out.write(json.dumps(obj, separators=(",", ":"), default=str) + "\n")
            self.out.flush()

    def _base(self) -> dict[str, Any]:
        cfg = yaml.safe_load(BASE.read_text())
        cfg["_project_root"] = str(self.project_root)
        return cfg

    def _selection(self, p: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        mode = _enum(p, "mode", tuple(MODES))
        kw: dict[str, Any] = {"browsers": _browsers(p)}
        if mode == "quick":
            kw["workload"] = _enum(p, "workload", WORKLOADS)
            kw["tabs"] = _enum(p, "tabs", TAB_LEVELS)
        return mode, kw

    # -- methods -------------------------------------------------------
    def m_hello(self, p: dict[str, Any]) -> Any:
        return {"protocol": PROTOCOL_VERSION, "modes": list(MODES), "browsers": list(BROWSERS)}

    def m_plan(self, p: dict[str, Any]) -> Any:
        mode, kw = self._selection(p)
        try:
            sched = plan(self._base(), mode, **kw)
        except ValueError as e:
            raise RpcError("invalid_params", str(e))
        spec = MODES[mode]
        return {
            "mode": mode, "trial_count": len(sched),
            "complete_design": set(kw["browsers"]) == set(BROWSERS),
            "inference_allowed": spec.allows_inference,
            "min_seconds_lower_bound": len(sched) * (spec.warmup_seconds + spec.measure_seconds),
            "trials": [c.to_dict() for c in sched],
        }

    def m_library_scan(self, p: dict[str, Any]) -> Any:
        return json.loads(to_json(scan(self.project_root)))

    TABLE_FILES = {
        "summary": "processed/trial_summary_{suite}.csv",
        "samples": "raw/samples.csv",
        "process_samples": "raw/process_samples.csv",
        "page_metrics": "raw/page_metrics.csv",
    }

    def m_library_table(self, p: dict[str, Any]) -> Any:
        """Page of a dataset table. Paths come from a library scan, never from the caller."""
        table = _enum(p, "table", tuple(self.TABLE_FILES))
        suite = p.get("suite", "core")
        info = next((i for i in scan(self.project_root) if i.id == p.get("id") and i.suite == suite), None)
        if info is None:
            raise RpcError("not_found", "unknown experiment")
        path = Path(info.path) / self.TABLE_FILES[table].format(suite=suite)
        if not path.exists():
            raise RpcError("not_found", f"{table} not present in this experiment")
        off, lim = p.get("offset", 0), p.get("limit", 200)
        if not (isinstance(off, int) and isinstance(lim, int) and off >= 0 and lim >= 0):
            raise RpcError("invalid_params", "offset/limit must be non-negative integers")
        tid = p.get("trial_id")
        if tid is not None and not isinstance(tid, str):
            raise RpcError("invalid_params", "trial_id must be a string")
        try:
            return tables.read_page(path, off, lim, tid)
        except ValueError as e:
            raise RpcError("unsupported", str(e))

    def m_stats_run(self, p: dict[str, Any]) -> Any:
        suite = p.get("suite", "core")
        info = next((i for i in scan(self.project_root) if i.id == p.get("id") and i.suite == suite), None)
        if info is None:
            raise RpcError("not_found", "unknown experiment")
        path = Path(info.path) / "processed" / f"trial_summary_{suite}.csv"
        if not path.exists():
            raise RpcError("not_found", "no trial summary for this experiment")
        return analyze(path, info.protocol_key)

    def m_export_write(self, p: dict[str, Any]) -> Any:
        """Write one export. Reached only from the native save dialog, never directly from the UI."""
        fmt = _enum(p, "format", tuple(FORMATS))
        suite = p.get("suite", "core")
        infos = scan(self.project_root)
        info = next((i for i in infos if i.id == p.get("id") and i.suite == suite), None)
        if info is None:
            raise RpcError("not_found", "unknown experiment")
        summary = Path(info.path) / "processed" / f"trial_summary_{suite}.csv"
        if not summary.exists():
            raise RpcError("not_found", "no trial summary for this experiment")
        images = p.get("images", [])
        if not isinstance(images, list) or len(images) > 6:
            raise RpcError("invalid_params", "images must be a list of at most 6 PNG data URLs")
        try:
            dest = validate_dest(str(p.get("path", "")), fmt, [Path(i.path).parent for i in infos] + [self.project_root / "analysis"])
            return write_export(fmt, dest, asdict(info), summary, analyze(summary, info.protocol_key), images)
        except ExportError as e:
            raise RpcError("invalid_params", str(e))

    def _browser_specs(self) -> dict[str, Any]:
        return self._base()["browsers"]

    def m_settings_get(self, p: dict[str, Any]) -> Any:
        from browserbench.browsers import browser_version
        root = self.project_root
        pointer = self.home / "project_root"
        source = "environment" if os.environ.get("BROWSERLAB_PROJECT_ROOT") else "saved" if pointer.is_file() else "default"
        specs = self._browser_specs()
        return {
            "project_root": str(root), "source": source,
            "datasets": len([d for d in root.glob("data_*") if d.is_dir()]),
            "profiles": [st.profile_status(root, b, specs[b], browser_version) for b in BROWSERS],
            "setup_active": self.setup[0] if self.setup else None,
        }

    def m_settings_set_project_root(self, p: dict[str, Any]) -> Any:
        """Internal: path comes from the native folder dialog."""
        if self.run and self.run.state in ("running", "pausing", "stopping"):
            raise RpcError("busy", "cannot change the project folder during a run")
        if self.setup:
            raise RpcError("busy", "finish or cancel the baseline-profile setup first")
        if os.environ.get("BROWSERLAB_PROJECT_ROOT"):
            raise RpcError("locked", "project folder is set by the BROWSERLAB_PROJECT_ROOT environment variable")
        try:
            self.project_root = st.write_pointer(self.home, str(p.get("path", "")))
        except st.SettingsError as e:
            raise RpcError("invalid_params", str(e))
        return self.m_settings_get({})

    def m_profiles_prepare(self, p: dict[str, Any]) -> Any:
        from browserbench.browsers import matching_processes
        browser = _enum(p, "browser", BROWSERS)
        if self.setup:
            raise RpcError("busy", "a baseline-profile setup is already active")
        if self.run and self.run.state in ("running", "pausing", "stopping"):
            raise RpcError("busy", "cannot set up a profile during a run")
        try:
            proc = st.start_profile_setup(self.project_root, browser, self._browser_specs()[browser], matching_processes)
        except st.SettingsError as e:
            raise RpcError("invalid_params", str(e))
        self.setup = (browser, proc)
        return {"browser": browser, "state": "launched"}

    def _end_setup(self, finish: bool) -> Any:
        from browserbench.browsers import browser_version
        if not self.setup:
            raise RpcError("no_setup", "no baseline-profile setup is active")
        browser, proc = self.setup
        st.stop_tree(proc)
        self.setup = None
        if finish:
            spec = self._browser_specs()[browser]
            st.write_marker(self.project_root, browser, browser_version(spec["binary"]))
        return self.m_settings_get({})

    def m_profiles_finish(self, p: dict[str, Any]) -> Any:
        return self._end_setup(True)

    def m_profiles_cancel(self, p: dict[str, Any]) -> Any:
        return self._end_setup(False)

    def m_preflight(self, p: dict[str, Any]) -> Any:
        mode, kw = self._selection(p)
        cfg = mode_config(self._base(), mode, **kw)
        return run_preflight(cfg, kw["browsers"], tuple(cfg["core"]["workloads"]), self.home / "preflight")

    def m_run_start(self, p: dict[str, Any]) -> Any:
        if self.run and self.run.state in ("running", "pausing", "stopping"):
            raise RpcError("busy", "an experiment run is already active")
        if self.setup:
            raise RpcError("busy", "finish or cancel the baseline-profile setup first")
        mode, kw = self._selection(p)
        run_id = p.get("resume_run_id") or time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
        if not run_id.replace("-", "").isalnum():
            raise RpcError("invalid_params", "bad run id")
        run_dir = self.home / "runs" / run_id
        cfg = mode_config(self._base(), mode, **kw)
        cfg_path = prepare_run_dir(self.project_root, run_dir, cfg, workloads_dir(self.project_root))
        self.run_id = run_id
        self.run = RunController(
            run_dir, self.argv_factory(cfg_path),
            lambda e: self.send({"event": e["type"], "run_id": run_id, **e}), cwd=run_dir,
        )
        self.run.start()
        return {"run_id": run_id, "state": self.run.state}

    def _ctl(self) -> RunController:
        if not self.run:
            raise RpcError("no_run", "no run in this session")
        return self.run

    def m_run_pause(self, p: dict[str, Any]) -> Any:
        self._ctl().pause(); return {"state": self.run.state}  # type: ignore[union-attr]

    def m_run_resume(self, p: dict[str, Any]) -> Any:
        self._ctl().start(); return {"state": self.run.state}  # type: ignore[union-attr]

    def m_run_stop(self, p: dict[str, Any]) -> Any:
        self._ctl().stop(); return {"state": self.run.state}  # type: ignore[union-attr]

    def m_run_status(self, p: dict[str, Any]) -> Any:
        c = self._ctl()
        return {"run_id": self.run_id, "state": c.state, "progress": c.progress}

    # -- dispatch ------------------------------------------------------
    def handle(self, line: str) -> dict[str, Any]:
        rid = None
        try:
            req = json.loads(line)
            if not isinstance(req, dict) or not isinstance(req.get("method"), str):
                raise RpcError("invalid_request", "expected {id, method, params}")
            rid = req.get("id")
            params = req.get("params") or {}
            if not isinstance(params, dict):
                raise RpcError("invalid_params", "params must be an object")
            fn = getattr(self, "m_" + req["method"].replace(".", "_"), None)
            if fn is None:
                raise RpcError("unknown_method", req["method"])
            return {"id": rid, "result": fn(params)}
        except RpcError as e:
            return {"id": rid, "error": {"code": e.code, "message": str(e)}}
        except json.JSONDecodeError:
            return {"id": rid, "error": {"code": "parse_error", "message": "invalid JSON"}}
        except Exception as e:  # noqa: BLE001 - boundary: never crash the sidecar
            from .runctl import InvalidTransition
            code = "invalid_state" if isinstance(e, InvalidTransition) else "internal"
            return {"id": rid, "error": {"code": code, "message": str(e)}}

    def serve(self, inp: TextIO) -> None:
        for line in inp:
            if line.strip():
                self.send(self.handle(line))
        if self.run and self.run.state in ("running", "pausing"):
            self.run.stop()  # stdin closed: end at trial boundary, keep data
            self.run.wait(3600)


def main() -> None:
    home = Path(os.environ.get("BROWSERLAB_HOME", Path.home() / "Library/Application Support/BrowserLab"))
    Server(sys.stdout, home, default_project_root(home)).serve(sys.stdin)


if __name__ == "__main__":
    main()
