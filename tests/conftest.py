"""Some tests exercise the author's real experiment folders (data_*/) and baseline profiles (.browserbench/).
Those are generated locally and are not in the repository, so on a fresh clone these tests are skipped with a reason
instead of failing. Which tests need which folder is detected from the dataset names they mention."""
import inspect
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
DATASET = re.compile(r"\bdata_[a-z0-9]+_[a-z0-9_]+")


def _datasets_used(item: pytest.Item) -> set[str]:
    func = getattr(item, "function", None)
    if func is None:
        return set()
    src = inspect.getsource(func)
    for defs in item._fixtureinfo.name2fixturedefs.values():  # fixtures the test pulls in
        for d in defs:
            if getattr(d.func, "__module__", "").startswith("test_"):
                src += inspect.getsource(d.func)
    for gname, value in vars(item.module).items():  # module-level helpers the test calls
        if inspect.isfunction(value) and value is not func and value.__module__ == item.module.__name__ and re.search(rf"\b{gname}\(", src):
            src += inspect.getsource(value)
    names = set(DATASET.findall(src))
    for gname, value in vars(item.module).items():  # module constants such as EXP = "data_..."
        if isinstance(value, str) and DATASET.fullmatch(value) and re.search(rf"\b{gname}\b", src):
            names.add(value)
    return names


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    present = {p.name for p in ROOT.glob("data_*") if p.is_dir() and p.name.startswith("data_")}
    for item in items:
        missing = sorted(n for n in _datasets_used(item) if n not in present)
        if missing:
            item.add_marker(pytest.mark.skip(reason=f"needs experiment folder(s) not in this checkout: {', '.join(missing)}"))
        elif "real_repo" in item.name and (len(present) < 10 or not (ROOT / ".browserbench" / "profiles" / "chrome").exists()):
            item.add_marker(pytest.mark.skip(reason="needs the author's data_*/ folders and baseline profiles"))
