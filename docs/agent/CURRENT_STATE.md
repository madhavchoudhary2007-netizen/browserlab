# Current state (verified)
- 2026-10-21, branch perfection-loop, architecture LOCKED (sha256 in DECISIONS.md D-005).
- Done: `src/browserlab/{modes,library,stats}.py` + tests (27 pytest pass via .venv; includes 18 original+new).
- Verified: Quick=4, Standard=48, Full=240 trials, block-balanced; library scan read-only over 16 datasets; known-answer stats.
- NOT done: RPC sidecar, run control FSM, exports, Tauri/Rust shell, React UI, packaging, perf/a11y/E2E, audits.
- Risks: disk 34 GB free; user's uncommitted edits in runner.py/workloads.py untouched.
