import sys
from pathlib import Path

from browserlab import engine_main, paths
from browserlab.runctl import engine_argv, prepare_run_dir


def test_workloads_resolution(monkeypatch, tmp_path):
    monkeypatch.delenv("BROWSERLAB_WORKLOADS", raising=False)
    assert paths.workloads_dir(tmp_path) == tmp_path / "workloads"
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path / "bundle"), raising=False)
    assert paths.workloads_dir(tmp_path) == tmp_path / "bundle" / "workloads"
    monkeypatch.setenv("BROWSERLAB_WORKLOADS", "/x/w")
    assert paths.workloads_dir(tmp_path) == Path("/x/w")


def test_frozen_argv_uses_bench_flag(monkeypatch, tmp_path):
    assert engine_argv("py", tmp_path / "c.yaml")[:3] == ["py", "-u", "-m"]
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    assert engine_argv("/app/engine", tmp_path / "c.yaml")[:3] == ["/app/engine", "--bench", "--config"]


def test_bench_flag_dispatches_to_browserbench(monkeypatch):
    seen = {}
    import browserbench.cli as cli
    monkeypatch.setattr(cli, "main", lambda: seen.update(argv=list(sys.argv)))
    engine_main.main(["engine", "--bench", "--config", "c.yaml", "doctor"])
    assert seen["argv"] == ["engine", "--config", "c.yaml", "doctor"]


def test_prepare_run_dir_links_bundled_workloads(tmp_path):
    bundled = tmp_path / "res" / "workloads"; bundled.mkdir(parents=True)
    root = tmp_path / "ws"; root.mkdir()
    prepare_run_dir(root, tmp_path / "run", {"project": {}}, bundled)
    assert (tmp_path / "run" / "workloads").resolve() == bundled.resolve()
    assert not (tmp_path / "run" / ".browserbench").exists()  # no baseline profiles yet -> preflight reports it


def test_default_root_frozen_creates_workspace(monkeypatch, tmp_path):
    monkeypatch.delenv("BROWSERLAB_PROJECT_ROOT", raising=False)
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    assert paths.default_project_root(tmp_path) == tmp_path / "workspace" and (tmp_path / "workspace").is_dir()


def test_project_root_pointer_file(monkeypatch, tmp_path):
    monkeypatch.delenv("BROWSERLAB_PROJECT_ROOT", raising=False)
    study = tmp_path / "study"; study.mkdir()
    (tmp_path / "project_root").write_text(str(study) + "\n")
    assert paths.default_project_root(tmp_path) == study
    (tmp_path / "project_root").write_text("/does/not/exist")
    assert paths.default_project_root(tmp_path) == Path.cwd()


def test_suite_argument_in_argv(monkeypatch, tmp_path):
    assert engine_argv("py", tmp_path / "c.yaml", "lifecycle")[-1] == "lifecycle"
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    assert engine_argv("e", tmp_path / "c.yaml", "lifecycle")[-2:] == ["--suite", "lifecycle"]
