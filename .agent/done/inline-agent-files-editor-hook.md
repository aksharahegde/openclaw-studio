# Inline Agent Files Editor Hook into AgentInspectPanels

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `.agent/PLANS.md` and must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, the Agent Brain panel will keep the same user-visible behavior (load agent brain files from the gateway, allow editing, auto-save on tab switch/close), but the code will have one fewer exported concept and one fewer file. Specifically, we will remove the single-use hook `useAgentFilesEditor` from `src/features/agents/state/useAgentFilesEditor.ts` and inline the hook logic into `src/features/agents/components/AgentInspectPanels.tsx` (as a file-local hook used only by `AgentBrainPanel`).

This reduces cognitive load: a reader of the Agent Brain UI no longer needs to jump into `state/` for a hook that is not shared anywhere else.

## Progress

- [x] (2026-02-08 18:27Z) Establish baseline by running the existing Agent Brain panel unit tests. [no-beads]
- [x] (2026-02-08 18:29Z) Milestone 1: Inline the hook logic into `src/features/agents/components/AgentInspectPanels.tsx`, remove the external import, and delete `src/features/agents/state/useAgentFilesEditor.ts`. [no-beads]
- [x] (2026-02-08 18:29Z) Milestone 2: Run `typecheck`, unit tests, and `lint` to confirm behavior parity, then commit. [no-beads]

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Inline the hook as a file-local hook in `src/features/agents/components/AgentInspectPanels.tsx` instead of rewriting the Brain panel to inline state/effects directly.
  Rationale: Keeps the Brain panel JSX readable while still deleting the cross-file abstraction and reducing surface area.
  Date/Author: 2026-02-08 / Codex

## Outcomes & Retrospective

Completed.

- Inlined the single-use `useAgentFilesEditor` hook into `src/features/agents/components/AgentInspectPanels.tsx` as a file-local hook used only by `AgentBrainPanel`.
- Deleted `src/features/agents/state/useAgentFilesEditor.ts`.
- Verified `npm run typecheck`, `npm run test`, and `npm run lint` pass.

## Context and Orientation

`src/features/agents/components/AgentInspectPanels.tsx` defines multiple inspect panels, including `AgentBrainPanel`. The Brain panel currently imports `useAgentFilesEditor` from `src/features/agents/state/useAgentFilesEditor.ts`.

`src/features/agents/state/useAgentFilesEditor.ts`:

- Holds local UI state for the Brain panel: selected file tab, file contents, dirty/saving/loading flags, and an error string.
- Calls gateway RPC helpers `readGatewayAgentFile` and `writeGatewayAgentFile` (from `src/lib/gateway/agentFiles.ts`) to fetch and persist the agent files.

Evidence the hook is single-use:

- The only production import is `src/features/agents/components/AgentInspectPanels.tsx`.

Tests covering this behavior:

- `tests/unit/agentBrainPanel.test.ts` renders `AgentBrainPanel` and validates file load, missing agent ID error text, and save-on-close behavior.

## Plan of Work

Milestone 1 moves the hook implementation from `src/features/agents/state/useAgentFilesEditor.ts` into `src/features/agents/components/AgentInspectPanels.tsx` as a file-local hook. The Brain panel continues to call it with the same input shape (`{ client, agentId }`) and uses the same return shape.

Then we delete the now-unused file `src/features/agents/state/useAgentFilesEditor.ts` and remove its import from `AgentInspectPanels.tsx`.

Milestone 2 verifies that this refactor is behavior-preserving by running targeted tests first, then full repo gates. Finally, commit the change.

## Concrete Steps

Run from repo root:

    cd /Users/georgepickett/openclaw-studio

Baseline:

    npm run test -- tests/unit/agentBrainPanel.test.ts

Milestone 1 (implementation):

1. Edit `src/features/agents/components/AgentInspectPanels.tsx`:
   - Remove the import of `useAgentFilesEditor` from `@/features/agents/state/useAgentFilesEditor`.
   - Add imports needed for the hook logic:
     - `createAgentFilesState`, `isAgentFileName` from `@/lib/agents/agentFiles`
     - `readGatewayAgentFile`, `writeGatewayAgentFile` from `@/lib/gateway/agentFiles`
   - Insert a file-local `useAgentFilesEditor` hook (same behavior as the deleted module) near `AgentBrainPanel`.
2. Delete `src/features/agents/state/useAgentFilesEditor.ts`.

Milestone 2 (verification + commit):

    npm run typecheck
    npm run test
    npm run lint

Commit:

    git status --porcelain=v1
    git commit -am "Refactor: inline agent files editor hook"

If `git commit -am` does not include the deleted file, stage it explicitly:

    git add -A
    git commit -m "Refactor: inline agent files editor hook"

## Validation and Acceptance

Acceptance criteria:

1. `tests/unit/agentBrainPanel.test.ts` passes and still verifies:
   - agent file loads into the panel
   - missing agent ID shows "Agent ID is missing for this agent."
   - dirty edits are saved before closing (gateway `agents.files.set` is called)
2. `npm run typecheck`, `npm run test`, and `npm run lint` all pass.
3. `src/features/agents/state/useAgentFilesEditor.ts` no longer exists, and `AgentInspectPanels.tsx` contains the (file-local) hook used by `AgentBrainPanel`.
