# Decisions
- D-001 Branch `perfection-loop` created from `fix/v0.1.3-profile-baselines` with user's uncommitted edits carried, never committed by agent.
- D-002 Model bindings: the Agent tool exposes only `sonnet|opus|haiku|fable` overrides without effort pinning per-worker; Haiku 5.5 high effort cannot be verified. Fallback: workers launched with `model: haiku` where used, effort not set; recorded here. Orchestrator = Sonnet 5.5 (this session).
- D-003 Test python = `.venv/bin/python`.
- D-004 PDF reports: decided at implementation by checking installed libs; no heavy deps unless needed.
- D-005 Architecture LOCKED sha256=f8ad199718015cadf8eee939372753c4b1f0a55bfe68c1f3074aea29e0214672 (computed after status line set)
