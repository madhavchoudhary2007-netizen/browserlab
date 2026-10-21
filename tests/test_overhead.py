import random

import pytest

from browserlab.overhead import MIN_BLOCKS, analyze, block_order


def test_block_order_alternates_and_balances():
    o = block_order(8)
    assert o[0] == ("headless", "supervised") and o[1] == ("supervised", "headless")
    assert sum(1 for a, _ in o if a == "headless") == 4


def test_insufficient_blocks_makes_no_claim():
    v = analyze([100.0] * (MIN_BLOCKS - 1), [100.0] * (MIN_BLOCKS - 1))
    assert v.verdict == "insufficient" and v.ratio is None


def test_negligible_when_ci_inside_margin():
    rng = random.Random(1)
    h = [1000 * (1 + rng.gauss(0, 0.05)) for _ in range(20)]
    s = [x * (1 + rng.gauss(0, 0.002)) for x in h]  # same block, tiny noise
    assert analyze(h, s).verdict == "negligible"


def test_detects_real_overhead():
    rng = random.Random(2)
    h = [1000 * (1 + rng.gauss(0, 0.05)) for _ in range(20)]
    s = [x * 1.08 * (1 + rng.gauss(0, 0.005)) for x in h]
    v = analyze(h, s)
    assert v.verdict == "overhead_detected" and 1.06 < v.ratio < 1.10


def test_noisy_small_effect_is_inconclusive_not_negligible():
    rng = random.Random(3)
    h = [1000.0] * 10
    s = [1000 * (1 + rng.gauss(0, 0.08)) for _ in range(10)]
    assert analyze(h, s).verdict in ("inconclusive", "overhead_detected")
    assert analyze(h, s).verdict != "negligible"


def test_unpaired_lengths_rejected():
    with pytest.raises(ValueError):
        analyze([1.0] * 8, [1.0] * 9)


def test_execute_alternates_order_and_resumes(tmp_path):
    from browserlab.overhead import analyze_by_browser, execute, load_results
    calls = []

    def run_arm(b, arm):
        calls.append((b, arm))
        if len(calls) == 5:
            raise RuntimeError("browser failed")
        return {"chrome": 100.0 + b, "brave": 50.0}, f"d{b}-{arm}"

    csv_path = tmp_path / "r.csv"
    with pytest.raises(RuntimeError):
        execute(4, csv_path, run_arm)
    assert calls[:4] == [(0, "headless"), (0, "supervised"), (1, "supervised"), (1, "headless")]
    assert len(load_results(csv_path)) == 8  # 4 finished arms x 2 browsers persisted before the failure
    out = execute(4, csv_path, lambda b, a: ({"chrome": 200.0, "brave": 50.0}, "x"))
    assert len(out) == 16
    assert load_results(csv_path)[("00", "headless", "chrome")] == 100.0  # earlier results untouched
    v = analyze_by_browser(out)
    assert set(v) == {"chrome", "brave"} and v["chrome"].verdict == "insufficient"  # 4 blocks < 8
