# Simplify Agent Creation To A One-Step Launch Flow

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

The source of truth for plan format in this repository is `/Users/georgepickett/.codex/worktrees/22b2/openclaw-studio/.agent/PLANS.md`, and this document must be maintained in accordance with it.

## Purpose / Big Picture

OpenClaw Studio currently requires a three-step create wizard that asks for ownership and authority before the user can launch an agent. Under the hood, that flow compiles a guided setup bundle and then performs additional post-create mutations (agent files, exec approvals, and config overrides). If setup fails, the UI enters a deferred pending-retry state. This makes the first-run creation path feel heavy and fragile.

After this change, creating an agent is a single action: open modal, set name, optionally shuffle avatar, launch. The new agent should appear immediately and become the focused chat target without any guided setup pending banner. Authority and runtime behavior remain adjustable later through existing settings controls (`onUpdateExecutionRole` in `AgentSettingsPanel` and `updateExecutionRoleViaStudio`).

## Progress

- [x] (2026-02-17 23:56Z) Audited current create flow in Studio and upstream OpenClaw create contract.
- [x] (2026-02-17 23:56Z) Created repo-local planning source at `.agent/PLANS.md` and drafted this ExecPlan.
- [x] (2026-02-18 00:12Z) Performed `execplan-improve` deep-read pass across all referenced code paths and test files.
- [x] (2026-02-18 16:18Z) Implemented one-step `AgentCreateModal` UI and create-only submit payload.
- [x] (2026-02-18 16:18Z) Simplified create mutation lifecycle to create-only behavior with `queued|creating` phases.
- [x] (2026-02-18 16:19Z) Removed pending guided setup storage/retry UX and wiring from `src/app/page.tsx`.
- [x] (2026-02-18 16:20Z) Deleted dead guided/pending runtime modules and obsolete tests; rewrote retained controller/integration tests.
- [x] (2026-02-18 16:21Z) Updated `ARCHITECTURE.md` and `docs/permissions-sandboxing.md` to match one-step create + post-create authority updates.
- [x] (2026-02-18 16:21Z) Validated with focused unit/integration tests, `npm run typecheck`, and full `npm run test`.

## Surprises & Discoveries

- Observation: upstream gateway creation is already minimal and does not require authority/persona setup.
  Evidence: `/Users/georgepickett/openclaw/src/gateway/server-methods/agents.ts` method `"agents.create"` only validates `name` and `workspace`, ensures workspace/transcripts, writes config, and appends identity lines.

- Observation: Studio complexity comes from post-create guided setup, not from creation itself.
  Evidence: `src/features/agents/operations/createAgentOperation.ts` applies files, exec approvals, and config overrides after `createGatewayAgent`; `src/app/page.tsx` maintains pending setup and retry UI.

- Observation: guided compile currently hardcodes sandbox mode off while still surfacing authority controls.
  Evidence: `src/features/agents/creation/compiler.ts` sets `normalizedSandboxMode = "off"`.

- Observation: pending setup behavior is spread beyond `page.tsx` into controller/workflow files, so deleting only page state would leave dead policy code.
  Evidence: `src/features/agents/operations/agentMutationLifecycleController.ts` imports pending setup policy and exposes `resolvePendingSetupAutoRetryIntent`; `src/features/agents/operations/pendingSetupLifecycleWorkflow.ts` is used by retry operations and integration tests.

- Observation: one controller integration test is coupled to guided create workflow modules, not only pending retry helpers.
  Evidence: `tests/unit/agentMutationLifecycleController.integration.test.ts` imports `runGuidedCreateWorkflow` and `resolveGuidedCreateCompletion` from `src/features/agents/operations/guidedCreateWorkflow.ts`, so deleting guided workflow modules requires rewriting this test, not only removing pending assertions.

- Observation: pending setup state in `page.tsx` is also wired through derived memos and scope helpers, not only top-level state variables.
  Evidence: `src/app/page.tsx` computes `focusedPendingCreateSetup`, `focusedPendingCreateSetupBusy`, and `pendingGuidedSetupGatewayScope`; it imports `runPendingCreateSetupRetryLifecycle` from create lifecycle and session-storage lifecycle helpers, then branches on `completion.pendingErrorMessage`.

- Observation: the workspace did not have dependencies installed, which blocked test execution until install.
  Evidence: initial focused test run failed with `sh: vitest: command not found`; running `npm install` added local toolchain binaries and unblocked test + typecheck runs.

- Observation: strict typecheck surfaced one unrelated-but-real nullable test typing issue during final verification.
  Evidence: `tests/unit/historySyncOperation.integration.test.ts` failed with `TS18048: 'transcriptEntries' is possibly 'undefined'`; fixed by defaulting to an empty array before filtering.

## Decision Log

- Decision: move agent creation to create-first, configure-later.
  Rationale: `agents.create` is reliable and minimal; reducing pre-create choices lowers confusion and removes retry-heavy setup paths from the critical first action.
  Date/Author: 2026-02-17 / Codex

- Decision: keep existing mutation queue guardrails (busy/queued/timeout) during simplification.
  Rationale: these guardrails already coordinate create/rename/delete contention and should remain to avoid regressions while internals are simplified.
  Date/Author: 2026-02-17 / Codex

- Decision: remove pending-guided-setup policy helpers together with page-level pending state, not in a later cleanup-only pass.
  Rationale: these helpers are currently coupled through imports and integration tests; removing them in the same migration prevents leaving orphaned policy APIs (`resolvePendingSetupAutoRetryIntent`, `runPendingSetupRetryLifecycle`) with no product behavior.
  Date/Author: 2026-02-18 / Codex

- Decision: rewrite integration tests that currently import guided workflow modules instead of only pruning pending setup assertions.
  Rationale: `agentMutationLifecycleController.integration.test.ts` currently exercises guided create workflow helpers directly; removing those modules without rewriting the test would break compilation and leave migration coverage unclear.
  Date/Author: 2026-02-18 / Codex

- Decision: explicitly remove `completion.pendingErrorMessage` handling from page create submit wiring during create-only migration.
  Rationale: create-only completion should no longer expose pending-setup outcomes; leaving this branch would preserve dead UI/error coupling after guided setup removal.
  Date/Author: 2026-02-18 / Codex

- Decision: keep avatar persistence in create flow while removing all guided setup write paths.
  Rationale: avatar seed persistence is an existing create-time UX behavior independent of guided setup and does not require deferred retry wiring.
  Date/Author: 2026-02-18 / Codex

## Outcomes & Retrospective

First-run agent creation is now one-step in runtime code: modal collects only name/avatar and create lifecycle enqueues a single `agents.create` path. Pending guided setup state, retry effects, and the focused chat “Guided setup pending” card were fully removed from `src/app/page.tsx`, and dead guided/pending modules were deleted.

Regression safety was validated through focused tests (`agentCreateModal`, create lifecycle, controller unit + integration coverage), then full project verification (`npm run typecheck`, `npm run test` with all suites passing).

The architecture and permissions docs now describe create-first behavior and post-create authority updates via `updateExecutionRoleViaStudio` instead of create-time guided compilation.

## Context and Orientation

The current create flow spans UI, compiler, orchestration, and page-level state.

`src/features/agents/components/AgentCreateModal.tsx` renders the three-step wizard and submits a guided payload.

`src/features/agents/creation/types.ts` and `src/features/agents/creation/compiler.ts` define guided draft and compile it into setup artifacts.

`src/features/agents/operations/createAgentMutationLifecycleOperation.ts` currently compiles the guided payload, runs `runGuidedCreateWorkflow`, and exports retry helpers tied to pending setup.

`src/features/agents/operations/guidedCreateWorkflow.ts`, `src/features/agents/operations/createAgentOperation.ts`, and `src/features/agents/creation/recovery.ts` implement create/apply/retry behavior.

`src/app/page.tsx` carries pending setup state (`pendingCreateSetupsByAgentId`, session-storage scope sync, auto-retry refs) and renders the “Guided setup pending” card.

`src/features/agents/operations/agentMutationLifecycleController.ts` and `src/features/agents/operations/pendingSetupLifecycleWorkflow.ts` still expose pending setup auto-retry and retry error policy logic used by tests and retry adapters.

The actual gateway create contract used by Studio is `createGatewayAgent` in `src/lib/gateway/agentConfig.ts`, which calls `agents.create` after deriving workspace from `config.get` path. That is the behavior this plan keeps.

Terms used in this plan:

“guided setup” means post-create writes to agent files, exec approvals, and per-agent config overrides.

“pending setup” means Studio created the agent but deferred guided setup and retained retry metadata in browser session storage.

“mutation block” means the temporary UI lock state that prevents overlapping create/rename/delete config mutations while one is active.

## Plan of Work

Implement this migration in an order that keeps the repository compiling at each checkpoint. First make the modal and payload contract create-only. Then simplify lifecycle orchestration so it only enqueues `createGatewayAgent` with existing mutation guards. Next remove pending setup state and retry wiring from `page.tsx` and status text. Then prune dead guided modules and tests, including controller/workflow helpers that exist only for pending setup. Finish by updating architecture and permissions docs and running full validation.

Keep edits additive within each milestone and remove dead modules only after imports are gone. This avoids unstable intermediate states where the compiler fails because a removed module is still referenced by page wiring or tests.

## Milestones

### Milestone 1: Convert the modal submit contract to create-only and simplify the modal UI

At the end of this milestone, `AgentCreateModal` is one screen, and submit payload carries only create data.

Edit `src/features/agents/components/AgentCreateModal.tsx` to remove step state, ownership tiles, authority profiles, capability overrides, and review-step copy. Keep the following visible pieces: header, close button, agent name input, avatar preview + shuffle, submit button, busy label, and submit error message. Remove guided-only compiler imports (`compileGuidedAgentCreation`, `createDefaultGuidedDraft`, preset resolvers, group-capability helpers) so this component has no dependency on `src/features/agents/creation/compiler.ts`.

Edit `src/features/agents/creation/types.ts` so `AgentCreateModalSubmitPayload` no longer requires guided draft content. Target shape:

    export type AgentCreateModalSubmitPayload = {
      mode: "simple";
      name: string;
      avatarSeed?: string;
    };

Update `tests/unit/agentCreateModal.test.ts` to assert one-step rendering and simple payload submission. Remove assertions for step transitions and guided draft fields.

Proof for this milestone is a passing focused modal test and no references to old step copy from this component.

### Milestone 2: Simplify create mutation lifecycle to create-only (no compile/apply/retry)

At the end of this milestone, create lifecycle no longer compiles guided drafts or applies setup. Keep temporary compatibility for pending-retry exports until Milestone 3 removes page-level imports, then remove those exports in the same commit as page wiring cleanup.

Edit `src/features/agents/operations/createAgentMutationLifecycleOperation.ts`:

- Remove imports from `creation/compiler` and `guidedCreateWorkflow`.
- Remove `AgentGuidedSetup` dependency and setup callbacks from `CreateAgentMutationLifecycleDeps`.
- Keep `runPendingCreateSetupRetryLifecycle` only if still imported by `src/app/page.tsx`; remove it immediately after Milestone 3 removes that import.
- Update `CreateAgentBlockState.phase` to `"queued" | "creating"`.
- Keep start guard (`resolveMutationStartGuard`) and timeout mapping (`isCreateBlockTimedOut`).
- In `runCreateAgentMutationLifecycle`, call `deps.createAgent` inside queued mutation and then `onCompletion` with a create-only completion payload.

Edit `tests/unit/createAgentMutationLifecycleOperation.test.ts` to remove compile-validation and pending-retry scenarios, and to assert create-only ordering and timeout behavior with the new phase union.

Proof for this milestone is a passing focused lifecycle test file with no import of guided draft/compiler APIs.

### Milestone 3: Remove pending guided setup runtime wiring from page orchestration

At the end of this milestone, `page.tsx` has no pending guided setup state, no retry effects, and no pending setup UI card.

Edit `src/app/page.tsx`:

- Remove imports from:
  - `src/features/agents/creation/recovery.ts`
  - `src/features/agents/creation/pendingSetupStore.ts`
  - `src/features/agents/creation/pendingGuidedSetupSessionStorageLifecycle.ts`
  - `src/features/agents/operations/createAgentOperation.ts`
  - `src/features/agents/operations/pendingGuidedSetupAutoRetryOperation.ts`
  - `runPendingCreateSetupRetryLifecycle` import from `src/features/agents/operations/createAgentMutationLifecycleOperation.ts`
- Remove state and refs:
  - `pendingCreateSetupsByAgentId`, `pendingCreateSetupsLoadedScope`, `retryPendingSetupBusyAgentId`
  - `pendingCreateSetupsByAgentIdRef`, `pendingSetupAutoRetryAttemptedRef`, `pendingSetupAutoRetryInFlightRef`
- Remove derived pending-setup memo/scope values: `focusedPendingCreateSetup`, `focusedPendingCreateSetupBusy`, and `pendingGuidedSetupGatewayScope`.
- Remove effects that load/persist pending setups, reset retry state, and run auto-retry.
- Remove `applyPendingCreateSetupForAgentId` and any calls that route through `runPendingCreateSetupRetryLifecycle`.
- Remove retry/discard handlers and the `Guided setup pending` card block.
- Update create block phase union and status line so there is no `"applying-setup"` branch.
- Update `handleCreateAgentSubmit` dependencies passed to `runCreateAgentMutationLifecycle` so only create-only callbacks remain.
- Remove `completion.pendingErrorMessage` handling inside `handleCreateAgentSubmit` completion callback.

Proof for this milestone is that the focused agent panel renders without pending setup card logic and the create flow still selects/open chats with the created agent.

### Milestone 4: Remove dead pending/guided policy helpers and update affected integration tests

At the end of this milestone, no runtime module remains whose only purpose was guided setup retry policy.

Edit `src/features/agents/operations/agentMutationLifecycleController.ts` to remove pending setup retry policy exports (`resolvePendingSetupAutoRetryIntent` and related skip/retry types) and remove imports from `pendingSetupLifecycleWorkflow` and `creation/pendingSetupRetry`.

Edit `src/features/agents/creation/types.ts` after compiler removal to retain only types still used by runtime call sites. Remove guided-only type aliases/interfaces that were only consumed by deleted modules.

Prune guided/pending modules after call sites are removed. Candidate files expected to become dead:

- `src/features/agents/operations/guidedCreateWorkflow.ts`
- `src/features/agents/operations/createAgentOperation.ts`
- `src/features/agents/operations/pendingGuidedSetupRetryOperation.ts`
- `src/features/agents/operations/pendingGuidedSetupAutoRetryOperation.ts`
- `src/features/agents/operations/pendingSetupLifecycleWorkflow.ts`
- `src/features/agents/creation/recovery.ts`
- `src/features/agents/creation/pendingSetupRetry.ts`
- `src/features/agents/creation/pendingSetupStore.ts`
- `src/features/agents/creation/pendingGuidedSetupSessionStorageLifecycle.ts`
- `src/features/agents/creation/compiler.ts`

Then update or remove tests that directly exercise those modules. Candidate test files expected to be removed or rewritten:

- `tests/unit/agentCreationCompiler.test.ts`
- `tests/unit/createAgentOperation.test.ts`
- `tests/unit/guidedCreateWorkflow.test.ts`
- `tests/unit/guidedCreateWorkflow.integration.test.ts`
- `tests/unit/guidedSetupRecovery.test.ts`
- `tests/unit/pendingGuidedSetupStore.test.ts`
- `tests/unit/pendingGuidedSetupSessionStorageLifecycle.test.ts`
- `tests/unit/pendingGuidedSetupAutoRetryOperation.test.ts`
- `tests/unit/pendingGuidedSetupRetryOperation.test.ts`
- `tests/unit/pendingGuidedSetupRetry.test.ts`
- `tests/unit/pendingSetupLifecycleWorkflow.test.ts`

`tests/unit/agentMutationLifecycleController.test.ts` currently imports `resolvePendingSetupAutoRetryIntent`; remove pending-setup assertions there and keep only active mutation guard/timeout/post-run command coverage.

`tests/unit/agentMutationLifecycleController.integration.test.ts` currently imports guided workflow helpers and pending setup policy. Rewrite its create-flow test to assert only guard + queue/controller command behavior that survives the migration, then remove guided/pending imports. `tests/unit/lifecycleControllerWorkflow.integration.test.ts` currently includes pending setup assertions; keep non-pending coverage (approval follow-up behavior) and remove pending-setup-specific blocks/imports.

Proof for this milestone is a clean `rg` showing no guided-create runtime symbols in `src/` and a passing updated test suite.

### Milestone 5: Align docs with shipped behavior

At the end of this milestone, docs no longer describe the old guided create path.

Update `ARCHITECTURE.md` sections that currently describe `AgentCreateModal` as a preset/control/review flow with pending guided setup persistence and retry.

Update `docs/permissions-sandboxing.md` sections that describe guided create compilation and setup application as part of initial create flow.

In `ARCHITECTURE.md`, update both the long “Focused agent UI” paragraph and the “Data flow / Agent create + per-agent setup” numbered flow so they describe one-step create and post-create settings updates only.

In `docs/permissions-sandboxing.md`, replace guided-create compiler/setup sections with the current create contract (`createGatewayAgent` -> `agents.create`) and move authority-level behavior references to post-create settings operations.

Retain accurate statements about gateway-level behavior and `agents.create` semantics, but explicitly state that create is now one-step and any authority/runtime changes happen after creation via settings operations.

Proof for this milestone is doc content that matches current runtime code and does not mention removed create-time guided setup modules.

## Concrete Steps

Run all commands from `/Users/georgepickett/.codex/worktrees/22b2/openclaw-studio`.

1. Write tests for simple modal payload, then run focused modal tests.

       npm run test -- tests/unit/agentCreateModal.test.ts

   Expectation: tests fail before modal refactor, pass after Milestone 1.

2. Update create mutation lifecycle and related test coverage.

       npm run test -- tests/unit/createAgentMutationLifecycleOperation.test.ts

   Expectation: tests pass with only `queued` and `creating` phases and no pending setup retry export usage.

3. Remove pending setup wiring from `page.tsx`, then run focused controller/integration tests that still should exist.

       npm run test -- tests/unit/agentMutationLifecycleController.test.ts tests/unit/agentMutationLifecycleController.integration.test.ts tests/unit/lifecycleControllerWorkflow.integration.test.ts
       rg -n "focusedPendingCreateSetup|pendingGuidedSetupGatewayScope|completion\\.pendingErrorMessage|runPendingCreateSetupRetryLifecycle" src/app/page.tsx

   Expectation: controller and integration tests pass after removing pending-specific assertions from retained tests; guided workflow modules can still remain until Milestone 4.
   Expectation: grep returns no matches for removed `page.tsx` pending-setup wiring symbols.

4. Prune dead modules/tests and verify no runtime references remain.

       rg -n "compileGuidedAgentCreation|runGuidedCreateWorkflow|runPendingCreateSetupRetryLifecycle|resolvePendingSetupAutoRetryIntent|runPendingSetupRetryLifecycle|pendingGuidedSetup|applyGuidedAgentSetup" src
       npm run test -- tests/unit/agentMutationLifecycleController.integration.test.ts tests/unit/lifecycleControllerWorkflow.integration.test.ts

   Expectation: no matches in `src/`; focused integration tests pass with no imports of removed guided/pending modules.

5. Run final project checks.

       npm run typecheck
       npm run test

   Expectation: typecheck succeeds and unit suite is green.

## Validation and Acceptance

Manual acceptance flow:

1. Start app locally:

       npm run dev

2. In Studio, click “New Agent.” Confirm the modal is one screen with name + avatar controls only.

3. Launch a new agent. Confirm fleet updates and chat focus switches to the newly created agent.

4. Confirm there is no pending guided setup banner/card and no retry/discard setup actions in the focused chat area.

5. Open agent settings and confirm execution role controls still function through `onUpdateExecutionRole`, proving authority adjustments remain available after creation.

Automated acceptance:

- `tests/unit/agentCreateModal.test.ts` validates create modal UI and payload contract.
- `tests/unit/createAgentMutationLifecycleOperation.test.ts` validates create lifecycle guards, queue behavior, and timeout behavior.
- Updated lifecycle integration tests validate remaining guardrail behavior without pending setup dependencies.
- Full `npm run test` verifies no regressions elsewhere.

## Idempotence and Recovery

This migration is code-structure refactoring with no persistent data migration. Re-running steps is safe.

Safe sequencing guidance:

- Do not delete guided/pending modules until all imports are removed from `src/app/page.tsx` and `createAgentMutationLifecycleOperation.ts`.
- Remove tests in the same change where their target modules are removed, or rewrite them to cover replacement behavior.
- If the tree fails typecheck mid-migration, first restore compile by stubbing old exports in-place, then continue removal in smaller commits.

Rollback strategy:

Use standard Git revert of the latest simplification commit(s). No user-state rollback is required.

## Artifacts and Notes

Use these grep checks as objective evidence during implementation:

- Old modal copy removed:

      rg -n "Define Ownership|Set Authority Level|What does this agent fully own\?" src/features/agents/components/AgentCreateModal.tsx

  Expected: no matches.

- Pending setup UI removed:

      rg -n "Guided setup pending|Retry setup|Discard pending setup" src/app/page.tsx

  Expected: no matches.

- Pending setup page wiring symbols removed:

      rg -n "focusedPendingCreateSetup|pendingGuidedSetupGatewayScope|completion\\.pendingErrorMessage|runPendingCreateSetupRetryLifecycle" src/app/page.tsx

  Expected: no matches.

- Create block status no longer references guided setup phase:

      rg -n "Applying guided setup|applying-setup" src/app/page.tsx src/features/agents/operations/createAgentMutationLifecycleOperation.ts

  Expected: no matches.

- Guided create runtime path removed:

      rg -n "guidedCreateWorkflow|createAgentOperation|pendingGuidedSetup" src/features/agents

  Expected: no matches for removed modules.

- Guided payload mode removed:

      rg -n "mode:\\s*\"guided\"|createDefaultGuidedDraft|compileGuidedAgentCreation" src/features/agents/components/AgentCreateModal.tsx src/features/agents/operations/createAgentMutationLifecycleOperation.ts tests/unit/agentCreateModal.test.ts tests/unit/createAgentMutationLifecycleOperation.test.ts

  Expected: no matches.

Preserve this behavior evidence from existing tests:

- `tests/unit/gatewayConfigPatch.test.ts` proving `createGatewayAgent` still calls `agents.create` with derived workspace.
- `tests/unit/executionRoleUpdateOperation.test.ts` proving post-create authority controls still map correctly.

## Interfaces and Dependencies

Keep this gateway helper unchanged:

`src/lib/gateway/agentConfig.ts`

    export const createGatewayAgent = async (params: { client: GatewayClient; name: string }): Promise<ConfigAgentEntry>

Create lifecycle public interface should remain, but use a create-only payload:

`src/features/agents/operations/createAgentMutationLifecycleOperation.ts`

    export const runCreateAgentMutationLifecycle = async (
      params: {
        payload: AgentCreateModalSubmitPayload;
        status: "connected" | "connecting" | "disconnected";
        hasCreateBlock: boolean;
        hasRenameBlock: boolean;
        hasDeleteBlock: boolean;
        createAgentBusy: boolean;
      },
      deps: CreateAgentMutationLifecycleDeps
    ): Promise<boolean>

`CreateAgentBlockState.phase` should be narrowed to `"queued" | "creating"`.

`runCreateAgentMutationLifecycle` should no longer require `isLocalGateway` input once guided setup/apply branches are removed.

`runPendingCreateSetupRetryLifecycle` should be removed from this module after `src/app/page.tsx` retry wiring is deleted.

`CreateAgentMutationLifecycleDeps.onCompletion` should no longer depend on `GuidedCreateCompletion`; remove guided completion payload fields such as `pendingErrorMessage`.

`src/features/agents/creation/types.ts` should retain `AgentCreateModalSubmitPayload` only if still needed by multiple modules; if it becomes a single-call-site type, it can be relocated, but update imports in `page.tsx`, `AgentCreateModal.tsx`, and lifecycle tests in the same commit.

The following post-create settings dependency should remain available and tested:

`src/features/agents/operations/executionRoleUpdateOperation.ts`

    export async function updateExecutionRoleViaStudio(...): Promise<void>

---

Plan revision note: initial plan created on 2026-02-17 to implement one-step agent creation UX and retire guided setup during create.

Plan revision note (2026-02-18): improved with code-grounded dependency fixes after deep-read of referenced and adjacent modules. Added missing coverage for `agentMutationLifecycleController.ts` and `pendingSetupLifecycleWorkflow.ts`, corrected cleanup scope for runtime and test files, tightened milestone ordering to keep the tree compiling, and replaced ambiguous commands with exact runnable checks and expected outcomes.

Plan revision note (2026-02-18, pass 2): tightened compile-safe sequencing for removal of `runPendingCreateSetupRetryLifecycle`, added missing test coverage updates for `agentMutationLifecycleController.test.ts` and `pendingGuidedSetupRetry.test.ts`, and added explicit cleanup checks for `applying-setup` status text and phase references.

Plan revision note (2026-02-18, pass 3): corrected PLANS source statement, added code-backed integration-test coupling fixes (`agentMutationLifecycleController.integration.test.ts` still imports guided workflow), tightened Milestone 3/4 cleanup scope to include retry callback removal and guided-import rewrites, and added stronger grep/test verification for pending policy symbol removal.

Plan revision note (2026-02-18, pass 4): added explicit `page.tsx` pending-setup wiring cleanup symbols (`focusedPendingCreateSetup`, `pendingGuidedSetupGatewayScope`, `completion.pendingErrorMessage`, and `runPendingCreateSetupRetryLifecycle` import), tightened create lifecycle completion-interface migration away from `GuidedCreateCompletion`, and made docs update targets concrete for `ARCHITECTURE.md` and `docs/permissions-sandboxing.md`.

Plan revision note (2026-02-18, pass 5 / implemented): completed the migration end-to-end. Shipped one-step create modal + create-only mutation lifecycle, removed pending guided setup runtime and dead modules/tests, aligned docs to runtime behavior, and verified with focused tests plus full `typecheck` and `test` runs.
