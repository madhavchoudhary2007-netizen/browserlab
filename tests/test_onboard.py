from types import SimpleNamespace

import pytest

from browserbench import onboard


def cfg(tmp_path, present=True, profile=False):
    exe = tmp_path / "browser"
    if present:
        exe.write_text("x")
    (tmp_path / "workloads/assets").mkdir(parents=True, exist_ok=True)
    (tmp_path / "workloads/assets/test_1080p.mp4").write_text("x")
    spec = {"enabled": True, "engine": "chromium", "binary": str(exe)}
    if profile:
        spec.update(profile_mode="template_clone", template_profile=".browserbench/profiles/chrome")
    return {"_project_root": str(tmp_path), "browsers": {"chrome": spec}}


@pytest.fixture(autouse=True)
def _no_autodetect(monkeypatch):
    monkeypatch.setattr(onboard, "apply_platform_defaults", lambda c: c)  # keep tests independent of the browsers installed on this machine


def go(tmp_path, c=None, **kw):
    lines, calls = [], []
    def run(cmd, **k):
        calls.append(cmd)
        return SimpleNamespace(returncode=0)
    rc = onboard.run_setup(c or cfg(tmp_path), run=run, out=lines.append, os_name=kw.pop("os_name", "linux"), interactive=kw.pop("interactive", False),
                           python_version=(3, 12), free_gb=100.0, **kw)
    return rc, "\n".join(lines), calls


def test_everything_present_does_nothing(tmp_path):
    rc, text, calls = go(tmp_path)
    assert rc == 0 and calls == [] and "Ready" in text


def test_missing_browser_without_yes_in_a_script_prints_the_exact_command(tmp_path):
    (tmp_path / "scripts").mkdir()
    (tmp_path / "scripts/install_browsers.sh").write_text("")
    rc, text, calls = go(tmp_path, cfg(tmp_path, present=False), os_name="linux")
    assert rc == 2 and calls == [] and "install_browsers.sh --only chrome" in text and "--yes" in text


def test_yes_runs_the_installer_for_the_missing_browsers_only(tmp_path):
    (tmp_path / "scripts").mkdir()
    (tmp_path / "scripts/install_browsers.sh").write_text("")
    c = cfg(tmp_path, present=False)
    def run(cmd, **k):
        (tmp_path / "browser").write_text("x")  # the installer put it in place
        calls.append(cmd)
        return SimpleNamespace(returncode=0)
    calls, lines = [], []
    rc = onboard.run_setup(c, assume_yes=True, run=run, out=lines.append, os_name="linux", interactive=False, python_version=(3, 12), free_gb=100.0)
    assert rc == 0 and calls[0][-2:] == ["--only", "chrome"] and any("[done]" in l for l in lines)


def test_installer_that_does_not_help_says_what_to_do_next(tmp_path):
    (tmp_path / "scripts").mkdir()
    (tmp_path / "scripts/install_browsers.sh").write_text("")
    rc, text, calls = go(tmp_path, cfg(tmp_path, present=False), assume_yes=True)
    assert rc == 2 and "still missing" in text and "google.com/chrome" in text and "binary: <path>" in text


def test_windows_uses_powershell_with_dry_run_flag(tmp_path):
    (tmp_path / "scripts").mkdir()
    (tmp_path / "scripts/install_browsers.ps1").write_text("")
    rc, text, calls = go(tmp_path, cfg(tmp_path, present=False), os_name="windows", dry_run=True)
    assert calls[0][0] == "powershell" and "-DryRun" in calls[0] and calls[0][calls[0].index("-Only") + 1] == "chrome"


def test_no_installer_script_falls_back_to_download_pages(tmp_path):
    rc, text, calls = go(tmp_path, cfg(tmp_path, present=False))
    assert rc == 2 and calls == [] and "not in this checkout" in text and "google.com/chrome" in text


def test_missing_profiles_and_old_python_are_reported(tmp_path):
    lines = []
    rc = onboard.run_setup(cfg(tmp_path, profile=True), out=lines.append, os_name="macos", interactive=False, python_version=(3, 9), free_gb=100.0)
    text = "\n".join(lines)
    assert rc == 2 and "Baseline profiles missing" in text and "brew install python@3.12" in text
