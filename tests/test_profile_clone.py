import os
import shutil
import sys

import pytest

from browserbench.browsers import _create_trial_profile


@pytest.mark.skipif(sys.platform == "win32", reason="symlink rights are not guaranteed on Windows; the case is a Linux/macOS Chromium profile")
def test_clone_skips_chromium_singleton_links_that_point_nowhere(tmp_path):
    template = tmp_path / "template"
    (template / "Default").mkdir(parents=True)
    (template / "Default" / "Preferences").write_text("{}")
    # A closed Chromium profile keeps these links to temp files that are gone by now.
    for n in ("SingletonSocket", "SingletonLock", "SingletonCookie"):
        os.symlink("/tmp/no-such-dir-chromium/" + n, template / n)
    os.symlink("156.0.0.0", template / "RunningChromeVersion")  # macOS: link to a version file that is gone
    os.symlink("/tmp/gone", template / "Default" / "stale-link")
    spec = {"profile_mode": "template_clone", "template_profile": str(template)}
    clone, mode = _create_trial_profile("chrome", "chromium", spec)
    try:
        assert mode == "template_clone"
        assert (clone / "Default" / "Preferences").read_text() == "{}"
        assert not (clone / "RunningChromeVersion").exists() and not (clone / "Default" / "stale-link").exists()
        assert not any((clone / n).is_symlink() or (clone / n).exists() for n in ("SingletonSocket", "SingletonLock", "SingletonCookie"))
    finally:
        shutil.rmtree(clone, ignore_errors=True)


def test_clone_keeps_nested_files_that_share_a_lock_name(tmp_path):
    template = tmp_path / "template"
    (template / "sub").mkdir(parents=True)
    (template / "sub" / "lock").write_text("keep")
    (template / "lock").write_text("drop")
    spec = {"profile_mode": "template_clone", "template_profile": str(template)}
    clone, _ = _create_trial_profile("firefox", "firefox", spec)
    try:
        assert (clone / "sub" / "lock").read_text() == "keep" and not (clone / "lock").exists()
    finally:
        shutil.rmtree(clone, ignore_errors=True)
