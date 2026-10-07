from browserbench.scheduler import build_schedule


def cfg():
    return {
        "project": {"seed": 123},
        "browsers": {
            "a": {"enabled": True},
            "b": {"enabled": True},
        },
        "core": {"workloads": ["static", "javascript"], "tab_counts": [1, 5], "repetitions": 2},
        "lifecycle": {"workloads": ["static"], "tab_count": 5, "repetitions": 2},
        "work_units": {"workloads": ["compute"], "tab_counts": [1], "repetitions": 2, "compute_units": 8},
    }


def test_core_schedule_is_blocked_and_reproducible():
    a = build_schedule(cfg(), "core")
    b = build_schedule(cfg(), "core")
    assert [x.trial_id for x in a] == [x.trial_id for x in b]
    assert len(a) == 2 * 2 * 2 * 2
    for block in (1, 2):
        rows = [x for x in a if x.block == block]
        combos = {(x.browser, x.workload, x.tabs) for x in rows}
        assert len(combos) == 8
