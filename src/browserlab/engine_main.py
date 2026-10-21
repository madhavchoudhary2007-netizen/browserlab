"""Single entry point for the packaged sidecar.

``engine --bench <browserbench args>`` runs the unmodified benchmark CLI (used for
experiment runs); with no flag it serves the JSON-RPC protocol on stdio.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def main(argv: list[str] | None = None) -> None:
    args = list(sys.argv if argv is None else argv)
    if len(args) > 1 and args[1] == "--bench":
        sys.argv = [args[0], *args[2:]]
        from browserbench.cli import main as bench_main
        bench_main()
        return
    from browserlab.paths import default_project_root
    from browserlab.rpc import Server
    home = Path(os.environ.get("BROWSERLAB_HOME", Path.home() / "Library/Application Support/BrowserLab"))
    home.mkdir(parents=True, exist_ok=True)
    Server(sys.stdout, home, default_project_root(home)).serve(sys.stdin)


if __name__ == "__main__":
    main()
