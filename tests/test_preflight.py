from pathlib import Path

from browserlab.preflight import run_preflight

SNAP = {"available_memory_pct": 50.0, "free_disk_gb": 100.0, "ac_power": True, "thermal_pressure": "nominal"}


def cfg(tmp_path, binary):
    prof = tmp_path / "prof"; prof.mkdir(exist_ok=True)
    (tmp_path / "workloads/assets").mkdir(parents=True, exist_ok=True); (tmp_path / "workloads/assets/test_1080p.mp4").write_text("x")
    return {"_project_root": str(tmp_path),
            "safety": {"minimum_available_memory_percent": 20, "minimum_free_disk_gb": 20, "require_ac_power": True},
            "browsers": {"chrome": {"engine": "chromium", "binary": str(binary), "profile_mode": "template_clone", "template_profile": "prof"}}}


def go(tmp_path, binary, snap=None, running=lambda b: [], workloads=("video",)):
    return run_preflight(cfg(tmp_path, binary), ("chrome",), workloads, tmp_path / "out",
                         snapshot_fn=lambda p: {**SNAP, **(snap or {})}, running_fn=running, version_fn=lambda b: "v1")


def status(r, id):
    return next(c["status"] for c in r["checks"] if c["id"] == id)


def test_all_good(tmp_path):
    b = tmp_path / "chrome"; b.write_text("")
    r = go(tmp_path, b)
    assert r["can_start"] and not r["has_warnings"]


def test_missing_browser_blocks(tmp_path):
    r = go(tmp_path, tmp_path / "nope")
    assert not r["can_start"] and status(r, "browser.chrome") == "fail"


def test_running_browser_blocks_and_is_not_touched(tmp_path):
    b = tmp_path / "chrome"; b.write_text("")
    r = go(tmp_path, b, running=lambda _b: [object()])
    assert not r["can_start"] and status(r, "running.chrome") == "fail"


def test_resource_failures(tmp_path):
    b = tmp_path / "chrome"; b.write_text("")
    r = go(tmp_path, b, {"available_memory_pct": 5, "free_disk_gb": 1, "ac_power": False, "thermal_pressure": "serious"})
    assert [status(r, i) for i in ("memory", "disk", "power", "thermal")] == ["fail"] * 4


def test_unknown_thermal_warns_not_fails(tmp_path):
    b = tmp_path / "chrome"; b.write_text("")
    r = go(tmp_path, b, {"thermal_pressure": "unknown"})
    assert r["can_start"] and r["has_warnings"]


def test_video_asset_only_required_for_video(tmp_path):
    b = tmp_path / "chrome"; b.write_text("")
    (tmp_path / "workloads/assets").mkdir(parents=True, exist_ok=True)
    c = cfg(tmp_path, b); (tmp_path / "workloads/assets/test_1080p.mp4").unlink()
    r = run_preflight(c, ("chrome",), ("static",), tmp_path / "o", snapshot_fn=lambda p: SNAP, running_fn=lambda b: [], version_fn=lambda b: "v")
    assert all(x["id"] != "video_asset" for x in r["checks"])
