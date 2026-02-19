# Consolidate SSH Execution for Gateway Media API Route

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository has ExecPlan requirements in `.agent/PLANS.md`, and this document must be maintained in accordance with it.

## Purpose / Big Picture

OpenClaw Studio has multiple Node-runtime API routes that execute small commands over SSH to the Gateway host. Most of those routes already reuse a shared helper (`runSshJson`) in `src/lib/ssh/gateway-host.ts` which centralizes:

- `ssh` invocation (`BatchMode=yes`)
- JSON parsing
- extraction of actionable error messages from JSON output

However, `src/app/api/gateway/media/route.ts` still shells out to `ssh` directly with `child_process.spawnSync`, duplicating error handling and JSON parsing logic and creating a drift risk (different routes surface different errors for similar SSH failures).

After this change, the media route will use the shared `runSshJson` helper instead of its own `spawnSync` call. We will extend `runSshJson` with a single optional knob (`maxBuffer`) so the media route can safely handle large base64 payloads (up to the existing 25MB limit).

You can see it working by running unit tests that verify:

1. `runSshJson` forwards `maxBuffer` to `spawnSync` when specified.
2. `/api/gateway/media` still returns binary image responses for successful remote reads and JSON errors for invalid requests.

## Progress

- [x] (2026-02-15 22:46Z) Add unit tests covering `runSshJson` maxBuffer and the remote (SSH) path of `src/app/api/gateway/media/route.ts`.
- [x] (2026-02-15 22:47Z) Extend `runSshJson` in `src/lib/ssh/gateway-host.ts` to accept an optional `maxBuffer`.
- [x] (2026-02-15 22:48Z) Refactor `src/app/api/gateway/media/route.ts` to replace direct `spawnSync` with `runSshJson`.
- [x] (2026-02-15 22:49Z) Run `npm run typecheck`, `npm test`, and `npm run lint` (do not introduce new lint warnings beyond the existing baseline).
- [x] (2026-02-15 22:50Z) Move this ExecPlan to `.agent/done/` with a date-prefixed filename.

- [x] (2026-02-15 22:46Z) Create branch `codex/consolidate-media-ssh-execution-2` for this ExecPlan.

## Surprises & Discoveries

- Observation: `src/app/api/gateway/media/route.ts` is the only API route that shells out to `ssh` directly instead of using `runSshJson`.
  Evidence: `rg -n "spawnSync\\(" -S src/app/api src/lib` shows `src/app/api/gateway/media/route.ts` and `src/lib/ssh/gateway-host.ts`.

- Observation: `runSshJson` did not initially forward `maxBuffer` to `child_process.spawnSync`.
  Evidence: `tests/unit/runSshJson.test.ts` initially failed with `expected undefined to be 12345`.

## Decision Log

- Decision: Consolidate SSH execution for the media route by reusing `runSshJson` and extending it with `maxBuffer`.
  Rationale: This is a small blast radius refactor (two modules plus tests) that deletes duplicated error/JSON handling, reduces drift risk, and keeps the media route’s payload-size safety constraints intact.
  Date/Author: 2026-02-15 / Codex

- Decision: Use branch `codex/consolidate-media-ssh-execution-2` instead of `codex/consolidate-media-ssh-execution`.
  Rationale: The `main` branch is checked out in another worktree, and policy blocked deleting/recreating the pre-existing `codex/consolidate-media-ssh-execution` branch name in this environment.
  Date/Author: 2026-02-15 / Codex

## Outcomes & Retrospective

- `src/app/api/gateway/media/route.ts` now uses the shared `runSshJson` helper for its remote (SSH) media read path, instead of invoking `child_process.spawnSync` directly.
- `runSshJson` in `src/lib/ssh/gateway-host.ts` now accepts `maxBuffer?: number` and forwards it to `child_process.spawnSync`, so callers with large JSON payloads (base64 media) can opt in safely.
- Added unit coverage for both the `maxBuffer` passthrough and the media route’s successful remote read behavior.
- Verification: `npm run typecheck` passed; `npm test` passed (105 files / 467 tests); `npm run lint` produced only the existing baseline warning in `src/app/page.tsx:1743`.

## Context and Orientation

Relevant files:

- `src/lib/ssh/gateway-host.ts`: owns `runSshJson` and the general SSH execution policy for Node routes.
- `src/app/api/gateway/media/route.ts`: fetches media from local `.openclaw` or, when gateway is remote, fetches media via SSH by running a Python script that base64-encodes the file and prints JSON.
- `src/app/api/gateway/agent-state/route.ts` and `src/app/api/gateway/dotenv-keys/route.ts`: examples of routes that already use `runSshJson`.

Non-goals:

- Do not change the media route’s local/remote decision logic.
- Do not change the media size limit (25MB) or supported extensions.
- Do not add new fallback behaviors. Fail fast with actionable errors.

## Plan of Work

### Milestone 1: Add tests that fail before the refactor

1. Add a node-environment unit test for `runSshJson` that asserts `maxBuffer` is passed through to `child_process.spawnSync` when provided.
2. Add a node-environment unit test for the remote path of `src/app/api/gateway/media/route.ts` that:
   - writes Studio settings to a temp `OPENCLAW_STATE_DIR` with a remote gateway URL
   - sets `OPENCLAW_GATEWAY_SSH_TARGET` explicitly to avoid hostname parsing differences
   - mocks `child_process.spawnSync` to return a JSON payload with `{ data, mime, size }`
   - calls the route handler and asserts the returned response is binary (not JSON) and has `Content-Type: image/...`.

Acceptance:

1. Tests fail before implementation (missing `maxBuffer` support and/or route still bypasses `runSshJson`).

### Milestone 2: Extend `runSshJson` with optional `maxBuffer`

In `src/lib/ssh/gateway-host.ts`, extend the `runSshJson` parameter type to include:

- `maxBuffer?: number`

and forward it to `child_process.spawnSync` options.

Acceptance:

1. The new `runSshJson` unit test passes.
2. No existing call sites break (param is optional).

### Milestone 3: Refactor media route to use `runSshJson`

In `src/app/api/gateway/media/route.ts`:

1. Replace the direct `childProcess.spawnSync("ssh", ...)` usage with a call to `runSshJson({ sshTarget, argv, input, label, fallbackMessage, maxBuffer })`.
2. Keep the current `maxBuffer` sizing logic (it currently uses `Math.ceil(MAX_MEDIA_BYTES * 1.6)`).
3. Keep response behavior the same: successful remote reads return a binary image response; failures return `NextResponse.json({ error }, { status: 400 })`.

Acceptance:

1. The media route test passes.
2. `rg -n "spawnSync\\(" src/app/api/gateway/media/route.ts` finds no matches.

## Concrete Steps

Run all commands from the repo root.

1. Add tests:

   - Create `tests/unit/runSshJson.test.ts` (node env) or extend an existing SSH helper test file.
   - Create `tests/unit/gatewayMediaRoute.test.ts` (node env) for the remote path.
   - Run `npm test` and confirm failures reflect the missing refactor.

2. Implement:

   - Edit `src/lib/ssh/gateway-host.ts`.
   - Edit `src/app/api/gateway/media/route.ts`.
   - Run `npm run typecheck`.
   - Run `npm test`.
   - Run `npm run lint`.

3. Commit after verification passes, then move this ExecPlan to `.agent/done/` with a date-prefixed filename.

## Validation and Acceptance

This work is complete when:

1. `npm run typecheck` passes.
2. `npm test` passes, including the new tests.
3. `npm run lint` introduces no new warnings beyond the current baseline.
4. `src/app/api/gateway/media/route.ts` no longer calls `child_process.spawnSync` directly and instead uses `runSshJson`.

## Idempotence and Recovery

This is a refactor with targeted tests. If a regression is found:

1. Revert the media route changes back to the direct `spawnSync` path.
2. Keep the `runSshJson maxBuffer` change only if tests still pass and it is demonstrably safe for existing users.

## Artifacts and Notes

Capture at completion:

1. The `rg` output proving the media route no longer contains `spawnSync`.
2. The test names and a short expected `npm test` transcript excerpt.

Artifacts captured:

1. `rg -n "spawnSync\\(" src/app/api/gateway/media/route.ts` produces no matches.
2. New/updated tests:
   - `tests/unit/runSshJson.test.ts` (`forwards maxBuffer to spawnSync when provided`)
   - `tests/unit/gatewayMediaRoute.test.ts` (`returns binary image data when reading remote media over ssh`)
   `npm test` summary: `105 passed`, `467 passed`.

## Interfaces and Dependencies

At the end of the plan:

- `runSshJson` in `src/lib/ssh/gateway-host.ts` accepts `maxBuffer?: number` and forwards it to `child_process.spawnSync`.
- `src/app/api/gateway/media/route.ts` uses `runSshJson` for remote media fetching.

Plan revision notes:

- 2026-02-15: Updated progress to reflect completion and adjusted `maxBuffer` discovery wording after moving the plan to `.agent/done/`.
