import hashlib
from pathlib import Path
from browserlab.library import compatible, scan

ROOT = Path(__file__).resolve().parents[1]


def _tree_hash(p: Path) -> str:
    h = hashlib.sha256()
    for f in sorted(p.rglob("*")):
        if f.is_file():
            h.update(f.name.encode()); h.update(str(f.stat().st_size).encode())
    return h.hexdigest()


def test_scan_is_read_only_and_classifies():
    before = _tree_hash(ROOT / "data_static_scaling_v013")
    infos = {i.id: i for i in scan(ROOT)}
    assert _tree_hash(ROOT / "data_static_scaling_v013") == before
    s = infos["data_static_scaling_v013"]
    assert s.status == "exploratory" and s.measure_seconds and s.completed_trials <= s.scheduled_trials
    assert infos["data_performance_instrumentation_5tab"].status == "instrumentation-validation"


def test_incomplete_detected(tmp_path):
    suite = tmp_path / "data_x" / "core"
    (suite / "raw").mkdir(parents=True)
    (suite / "schedule.csv").write_text("trial_id\na\nb\n")
    (suite / "state.json").write_text('{"completed_trial_ids": ["a"]}')
    (suite / "raw" / "samples.csv").write_text("trial_id\n")
    [i] = scan(tmp_path)
    assert i.status == "incomplete" and i.warnings


def test_compat_flags_mismatch():
    infos = scan(ROOT)
    keys = {i.protocol_key for i in infos}
    if len(keys) > 1:
        a = infos[0]; b = next(i for i in infos if i.protocol_key != a.protocol_key)
        assert not compatible(a, b)[0]


def test_app_runs_are_listed_with_timestamps_newest_first(tmp_path):
    def make(base, run, started, ended, done):
        suite = base / run / "data" / "core"
        (suite / "raw").mkdir(parents=True); (suite / "processed").mkdir()
        (suite / "schedule.csv").write_text("trial_id\na\nb\n")
        (suite / "state.json").write_text('{"completed_trial_ids": %s}' % (["a", "b"][:done] and str(["a", "b"][:done]).replace("'", '"')))
        (suite / "raw" / "samples.csv").write_text("trial_id,phys_footprint_mb\n")
        (suite / "processed" / "trial_summary_core.csv").write_text(f"trial_id,started_unix,ended_unix\na,{started},{started + 10}\nb,{ended - 10},{ended}\n")
    home = tmp_path / "home"
    make(home / "runs", "20261001-000000-aaaaaa", 1000.0, 1100.0, 2)
    make(home / "runs", "20261002-000000-bbbbbb", 2000.0, 2100.0, 1)
    infos = scan(tmp_path / "empty_root", home)
    assert [i.id for i in infos] == ["20261002-000000-bbbbbb", "20261001-000000-aaaaaa"]
    assert infos[0].status == "incomplete" and infos[1].status == "completed"
    assert infos[1].source == "app" and infos[1].started_unix == 1000.0 and infos[1].finished_unix == 1100.0


def test_every_historical_dataset_has_a_timestamp():
    assert all(i.finished_unix or i.started_unix for i in scan(ROOT))
