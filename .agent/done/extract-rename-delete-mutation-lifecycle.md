# Extract Rename/Delete Mutation Lifecycle From AgentStudioPage

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository keeps plan requirements at `.agent/PLANS.md`. This ExecPlan must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

`src/app/page.tsx` currently owns both user-interface wiring and the full rename/delete config-mutation lifecycle, including queue submission, mutation-block phase changes, remote-restart gating, and post-run command execution. After this refactor, that lifecycle logic will live in one dedicated operation module under `src/features/agents/operations`, so the page keeps only page-specific concerns (confirmation prompt, local UI wiring, callback plumbing, and status-line rendering). This is a pure refactor with no intended user-visible behavior change: rename and delete still work the same way, with the same restart waiting behavior and the same status/error text.

## Progress

- [x] (2026-02-17 16:28Z) Created `src/features/agents/operations/agentConfigMutationLifecycleOperation.ts` with dependency-injected lifecycle orchestration for `rename-agent` and `delete-agent`.
- [x] (2026-02-17 16:28Z) Moved duplicate rename/delete orchestration logic out of `src/app/page.tsx` and delegated both handlers to `runAgentConfigMutationLifecycle`.
- [x] (2026-02-17 16:28Z) Preserved restart-block behavior: page-level blocks still transition through `queued` -> (`deleting`/`renaming`) -> `awaiting-restart` or clear.
- [x] (2026-02-17 16:28Z) Added focused unit tests in `tests/unit/agentConfigMutationLifecycleOperation.test.ts` for completed, awaiting-restart, local-gateway, and failure paths.
- [x] (2026-02-17 16:28Z) Ran `npm run typecheck`, targeted `vitest --run` suite, and full `vitest --run` suite successfully.
- [x] (2026-02-17 16:28Z) Verified page-size reduction and boundary cleanliness: `src/app/page.tsx` dropped from 2739 -> 2707 lines, and the extracted operation file has no direct infrastructure/browser imports.
- [x] (2026-02-17 16:27Z) Installed local dependencies with `npm ci`, restoring `tsc` and `vitest` command availability.

## Surprises & Discoveries

- None yet. Update this section during implementation if any behavior differs from assumptions.
- Observation: validation commands in this shell fail before installation because project-local binaries are missing.
  Evidence: `npm run typecheck` -> `sh: tsc: command not found`; `npm run test -- --run tests/unit/configMutationWorkflow.integration.test.ts` -> `sh: vitest: command not found`.
- Observation: full test suite emits expected stderr logs from negative-path storage tests but still passes.
  Evidence: `tests/unit/pendingGuidedSetupStore.test.ts` logs intentional `getItem/setItem/removeItem failed` errors while suite result is `108 passed`.

## Decision Log

- Decision: Extract the rename/delete mutation lifecycle first, not the create-agent lifecycle.
  Rationale: `src/app/page.tsx` contains nearly identical rename/delete orchestration blocks (queue + run + disposition commands + restart block coordination) in `handleDeleteAgent` (`src/app/page.tsx:1244` onward) and `handleRenameAgent` (`src/app/page.tsx:2062` onward). This seam is the clearest, removes substantial duplication with limited cross-module churn, and produces a directly unit-testable operation.
  Date/Author: 2026-02-17 / Codex
- Decision: Make test commands explicit with `--run` and include dependency bootstrap before validation.
  Rationale: this repo uses `"test": "vitest"`, which can enter watch mode in interactive shells; deterministic plan execution needs one-shot runs. Current workspace evidence also shows missing local binaries until dependencies are installed.
  Date/Author: 2026-02-17 / Codex
- Decision: Keep queued-block construction in `src/app/page.tsx` via callbacks, and extract lifecycle execution into one operation entry point.
  Rationale: page handlers need page-local state guards (`agentId` match checks and phase names `deleting`/`renaming`), but the mutation workflow/run-command logic is fully shareable. Callback injection preserves behavior while removing duplicated orchestration.
  Date/Author: 2026-02-17 / Codex

## Outcomes & Retrospective

- Completed. Rename/delete mutation orchestration now runs through a shared operation module, page-level duplication was removed, and existing queue/restart/status behaviors remained intact under test.

## Context and Orientation

The target module is `src/app/page.tsx`, which is currently 2,739 lines and contains 40 `useEffect` hooks. It is the main Studio page component, but it also performs mutation-lifecycle orchestration that belongs in operation-layer code. The duplicate lifecycle exists in the delete handler (`src/app/page.tsx:1244-1342`) and rename handler (`src/app/page.tsx:2062-2154`). Each block performs the same sequence: mutation guard, queued-block creation, `enqueueConfigMutation`, transition into a mutating phase, `runConfigMutationWorkflow`, conversion of disposition into commands via `buildMutationSideEffectCommands`, command application to block state, and error mapping via `buildConfigMutationFailureMessage`.

The adjacent operation modules already define the policy pieces that this extraction should compose instead of duplicating. `src/features/agents/operations/configMutationWorkflow.ts` defines disposition rules (`completed` or `awaiting-restart`) and failure-message helpers. `src/features/agents/operations/agentMutationLifecycleController.ts` defines guard checks and side-effect commands. `src/features/agents/operations/useConfigMutationQueue.ts` defines queue typing and gating (`ConfigMutationKind` and queue start policy) and must remain behaviorally unchanged. `src/features/agents/operations/useGatewayRestartBlock.ts` plus `src/features/agents/operations/gatewayRestartPolicy.ts` own restart observation; the extraction must preserve compatibility with existing rename/delete block objects.

Two page-specific details must remain intact after extraction. First, delete and rename use page-specific mutation phases (`"deleting"` and `"renaming"`) that are later mapped back to `"mutating"` for status text in `resolveConfigMutationStatusLine` at `src/app/page.tsx:2266-2283`. Second, delete has side effects that rename does not (`window.confirm` and `setSettingsAgentId(null)` inside its mutation function), so the extracted operation must be callback-driven and not hardcode delete/rename transport behavior.

## Plan of Work

Milestone 1 creates `src/features/agents/operations/agentConfigMutationLifecycleOperation.ts` as the only place that performs rename/delete lifecycle orchestration. This new module will not call gateway APIs directly. It will accept dependency callbacks for queue submission, mutation execution, restart requirement checks, block setters, and post-run actions. The module will call existing policy helpers (`runConfigMutationWorkflow`, `buildMutationSideEffectCommands`, and `buildConfigMutationFailureMessage`) and return a success/failure outcome for the page.

Milestone 2 rewires `handleDeleteAgent` and `handleRenameAgent` in `src/app/page.tsx` to delegate orchestration to the new module. `src/app/page.tsx` keeps guard-adjacent UI behavior that is truly page-specific: loading the selected agent from store state, presenting the delete confirmation dialog, and building operation-specific mutation executors (delete uses `deleteAgentViaStudio`, rename uses `renameGatewayAgent` plus optimistic `dispatch`). Shared lifecycle branches move out. This milestone also removes now-unused page imports (for example, mutation workflow helpers currently imported only for inline rename/delete orchestration) while preserving `resolveConfigMutationStatusLine`, which is still required for UI status text.

Milestone 3 adds focused unit coverage in `tests/unit/agentConfigMutationLifecycleOperation.test.ts` using the same Vitest style as adjacent operation tests (`vi.fn`, dependency stubs, explicit command-order assertions). The tests must validate both local and remote gateway paths and verify that command application parity matches existing integration assertions in `tests/unit/configMutationWorkflow.integration.test.ts` and `tests/unit/agentMutationLifecycleController.integration.test.ts`.

## Concrete Steps

All commands below run from `/Users/georgepickett/.codex/worktrees/db4a/openclaw-studio`.

1. Verify or install dependencies so local binaries exist.

    test -d node_modules && echo "node_modules present" || npm ci

Expected outcome: either `node_modules present` or a clean lockfile-based install ending with npm's summary line. After this step, `tsc` and `vitest` are callable via npm scripts. If `npm ci` fails because the lockfile and `package.json` are out of sync, run `npm install` once, then rerun the validation commands.

2. Capture baseline structure and duplication before editing.

    wc -l src/app/page.tsx
    rg -n "const handleDeleteAgent|const handleRenameAgent|buildMutationSideEffectCommands\(|runConfigMutationWorkflow\(" src/app/page.tsx

Expected outcome: line count near 2739 and both handlers found with duplicated lifecycle sections.

3. Implement the new operation module.

    test -f src/features/agents/operations/agentConfigMutationLifecycleOperation.ts || touch src/features/agents/operations/agentConfigMutationLifecycleOperation.ts

Add one exported orchestration entry point that accepts:

- mutation metadata (`kind`, `agentId`, `agentName`, `isLocalGateway`),
- queue callback (`enqueueConfigMutation`),
- lifecycle block callbacks (set queued, set mutating, apply command patch, clear block),
- mutation callbacks (`executeMutation`, `shouldAwaitRemoteRestart`, `reloadAgents`, `setMobilePane`),
- error callback that consumes `buildConfigMutationFailureMessage` output.

4. Rewire page handlers to call the new operation and clean imports.

    rg -n "handleDeleteAgent|handleRenameAgent" src/app/page.tsx
    rg -n "buildConfigMutationFailureMessage|runConfigMutationWorkflow|buildMutationSideEffectCommands" src/app/page.tsx

Update both handlers so they keep only per-handler concerns and invoke the shared operation for lifecycle orchestration. Remove now-redundant inline command loops and duplicate try/catch mutation-flow blocks. Update imports so only actively used helpers remain in `src/app/page.tsx`.

5. Add tests for the extracted module.

    test -f tests/unit/agentConfigMutationLifecycleOperation.test.ts || touch tests/unit/agentConfigMutationLifecycleOperation.test.ts

Cover these cases with `describe("agentConfigMutationLifecycleOperation", ...)`:

- rename completed path: runs mutation once, reloads agents, clears block, sets mobile pane,
- delete awaiting-restart path: applies only patch command (`phase: "awaiting-restart"`) and does not clear,
- failure path: clears appropriate block state and emits mapped failure message,
- local gateway path: never calls restart-check callback.

6. Run validation commands.

    npm run typecheck
    npm run test -- --run tests/unit/agentConfigMutationLifecycleOperation.test.ts tests/unit/configMutationWorkflow.test.ts tests/unit/configMutationWorkflow.integration.test.ts tests/unit/configMutationGatePolicy.test.ts tests/unit/gatewayRestartPolicy.test.ts tests/unit/agentMutationLifecycleController.test.ts tests/unit/agentMutationLifecycleController.integration.test.ts
    npm run test -- --run
    wc -l src/app/page.tsx
    rg -n "@/lib/gateway|@/lib/http|window|fetch\(|WebSocket|useEffect\(" src/features/agents/operations/agentConfigMutationLifecycleOperation.ts || true

Expected outcome: typecheck passes; targeted tests pass; full test run passes; page line count decreases materially; `rg` confirms inline rename/delete lifecycle helpers were removed from page handlers; the extracted operation file shows no direct infrastructure/browser/React-hook imports.

## Validation and Acceptance

Acceptance is complete when behavior and structure both match the current system with less page-level coupling. The structural check is that `src/app/page.tsx` no longer contains duplicate rename/delete lifecycle orchestration loops and is reduced by roughly 120 or more lines. The behavior check is that rename and delete still drive the same mutation-block transitions (`queued` to mutating to either clear or `awaiting-restart`) and still present the same restart-dependent status text via the existing mapping in `resolveConfigMutationStatusLine`.

The operation-layer boundary is valid only if `src/features/agents/operations/agentConfigMutationLifecycleOperation.ts` has no direct imports from `@/lib/gateway/*`, `@/lib/http`, browser globals (`window`, `fetch`, `WebSocket`), or React hooks. All infrastructure actions must be provided through callbacks from `src/app/page.tsx`.

Validation commands must all succeed after dependencies are installed. `npm run typecheck` and both targeted/full `vitest --run` invocations are required. The new test file must prove command-order and disposition parity, not just happy-path invocation counts. Existing controller and policy tests (`tests/unit/agentMutationLifecycleController.test.ts`, `tests/unit/agentMutationLifecycleController.integration.test.ts`, `tests/unit/configMutationGatePolicy.test.ts`, and `tests/unit/gatewayRestartPolicy.test.ts`) must continue to pass because they encode queue/restart semantics relied upon by the extraction.

## Idempotence and Recovery

This change is additive and retriable. If implementation is interrupted, rerunning the steps is safe because the new module and test files are deterministic and can be overwritten with corrected content. If the extraction introduces regressions, revert only touched files and retry:

    git checkout -- src/app/page.tsx src/features/agents/operations/agentConfigMutationLifecycleOperation.ts tests/unit/agentConfigMutationLifecycleOperation.test.ts

If command validation fails due to missing tools, rerun the dependency bootstrap step and repeat only the failed validation commands.

## Artifacts and Notes

Baseline evidence from this repository state:

- `src/app/page.tsx` line count: 2739.
- `src/app/page.tsx` `useEffect` count: 40.
- Historical churn (commit-touch count):
  - `src/app/page.tsx`: 162
  - `src/lib/gateway/agentConfig.ts`: 19
  - `src/features/agents/state/gatewayRuntimeEventHandler.ts`: 18
  - `server/gateway-proxy.js`: 4

Environment evidence from this shell before dependency install:

- `npm run typecheck` failed with `sh: tsc: command not found`.
- `npm run test -- --run ...` failed with `sh: vitest: command not found`.

Implementation evidence:

- `npm ci` succeeded: 582 packages installed.
- `npm run typecheck` passed.
- Targeted regression command passed: 7 test files / 32 tests.
- Full regression command passed: 108 test files / 498 tests.
- `src/app/page.tsx` line count after extraction: 2707 (down from 2739).
- `rg -n "@/lib/gateway|@/lib/http|window|fetch\\(|WebSocket|useEffect\\(" src/features/agents/operations/agentConfigMutationLifecycleOperation.ts` returned no matches.

## Interfaces and Dependencies

The extracted operation module should expose one orchestration API that composes existing policy helpers and keeps side effects injected. Keep names stable and explicit.

In `src/features/agents/operations/agentConfigMutationLifecycleOperation.ts`, define input/output types similar to:

    import type { ConfigMutationKind } from "@/features/agents/operations/useConfigMutationQueue";

    type AgentConfigMutationKind = "rename-agent" | "delete-agent";

    type AgentConfigMutationLifecycleInput = {
      kind: AgentConfigMutationKind;
      agentId: string;
      agentName: string;
      isLocalGateway: boolean;
    };

    type AgentConfigMutationLifecycleDeps = {
      enqueueConfigMutation: (params: { kind: ConfigMutationKind; label: string; run: () => Promise<void> }) => Promise<void>;
      setQueuedBlock: () => void;
      setMutatingBlock: () => void;
      patchBlockAwaitingRestart: (patch: { phase: "awaiting-restart"; sawDisconnect: boolean }) => void;
      clearBlock: () => void;
      executeMutation: () => Promise<void>;
      shouldAwaitRemoteRestart: () => Promise<boolean>;
      reloadAgents: () => Promise<void>;
      setMobilePaneChat: () => void;
      onError: (message: string) => void;
    };

    export async function runAgentConfigMutationLifecycle(
      input: AgentConfigMutationLifecycleInput,
      deps: AgentConfigMutationLifecycleDeps
    ): Promise<boolean>;

The implementation should import and use only operation-layer helpers that already exist:

- `runConfigMutationWorkflow` and `buildConfigMutationFailureMessage` from `src/features/agents/operations/configMutationWorkflow.ts`.
- `buildMutationSideEffectCommands` (and optionally `buildQueuedMutationBlock`) from `src/features/agents/operations/agentMutationLifecycleController.ts`.
- `ConfigMutationKind` type from `src/features/agents/operations/useConfigMutationQueue.ts` for queue-kind compatibility.

`src/app/page.tsx` remains responsible for operation-specific mutation execution details (`deleteAgentViaStudio`, `renameGatewayAgent`, `dispatch`, and `setSettingsAgentId`).

Append-only revision note:

- 2026-02-17: Initial plan authored from the entanglement analysis pass. It selects rename/delete mutation lifecycle extraction as the first cut because it removes duplicated high-churn orchestration with minimal blast-radius risk.
- 2026-02-17: Plan improved via deep code-grounding pass. Corrected PLANS reference to `.agent/PLANS.md`, added prerequisite/bootstrap guidance based on observed local command failures, tightened handler/module mapping to actual page phases (`deleting`/`renaming` vs `mutating` mapping), and made test/validation commands deterministic with `vitest --run` plus concrete coverage expectations.
- 2026-02-17: Plan improved again after adjacency review. Added explicit import-cleanup expectations in `src/app/page.tsx`, aligned queue callback typing with `ConfigMutationKind` from `useConfigMutationQueue.ts`, switched bootstrap command to lockfile-safe `npm ci`, and expanded targeted regression coverage to include `agentMutationLifecycleController.test.ts`.
- 2026-02-17: Plan improved again after policy-adjacency verification. Added `npm ci` failure fallback guidance, extended targeted regression coverage to include `configMutationGatePolicy` and `gatewayRestartPolicy` tests, and made the `ConfigMutationKind` import explicit in the interface sketch.
- 2026-02-17: Plan implemented end-to-end. Added extracted operation module, rewired rename/delete handlers, added focused unit coverage, ran typecheck + targeted + full tests, and recorded measured outcomes.
