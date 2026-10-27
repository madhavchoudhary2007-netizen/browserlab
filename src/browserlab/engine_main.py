"""Single entry point for the packaged sidecar.

``engine --bench <browserbench args>`` runs the unmodified benchmark CLI (used for
experiment runs); with no flag it serves the JSON-RPC protocol on stdio.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def main(argv: list[str] | None = None) -> None:
    from browserlab.paths import ensure_tool_path
    ensure_tool_path()  # GUI-launched apps get a minimal PATH; both RPC and --bench (and its children) need the tools
    args = list(sys.argv if argv is None else argv)
    if len(args) > 1 and args[1] == "--bench":
        sys.argv = [args[0], *args[2:]]
        # The app reads progress lines from a pipe; a frozen executable has no `python -u`, so flush per line.
        for stream in (sys.stdout, sys.stderr):
            if hasattr(stream, "reconfigure"):
                stream.reconfigure(line_buffering=True)
        from browserbench.cli import main as bench_main
        bench_main()
        return
    from browserbench.platforms import default_home
    from browserlab.paths import default_project_root
    from browserlab.rpc import Server
    home = Path(os.environ.get("BROWSERLAB_HOME") or default_home())
    home.mkdir(parents=True, exist_ok=True)
    Server(sys.stdout, home, default_project_root(home)).serve(sys.stdin)


if __name__ == "__main__":
    main()
