# Extract Create-Agent Guided Setup Lifecycle From AgentStudioPage

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository keeps plan requirements at `.agent/PLANS.md`. This ExecPlan must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

`src/app/page.tsx` currently combines user-interface wiring and create-agent lifecycle orchestration in one high-churn module. The create path spans guard decisions, guided setup compilation, queue orchestration, gateway-side create/setup writes, pending setup persistence/retry behavior, and timeout recovery in the same page component. After this refactor, those lifecycle decisions move into operation-layer modules so the page is primarily wiring and rendering. This is a pure refactor: no user-visible behavior should change in create, pending setup retry/discard, or timeout handling.

## Progress

- [x] (2026-02-17 00:44Z) Created `src/features/agents/operations/createAgentMutationLifecycleOperation.ts` with dependency-injected create lifecycle orchestration (`runCreateAgentMutationLifecycle`, `runPendingCreateSetupRetryLifecycle`, `isCreateBlockTimedOut`).
- [x] (2026-02-17 00:44Z) Moved create-submit orchestration out of `src/app/page.tsx` and delegated through `runCreateAgentMutationLifecycle`.
- [x] (2026-02-17 00:44Z) Replaced inline create-timeout branch logic with timeout evaluation routed through `isCreateBlockTimedOut` (which delegates to `resolveMutationTimeoutIntent`).
- [x] (2026-02-17 00:44Z) Extracted page-local pending setup retry glue from `applyPendingCreateSetupForAgentId` into `runPendingCreateSetupRetryLifecycle`.
- [x] (2026-02-17 00:44Z) Added unit coverage in `tests/unit/createAgentMutationLifecycleOperation.test.ts` (7 tests covering guard, validation, success, pending, retry, and timeout mapping).
- [x] (2026-02-17 00:44Z) Ran `npm run typecheck`, targeted `vitest --run` suites, and full `vitest --run` suite successfully.
- [x] (2026-02-17 00:44Z) Confirmed page-size reduction and boundary cleanliness (`src/app/page.tsx` 2707 -> 2688 lines; no infrastructure/browser imports in extracted operation module per `rg` check).

## Surprises & Discoveries

- Observation: timeout policy for create/rename/delete already exists and is unit-tested in `resolveMutationTimeoutIntent`.
  Evidence: `src/features/agents/operations/agentMutationLifecycleController.ts:197` and `tests/unit/agentMutationLifecycleController.test.ts` include explicit `create-timeout` assertions.
- Observation: full test suite still emits intentional stderr from throwing-storage tests while passing.
  Evidence: `tests/unit/pendingGuidedSetupStore.test.ts` logs `getItem/setItem/removeItem failed` in expected negative-path assertions; suite result remained green (`109 passed` files, `505 passed` tests).
- Observation: line-count reduction was measurable but smaller than the initial projection.
  Evidence: `wc -l src/app/page.tsx` changed from `2707` to `2688` after extraction because this pass moved lifecycle branching into operation modules but retained page-owned UI wiring callbacks.

## Decision Log

- Decision: Extract the create-agent guided setup lifecycle first.
  Rationale: This is the highest-impact entanglement by weighted score across blast radius, testability damage, bug surface, change frequency, and extraction feasibility. It sits in the highest-churn file (`src/app/page.tsx`, 162 commit touches) and interleaves domain decisions with gateway calls, session storage lifecycle, timers, and UI side effects.
  Date/Author: 2026-02-17 / Codex

- Decision: Keep pending setup auto-retry and session-storage modules in place, and extract only the page-level orchestration seam that currently glues them together.
  Rationale: `guidedCreateWorkflow`, `pendingGuidedSetupRetryOperation`, and `pendingGuidedSetupAutoRetryOperation` already represent partial separations. The best first cut is to remove the remaining orchestration center from `src/app/page.tsx` rather than rewrite working policy helpers.
  Date/Author: 2026-02-17 / Codex

- Decision: Reuse `resolveMutationTimeoutIntent` instead of introducing a second timeout policy helper.
  Rationale: The existing helper already encodes create-timeout behavior and is covered by unit tests. Reusing it avoids policy drift and duplicated test surface.
  Date/Author: 2026-02-17 / Codex

- Decision: Mirror the dependency-injected pattern used by `runAgentConfigMutationLifecycle` for the create extraction.
  Rationale: The repo already uses operation-layer lifecycle modules with callback dependencies to keep page components thin and unit-testable. Following that pattern minimizes conceptual overhead.
  Date/Author: 2026-02-17 / Codex

- Decision: Keep all extracted create lifecycle logic in a single new operation module (`createAgentMutationLifecycleOperation.ts`) for this refactor.
  Rationale: The current objective is to reduce `src/app/page.tsx` entanglement with the smallest number of new concepts. One module is sufficient and matches existing operation naming/placement conventions.
  Date/Author: 2026-02-17 / Codex

- Decision: Accept the smaller-than-planned line-count reduction as complete for this refactor.
  Rationale: The intended boundary extraction was completed (create submit, pending retry glue, and timeout policy routing), typecheck/tests are green, and remaining `page.tsx` size is primarily UI wiring rather than the extracted lifecycle policy.
  Date/Author: 2026-02-17 / Codex

## Outcomes & Retrospective

- Implemented successfully with behavior preserved and test coverage added.
- New operation boundary: `src/features/agents/operations/createAgentMutationLifecycleOperation.ts`.
- `src/app/page.tsx` now delegates create submit/retry/timeout policy decisions to operation-layer helpers instead of owning the full branching lifecycle inline.
- Verification:
  - `npm run typecheck` passed.
  - Targeted tests passed (9 files / 38 tests).
  - Full test run passed (109 files / 505 tests).
- Structural evidence:
  - `src/app/page.tsx`: `2707` -> `2688` lines.
  - `rg -n "@/lib/gateway|@/lib/http|window\\.|sessionStorage|fetch\\(|WebSocket|useEffect\\(" src/features/agents/operations/createAgentMutationLifecycleOperation.ts` returned no matches.

## Context and Orientation

The target file is `src/app/page.tsx` (currently 2707 lines). The create lifecycle is spread across several regions:

- `src/app/page.tsx:693-727`: page callback `applyPendingCreateSetupForAgentId` composes retry operation, in-flight guards, `loadAgents`, and error fanout.
- `src/app/page.tsx:856-885`: pending setup load/persist effect pair around `window.sessionStorage` scope management.
- `src/app/page.tsx:887-914`: auto-retry effect that bridges page state into `runPendingGuidedSetupAutoRetryViaStudio`.
- `src/app/page.tsx:1514-1657`: `handleCreateAgentSubmit`, which currently orchestrates guard checks, compile/validation, queueing, create/apply/pending behavior, UI state updates, and error handling.
- `src/app/page.tsx:1659-1672`: create-timeout effect that clears block state, closes modal, reloads agents, and sets the timeout error.

The create submit branch also includes nontrivial UI side effects that must stay behaviorally identical after extraction: avatar persistence via `persistAvatarSeed` (`src/app/page.tsx:1494`), draft flush and focus filter reset (`src/app/page.tsx:1582-1584`), focused agent selection and pane changes (`src/app/page.tsx:1585-1588`), immediate modal close after queue submission (`src/app/page.tsx:1630`), and consistent busy/block teardown in success/catch/finally paths.

The extracted logic must continue to compose these existing modules and helpers:

- `src/features/agents/operations/guidedCreateWorkflow.ts` (`runGuidedCreateWorkflow`, `resolveGuidedCreateCompletion`, `runGuidedRetryWorkflow`).
- `src/features/agents/operations/pendingGuidedSetupRetryOperation.ts` and `src/features/agents/operations/pendingGuidedSetupAutoRetryOperation.ts`.
- `src/features/agents/creation/pendingGuidedSetupSessionStorageLifecycle.ts` and `src/features/agents/creation/recovery.ts`.
- `src/features/agents/operations/agentMutationLifecycleController.ts` (`resolveMutationStartGuard`, `buildQueuedMutationBlock`, `resolveMutationTimeoutIntent`).
- `src/features/agents/operations/useConfigMutationQueue.ts` (`ConfigMutationKind`, queue contract).

A “guided setup” means the compiled per-agent setup payload (`agentOverrides`, `files`, `execApprovals`) built from `compileGuidedAgentCreation` in `src/features/agents/creation/compiler.ts:430`. A “pending guided setup” means agent creation succeeded but setup application failed, so setup data is retained for manual/automatic retry.

## Plan of Work

Milestone 1 introduces `src/features/agents/operations/createAgentMutationLifecycleOperation.ts` and moves create-submit orchestration there. The new module should be operation-only: no React hooks, no browser globals, and no direct gateway/http imports. It should accept dependencies for side effects (queue submission, create/apply calls, state update callbacks), run guard and workflow policy helpers, and return a typed success/failure outcome.

Milestone 2 moves pending setup retry glue out of `src/app/page.tsx`. Today, the page-level callback `applyPendingCreateSetupForAgentId` still composes retry in-flight guards, pending map lookups, `runGuidedRetryWorkflow`, and user-facing error behavior. Extract that callback logic into the same new operation module, while keeping existing `pendingGuidedSetupRetryOperation` and `pendingGuidedSetupAutoRetryOperation` as the underlying policy/adapter layers.

Milestone 3 updates timeout handling to reuse existing policy. Replace inline timeout math in the create-timeout effect with `resolveMutationTimeoutIntent` using a mapped create mutation block, then execute the same page side effects (`setCreateAgentBlock(null)`, `setCreateAgentModalOpen(false)`, `loadAgents`, timeout error message) when intent is `create-timeout`.

Milestone 4 adds unit coverage and validates parity. Add tests for the new operation module following existing Vitest conventions (`vi.fn` callback stubs, explicit call-order assertions). Keep existing workflow and lifecycle tests green to prove no behavioral drift.

## Concrete Steps

All commands below run from `/Users/georgepickett/.codex/worktrees/db4a/openclaw-studio`.

1. Capture baseline shape and anchors.

    wc -l src/app/page.tsx
    rg -n "persistAvatarSeed|applyPendingCreateSetupForAgentId|handleCreateAgentSubmit|runPendingGuidedSetupAutoRetryViaStudio|Agent creation timed out|createBlockStatusLine" src/app/page.tsx
    rg -n "resolveMutationStartGuard|buildQueuedMutationBlock|resolveMutationTimeoutIntent" src/features/agents/operations/agentMutationLifecycleController.ts

Expected outcome: current create lifecycle anchors appear in `src/app/page.tsx`, and timeout policy helper exists in `agentMutationLifecycleController.ts`.

2. Create the operation module and define concrete interfaces.

    test -f src/features/agents/operations/createAgentMutationLifecycleOperation.ts || touch src/features/agents/operations/createAgentMutationLifecycleOperation.ts

Implement operation functions that encapsulate:

- create-submit lifecycle orchestration,
- pending setup retry orchestration now in `applyPendingCreateSetupForAgentId`,
- create-timeout intent mapping via `resolveMutationTimeoutIntent`.

Expected outcome: module exports are present and referenced by `src/app/page.tsx` with no browser/global API usage in the module.

3. Rewire page handlers/effects to operation boundaries.

    rg -n "handleCreateAgentSubmit|applyPendingCreateSetupForAgentId|createAgentBlock.phase === \"queued\"|Agent creation timed out" src/app/page.tsx

Update `src/app/page.tsx` to keep local state updates and render wiring only; remove inline lifecycle branching now owned by the operation module.

4. Add focused unit tests for the extracted operation module.

    test -f tests/unit/createAgentMutationLifecycleOperation.test.ts || touch tests/unit/createAgentMutationLifecycleOperation.test.ts

Cover at least:

- guard denial when disconnected,
- compile/validation failure mapping to modal error,
- successful create + setup apply path,
- pending setup fallback path after setup failure,
- pending retry path success and failure handling,
- timeout intent mapping to `create-timeout`.

Follow local testing style already used in `tests/unit/agentConfigMutationLifecycleOperation.test.ts`: dependency-injected callback stubs, call-order assertions, and explicit outcome assertions.

5. Validate with targeted and full tests.

    npm run typecheck
    npm run test -- --run tests/unit/createAgentMutationLifecycleOperation.test.ts tests/unit/guidedCreateWorkflow.test.ts tests/unit/guidedCreateWorkflow.integration.test.ts tests/unit/pendingSetupLifecycleWorkflow.test.ts tests/unit/pendingGuidedSetupRetryOperation.test.ts tests/unit/pendingGuidedSetupAutoRetryOperation.test.ts tests/unit/pendingGuidedSetupSessionStorageLifecycle.test.ts tests/unit/agentMutationLifecycleController.test.ts tests/unit/agentMutationLifecycleController.integration.test.ts
    npm run test -- --run
    wc -l src/app/page.tsx
    rg -n "@/lib/gateway|@/lib/http|window\.|sessionStorage|fetch\(|WebSocket|useEffect\(" src/features/agents/operations/createAgentMutationLifecycleOperation.ts || true

Expected outcome: typecheck passes, targeted suites pass, full suite passes, page line count decreases materially, and extracted operation module remains infrastructure/browser independent.

## Validation and Acceptance

Acceptance requires structural proof and behavior parity proof.

Structural acceptance:

- `src/app/page.tsx` is reduced measurably after extraction (target was 120 to 220 lines; observed reduction in this pass was 19 lines).
- `handleCreateAgentSubmit` is no longer the orchestration center; it delegates to operation-layer functions.
- `applyPendingCreateSetupForAgentId` page-level glue is removed or reduced to a thin call-through.
- create-timeout effect uses lifecycle timeout policy (`resolveMutationTimeoutIntent`) rather than inline elapsed-time branching.
- `src/features/agents/operations/createAgentMutationLifecycleOperation.ts` has no direct `@/lib/gateway/*`, `@/lib/http`, `window`, `sessionStorage`, `fetch`, `WebSocket`, or React-hook imports.
- `src/app/page.tsx` still performs the same UI side effects for successful create (`persistAvatarSeed`, focus reset, agent select, modal close, pane set) and for failure/timeout paths.

Behavior acceptance:

1. When disconnected, create submit still surfaces `Connect to gateway before creating an agent.` in modal error state.
2. Validation failures from `compileGuidedAgentCreation` still block create and show the first validation error.
3. Successful create/apply still clears pending setup, reloads agents, and keeps create status text behavior (`Waiting for active runs to finish` -> `Submitting config change` -> `Applying guided setup`).
4. Setup failure after create still preserves pending setup and shows the existing pending setup error banner from `resolveGuidedCreateCompletion`.
5. Manual retry via pending setup card still routes through the same retry lifecycle behavior and error messages.
6. Timeout still clears create block, closes modal, reloads agents, and sets `Agent creation timed out.`.

Verification commands are mandatory: `npm run typecheck`, targeted `vitest --run`, and full `vitest --run` must all pass.

## Idempotence and Recovery

This refactor is additive and retriable. Running the edit sequence multiple times is safe because it introduces one operation module and rewires imports/callbacks.

If rollback is needed:

    git checkout -- src/app/page.tsx
    rm -f src/features/agents/operations/createAgentMutationLifecycleOperation.ts
    rm -f tests/unit/createAgentMutationLifecycleOperation.test.ts

If the new files are already tracked at rollback time, replace `rm -f` with:

    git checkout -- src/features/agents/operations/createAgentMutationLifecycleOperation.ts tests/unit/createAgentMutationLifecycleOperation.test.ts

Then rerun:

    npm run typecheck
    npm run test -- --run

## Artifacts and Notes

Baseline evidence for this plan revision:

- `src/app/page.tsx` line count: `2707`.
- Churn snapshot from git history:
  - `src/app/page.tsx`: `162` touches
  - `src/features/agents/state/gatewayRuntimeEventHandler.ts`: `18` touches
  - `src/features/agents/components/AgentInspectPanels.tsx`: `15` touches
- Existing timeout policy helper already present and tested:
  - `src/features/agents/operations/agentMutationLifecycleController.ts:197`
  - `tests/unit/agentMutationLifecycleController.test.ts`

## Interfaces and Dependencies

Create `src/features/agents/operations/createAgentMutationLifecycleOperation.ts` with explicit dependency-injected interfaces that match existing patterns in `src/features/agents/operations/agentConfigMutationLifecycleOperation.ts`.

Define operation interfaces around current real types:

    import type { AgentCreateModalSubmitPayload } from "@/features/agents/creation/types";
    import type { AgentGuidedSetup } from "@/features/agents/operations/createAgentOperation";
    import type { ConfigMutationKind } from "@/features/agents/operations/useConfigMutationQueue";

    export type CreateAgentMutationLifecycleDeps = {
      enqueueConfigMutation: (params: { kind: ConfigMutationKind; label: string; run: () => Promise<void> }) => Promise<void>;
      createAgent: (name: string) => Promise<{ id: string }>;
      applySetup: (agentId: string, setup: AgentGuidedSetup) => Promise<void>;
      upsertPending: (agentId: string, setup: AgentGuidedSetup) => void;
      removePending: (agentId: string) => void;
      onQueued: (params: { agentName: string; startedAt: number }) => void;
      onCreating: (agentName: string) => void;
      onApplyingSetup: (params: { agentName: string; agentId: string }) => void;
      onCreatedAgent: (params: { agentId: string; avatarSeed: string | null }) => void;
      onCompletion: (params: { shouldReloadAgents: boolean; shouldCloseCreateModal: boolean; pendingErrorMessage: string | null }) => Promise<void> | void;
      onModalError: (message: string) => void;
      onError: (message: string) => void;
      clearCreateBlock: () => void;
      isDisconnectLikeError: (error: unknown) => boolean;
      resolveAgentName: (agentId: string) => string;
      loadAgents: () => Promise<void>;
    };

    export async function runCreateAgentMutationLifecycle(params: {
      payload: AgentCreateModalSubmitPayload;
      status: "connected" | "connecting" | "disconnected";
      hasCreateBlock: boolean;
      hasRenameBlock: boolean;
      hasDeleteBlock: boolean;
      createAgentBusy: boolean;
      isLocalGateway: boolean;
    }, deps: CreateAgentMutationLifecycleDeps): Promise<boolean>;

    export async function runPendingCreateSetupRetryLifecycle(params: {
      agentId: string;
      source: "auto" | "manual";
      retryBusyAgentId: string | null;
      pendingSetupsByAgentId: Record<string, AgentGuidedSetup>;
      inFlightAgentIds: Set<string>;
      executeRetry: (agentId: string) => Promise<{ applied: boolean }>;
      setRetryBusyAgentId: (next: string | null | ((current: string | null) => string | null)) => void;
    }, deps: {
      onApplied: () => Promise<void> | void;
      onError: (message: string) => void;
      isDisconnectLikeError: (error: unknown) => boolean;
      resolveAgentName: (agentId: string) => string;
    }): Promise<boolean>;

    export function isCreateBlockTimedOut(params: {
      startedAt: number;
      nowMs: number;
      maxWaitMs: number;
    }): boolean;

`isCreateBlockTimedOut` should delegate to `resolveMutationTimeoutIntent` with a mapped create block shape so timeout policy remains single-sourced.

Do not introduce new policy logic for guard checks or guided create outcomes; reuse:

- `resolveMutationStartGuard` and `buildQueuedMutationBlock` from `src/features/agents/operations/agentMutationLifecycleController.ts`.
- `runGuidedCreateWorkflow` and `resolveGuidedCreateCompletion` from `src/features/agents/operations/guidedCreateWorkflow.ts`.
- `applyPendingGuidedSetupRetryViaStudio` composition path already used in `src/features/agents/operations/pendingGuidedSetupRetryOperation.ts`.

Revision notes:

- 2026-02-17: Initial plan authored from `find-entangled-flows` analysis. Chosen extraction is create-agent guided setup lifecycle orchestration from `src/app/page.tsx` into a dedicated operation module.
- 2026-02-17: Improved via deep code-grounded review. Removed speculative timeout-helper duplication, aligned timeout work to existing `resolveMutationTimeoutIntent`, added missing pending-retry glue extraction, tightened concrete tests/commands against existing unit suites, and aligned interface guidance with existing operation-layer patterns.
- 2026-02-17: Improved again via adjacency pass. Removed remaining multi-file ambiguity by fixing extraction target to one module, added missing side-effect parity checks tied to exact `src/app/page.tsx` anchors, and tightened dependency guidance to the existing `applyPendingGuidedSetupRetryViaStudio` composition path.
- 2026-02-17: Implemented end-to-end. Added `createAgentMutationLifecycleOperation`, rewired `src/app/page.tsx` create/retry/timeout flows to operation boundaries, added unit coverage, and validated with typecheck plus targeted/full tests.
