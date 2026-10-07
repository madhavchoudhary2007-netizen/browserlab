from browserbench.energy import POWER_PATTERNS, _to_watts


def test_power_regex():
    m = POWER_PATTERNS["cpu_w"].search("CPU Power: 1250 mW")
    assert m
    assert _to_watts(m.group(1), m.group(2)) == 1.25
