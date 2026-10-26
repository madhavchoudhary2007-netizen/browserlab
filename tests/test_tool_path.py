import os

from browserlab.paths import with_tool_path


def test_appends_missing_tool_dirs_last():
    out = with_tool_path(os.pathsep.join(["/usr/bin", "/bin"]), exists=lambda d: True).split(os.pathsep)
    assert out == ["/usr/bin", "/bin", "/opt/homebrew/bin", "/usr/local/bin"]


def test_existing_entries_keep_priority_and_are_not_duplicated():
    out = with_tool_path(os.pathsep.join(["/usr/local/bin", "/usr/bin"]), exists=lambda d: True).split(os.pathsep)
    assert out == ["/usr/local/bin", "/usr/bin", "/opt/homebrew/bin"]


def test_skips_dirs_that_do_not_exist():
    assert with_tool_path("/usr/bin", exists=lambda d: False) == "/usr/bin"
