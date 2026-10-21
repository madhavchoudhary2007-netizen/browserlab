import collections
import pytest
from browserlab.modes import BROWSERS, MODES, is_complete_design, mode_config, plan

BASE = {"project": {"seed": 7}, "browsers": {b: {"enabled": True} for b in BROWSERS}, "core": {}}


def test_quick_is_four_trials():
    s = plan(BASE, "quick", workload="javascript", tabs=5)
    assert len(s) == 4 and {c.browser for c in s} == set(BROWSERS)
    assert {(c.workload, c.tabs) for c in s} == {("javascript", 5)}


def test_standard_is_48_and_balanced():
    s = plan(BASE, "standard")
    assert len(s) == 48
    cells = collections.Counter((c.browser, c.workload, c.tabs) for c in s)
    assert len(cells) == 24 and set(cells.values()) == {2}
    assert {c.tabs for c in s} == {1, 30}


def test_full_is_240_and_blocks_complete():
    s = plan(BASE, "full")
    assert len(s) == 240
    for block in range(1, 6):
        assert len({(c.browser, c.workload, c.tabs) for c in s if c.block == block}) == 48
    assert {c.tabs for c in s} == {1, 5, 15, 30}


def test_timing_and_inference_flags():
    assert (MODES["quick"].measure_seconds, MODES["quick"].allows_inference) == (30, False)
    assert mode_config(BASE, "standard")["core"]["measure_seconds"] == 105
    assert mode_config(BASE, "full")["core"]["warmup_seconds"] == 20


def test_validation():
    with pytest.raises(ValueError):
        plan(BASE, "quick")
    with pytest.raises(ValueError):
        plan(BASE, "standard", tabs=5)
    with pytest.raises(ValueError):
        plan(BASE, "bogus")


def test_partial_browser_set_not_complete():
    assert not is_complete_design(("chrome", "brave"))
    assert len(plan(BASE, "quick", workload="static", tabs=1, browsers=("chrome", "brave"))) == 2


def test_base_config_not_mutated():
    mode_config(BASE, "full")
    assert BASE["core"] == {}
