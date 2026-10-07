from browserbench.system import _parse_pmset_thermal


def test_pmset_normal_output_is_nominal():
    text = """Note: No thermal warning level has been recorded
Note: No performance warning level has been recorded
Note: No CPU power status has been recorded"""
    assert _parse_pmset_thermal(text) == "nominal"


def test_pmset_cpu_limit_100_is_nominal():
    text = "CPU_Scheduler_Limit = 100\nCPU_Speed_Limit = 100"
    assert _parse_pmset_thermal(text) == "nominal"


def test_pmset_severe_cpu_limit_is_serious():
    text = "CPU_Scheduler_Limit = 70\nCPU_Speed_Limit = 75"
    assert _parse_pmset_thermal(text) == "serious"
