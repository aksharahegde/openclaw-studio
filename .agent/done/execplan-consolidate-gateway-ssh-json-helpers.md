# Consolidate SSH JSON Helpers Used For Remote Gateway Operations

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository has an ExecPlan format and requirements documented at `.agent/PLANS.md` (from the repository root). This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

OpenClaw Studio has two separate places that run commands over SSH and parse JSON output:

1. Beads task control plane runner in `src/lib/task-control-plane/br-runner.ts` (runs `br ... --json` locally or on the gateway host over SSH).
2. Agent state trash/restore route in `src/app/api/gateway/agent-state/route.ts` (runs a bash script over SSH that prints JSON).

Both re-implement the same key behaviors: how to derive the SSH target from env vars or Studio settings, and how to extract actionable error messages from JSON-ish stdout/stderr. Keeping this duplicated increases bug surface area and makes remote behavior drift between features.

After this change, there will be a single shared server-side helper for:

- Resolving the gateway SSH target (`OPENCLAW_TASK_CONTROL_PLANE_SSH_TARGET` / `OPENCLAW_TASK_CONTROL_PLANE_SSH_USER` or derived from Studio settings gateway URL).
- Extracting an error string from command output when the output is JSON with `{ error }` or `{ error: { message } }`.
- Parsing and validating JSON output consistently.

This reduces conceptual surface area for “remote gateway host command execution” and makes future remote features reuse the same hardening.

## Progress

- [x] (2026-02-08) Add a shared server-only helper module for SSH target resolution + JSON output/error parsing.
- [x] (2026-02-08) Migrate `src/lib/task-control-plane/br-runner.ts` to use the shared helper and delete duplicated code.
- [x] (2026-02-08) Migrate `src/app/api/gateway/agent-state/route.ts` to use the shared helper and delete duplicated code.
- [x] (2026-02-08) Run `npm run test`, `npm run typecheck`, and `npm run lint`.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Consolidate SSH target resolution and JSON output/error parsing into a single shared helper under `src/lib`.
  Rationale: The same logic currently exists in `src/lib/task-control-plane/br-runner.ts` and `src/app/api/gateway/agent-state/route.ts` (e.g. `resolveSshTarget`, `extractErrorMessage`, JSON parsing), which can drift and cause inconsistent remote behavior.
  Date/Author: 2026-02-08 / Codex

## Outcomes & Retrospective

- Consolidated gateway-host SSH target resolution and JSON output/error parsing into `src/lib/ssh/gateway-host.ts`.
- Removed duplicated implementations from `src/lib/task-control-plane/br-runner.ts` and `src/app/api/gateway/agent-state/route.ts`.
- Validation: `npm run test`, `npm run typecheck`, and `npm run lint` all passed.

Note: Milestone 4 was verification-only (no code changes), so there was no additional commit for that milestone.

## Context and Orientation

Relevant code:

- `src/lib/task-control-plane/br-runner.ts` is the only place that runs `br ... --json`, and it supports both local execution and remote execution over SSH based on env vars like `OPENCLAW_TASK_CONTROL_PLANE_GATEWAY_BEADS_DIR`. When remote, it needs a stable SSH target to the gateway host and it needs to parse JSON output or actionable errors from stdout/stderr.
- `src/app/api/gateway/agent-state/route.ts` is an API route that trashes/restores agent state on the gateway host by running a bash script over SSH. It also needs the same SSH target derivation and the same JSON/error parsing.
- Both currently use `loadStudioSettings` from `src/lib/studio/settings-store.ts` to read the configured gateway URL when the SSH target is not explicitly set via env vars.

Tests that should protect this refactor:

- `tests/unit/agentStateRoute.test.ts` asserts the SSH arguments include the derived `ubuntu@<hostname>` based on the Studio settings gateway URL.
- Task control plane tests (for example `tests/unit/taskControlPlaneRoute.test.ts`) exercise the Beads routes that depend on `createTaskControlPlaneBrRunner()`.

## Plan of Work

### Milestone 1: Add A Shared SSH/JSON Helper Module

At the end of this milestone, a single shared helper exists for:

- Resolving the SSH target used for gateway-host operations.
- Extracting error strings from JSON-ish command output.
- Parsing JSON output with consistent empty/invalid handling.

1. Add a new file `src/lib/ssh/gateway-host.ts` (server-only by usage; do not import it from client components). It should export:

   - `resolveGatewaySshTarget(env?: NodeJS.ProcessEnv): string`
     This must preserve existing behavior:
       - Uses `OPENCLAW_TASK_CONTROL_PLANE_SSH_TARGET` if set; if it includes `@`, return it as-is.
       - Otherwise, if `OPENCLAW_TASK_CONTROL_PLANE_SSH_USER` is set, combine them as `<user>@<target>`.
       - If no explicit target env var is set, read Studio settings via `loadStudioSettings()` and derive the hostname from `settings.gateway.url` (via `new URL(gatewayUrl).hostname`). Default user is `ubuntu` unless `OPENCLAW_TASK_CONTROL_PLANE_SSH_USER` is set.
       - Fail fast with actionable errors on missing/invalid gateway URL (same message semantics as today).

   - `extractJsonErrorMessage(value: string): string | null`
     Match existing semantics from both call sites: if the trimmed value is JSON with `error: string` or `error: { message: string }`, return that message.

   - `parseJsonOutput(raw: string, label: string): unknown`
     Fail fast on empty output and invalid JSON, with messages that include `label` so logs stay actionable.

2. Do not change any of the public API route shapes in this milestone; only add the helper module.

Verification for this milestone:

- Run `npm run test -- tests/unit/agentStateRoute.test.ts` and expect it to pass (this test will be updated in later milestones, but it should still pass after adding a new module).

Commit after verification with message: `Milestone 1: Add shared gateway SSH helpers`.

### Milestone 2: Update Beads Br Runner To Use Shared Helpers

At the end of this milestone, `src/lib/task-control-plane/br-runner.ts` no longer defines its own `extractErrorMessage` or `resolveSshTarget`, and instead imports from `src/lib/ssh/gateway-host.ts`.

1. In `src/lib/task-control-plane/br-runner.ts`:

   - Replace its local `extractErrorMessage` with `extractJsonErrorMessage`.
   - Replace its local `resolveSshTarget` with `resolveGatewaySshTarget`.
   - Keep the rest of the code structure (local vs SSH execution) the same to minimize risk.

2. Ensure error messages are not silently changed in a way that breaks existing tests. Preserve the existing `isBeadsWorkspaceError` behavior.

Verification:

- Run `npm run test -- tests/unit/taskControlPlaneRoute.test.ts` and `npm run test -- tests/unit/taskControlPlaneShowRoute.test.ts` and `npm run test -- tests/unit/taskControlPlanePriorityRoute.test.ts`.

Commit after verification with message: `Milestone 2: Reuse shared SSH helpers in br runner`.

### Milestone 3: Update Agent State Route To Use Shared Helpers

At the end of this milestone, `src/app/api/gateway/agent-state/route.ts` no longer defines duplicated `extractErrorMessage`, `parseJsonOutput`, or `resolveSshTarget`, and instead imports from `src/lib/ssh/gateway-host.ts`.

1. In `src/app/api/gateway/agent-state/route.ts`:

   - Replace `extractErrorMessage` with `extractJsonErrorMessage`.
   - Replace `parseJsonOutput` with the shared `parseJsonOutput`.
   - Replace `resolveSshTarget` with `resolveGatewaySshTarget`.

2. Keep all request validation behavior the same (payload checks, `agentId` validation, required fields).

Verification:

- Run `npm run test -- tests/unit/agentStateRoute.test.ts` and expect it to pass.

Commit after verification with message: `Milestone 3: Reuse shared SSH helpers in agent state route`.

### Milestone 4: Full Validation Sweep

1. Run unit tests:

   - `npm run test`

2. Run typecheck:

   - `npm run typecheck`

3. Run lint:

   - `npm run lint`

Acceptance is satisfied when all three commands exit 0 and `rg -n "resolveSshTarget|extractErrorMessage" src` shows only the shared helper implementations (no duplicated versions remain in feature files).

Commit after verification with message: `Milestone 4: Validate SSH helper consolidation`.

## Concrete Steps

All commands should be run from the repository root:

  cd /Users/georgepickett/openclaw-studio

Suggested implementation order:

1. Create `src/lib/ssh/gateway-host.ts`.
2. Update `src/lib/task-control-plane/br-runner.ts` to import and use the shared functions.
3. Update `src/app/api/gateway/agent-state/route.ts` to import and use the shared functions.
4. Run:

   npm run test
   npm run typecheck
   npm run lint

## Validation and Acceptance

The change is accepted when:

1. `npm run test` passes.
2. `npm run typecheck` passes.
3. `npm run lint` passes.
4. There is a single source of truth for:
   - Deriving the gateway SSH target from env vars or Studio settings.
   - Extracting JSON-ish `{ error }` messages from stdout/stderr.
   - Parsing JSON output with consistent empty/invalid handling.

## Idempotence and Recovery

This refactor is safe to retry because it is code-only. If any test failures occur due to error message string mismatches, prefer preserving existing error messages exactly at the call sites rather than inventing new fallbacks.

If the shared helper accidentally becomes imported into client code, move it under a clearly server-only namespace (for example `src/lib/server/...`) and update imports, but do not introduce additional abstraction layers beyond what is necessary to remove duplication.

## Artifacts and Notes

Key files:

- `src/lib/task-control-plane/br-runner.ts`
- `src/app/api/gateway/agent-state/route.ts`
- `src/lib/studio/settings-store.ts`
- `tests/unit/agentStateRoute.test.ts`
- `tests/unit/taskControlPlaneRoute.test.ts`
