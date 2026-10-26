from __future__ import annotations

import argparse
import json
import signal
import sys
from pathlib import Path

from .config import load_config, with_overrides
from .doctor import run_doctor
from .runner import run_suite
from .scheduler import build_schedule


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="browserbench", description="Controlled browser resource-efficiency research harness")
    p.add_argument("--config", default="config.yaml", help="Path to YAML config")
    sub = p.add_subparsers(dest="command", required=True)

    d = sub.add_parser("doctor", help="Verify browsers, media asset, power/safety prerequisites")

    st = sub.add_parser("setup", help="Check this system, install missing browsers and say what is left to do")
    st.add_argument("--yes", action="store_true", help="Do not ask before installing")
    st.add_argument("--dry-run", action="store_true", help="Show what would be installed without installing")

    s = sub.add_parser("schedule", help="Print the randomized blocked schedule without running it")
    s.add_argument("--suite", choices=["core", "lifecycle", "work"], default="core")
    s.add_argument("--repetitions", type=int)

    r = sub.add_parser("run", help="Run an experiment suite")
    r.add_argument("--suite", choices=["core", "lifecycle", "work"], default="core")
    r.add_argument("--repetitions", type=int)
    r.add_argument("--measure-seconds", type=int, help="Override core measurement time")
    r.add_argument("--no-resume", action="store_true", help="Ignore state.json and start schedule from scratch")
    return p


INCOMPLETE_EXIT = 3  # the run ended normally but some trials gave up after their retries


def main() -> None:
    if sys.platform == "win32":  # BrowserLab stops a run at a trial boundary with Ctrl+Break; make it behave like Ctrl+C
        signal.signal(signal.SIGBREAK, signal.default_int_handler)
    args = _parser().parse_args()
    cfg = load_config(args.config)
    if args.command == "doctor":
        raise SystemExit(run_doctor(cfg))
    if args.command == "setup":
        from .onboard import run_setup
        raise SystemExit(run_setup(cfg, assume_yes=args.yes, dry_run=args.dry_run))
    if args.command == "schedule":
        for c in build_schedule(cfg, args.suite, args.repetitions):
            print(c.trial_id)
        return
    if args.command == "run":
        cfg = with_overrides(cfg, repetitions=args.repetitions, measure_seconds=args.measure_seconds)
        out = run_suite(cfg, args.suite, repetitions=args.repetitions, resume=not args.no_resume)
        print(f"\nExperiment data written to: {Path(out).resolve()}")
        try:
            done = set(json.loads((Path(out) / "state.json").read_text())["completed_trial_ids"])
        except (OSError, ValueError, KeyError):
            done = set()
        missing = [c.trial_id for c in build_schedule(cfg, args.suite, args.repetitions) if c.trial_id not in done]
        if missing:
            print(f"{len(missing)} scheduled trial(s) did not complete; run the same command again to retry them.")
            raise SystemExit(INCOMPLETE_EXIT)


if __name__ == "__main__":
    main()
