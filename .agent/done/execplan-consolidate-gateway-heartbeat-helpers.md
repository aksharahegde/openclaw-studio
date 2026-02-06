# Consolidate Gateway Heartbeat Helpers Into `src/lib/gateway/agentConfig.ts`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan format requirements live at `.agent/PLANS.md` from the repository root. This document must be maintained in accordance with that file.

## Purpose / Big Picture

OpenClaw Studio’s “Agent settings” UI shows heartbeat state and lets the user trigger a heartbeat or remove an override. Today, heartbeat logic is split across two modules:

- `src/lib/gateway/agentConfig.ts` contains heartbeat normalization and gateway `config.patch` mutation helpers.
- `src/lib/heartbeat/gateway.ts` contains heartbeat list/wake helpers that combine `config.get` and `status`, plus it defines the public heartbeat types used by the UI.

This split increases cognitive load because “heartbeat” is both a gateway concern and an agent-config concern, but the implementation lives in two different library directories. After this change, heartbeat types and gateway helpers will live in one place (`src/lib/gateway/agentConfig.ts`), and `src/lib/heartbeat/gateway.ts` will be removed. The user-visible behavior should not change.

You can see this working by running the test suite and by starting the app (`npm run dev`) and confirming the Agent Settings panel still renders heartbeat rows and the “run now” / “delete override” actions still call the same gateway methods.

## Progress

- [x] (2026-02-06 16:36Z) Add characterization tests for heartbeat resolution and list behavior.
- [x] (2026-02-06 16:39Z) Move heartbeat public types + gateway helpers into `src/lib/gateway/agentConfig.ts` and update imports.
- [x] (2026-02-06 16:40Z) Remove `src/lib/heartbeat/gateway.ts`, update `ARCHITECTURE.md` references, and ensure the repo still builds/tests cleanly.

## Surprises & Discoveries

- Observation: `npm run test` initially failed with `vitest: command not found` because dependencies were not installed in this worktree.
  Evidence: running `npm install` installed dependencies and unblocked tests.
- Observation: Vitest is configured to only include `tests/unit/**/*.test.ts`, so characterization tests must live under `tests/unit/` to be executed.
  Evidence: `vitest.config.ts` sets `include: ["tests/unit/**/*.test.ts"]`.
- Observation: `next build` auto-edited `tsconfig.json` to include `.next` type paths (and reformatted the JSON).
  Evidence: `npm run build` printed the tsconfig reconfiguration message and `git diff tsconfig.json` shows `.next/types/**/*.ts` and `.next/dev/types/**/*.ts` added to `include`.

## Decision Log

- Decision: Consolidate heartbeat gateway helpers into `src/lib/gateway/agentConfig.ts` and delete `src/lib/heartbeat/gateway.ts`.
  Rationale: Heartbeat behavior is already partially implemented in `src/lib/gateway/agentConfig.ts` (`resolveHeartbeatSettings`, `updateGatewayHeartbeat`, `removeGatewayHeartbeatOverride`). Keeping the remaining heartbeat surface area in a separate `src/lib/heartbeat` module creates an unnecessary “two places to look” tax and a type-only cross-module dependency.
  Date/Author: 2026-02-06 / Codex

## Outcomes & Retrospective

- Outcome: Heartbeat types and gateway helpers (`listHeartbeatsForAgent`, `triggerHeartbeatNow`) now live in `src/lib/gateway/agentConfig.ts` alongside heartbeat config normalization and mutation helpers. The legacy module `src/lib/heartbeat/gateway.ts` was removed.
- Outcome: Added characterization coverage in `tests/unit/heartbeatAgentConfig.test.ts` and updated existing call sites/imports to use `@/lib/gateway/agentConfig`.
- Verification: `npm run lint`, `npm run test`, `npm run typecheck`, and `npm run build` succeed after the refactor.

## Context and Orientation

Key files involved:

- `src/app/page.tsx` is the main client page and owns the settings sidebar state. It loads heartbeats for the focused settings agent via `listHeartbeatsForAgent` and triggers heartbeats via `triggerHeartbeatNow`. It also deletes heartbeat overrides via `removeGatewayHeartbeatOverride` (already in `src/lib/gateway/agentConfig.ts`).
- `src/features/agents/components/AgentInspectPanels.tsx` renders the settings UI and uses the `AgentHeartbeatSummary` type to display heartbeat rows.
- `src/lib/heartbeat/gateway.ts` currently defines the public heartbeat types (`AgentHeartbeat*`, `AgentHeartbeatSummary`, `HeartbeatListResult`, `HeartbeatWakeResult`) and gateway helpers (`listHeartbeatsForAgent`, `triggerHeartbeatNow`). It depends on `resolveHeartbeatSettings` from `src/lib/gateway/agentConfig.ts`.
- `src/lib/gateway/agentConfig.ts` currently defines heartbeat normalization (`resolveHeartbeatSettings`), config mutations (`updateGatewayHeartbeat`, `removeGatewayHeartbeatOverride`), and agent CRUD mutations (`createGatewayAgent`, `renameGatewayAgent`, `deleteGatewayAgent`). It currently imports the heartbeat types from `src/lib/heartbeat/gateway.ts` as type-only imports.

After the refactor, `src/lib/gateway/agentConfig.ts` will be the only “heartbeat gateway + config” module. Call sites should import heartbeat types and helpers from `@/lib/gateway/agentConfig`.

## Plan of Work

First, add tests that lock down the current behavior of heartbeat resolution and listing. These are “characterization” tests: they describe what the code does today and should keep passing after the refactor, preventing accidental behavior changes while moving code around.

Then, move the type definitions and the two gateway-facing heartbeat helpers (`listHeartbeatsForAgent`, `triggerHeartbeatNow`) into `src/lib/gateway/agentConfig.ts`. Remove the now-unnecessary type-only import of heartbeat types in `src/lib/gateway/agentConfig.ts`, and update all imports that point at `@/lib/heartbeat/gateway` to use `@/lib/gateway/agentConfig` instead.

Finally, delete `src/lib/heartbeat/gateway.ts`, update `ARCHITECTURE.md` so it no longer references the removed module, and run the full set of repo quality gates (tests, typecheck, lint).

## Concrete Steps

All commands below assume the working directory is the repo root: `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio`.

1. Add characterization tests.

   Create `src/lib/gateway/agentConfig.heartbeat.test.ts` with Vitest tests for:
   - `resolveHeartbeatSettings(config, agentId)` merging defaults and per-agent overrides.
   - `listHeartbeatsForAgent(client, agentId)` behavior when:
     - `status` says heartbeats are disabled and there is no override (expect `[]`).
     - `status` says enabled and there is no override (expect one entry with `source: "default"`).
     - there is an override in config (expect `source: "override"`).
     - `status` has an `every` string (expect it to override the schedule in the returned `heartbeat`).

   Implement the `listHeartbeatsForAgent` tests using a minimal fake `client` object with a `call(method, params)` function that returns deterministic snapshots for `config.get`, `status`, and `wake`. In TypeScript tests, it is acceptable to cast this fake object to `unknown as GatewayClient` to satisfy the type system.

   Run:

     npm run test

   The tests should pass before the refactor begins. If they do not, fix the tests (not production code) until they accurately capture current behavior.

2. Consolidate heartbeat exports into `src/lib/gateway/agentConfig.ts`.

   In `src/lib/gateway/agentConfig.ts`:
   - Move in the type exports currently defined in `src/lib/heartbeat/gateway.ts`:
     - `AgentHeartbeatActiveHours`
     - `AgentHeartbeat`
     - `AgentHeartbeatResult`
     - `AgentHeartbeatUpdatePayload`
     - `AgentHeartbeatSummary`
     - `HeartbeatListResult`
     - `HeartbeatWakeResult`
   - Move in the function exports:
     - `listHeartbeatsForAgent(client, agentId)`
     - `triggerHeartbeatNow(client, agentId)`
   - Delete the type-only import from `@/lib/heartbeat/gateway` since the types will now be local.
   - Keep `resolveHeartbeatSettings`, `updateGatewayHeartbeat`, and `removeGatewayHeartbeatOverride` behavior identical.

   Update imports:
   - In `src/app/page.tsx`, change the heartbeat imports to come from `@/lib/gateway/agentConfig`.
   - In `src/features/agents/components/AgentInspectPanels.tsx`, change the `AgentHeartbeatSummary` type import to come from `@/lib/gateway/agentConfig`.

   Run:

     npm run typecheck

   Fix any type errors caused by the move (they should be mostly import path updates).

3. Remove the old module and update docs.

   Delete `src/lib/heartbeat/gateway.ts`.

   Update `ARCHITECTURE.md`:
   - Replace references to `src/lib/heartbeat/gateway.ts` with `src/lib/gateway/agentConfig.ts` in the “Heartbeat helpers” section.
   - Ensure the description still accurately reflects what the module does (config-derived heartbeat settings plus status/wake integration).

   Run the full gates:

     npm run lint
     npm run test
     npm run typecheck
     npm run build

   Commit the change as one atomic refactor commit after all commands pass.

## Validation and Acceptance

Acceptance criteria:

- There is no longer any import of `@/lib/heartbeat/gateway` anywhere under `src/`.
- `src/lib/heartbeat/gateway.ts` is removed, and heartbeat gateway helpers/types are exported from `src/lib/gateway/agentConfig.ts`.
- `npm run lint`, `npm run test`, `npm run typecheck`, and `npm run build` all succeed.

Optional manual validation (when a gateway is available):

- Run `npm run dev`, open `http://localhost:3000`, connect to a gateway, open an agent’s Settings panel, and confirm heartbeat rows still render when enabled or overridden. Then click “Run now” and confirm it triggers a `wake` call and the list refreshes. Finally, click “Delete override” and confirm the override is removed and the list refreshes.

## Idempotence and Recovery

This is a refactor with no intended behavior changes. It should be safe to retry.

If the refactor gets stuck mid-way (for example, due to import cycles or failing tests), revert to a passing state by:

- restoring `src/lib/heartbeat/gateway.ts` from git, and
- undoing the import path changes in `src/app/page.tsx` and `src/features/agents/components/AgentInspectPanels.tsx`.

Then re-apply the consolidation in smaller edits until tests pass again.

## Artifacts and Notes

- None yet.

## Interfaces and Dependencies

At the end of this refactor, `src/lib/gateway/agentConfig.ts` must export the heartbeat surface area currently split across two modules:

- Types: `AgentHeartbeatActiveHours`, `AgentHeartbeat`, `AgentHeartbeatResult`, `AgentHeartbeatUpdatePayload`, `AgentHeartbeatSummary`, `HeartbeatListResult`, `HeartbeatWakeResult`
- Functions: `resolveHeartbeatSettings(config, agentId)`, `listHeartbeatsForAgent(client, agentId)`, `triggerHeartbeatNow(client, agentId)`, `updateGatewayHeartbeat({ client, agentId, payload, sessionKey? })`, `removeGatewayHeartbeatOverride({ client, agentId, sessionKey? })`

The exported names should remain the same to keep UI call sites simple; only the module path should change.
