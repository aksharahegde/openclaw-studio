# Consolidate Mutation Lifecycle Policy into One Workflow Module

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `.agent/PLANS.md` and must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, OpenClaw Studio will have one mutation-lifecycle policy surface for create, rename, and delete agent config changes. Today that policy is split between two modules, which forces contributors to learn and update two files for one concept: mutation start guards, timeout logic, post-run dispositions, and user-facing lock-screen status lines.

User-visible behavior should remain unchanged. Rename/delete/create mutation locking, queued-state messaging, and restart-wait behavior should work exactly as they do now. The gain is internal: fewer concepts, fewer files, and fewer opportunities for drift when mutation lifecycle behavior changes.

## Progress

- [x] (2026-02-20 02:46Z) Re-audited the repository after the previous permissions consolidation.
- [x] (2026-02-20 02:46Z) Identified the top consolidation seam: split mutation-lifecycle policy across `configMutationWorkflow.ts` and `agentMutationLifecycleController.ts`.
- [x] (2026-02-20 02:46Z) Authored this ExecPlan in `.agent/execplan-pending.md`.
- [x] (2026-02-20 02:49Z) Implemented Milestone 1 by creating `src/features/agents/operations/mutationLifecycleWorkflow.ts` and migrating lifecycle policy exports from the two legacy modules.
- [x] (2026-02-20 02:50Z) Implemented Milestone 2 by rewiring source imports in `src/app/page.tsx`, `createAgentMutationLifecycleOperation.ts`, and `agentConfigMutationLifecycleOperation.ts`, then deleting `configMutationWorkflow.ts` and `agentMutationLifecycleController.ts`.
- [x] (2026-02-20 02:51Z) Implemented Milestone 3 by consolidating lifecycle tests into `tests/unit/mutationLifecycleWorkflow.test.ts` + `tests/unit/mutationLifecycleWorkflow.integration.test.ts`, updating `ARCHITECTURE.md`, and running validation commands.

## Surprises & Discoveries

- Observation: one runtime flow composes policy from two modules in the same function.
  Evidence: `src/features/agents/operations/agentConfigMutationLifecycleOperation.ts` imports from both `configMutationWorkflow` and `agentMutationLifecycleController`.

- Observation: post-run lifecycle semantics exist in two representations that encode the same outcome.
  Evidence: `src/features/agents/operations/configMutationWorkflow.ts` exports `resolveConfigMutationPostRunEffects(...)`, while `src/features/agents/operations/agentMutationLifecycleController.ts` exports `buildMutationSideEffectCommands(...)`; both map `completed` vs `awaiting-restart` into side effects.

- Observation: several exports are effectively test-facing scaffolding, not runtime dependencies.
  Evidence: `buildMutatingMutationBlock` and `resolveConfigMutationPostRunEffects` are referenced by tests but not by source runtime call paths.

- Observation: consolidation removed all source/test imports of the legacy lifecycle modules in one pass without interface churn.
  Evidence: `rg -n "configMutationWorkflow|agentMutationLifecycleController" ARCHITECTURE.md src tests` returns no matches after migration.

- Observation: full-suite baseline still includes three timeout failures in `tests/unit/agentSettingsPanel.test.ts` unrelated to lifecycle policy changes.
  Evidence: `npm run test` failed only at `autosaves_updated_permissions_draft`, `submits_modal_with_agent_scoped_draft`, and `keeps_modal_open_and_shows_error_when_create_fails`; all new lifecycle tests passed.

## Decision Log

- Decision: choose mutation-lifecycle policy consolidation as the single best refactor.
  Rationale: it removes a duplicated abstraction seam with low blast radius and clear verification through existing unit/integration tests.
  Date/Author: 2026-02-20 / Codex

- Decision: consolidate into a new module named `src/features/agents/operations/mutationLifecycleWorkflow.ts` and remove both legacy modules.
  Rationale: a neutral name avoids “config-only” confusion and keeps create/rename/delete lifecycle policy in one discoverable location.
  Date/Author: 2026-02-20 / Codex

- Decision: keep command-based post-run effects as the single canonical representation.
  Rationale: command lists are already used by runtime orchestration and are easier to execute deterministically than boolean effect bags.
  Date/Author: 2026-02-20 / Codex

- Decision: retain compatibility exports (`resolveConfigMutationPostRunEffects`, `buildMutatingMutationBlock`) in the consolidated module for existing tests while centralizing all policy in one file.
  Rationale: preserves behavior and avoids unnecessary test semantic rewrites during structural consolidation.
  Date/Author: 2026-02-20 / Codex

## Outcomes & Retrospective

Implemented outcome: lifecycle policy for create/rename/delete now lives in one file, `src/features/agents/operations/mutationLifecycleWorkflow.ts`. The legacy split modules were removed, source call sites were rewired, lifecycle tests were consolidated to the new module boundary, and architecture documentation now describes the consolidated module.

Validation outcome:

- `npm run test -- --run tests/unit/mutationLifecycleWorkflow.test.ts tests/unit/mutationLifecycleWorkflow.integration.test.ts` passed.
- `npm run typecheck` passed.
- `npm run test` failed only on the known baseline `agentSettingsPanel` timeout trio and showed no lifecycle-specific regressions.

No user-visible behavior changes were introduced in mutation gating, status line messaging, or post-run side effect execution.

## Context and Orientation

Mutation lifecycle in this repository controls how agent config changes are gated and applied when runs are active. The relevant user flows are:

1. Create flow in `src/app/page.tsx` using `runCreateAgentMutationLifecycle`.
2. Rename/delete flow in `src/app/page.tsx` using `runAgentConfigMutationLifecycle`.
3. Status-line rendering in `src/app/page.tsx` for queued/mutating/restart states.

Today, lifecycle policy is split:

- `src/features/agents/operations/agentMutationLifecycleController.ts` contains start guard logic, queued block builders, timeout intent, and command mapping.
- `src/features/agents/operations/configMutationWorkflow.ts` contains remote/local mutation disposition, failure messages, and status-line text.

This split is a duplicate-abstraction smell because one conceptual policy boundary now requires synchronized edits in two modules plus dual test suites.

## Plan of Work

Milestone 1 creates `src/features/agents/operations/mutationLifecycleWorkflow.ts` and migrates all lifecycle policy there. Copy behavior, not style. Keep function contracts stable where possible so call-site changes are import rewires, not semantic rewrites. The consolidated module should contain:

- mutation start guard resolution,
- queued-block helpers,
- timeout intent,
- run/disposition workflow for local vs remote mutation,
- user-facing status-line text,
- failure message mapping,
- command-based post-run side effects.

Milestone 2 rewires runtime imports and removes old modules. Update:

- `src/app/page.tsx`,
- `src/features/agents/operations/createAgentMutationLifecycleOperation.ts`,
- `src/features/agents/operations/agentConfigMutationLifecycleOperation.ts`.

Then delete:

- `src/features/agents/operations/agentMutationLifecycleController.ts`,
- `src/features/agents/operations/configMutationWorkflow.ts`.

Milestone 3 consolidates tests and documentation. Replace split module tests with a consolidated `mutationLifecycleWorkflow` test surface and keep existing behavior assertions. Update `ARCHITECTURE.md` module list references so it documents one lifecycle workflow module, not two.

## Concrete Steps

Run from repository root:

    cd /Users/georgepickett/openclaw-studio

Baseline evidence:

    rg -n "from \"@/features/agents/operations/(configMutationWorkflow|agentMutationLifecycleController)\"" src tests

Milestone 1 implementation:

    # Create src/features/agents/operations/mutationLifecycleWorkflow.ts
    # Move/merge lifecycle policy exports from both old modules.

Milestone 2 import rewiring and deletion:

    # Update imports in page + operations to the new module path.
    # Delete old modules.

    rg -n "configMutationWorkflow|agentMutationLifecycleController" src

Milestone 3 tests and docs:

    # Rename/merge tests to mutationLifecycleWorkflow-focused files.
    # Update ARCHITECTURE.md references in module list and flow narrative.

    npm run test -- --run tests/unit/mutationLifecycleWorkflow.test.ts tests/unit/mutationLifecycleWorkflow.integration.test.ts
    npm run typecheck
    npm run test

Expected structural output after migration:

    rg -n "configMutationWorkflow|agentMutationLifecycleController" src tests

should show no runtime imports of deleted modules.

## Validation and Acceptance

Acceptance is complete when all conditions below are true.

1. One lifecycle policy module exists at `src/features/agents/operations/mutationLifecycleWorkflow.ts` and both old modules are removed.
2. Create and rename/delete mutation flows still gate on connection and active blocks exactly as before.
3. Queued/mutating/awaiting-restart status line behavior in `src/app/page.tsx` remains unchanged.
4. Lifecycle unit/integration tests pass from consolidated imports.
5. `npm run typecheck` passes, and `npm run test` has no new failures attributable to this refactor.

## Idempotence and Recovery

This is a structural refactor with no data migration. It is safe to retry.

If migration breaks mid-way, restore the two original modules and temporary dual-import call sites, then re-run with smaller steps: first create the new consolidated module, then migrate one consumer at a time, then delete old files last.

If full-suite tests fail due pre-existing baseline instability unrelated to lifecycle policy, document exact failing tests and verify all lifecycle-focused tests still pass before proceeding.

## Artifacts and Notes

Capture these artifacts during implementation:

    rg -n "configMutationWorkflow|agentMutationLifecycleController" src tests

    npm run test -- --run tests/unit/mutationLifecycleWorkflow.test.ts tests/unit/mutationLifecycleWorkflow.integration.test.ts

    npm run typecheck

    npm run test

These outputs prove structural consolidation and behavior parity.

## Interfaces and Dependencies

At completion, `src/features/agents/operations/mutationLifecycleWorkflow.ts` must export the lifecycle policy APIs consumed by runtime call sites. Preserve existing signatures where practical for low-risk migration, including start guard, queued block builder, timeout resolver, status-line resolver, mutation run workflow, failure message mapping, and side-effect command generation.

No third-party dependencies should be added.

Plan update note (2026-02-20): Initial plan authored after repository analysis selected mutation-lifecycle policy consolidation as the highest-payoff low-blast refactor seam.
Plan update note (2026-02-20): Completed implementation and validation; consolidated lifecycle policy into `mutationLifecycleWorkflow.ts`, removed legacy modules, migrated tests/docs, and documented unchanged baseline `agentSettingsPanel` timeouts observed in full-suite runs.
