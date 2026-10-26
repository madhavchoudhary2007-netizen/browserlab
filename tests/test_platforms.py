from pathlib import Path

import pytest

from browserbench import platforms as pf
from browserbench import system


def test_candidates_cover_every_browser_on_every_os():
    for os_name in ("macos", "windows", "linux"):
        for b in pf.BROWSERS:
            assert pf.candidates(b, os_name), (os_name, b)


def test_candidates_use_each_os_convention():
    assert pf.candidates("chrome", "macos")[0].endswith("Google Chrome.app/Contents/MacOS/Google Chrome")
    assert pf.candidates("firefox", "windows")[0].endswith(r"Mozilla Firefox\firefox.exe")
    assert pf.candidates("brave", "linux")[0] == "/usr/bin/brave-browser"


def test_existing_configured_path_is_never_replaced(tmp_path):
    exe = tmp_path / "chrome"
    exe.write_text("x")
    assert pf.resolve_binary("chrome", str(exe), which=lambda n: "/elsewhere", exists=lambda p: True) == str(exe)


def test_missing_configured_path_falls_back_to_what_is_installed():
    found = pf.candidates("firefox", pf.current_os())[-1]
    got = pf.resolve_binary("firefox", "/nonexistent/firefox", which=lambda n: None, exists=lambda p: p == found)
    assert got == found



def test_auto_with_nothing_installed_names_the_usual_location():
    got = pf.resolve_binary("librewolf", "auto", which=lambda n: None, exists=lambda p: False)
    assert got == pf.candidates("librewolf")[0]


def test_apply_platform_defaults_leaves_unknown_keys_alone():
    cfg = {"browsers": {"chrome": {"binary": "auto", "engine": "chromium"}, "custom": {"binary": "x"}}}
    out = pf.apply_platform_defaults(cfg)
    assert out["browsers"]["custom"]["binary"] == "x"
    assert out["browsers"]["chrome"]["binary"] != "auto"


@pytest.mark.parametrize("os_name,expected", [("macos", "Application Support"), ("windows", "BrowserLab"), ("linux", "browserlab")])
def test_default_home_follows_os(monkeypatch, os_name, expected):
    monkeypatch.setattr(pf, "current_os", lambda: os_name)
    monkeypatch.setenv("APPDATA", "C:/Users/x/AppData/Roaming")
    monkeypatch.delenv("XDG_DATA_HOME", raising=False)
    assert expected in str(pf.default_home())


def test_power_status_without_battery_counts_as_mains(monkeypatch):
    monkeypatch.setattr(system.psutil, "sensors_battery", lambda: None)
    assert system._power_status_psutil() == {"ac_power": True, "battery_pct": None}


def test_power_status_on_battery(monkeypatch):
    class B:
        power_plugged = False
        percent = 41.0
    monkeypatch.setattr(system.psutil, "sensors_battery", lambda: B())
    assert system._power_status_psutil() == {"ac_power": False, "battery_pct": 41}


def test_energy_collection_is_refused_off_macos(monkeypatch):
    from browserbench import energy
    monkeypatch.setattr(energy.sys, "platform", "linux")
    with pytest.raises(RuntimeError, match="macOS"):
        energy.EnergySampler().start()


def test_engine_process_group_arguments_per_os():
    from browserlab.runctl import group_kwargs
    assert group_kwargs("win32") == {"creationflags": 0x200}
    assert group_kwargs("linux") == {"start_new_session": True}
    assert group_kwargs("darwin") == {"start_new_session": True}


def test_missing_browser_names_this_systems_location_not_another_systems(monkeypatch):
    monkeypatch.setattr(pf, "current_os", lambda: "linux")
    got = pf.resolve_binary("brave", "/Applications/NoSuchBrave.app/Contents/MacOS/Brave", which=lambda n: None, exists=lambda p: False)
    assert got == "/usr/bin/brave-browser"
    assert pf.resolve_binary("brave", "/opt/custom/brave", which=lambda n: None, exists=lambda p: False) == "/opt/custom/brave"
