import io
import json
import os
import stat
import sys
from pathlib import Path

import psutil
import pytest
from browserlab import settings as st
from browserlab.rpc import Server

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def fake(tmp_path, monkeypatch):
    exe = tmp_path / "fakebrowser"
    exe.write_text('#!/bin/sh\nif [ "$1" = "--version" ]; then echo "Fake 1.0"; exit 0; fi\nsleep 120\n')
    exe.chmod(exe.stat().st_mode | stat.S_IXUSR)
    root = tmp_path / "study"; root.mkdir()
    home = tmp_path / "home"
    monkeypatch.delenv("BROWSERLAB_PROJECT_ROOT", raising=False)
    s = Server(io.StringIO(), home, root)
    base = s._base()
    for b in base["browsers"].values():
        b["binary"] = str(exe)
    monkeypatch.setattr(Server, "_base", lambda self: {**base})
    monkeypatch.setattr("browserbench.browsers.browser_version", lambda b: "Fake 1.0")
    monkeypatch.setattr("browserbench.browsers.matching_processes", lambda b: [])
    return s, root, home


def call(s, method, **params):
    return s.handle(json.dumps({"id": 1, "method": method, "params": params}))


def state(s, b):
    return next(p["state"] for p in call(s, "settings.get")["result"]["profiles"] if p["browser"] == b)


def test_status_states(fake):
    s, root, _ = fake
    assert state(s, "chrome") == "missing"
    d = st.profile_dir(root, "chrome"); d.mkdir(parents=True)
    assert state(s, "chrome") == "empty"
    (d / "Preferences").write_text("{}")
    assert state(s, "chrome") == "unmanaged"
    st.write_marker(root, "chrome", "Fake 1.0")
    assert state(s, "chrome") == "ready"
    st.write_marker(root, "chrome", "Fake 0.9")
    assert state(s, "chrome") == "version_changed"


def test_prepare_finish_lifecycle_terminates_only_our_process(fake):
    s, root, _ = fake
    assert call(s, "profiles.prepare", browser="firefox")["result"]["state"] == "launched"
    _, proc = s.setup
    assert psutil.pid_exists(proc.pid) and st.profile_dir(root, "firefox").is_dir()
    assert call(s, "profiles.prepare", browser="chrome")["error"]["code"] == "busy"
    assert call(s, "run.start", mode="quick", workload="static", tabs=1)["error"]["code"] == "busy"
    r = call(s, "profiles.finish")["result"]
    assert proc.poll() is not None and s.setup is None
    assert next(p for p in r["profiles"] if p["browser"] == "firefox")["state"] == "ready"
    assert (st.profile_dir(root, "firefox") / st.MARKER).is_file()


def test_never_overwrites_existing_profile(fake):
    s, root, _ = fake
    d = st.profile_dir(root, "brave"); d.mkdir(parents=True)
    (d / "keep.txt").write_text("baseline data")
    assert call(s, "profiles.prepare", browser="brave")["error"]["code"] == "invalid_params"
    assert (d / "keep.txt").read_text() == "baseline data" and s.setup is None


def test_cancel_leaves_directory_unmarked(fake):
    s, root, _ = fake
    call(s, "profiles.prepare", browser="librewolf"); call(s, "profiles.cancel")
    assert st.profile_dir(root, "librewolf").is_dir() and not (st.profile_dir(root, "librewolf") / st.MARKER).exists()
    assert state(s, "librewolf") == "empty"
    assert call(s, "profiles.finish")["error"]["code"] == "no_setup"
    assert call(s, "profiles.prepare", browser="librewolf")["result"]["state"] == "launched"  # empty dir is safe to reuse
    call(s, "profiles.cancel")


def test_running_browser_blocks_setup(fake, monkeypatch):
    s, root, _ = fake
    monkeypatch.setattr("browserbench.browsers.matching_processes", lambda b: [object()])
    assert call(s, "profiles.prepare", browser="chrome")["error"]["code"] == "invalid_params"
    assert not st.profile_dir(root, "chrome").exists()


def test_set_project_root(fake, tmp_path, monkeypatch):
    s, _, home = fake
    new = tmp_path / "elsewhere"; new.mkdir()
    r = call(s, "settings.set_project_root", path=str(new))["result"]
    assert r["project_root"] == str(new.resolve()) and (home / "project_root").read_text().strip() == str(new.resolve())
    assert s.project_root == new.resolve()
    for bad in ("relative", str(tmp_path / "nope"), ""):
        assert call(s, "settings.set_project_root", path=bad)["error"]["code"] == "invalid_params"
    monkeypatch.setenv("BROWSERLAB_PROJECT_ROOT", "/x")
    assert call(s, "settings.set_project_root", path=str(new))["error"]["code"] == "locked"


def test_real_repo_profiles_reported_without_launching():
    s = Server(io.StringIO(), ROOT / "nonexistent_home", ROOT)
    r = call(s, "settings.get")["result"]
    assert r["datasets"] >= 10
    assert {p["browser"]: p["state"] for p in r["profiles"]}["chrome"] in ("unmanaged", "ready", "version_changed")
    assert not (ROOT / "nonexistent_home").exists()
