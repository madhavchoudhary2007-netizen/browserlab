import io
import json
import sys
from pathlib import Path

from browserlab.rpc import Server

ROOT = Path(__file__).resolve().parents[1]


def call(s, method, **params):
    return s.handle(json.dumps({"id": 1, "method": method, "params": params}))


def server(tmp_path):
    return Server(io.StringIO(), tmp_path, ROOT)


def test_hello_and_plan_counts(tmp_path):
    s = server(tmp_path)
    assert call(s, "hello")["result"]["protocol"] == 1
    assert call(s, "plan", mode="full")["result"]["trial_count"] == 240
    r = call(s, "plan", mode="quick", workload="video", tabs=15)["result"]
    assert r["trial_count"] == 4 and not r["inference_allowed"] and r["complete_design"]
    r = call(s, "plan", mode="quick", workload="video", tabs=15, browsers=["chrome"])["result"]
    assert not r["complete_design"]


def test_validation_errors(tmp_path):
    s = server(tmp_path)
    assert call(s, "plan", mode="bogus")["error"]["code"] == "invalid_params"
    assert call(s, "plan", mode="quick")["error"]["code"] == "invalid_params"
    assert call(s, "plan", mode="full", browsers=["safari"])["error"]["code"] == "invalid_params"
    assert call(s, "nope")["error"]["code"] == "unknown_method"
    assert s.handle("{bad")["error"]["code"] == "parse_error"
    assert s.handle("[]")["error"]["code"] == "invalid_request"
    assert call(s, "run.pause")["error"]["code"] == "no_run"


def test_library_scan(tmp_path):
    ids = {i["id"] for i in call(server(tmp_path), "library.scan")["result"]}
    assert "data_static_scaling_v013" in ids


def test_run_prepares_dir_and_single_active(tmp_path):
    s = Server(io.StringIO(), tmp_path, ROOT, argv_factory=lambda cfg: [sys.executable, "-c", "print('noop')"])  # never launch real browsers
    r = call(s, "run.start", mode="quick", workload="static", tabs=1)
    assert "run_id" in r["result"]
    s.run.wait(20)
    cfg = tmp_path / "runs" / r["result"]["run_id"] / "config.yaml"
    assert cfg.exists() and (cfg.parent / "workloads").is_symlink()
    assert s.run.state == "completed"
    assert call(s, "run.status")["result"]["state"] == s.run.state


def test_preflight_rpc_shape(tmp_path):
    r = call(server(tmp_path), "preflight", mode="quick", workload="static", tabs=1)["result"]
    ids = {c["id"] for c in r["checks"]}
    assert {"memory", "disk", "thermal"} <= ids and isinstance(r["can_start"], bool)
