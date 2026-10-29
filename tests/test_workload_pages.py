from pathlib import Path

import pytest

from browserbench import runner
from browserbench.config import load_config


def test_run_refuses_without_workload_pages(monkeypatch, tmp_path):
    # A project folder without workloads/ would otherwise serve 404s and measure error pages.
    monkeypatch.setattr(runner, "assert_safe", lambda cfg, out: None)
    cfg = load_config(Path(__file__).resolve().parents[1] / "config.smoke.yaml")
    cfg["_project_root"] = str(tmp_path)
    with pytest.raises(FileNotFoundError, match="Workload pages missing"):
        runner.run_suite(cfg, "core")
