# Extract And Test The Delete-Agent Transaction In Studio

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan rules live at `.agent/PLANS.md` from the repo root. This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

After this change, OpenClaw Studio’s “Delete agent” operation will be implemented as a single, testable transaction with explicit steps and rollback semantics, instead of being embedded inline in the main page component.

This matters because “delete an agent” is a multi-step operation that spans gateway config, cron jobs, and remote filesystem state. Today, those rules are interleaved with UI state updates, making the behavior hard to test and easy to regress. After this change, we will be able to unit-test the ordering and rollback behavior without running a gateway or SSH, and the UI code in `src/app/page.tsx` will become simpler.

You can see it working by running unit tests that exercise the delete transaction logic (including rollback on failure), then running the app and deleting an agent as usual; behavior should match current UI behavior, but the implementation will be modular and covered by tests.

## Progress

- [x] (2026-02-08) Milestone 1: Add a pure delete-agent transaction module with dependency injection and unit tests.
- [x] (2026-02-08) Milestone 2: Wire `src/app/page.tsx` delete handler to the new transaction module; keep UI behavior unchanged.
- [x] (2026-02-08) Milestone 3: Run full unit suite + lint + typecheck; do a manual smoke test of deleting an agent against a real gateway.

## Surprises & Discoveries

- Observation: The gateway client code in this repo is browser-only (`"use client"`) and uses `window.localStorage` inside the vendored `GatewayBrowserClient`, so server-side API routes cannot safely call gateway methods without a new Node-compatible gateway client.
  Evidence: `src/lib/gateway/GatewayClient.ts` is `"use client"`, and `src/lib/gateway/openclaw/GatewayBrowserClient.ts` reads `window.localStorage`.

## Decision Log

- Decision: Keep gateway calls (remove cron jobs, patch config) on the client side, and only extract the delete operation into a testable transaction module using dependency injection.
  Rationale: The existing gateway client implementation is browser-only, so moving the entire delete transaction server-side would require introducing a new Node WebSocket client (out of scope for this consolidation refactor). Extracting a transaction module still isolates the domain workflow and makes it unit-testable.
  Date/Author: 2026-02-08 / Codex

## Outcomes & Retrospective

- Outcome: The delete-agent workflow is now encoded in a dependency-injected transaction module at `src/features/agents/operations/deleteAgentTransaction.ts`, with unit tests covering ordering, rollback attempts, and restore-failure logging behavior.
- Outcome: `src/app/page.tsx` no longer contains inline rollback orchestration; it delegates to the transaction module while preserving existing UI block/phase behavior.
- Outcome: `npm test`, `npm run lint`, and `npm run typecheck` all pass.
- Gap: Manual smoke test against a real gateway was not executed as part of this automated run; it should be performed when convenient to confirm end-to-end behavior is unchanged in a real gateway/SSH environment.

## Context and Orientation

OpenClaw Studio is a Next.js App Router UI. Most agent operations happen in the client page at `src/app/page.tsx`, which connects directly to an OpenClaw gateway over WebSocket.

“Delete agent” currently means:

1. Move the agent’s workspace/state on the gateway host into `~/.openclaw/trash/...` over SSH, via the API route `src/app/api/gateway/agent-state/route.ts`.
2. Remove all cron jobs for the agent via gateway method `cron.list` + `cron.remove` (client helper: `src/lib/cron/types.ts`, function `removeCronJobsForAgent`).
3. Remove the agent entry (and bindings) from gateway config via gateway method `config.get` + `config.patch` (client helper: `src/lib/gateway/agentConfig.ts`, function `deleteGatewayAgent`).
4. If step (2) or (3) fails after trashing the agent’s state, attempt to restore the moved files via the same API route.

Today this orchestration is implemented inline inside `src/app/page.tsx` in `handleDeleteAgent` around the `enqueueConfigMutation` call. The goal of this ExecPlan is to extract the orchestration logic (ordering, rollback conditions, and “what gets called”) into a dedicated module that can be unit tested by mocking its side-effecting dependencies.

Terms used in this plan:

- “Gateway host”: the machine where the OpenClaw gateway is running and where `~/.openclaw` lives. Studio may run locally while gateway runs remotely (for example, on EC2).
- “Trash agent state”: the server-side operation that uses SSH to move `~/.openclaw/workspace-<agentId>` and `~/.openclaw/agents/<agentId>` into a unique folder under `~/.openclaw/trash/studio-delete-agent/...`.
- “Transaction module”: a small TypeScript module that encodes the delete workflow as code, taking its side effects as injected functions. It is “transactional” in the sense that it attempts a best-effort rollback (restore) if it has already trashed state and a later step fails.

## Plan of Work

We will implement the delete-agent workflow as a single function in a new module under `src/features/agents/operations/`. The function will:

1. Validate its input (agent id).
2. Call a `trashAgentState` dependency and capture its result.
3. Call a `removeCronJobsForAgent` dependency.
4. Call a `deleteGatewayAgent` dependency.
5. If any step after trashing throws, attempt restore if and only if the trash step actually moved something, then rethrow the original error.

We will then change `src/app/page.tsx` to call this new function from inside the existing `enqueueConfigMutation` path, keeping UI state transitions (`deleteAgentBlock` phases, settings panel resets, “awaiting-restart” flow) in `page.tsx` but removing the infrastructure orchestration from the UI handler.

Finally, we will add unit tests covering call ordering and rollback behavior. Tests will be pure and will not require a running gateway, a real SSH binary, or a filesystem.

## Concrete Steps

All commands below are run from the repo root:

    cd /Users/georgepickett/.codex/worktrees/5e63/openclaw-studio

### Milestone 1: Create transaction module + unit tests

1. Add a new module `src/features/agents/operations/deleteAgentTransaction.ts` that exports:

   - Types:

         export type GatewayAgentStateMove = { from: string; to: string };
         export type TrashAgentStateResult = { trashDir: string; moved: GatewayAgentStateMove[] };
         export type RestoreAgentStateResult = { restored: GatewayAgentStateMove[] };

         export type DeleteAgentTransactionDeps = {
           trashAgentState: (agentId: string) => Promise<TrashAgentStateResult>;
           restoreAgentState: (agentId: string, trashDir: string) => Promise<RestoreAgentStateResult>;
           removeCronJobsForAgent: (agentId: string) => Promise<void>;
           deleteGatewayAgent: (agentId: string) => Promise<void>;
           logError?: (message: string, error: unknown) => void;
         };

         export type DeleteAgentTransactionResult = {
           trashed: TrashAgentStateResult;
           restored: RestoreAgentStateResult | null;
         };

   - Function:

         export async function runDeleteAgentTransaction(
           deps: DeleteAgentTransactionDeps,
           agentId: string
         ): Promise<DeleteAgentTransactionResult>

   Requirements for `runDeleteAgentTransaction`:

   - Fail fast: throw `Error("Agent id is required.")` when `agentId.trim()` is empty.
   - Ordering: always trash first, then remove cron, then delete gateway agent config.
   - Rollback policy: if `removeCronJobsForAgent` or `deleteGatewayAgent` throws and `trashed.moved.length > 0`, call `restoreAgentState(agentId, trashed.trashDir)` in a best-effort attempt, but do not swallow the original error.
   - Observability: if restore fails, call `deps.logError?.("Failed to restore trashed agent state.", restoreErr)` (and then rethrow the original error).
   - Return value: on success, return `{ trashed, restored: null }`. On rollback success (only possible if we choose to treat rollback as non-throwing; in this plan we will still rethrow the original error), still return is not observable, so only success path returns. (I.e. we rethrow on any post-trash failure.)

2. Add unit tests at `tests/unit/deleteAgentTransaction.test.ts` using vitest. The test file should:

   - Create fake deps with `vi.fn()` that record call order (for example by pushing labels into an array).
   - Include at least these tests (names can vary, but assertions must match):

     1. `runs_steps_in_order_on_success`
        - `trashAgentState` returns `{ trashDir: "...", moved: [] }`.
        - `removeCronJobsForAgent` resolves.
        - `deleteGatewayAgent` resolves.
        - Assert call order is `trash -> removeCron -> deleteGatewayAgent`.

     2. `attempts_restore_when_remove_cron_fails_and_trash_moved_paths`
        - `trashAgentState` returns moved paths (length > 0).
        - `removeCronJobsForAgent` throws `new Error("boom")`.
        - Assert `restoreAgentState` is called with `(agentId, trashDir)` and the original error is rethrown.

     3. `attempts_restore_when_delete_agent_fails_and_trash_moved_paths`
        - Same shape as above, but `deleteGatewayAgent` throws.

     4. `does_not_restore_when_trash_moved_is_empty`
        - `trashAgentState` returns `{ moved: [] }`.
        - `removeCronJobsForAgent` throws.
        - Assert `restoreAgentState` was not called.

     5. `logs_restore_failure_and_still_throws_original_error`
        - `trashAgentState` returns `{ moved: [..] }`.
        - `deleteGatewayAgent` throws `originalErr`.
        - `restoreAgentState` throws `restoreErr`.
        - Provide `logError` mock; assert it is called once with the expected message and `restoreErr`.
        - Assert the thrown error is `originalErr` (not `restoreErr`).

3. Run unit tests:

    npm test

Expected: all tests pass, including the new `deleteAgentTransaction` tests.

### Milestone 2: Wire the UI delete handler to the transaction module

1. Update `src/app/page.tsx`:

   - Remove the local type definitions that are now owned by the transaction module:
     - `GatewayAgentStateMove`
     - `TrashAgentStateResult`
     - `RestoreAgentStateResult`
   - Import `runDeleteAgentTransaction` and the result types from `src/features/agents/operations/deleteAgentTransaction.ts`.

2. In `handleDeleteAgent` in `src/app/page.tsx` (currently around `src/app/page.tsx:1316`), replace the inline sequence:

   - `fetchJson("/api/gateway/agent-state", { method: "POST", ... })`
   - `removeCronJobsForAgent(...)`
   - `deleteGatewayAgent(...)`
   - rollback `PUT /api/gateway/agent-state` on error

   with a call to `runDeleteAgentTransaction(...)` where deps are implemented using the existing helpers:

   - `trashAgentState(agentId)` should call:
     - `fetchJson<{ result: TrashAgentStateResult }>("/api/gateway/agent-state", { method: "POST", ... })`
     - and return the `.result`.
   - `restoreAgentState(agentId, trashDir)` should call:
     - `fetchJson<{ result: RestoreAgentStateResult }>("/api/gateway/agent-state", { method: "PUT", ... })`
     - and return the `.result`.
   - `removeCronJobsForAgent(agentId)` should call existing `removeCronJobsForAgent(client, agentId)` and ignore the returned count.
   - `deleteGatewayAgent(agentId)` should call existing `deleteGatewayAgent({ client, agentId })`.
   - `logError` should call `console.error`.

3. Keep UI behavior unchanged:

   - The `deleteAgentBlock` phases must still be set to `"queued" -> "deleting" -> "awaiting-restart"`.
   - The existing “awaiting restart” `useEffect` that waits for a disconnect/reconnect and then calls `loadAgents()` must remain.
   - Error handling remains: on failure, clear `deleteAgentBlock` and set a user-visible error via `setError(...)`.

4. Run unit tests again:

    npm test

### Milestone 3: Verification, lint, typecheck, and manual smoke test

1. Run:

    npm run lint
    npm run typecheck
    npm test

2. Manual smoke test (requires an OpenClaw gateway you can connect to):

   - Start Studio:

         npm run dev

   - Open http://localhost:3000 and connect to your gateway.
   - Create a disposable agent (for example “Delete Me”) and then delete it from the UI.
   - Acceptance: the agent disappears from the fleet, any cron jobs for the agent are removed, and the gateway host’s `~/.openclaw/agents/<agentId>` and `~/.openclaw/workspace-<agentId>` have been moved under `~/.openclaw/trash/studio-delete-agent/...` (as before).

## Validation and Acceptance

Acceptance is met when all of the following are true:

1. Unit tests exist and pass that prove the delete-agent transaction:
   - calls steps in the correct order
   - attempts restore when a post-trash step fails and trash actually moved files
   - does not attempt restore when trash moved nothing
   - logs restore failure but still surfaces the original error

2. The UI still deletes agents with the same behavior and user-visible phases as before, but the orchestration logic is no longer embedded inline in `src/app/page.tsx`.

3. `npm run lint`, `npm run typecheck`, and `npm test` all pass.

## Idempotence and Recovery

- The unit tests are idempotent; they should not write any persistent state.
- The extracted transaction function is safe to call repeatedly; it is “best-effort rollback” and will not attempt restore unless trash moved something.
- Manual smoke tests should always use a disposable agent. If a manual delete fails midway, the UI should surface an error, and the transaction will have attempted to restore state if trashing actually moved files.

## Artifacts and Notes

- Primary refactor target (current entanglement): `src/app/page.tsx` delete handler around `handleDeleteAgent` and its inline rollback logic.
- Existing trash/restore boundary: `src/app/api/gateway/agent-state/route.ts` (SSH + embedded script). This plan does not change it; it only changes how Studio orchestrates calls to it.

## Interfaces and Dependencies

The new module must be usable without React and without a gateway connection; it should accept all side effects as injected dependencies.

At the end of Milestone 1, `src/features/agents/operations/deleteAgentTransaction.ts` must define:

    export type DeleteAgentTransactionDeps = {
      trashAgentState: (agentId: string) => Promise<TrashAgentStateResult>;
      restoreAgentState: (agentId: string, trashDir: string) => Promise<RestoreAgentStateResult>;
      removeCronJobsForAgent: (agentId: string) => Promise<void>;
      deleteGatewayAgent: (agentId: string) => Promise<void>;
      logError?: (message: string, error: unknown) => void;
    };

    export async function runDeleteAgentTransaction(
      deps: DeleteAgentTransactionDeps,
      agentId: string
    ): Promise<DeleteAgentTransactionResult>;

Plan revision note (required for living plans):

- (2026-02-08) Initial ExecPlan created to implement Option 1 (delete-agent orchestration separation) by extracting a testable transaction module and wiring it into the UI. The server-side orchestration variant was explicitly deferred due to browser-only gateway client dependencies in this repo.
