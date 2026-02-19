# Consolidate Gateway Agent Files Get/Set Helpers

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository has an ExecPlan format and requirements documented at `.agent/PLANS.md` (from the repository root). This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

OpenClaw Studio reads and writes agent “brain files” (AGENTS.md, MEMORY.md, etc.) through the gateway methods `agents.files.get` and `agents.files.set`.

Today, two separate modules each implement their own parsing of the gateway response shape for `agents.files.get` and each call `agents.files.set` directly:

- `src/features/agents/state/useAgentFilesEditor.ts`
- `src/lib/gateway/agentFilesBootstrap.ts`

After this change, there will be one shared gateway helper module that owns:

- The request/response shape parsing for `agents.files.get`.
- The single call site for `agents.files.set`.

This reduces drift risk, makes the “gateway agent files” concept explicit, and shrinks per-feature code.

## Progress

- [ ] (2026-02-08) Add `src/lib/gateway/agentFiles.ts` with shared read/write helpers and unit tests.
- [ ] (2026-02-08) Update `src/features/agents/state/useAgentFilesEditor.ts` to use the shared helpers and delete duplicated parsing/types.
- [ ] (2026-02-08) Update `src/lib/gateway/agentFilesBootstrap.ts` to use the shared helpers and delete duplicated parsing/types.
- [ ] (2026-02-08) Run targeted tests, then `npm run test`, `npm run typecheck`, `npm run lint`.
- [ ] (2026-02-08) Move this ExecPlan to `.agent/done/` with a descriptive filename.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Introduce `src/lib/gateway/agentFiles.ts` rather than exporting helpers from `agentFilesBootstrap.ts`.
  Rationale: Bootstrapping is a feature-specific flow; the shared concept is the gateway “agent files” transport and parsing. A dedicated module keeps imports semantically clean and avoids coupling unrelated callers to “bootstrap” naming.
  Date/Author: 2026-02-08 / Codex

## Outcomes & Retrospective

- Not started yet.

## Context and Orientation

Relevant files:

- `src/features/agents/state/useAgentFilesEditor.ts` loads/saves agent files for the Brain panel UI and currently parses `agents.files.get` response records locally.
- `src/lib/gateway/agentFilesBootstrap.ts` reads template and target agent files and currently parses `agents.files.get` response records locally.
- `src/lib/agents/agentFiles.ts` defines the canonical list of agent file names (`AgentFileName`, `AGENT_FILE_NAMES`).

There are exactly two `agents.files.get` call sites today:

- `src/features/agents/state/useAgentFilesEditor.ts`
- `src/lib/gateway/agentFilesBootstrap.ts`

## Plan of Work

### Milestone 1: Add Shared Gateway Agent Files Helpers + Unit Tests

1. Add a new module `src/lib/gateway/agentFiles.ts` exporting:

   - `readGatewayAgentFile(params: { client: GatewayClient; agentId: string; name: AgentFileName }): Promise<{ exists: boolean; content: string }>`
   - `writeGatewayAgentFile(params: { client: GatewayClient; agentId: string; name: AgentFileName; content: string }): Promise<void>`

   The `readGatewayAgentFile` behavior must match current behavior:
   - Calls `client.call("agents.files.get", { agentId, name })`.
   - Treats `file.missing === true` as not existing.
   - Treats non-string `file.content` as empty string.
   - Does not introduce new fallback semantics beyond what the existing callers already implement.

   The helper should fail fast on invalid `agentId` (empty/whitespace) with an actionable error message (e.g. “agentId is required.”).

2. Add `tests/unit/gatewayAgentFiles.test.ts` that:
   - Mocks a `GatewayClient` with a `call` method and asserts:
     - Missing file (`{ file: { missing: true } }`) results in `{ exists: false, content: "" }`.
     - Existing file (`{ file: { missing: false, content: "x" } }`) results in `{ exists: true, content: "x" }`.
     - Non-string content results in empty string.
     - Empty agent id throws.

Verification:

- Run `npm run test -- tests/unit/gatewayAgentFiles.test.ts` and expect it to pass.

Commit after verification with message: `Add gateway agent files helpers`.

### Milestone 2: Migrate `useAgentFilesEditor` To Shared Helpers

1. In `src/features/agents/state/useAgentFilesEditor.ts`:
   - Remove the local `AgentsFilesGetResponse` type and any local parsing helpers.
   - Replace the `agents.files.get` call with `readGatewayAgentFile(...)`.
   - Replace the `agents.files.set` call with `writeGatewayAgentFile(...)`.
   - Keep existing UI behavior (dirty tracking, save-on-tab-change, error messages) the same.

Verification:

- Run `npm run test -- tests/unit/agentBrainPanel.test.ts` (covers Brain panel behaviors).

Commit after verification with message: `Use shared gateway agent files helpers in editor`.

### Milestone 3: Migrate `agentFilesBootstrap` To Shared Helpers

1. In `src/lib/gateway/agentFilesBootstrap.ts`:
   - Delete the local `AgentsFilesGetResponse` type, `isRecord`, and `readAgentsFilesGet`.
   - Replace reads with `readGatewayAgentFile(...)`.
   - Replace writes with `writeGatewayAgentFile(...)`.

Verification:

- Run `npm run test -- tests/unit/agentFilesBootstrap.test.ts`.

Commit after verification with message: `Use shared gateway agent files helpers in bootstrap`.

### Milestone 4: Full Validation + Drift Check

1. Run:

   npm run test
   npm run typecheck
   npm run lint

2. Drift check:

   rg -n \"agents\\.files\\.get\" src
   rg -n \"agents\\.files\\.set\" src

Expected:
- Only `src/lib/gateway/agentFiles.ts` contains `agents.files.get` and `agents.files.set` calls.

If Milestone 4 introduces no additional code changes beyond verification, do not create an extra “validation-only” commit; record the results in `Outcomes & Retrospective`.

### Milestone 5: Archive The ExecPlan

Move `.agent/execplan-pending.md` to `.agent/done/execplan-consolidate-gateway-agent-files-helpers.md` (or similarly descriptive name).

Commit the done ExecPlan file if the repository convention is to track `.agent/done/*`.

## Concrete Steps

All commands should be run from the repository root:

  cd /Users/georgepickett/openclaw-studio

Suggested command sequence:

1. `npm run test -- tests/unit/gatewayAgentFiles.test.ts`
2. `npm run test -- tests/unit/agentBrainPanel.test.ts`
3. `npm run test -- tests/unit/agentFilesBootstrap.test.ts`
4. `npm run test`
5. `npm run typecheck`
6. `npm run lint`

## Validation and Acceptance

Acceptance is satisfied when:

1. `npm run test` passes.
2. `npm run typecheck` passes.
3. `npm run lint` passes.
4. `agents.files.get` / `agents.files.set` calls exist in exactly one production module: `src/lib/gateway/agentFiles.ts`.

## Idempotence and Recovery

This is a refactor-only change. If any test relies on exact call counts or call shapes, adjust the shared helper to preserve the existing request payload shapes exactly rather than adding new wrapper behavior.

## Artifacts and Notes

Files expected to change:

- `src/lib/gateway/agentFiles.ts` (new)
- `src/features/agents/state/useAgentFilesEditor.ts`
- `src/lib/gateway/agentFilesBootstrap.ts`
- `tests/unit/gatewayAgentFiles.test.ts` (new)

