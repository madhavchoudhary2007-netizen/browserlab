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
    s = Server(io.StringIO(), tmp_path, ROOT, argv_factory=lambda cfg, suite: [sys.executable, "-c", "print('noop')"])  # never launch real browsers
    r = call(s, "run.start", mode="quick", workload="static", tabs=1)
    assert "run_id" in r["result"]
    s.run.wait(20)
    cfg = tmp_path / "runs" / r["result"]["run_id"] / "config.yaml"
    assert cfg.exists() and (cfg.parent / "workloads").exists()
    assert s.run.state == "completed"
    assert call(s, "run.status")["result"]["state"] == s.run.state


def test_preflight_rpc_shape(tmp_path):
    r = call(server(tmp_path), "preflight", mode="quick", workload="static", tabs=1)["result"]
    ids = {c["id"] for c in r["checks"]}
    assert {"memory", "disk", "thermal"} <= ids and isinstance(r["can_start"], bool)


def test_library_table_paging_and_validation(tmp_path):
    s = server(tmp_path)
    r = call(s, "library.table", id="data_static_scaling_v013", table="summary", offset=0, limit=5)["result"]
    assert r["total"] == 48 and len(r["rows"]) == 5 and "trial_id" in r["columns"]
    tid = r["rows"][0][r["columns"].index("trial_id")]
    r2 = call(s, "library.table", id="data_static_scaling_v013", table="samples", trial_id=tid, limit=1000)["result"]
    assert 0 < r2["total"] == len(r2["rows"])
    assert call(s, "library.table", id="../../etc", table="summary")["error"]["code"] == "not_found"
    assert call(s, "library.table", id="data_static_scaling_v013", table="passwd")["error"]["code"] == "invalid_params"
    assert call(s, "library.table", id="data_static_scaling_v013", table="samples", offset=-1)["error"]["code"] == "invalid_params"


def test_rust_allowlist_matches_rpc_methods():
    import re
    src = (ROOT / "app/src-tauri/src/engine.rs").read_text()
    allowed = set(re.findall(r'"([a-z_.]+)"', src[src.index("const ALLOWED"):src.index("];")]))
    internal = set(re.findall(r'"([a-z_.]+)"', src[src.index("const INTERNAL"):src.index("];", src.index("const INTERNAL"))]))
    assert internal == {"export.write", "settings.set_project_root"} and not (internal & allowed)
    allowed |= internal
    methods = {n[2:].replace("_", ".", 1) if n.count("_") else n[2:] for n in dir(Server) if n.startswith("m_")}
    # m_library_scan -> library.scan ; m_run_start -> run.start ; m_hello -> hello
    assert allowed == methods, (allowed ^ methods)


def test_lifecycle_run_uses_lifecycle_suite_and_is_disclosed(tmp_path):
    seen = {}
    def factory(cfg, suite):
        seen["suite"] = suite
        return [sys.executable, "-c", "print('noop')"]
    s = Server(io.StringIO(), tmp_path, ROOT, argv_factory=factory)
    plan = call(s, "plan", mode="lifecycle")["result"]
    assert plan["trial_count"] == 40 and "additional trials" in plan["disclosure"]
    assert "lifecycle" not in call(s, "hello")["result"]["modes"]  # primary UI keeps exactly three modes
    r = call(s, "run.start", mode="lifecycle", browsers=["chrome"])
    s.run.wait(20)
    assert seen["suite"] == "lifecycle" and s.run.suite == "lifecycle"
    import yaml
    cfg = yaml.safe_load((tmp_path / "runs" / r["result"]["run_id"] / "config.yaml").read_text())
    assert [k for k, v in cfg["browsers"].items() if v["enabled"]] == ["chrome"]
