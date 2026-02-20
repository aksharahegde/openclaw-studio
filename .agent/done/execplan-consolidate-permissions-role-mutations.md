# Consolidate Execution-Role and Permissions Mutations into One Operation Boundary

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `.agent/PLANS.md` and must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, OpenClaw Studio will have one permissions mutation boundary instead of two partially overlapping paths. Today, the app updates agent permissions through `updateAgentPermissionsViaStudio` in one module and updates execution role through `updateExecutionRoleViaStudio` in a different module, even though both perform the same core sequence: read approvals policy, update policy, read gateway config, derive tool overrides, patch config, and sync session execution settings.

From a user perspective, behavior stays the same: new agents still bootstrap into autonomous execution defaults, and the Settings panel still saves command mode plus web/file tool toggles. The difference is internal clarity. Contributors will make permission changes in one place, with one test surface, and fewer opportunities for behavior drift.

## Progress

- [x] (2026-02-20 02:38Z) Completed deep repo analysis of core flows and selected one consolidation target with the best payoff-to-blast ratio.
- [x] (2026-02-20 02:38Z) Verified duplicate permission mutation choreography across `src/features/agents/operations/agentPermissionsOperation.ts` and `src/features/agents/operations/executionRoleUpdateOperation.ts`.
- [x] (2026-02-20 02:38Z) Drafted this ExecPlan in `.agent/execplan-pending.md`.
- [x] (2026-02-20 02:41Z) Implemented Milestone 1 by consolidating role-only mutation logic into `src/features/agents/operations/agentPermissionsOperation.ts`, extracting shared internals, and deleting `src/features/agents/operations/executionRoleUpdateOperation.ts`.
- [x] (2026-02-20 02:41Z) Implemented Milestone 2 by rewiring `src/app/page.tsx` and test imports to the consolidated permissions module, renaming the role-helper unit suite to `tests/unit/agentPermissionsRoleHelpers.test.ts`, and removing all source/test references to `executionRoleUpdateOperation`.
- [x] (2026-02-20 02:43Z) Implemented Milestone 3 by updating `ARCHITECTURE.md`, running `npm run typecheck` (pass), and running targeted/full unit suites (all affected consolidation tests pass; only existing `tests/unit/agentSettingsPanel.test.ts` timeout failures remain).

## Surprises & Discoveries

- Observation: both permission mutation paths call the same backend sequence with different entry payloads.
  Evidence: `src/features/agents/operations/executionRoleUpdateOperation.ts:73` to `src/features/agents/operations/executionRoleUpdateOperation.ts:136` and `src/features/agents/operations/agentPermissionsOperation.ts:241` to `src/features/agents/operations/agentPermissionsOperation.ts:308` each perform approvals policy update, config read, tool override patch, and `sessions.patch` sync.

- Observation: the role-update module already depends on and re-exports role helpers from the permissions module, which is a thin-wrapper smell.
  Evidence: `src/features/agents/operations/executionRoleUpdateOperation.ts:9` to `src/features/agents/operations/executionRoleUpdateOperation.ts:18` imports and re-exports helpers from `agentPermissionsOperation`.

- Observation: page-level create bootstrap and settings save currently use different modules for the same domain concept.
  Evidence: `src/app/page.tsx:1488` calls `updateExecutionRoleViaStudio`, while `src/app/page.tsx:2178` calls `updateAgentPermissionsViaStudio`.

- Observation: repository baseline still has three timeout failures in `tests/unit/agentSettingsPanel.test.ts`, unrelated to permissions-module consolidation.
  Evidence: `npm run test` and targeted runs both fail only at `autosaves_updated_permissions_draft`, `submits_modal_with_agent_scoped_draft`, and `keeps_modal_open_and_shows_error_when_create_fails`, while consolidation-focused tests pass.

- Observation: keeping the old role-helper test filename would preserve the deprecated operation concept in repository navigation.
  Evidence: renamed `tests/unit/executionRoleUpdateOperation.test.ts` to `tests/unit/agentPermissionsRoleHelpers.test.ts` after rewiring imports so test intent now matches the consolidated module.

## Decision Log

- Decision: choose permissions-domain consolidation as the single refactor target instead of a large `src/app/page.tsx` split.
  Rationale: this removes a full duplicate abstraction layer with limited blast radius and clear rollback/testing paths.
  Date/Author: 2026-02-20 / Codex

- Decision: remove `src/features/agents/operations/executionRoleUpdateOperation.ts` and move any still-needed exports into `src/features/agents/operations/agentPermissionsOperation.ts`.
  Rationale: one file per domain concept is easier for new contributors than two files with overlapping orchestration.
  Date/Author: 2026-02-20 / Codex

- Decision: keep external behavior stable by preserving the `updateExecutionRoleViaStudio` function signature (relocated), then gradually migrate call sites to the broader permissions API only where behavior is intentionally equivalent.
  Rationale: this enables consolidation now without forcing risky behavior changes in the same pass.
  Date/Author: 2026-02-20 / Codex

- Decision: treat the three `agentSettingsPanel` timeout tests as pre-existing validation debt and not a blocker for this consolidation.
  Rationale: they fail in isolation without touching the settings panel implementation in this refactor, while all changed-path tests pass.
  Date/Author: 2026-02-20 / Codex

## Outcomes & Retrospective

Implemented outcome: OpenClaw Studio now has one permissions-domain mutation module. `src/features/agents/operations/executionRoleUpdateOperation.ts` was removed, role-only and draft-based mutation entrypoints now live together in `src/features/agents/operations/agentPermissionsOperation.ts`, and page/docs/test imports were rewired to that consolidated boundary.

Validation outcome:

- `npm run typecheck` passed.
- Consolidation-focused tests passed (`tests/unit/agentPermissionsOperation.test.ts`, `tests/unit/agentPermissionsRoleHelpers.test.ts`, `tests/unit/createAgentMutationLifecycleOperation.test.ts`).
- Full `npm run test` fails only on three known `tests/unit/agentSettingsPanel.test.ts` timeout cases that predate this change and are documented in this plan.

Residual gap: repository-level baseline still includes the three `agentSettingsPanel` timeout failures and should be handled in a separate hardening pass.

## Context and Orientation

OpenClaw Studio is a Next.js frontend where agent runtime state is managed client-side in `src/app/page.tsx` and gateway mutations are encapsulated in operation modules under `src/features/agents/operations`.

A “permissions mutation” in this repository means any gateway write that changes how an agent can execute commands and tools. In practice this includes:

- Exec approvals policy (`exec.approvals.set`), which controls security level and ask behavior.
- Agent tool-group overrides (`config.patch` via `updateGatewayAgentOverrides`), which controls runtime/web/fs tool groups.
- Session execution settings (`sessions.patch` via `syncGatewaySessionSettings`), which controls current session execution host/security/ask.

Before this refactor, two files owned this same concept:

- `src/features/agents/operations/agentPermissionsOperation.ts` handles full Settings-panel draft updates (`commandMode`, `webAccess`, `fileTools`).
- `src/features/agents/operations/executionRoleUpdateOperation.ts` handled role-only updates for post-create autonomous bootstrap.

The duplication creates shotgun surgery risk: any future change to approvals policy mapping, sandbox-mode handling, or session sync behavior must be applied in both files and both test suites.

## Plan of Work

Milestone 1 consolidates behavior by moving role-update orchestration into `src/features/agents/operations/agentPermissionsOperation.ts` and deleting duplicate mutation choreography from `src/features/agents/operations/executionRoleUpdateOperation.ts`. Keep function-level behavior stable by relocating `updateExecutionRoleViaStudio` and `resolveRuntimeToolOverridesForRole` into the consolidated module, then implementing both public entrypoints (`updateExecutionRoleViaStudio`, `updateAgentPermissionsViaStudio`) through shared internal primitives.

Milestone 2 updates callers and tests. Update `src/app/page.tsx` imports so all permissions-domain functions come from `agentPermissionsOperation`. Update unit tests so execution-role and full-draft mutation behavior are validated in one suite (or in two suites that target one module). Remove test imports tied to the deleted file path.

Milestone 3 validates the consolidation and updates architecture text that currently points to the removed file. The most important architecture reference to update is in `ARCHITECTURE.md` where execution-role updates are currently documented under `executionRoleUpdateOperation.ts`.

## Concrete Steps

Run all commands from repository root:

    cd /Users/georgepickett/openclaw-studio

Establish duplicate baseline evidence:

    rg -n "updateExecutionRoleViaStudio|updateAgentPermissionsViaStudio|resolveSessionExecSettingsForRole" src/features/agents/operations src/app/page.tsx

Implement Milestone 1 (consolidate operations):

    # Edit src/features/agents/operations/agentPermissionsOperation.ts
    # - add/relocate resolveRuntimeToolOverridesForRole
    # - add/relocate updateExecutionRoleViaStudio
    # - extract shared private mutation helpers used by both role-only and draft-based entrypoints

    # Remove src/features/agents/operations/executionRoleUpdateOperation.ts

    rg -n "updateExecutionRoleViaStudio|resolveRuntimeToolOverridesForRole" src/features/agents/operations

Implement Milestone 2 (rewire callers/tests):

    # Edit src/app/page.tsx imports to use agentPermissionsOperation only
    # Edit tests to import from agentPermissionsOperation path

    rg -n "executionRoleUpdateOperation" src tests ARCHITECTURE.md

    npm run test -- --run tests/unit/agentPermissionsOperation.test.ts

Implement Milestone 3 (full validation + docs):

    # Update ARCHITECTURE.md references to consolidated permissions module ownership

    npm run typecheck
    npm run test -- --run tests/unit/agentPermissionsOperation.test.ts tests/unit/createAgentMutationLifecycleOperation.test.ts tests/unit/agentSettingsPanel.test.ts

    npm run test

Expected command-level evidence after consolidation:

    rg -n "executionRoleUpdateOperation" src tests

should return no code/test imports for the removed path.

## Validation and Acceptance

Acceptance is complete when all conditions below are true.

1. `src/features/agents/operations/executionRoleUpdateOperation.ts` no longer exists.
2. `src/features/agents/operations/agentPermissionsOperation.ts` exports both role-only and draft-based mutation entrypoints, with shared internal mutation choreography.
3. `src/app/page.tsx` still performs post-create autonomous bootstrap and settings-permissions save using the consolidated module.
4. Unit coverage for role mapping and permissions mutation behavior runs from consolidated imports and passes.
5. `npm run typecheck` passes, and `npm run test` has no new failures from this consolidation (current baseline still includes three known `agentSettingsPanel` timeout failures).

Behavioral verification for a human:

- Create a new agent from the UI.
- Confirm Studio opens that agent’s settings and autonomous defaults still apply.
- Change command mode/web/file toggles in Settings, save, and confirm settings persist after reload.

## Idempotence and Recovery

This plan is a structural refactor and is safe to rerun. If Milestone 1 fails midway, restore the removed file from git and re-run with shared helpers extracted first, then delete the old file only after tests pass. If caller rewiring fails, keep compatibility exports in `agentPermissionsOperation.ts` and postpone import cleanup until tests are green.

No data migrations, directory deletions, or irreversible gateway-side mutations are required for this plan.

## Artifacts and Notes

Capture concise evidence snippets during implementation:

    npm run test -- --run tests/unit/agentPermissionsOperation.test.ts

    npm run typecheck

    npm run test

    rg -n "executionRoleUpdateOperation" src tests ARCHITECTURE.md

Use these outputs to prove the duplicate path was removed and behavior remained stable.

## Interfaces and Dependencies

At the end of this plan, `src/features/agents/operations/agentPermissionsOperation.ts` must remain the single permissions-domain module and expose stable interfaces for both flows:

- `updateAgentPermissionsViaStudio(params: { client; agentId; sessionKey; draft; loadAgents? })`
- `updateExecutionRoleViaStudio(params: { client; agentId; sessionKey; role; loadAgents })`
- Shared role/policy helpers (`resolveExecApprovalsPolicyForRole`, `resolveSessionExecSettingsForRole`, and role/draft mappers).

No new dependencies are required. This refactor only reorganizes existing TypeScript modules and tests.

Plan update note (2026-02-20): Initial plan authored after repository analysis identified duplicate permissions mutation orchestration as the highest-value low-blast consolidation seam.
Plan update note (2026-02-20): Completed implementation and validation of permissions/role mutation consolidation, rewired code and docs to the single module boundary, and recorded existing unrelated test baseline failures observed during full-suite execution.
