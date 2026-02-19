# Consolidate agent inspect panels into one module

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md` in the repository root.

## Purpose / Big Picture

This change reduces duplication in the agent inspect UI by consolidating the settings and brain panels into a single module with a shared header shell. The user-visible behavior should remain the same, but the codebase will have one less file and a single source of truth for the repeated header + close button layout. A developer can verify success by running the app and seeing the same settings and brain panels, while the file count under `src/features/agents/components` is reduced.

## Progress

- [x] (2026-02-06 02:11Z) Drafted ExecPlan and identified candidate files for consolidation.
- [x] (2026-02-06 02:16Z) Created Beads issues for milestones. [bd-2j1, bd-309]
- [x] (2026-02-06 02:20Z) Milestone 1: Consolidated agent inspect panels into a single module with shared header shell. [bd-2j1]
- [x] (2026-02-06 02:20Z) Milestone 2: Updated imports, removed obsolete files, and verified via npm test/lint/typecheck. [bd-309]

## Surprises & Discoveries

- Observation: No behavioral changes were required; the refactor was purely a module move + shared header extraction.
  Evidence: `npm test`, `npm run lint`, and `npm run typecheck` all passed after the move.

## Decision Log

- Decision: Consolidate `AgentSettingsPanel` and `AgentBrainPanel` into a single module and extract a shared header component inside that module.
  Rationale: These panels share the same header/close button layout and panel shell; merging reduces file count and removes repeated UI concepts with minimal blast radius.
  Date/Author: 2026-02-06 (Codex).

## Outcomes & Retrospective

Consolidated the agent inspect panels into a single module:

- Added `src/features/agents/components/AgentInspectPanels.tsx` exporting `AgentSettingsPanel` and `AgentBrainPanel`.
- Deleted `src/features/agents/components/AgentSettingsPanel.tsx` and `src/features/agents/components/AgentBrainPanel.tsx`.
- Updated imports in `src/app/page.tsx`.
- Updated unit test imports in `tests/unit/agentSettingsPanel.test.ts` and `tests/unit/agentBrainPanel.test.ts`.

Validation:

- `npm test`
- `npm run lint`
- `npm run typecheck`

## Context and Orientation

The agent inspect UI lives in `src/features/agents/components`. The settings panel is in `src/features/agents/components/AgentSettingsPanel.tsx` and the brain files panel is in `src/features/agents/components/AgentBrainPanel.tsx`. Both panels render a near-identical header area with a title block and a close button, and both use the `agent-inspect-panel` CSS class defined in `src/app/globals.css`.

The main page (`src/app/page.tsx`) imports and renders both panels. This consolidation will keep public exports and props unchanged so call sites remain simple. No changes to styles, DOM structure outside the shared header, or runtime logic should be observable to users.

## Plan of Work

First, introduce a new module `src/features/agents/components/AgentInspectPanels.tsx`. Move the full content of both `AgentSettingsPanel` and `AgentBrainPanel` into this file. Inside this file, define a small shared component (for example `AgentInspectHeader`) that renders the shared header layout and close button styling, accepting the title, subtitle, and close handler. Update both panels to use the shared header component so the duplicated markup and button styling live in one place.

Second, update `src/app/page.tsx` to import both panels from the new module. Update unit tests that import the panels (`tests/unit/agentSettingsPanel.test.ts` and `tests/unit/agentBrainPanel.test.ts`) to use the new module path as well.

Third, remove the old files `src/features/agents/components/AgentSettingsPanel.tsx` and `src/features/agents/components/AgentBrainPanel.tsx` once the new module is in use. Ensure exports are named the same (`AgentSettingsPanel`, `AgentBrainPanel`) so call sites only need the import path updated.

Finally, run unit tests, lint, and typecheck to confirm the refactor is clean. If anything fails, fix issues in the new module before proceeding.

## Concrete Steps

1. From the repository root, if Beads is in use, create issues for each milestone.

   Example (replace with real IDs):

     br create "Milestone 1: Consolidate agent inspect panels" --type task --priority 2 --description "Move AgentSettingsPanel and AgentBrainPanel into a single module with a shared header shell. Keep exports stable and behavior unchanged."
     br create "Milestone 2: Update imports and remove old files" --type task --priority 2 --description "Update app/page imports, delete old panel files, and run lint/typecheck."

   Then link dependencies:

     br dep add <milestone-2-id> <milestone-1-id>

2. Create `src/features/agents/components/AgentInspectPanels.tsx` and move both panel implementations into it. Define and use a shared header component inside the file to unify the repeated header markup and close button styling.

3. Update `src/app/page.tsx` to import `AgentSettingsPanel` and `AgentBrainPanel` from the new module path.

4. Update unit test imports:

   - `tests/unit/agentSettingsPanel.test.ts`
   - `tests/unit/agentBrainPanel.test.ts`

5. Delete the old files `src/features/agents/components/AgentSettingsPanel.tsx` and `src/features/agents/components/AgentBrainPanel.tsx`.

6. Run unit tests, lint, and typecheck from the repository root:

     npm test
     npm run lint
     npm run typecheck

   All commands must complete without errors.

7. Commit changes after verification passes with a message like: "Milestone 2: Consolidate agent inspect panels".

## Validation and Acceptance

Acceptance is met when:

1. The application renders the settings and brain panels with the same visible UI and behavior as before, including working close buttons and all panel-specific controls.
2. The file count is reduced by one: `AgentSettingsPanel.tsx` and `AgentBrainPanel.tsx` no longer exist, replaced by `AgentInspectPanels.tsx`.
3. `npm test`, `npm run lint`, and `npm run typecheck` succeed from the repository root.

For Milestone 1, if possible, add a minimal unit test only if there is an existing test harness for component structure; otherwise, rely on lint/typecheck and manual visual confirmation.

## Idempotence and Recovery

This refactor is safe to repeat because it only moves code and updates imports. If something breaks, revert by restoring the two original files and re-pointing the imports. Keep the content identical to avoid drift.

## Artifacts and Notes

- Expected `rg` output after consolidation (example):

    rg -n "AgentSettingsPanel" src/features/agents/components
    src/features/agents/components/AgentInspectPanels.tsx:... export const AgentSettingsPanel ...

## Interfaces and Dependencies

The following public component interfaces must remain unchanged:

- `AgentSettingsPanel` props: `agent`, `onClose`, `onRename`, `onNewSession`, `onDelete`, `canDelete`, `onToolCallingToggle`, `onThinkingTracesToggle`, `cronJobs`, `cronLoading`, `cronError`, `cronRunBusyJobId`, `cronDeleteBusyJobId`, `onRunCronJob`, `onDeleteCronJob`, `heartbeats`, `heartbeatLoading`, `heartbeatError`, `heartbeatRunBusyId`, `heartbeatDeleteBusyId`, `onRunHeartbeat`, `onDeleteHeartbeat`.

- `AgentBrainPanel` props: `client`, `agents`, `selectedAgentId`, `onClose`.

The new shared header component should be file-private within `AgentInspectPanels.tsx` and not exported.

---

Plan revision note (2026-02-06): Updated the plan to include unit test import-path updates and to require `npm test` during verification. This avoids a predictable failure mode where the old component import paths break after consolidation.
