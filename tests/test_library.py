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
