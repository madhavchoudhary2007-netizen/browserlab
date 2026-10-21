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

from .library import scan, to_json
from .modes import BROWSERS, MODES, TAB_LEVELS, WORKLOADS, mode_config, plan
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

    def m_run_start(self, p: dict[str, Any]) -> Any:
        if self.run and self.run.state in ("running", "pausing", "stopping"):
            raise RpcError("busy", "an experiment run is already active")
        mode, kw = self._selection(p)
        run_id = p.get("resume_run_id") or time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
        if not run_id.replace("-", "").isalnum():
            raise RpcError("invalid_params", "bad run id")
        run_dir = self.home / "runs" / run_id
        cfg = mode_config(self._base(), mode, **kw)
        cfg_path = prepare_run_dir(self.project_root, run_dir, cfg)
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
    root = Path(os.environ.get("BROWSERLAB_PROJECT_ROOT", Path.cwd()))
    Server(sys.stdout, home, root).serve(sys.stdin)


if __name__ == "__main__":
    main()
