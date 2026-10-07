from pathlib import Path
from urllib.request import urlopen
from browserbench.server import WorkloadServer


def test_workload_server_serves_static_page():
    root = Path(__file__).resolve().parents[1] / "workloads"
    s = WorkloadServer(root)
    s.start()
    try:
        body = urlopen(s.url("static"), timeout=3).read().decode("utf-8")
        assert "Deterministic Static DOM Workload" in body
    finally:
        s.stop()
