/* global process */
// Builds the e2e fixtures with the project's Python (venv if present, else the one on PATH), then runs Playwright.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const venv = process.platform === "win32" ? join(root, ".venv", "Scripts", "python.exe") : join(root, ".venv", "bin", "python");
const python = existsSync(venv) ? venv : process.platform === "win32" ? "python" : "python3";
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" && cmd === "pnpm" }); if (r.status !== 0) process.exit(r.status ?? 1); };

run(python, [join(root, "scripts", "make_e2e_fixtures.py")]);
run("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)]);
