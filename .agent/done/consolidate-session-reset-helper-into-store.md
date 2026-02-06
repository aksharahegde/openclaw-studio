# Consolidate Session Reset Patch Helper Into `src/features/agents/state/store.tsx`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan requirements live at `.agent/PLANS.md` and this document must be maintained in accordance with it.

## Purpose / Big Picture

The focused agent UI has a single-purpose helper `buildNewSessionAgentPatch` in `src/features/agents/state/agentSessionActions.ts`. It is only used in one production file (`src/app/page.tsx`) and exists solely to build a `Partial<AgentState>` that clears runtime fields when the user starts a new session.

After this change:

1. The session-reset patch helper is exported from `src/features/agents/state/store.tsx` (where `AgentState` is defined and other store helpers live).
2. The standalone module `src/features/agents/state/agentSessionActions.ts` is deleted.
3. The standalone unit test file for the deleted module is folded into the existing `tests/unit/agentStore.test.ts`, and the old test file is deleted.
4. `ARCHITECTURE.md` is updated to stop referencing the deleted file.

This reduces surface area by removing a file-level concept (“agent session actions”) that is just one pure function and is not a true subsystem.

## Scope and Constraints (Assumptions)

- Production-level caution: we must preserve behavior and keep tests passing.
- `buildNewSessionAgentPatch` is a pure helper and has no side effects.
- This is a consolidation-only refactor: no changes to runtime semantics, naming, or UI behavior.

## Mental Model (Evidence-Based)

Core concepts and locations:

- Agent runtime state type and store helpers: `src/features/agents/state/store.tsx`
- Session-reset patch builder (to inline): `src/features/agents/state/agentSessionActions.ts`
- Production caller: `src/app/page.tsx`
- Unit test: `tests/unit/agentSessionActions.test.ts`

Dependency highlights:

- Only two imports exist today:
  - `src/app/page.tsx` imports `buildNewSessionAgentPatch` from `@/features/agents/state/agentSessionActions`
  - `tests/unit/agentSessionActions.test.ts` imports the same symbol

Smell:

- Thin wrapper module: a separate file exists for one function operating on a type defined in another file, and it is not reused elsewhere.

## Candidate Refactors Ranked

Scores: 1 (low) to 5 (high). For Blast radius, higher means smaller/safer.

| Candidate | Payoff (30%) | Blast Radius (25%) | Cognitive Load (20%) | Velocity Unlock (15%) | Validation / Rollback (10%) | Weighted |
|---|---:|---:|---:|---:|---:|---:|
| Delete `agentSessionActions.ts` by moving `buildNewSessionAgentPatch` into `store.tsx` and folding the unit test into `agentStore.test.ts` | 4 | 5 | 4 | 2 | 5 | 4.05 |
| Delete `src/lib/utils.ts` by inlining `cn()` into its only caller | 3 | 5 | 2 | 1 | 5 | 3.20 |

## Proposed Change (The Call)

Move `buildNewSessionAgentPatch` into `src/features/agents/state/store.tsx`, delete `src/features/agents/state/agentSessionActions.ts`, and fold the unit test into `tests/unit/agentStore.test.ts`.

### Files Impacted

- `src/features/agents/state/store.tsx`
- `src/features/agents/state/agentSessionActions.ts` (delete)
- `src/app/page.tsx`
- `tests/unit/agentStore.test.ts`
- `tests/unit/agentSessionActions.test.ts` (delete)
- `ARCHITECTURE.md`

### Acceptance Criteria

1. `src/features/agents/state/agentSessionActions.ts` does not exist.
2. `tests/unit/agentSessionActions.test.ts` does not exist.
3. `rg -n "@/features/agents/state/agentSessionActions" src tests` returns no results.
4. `npm run typecheck`, `npm run lint`, and `npm test` all pass.
5. `ARCHITECTURE.md` no longer references the deleted file and still describes the “New session” behavior accurately.

### Risks and Mitigations

- Risk: store module becomes a grab bag.
  Mitigation: keep the helper near other exported store helpers; the helper is specifically about resetting `AgentState` fields, so it belongs with the type definition.

## Progress

- [x] Milestone 1: Move helper into `store.tsx` and update production import. (2026-02-06 04:30:43Z)
- [x] Milestone 2: Fold unit test into `agentStore.test.ts`, delete the old module and test file, update `ARCHITECTURE.md`, and run checks. (2026-02-06 04:32:12Z)

## Surprises & Discoveries

- None.

## Decision Log

- Decision: Co-locate the session-reset patch builder with the `AgentState` definition and delete the standalone “agent session actions” module.
  Rationale: The module is a single pure helper with one production caller; deleting it reduces file-level surface area with minimal blast radius and clear tests.
  Date/Author: 2026-02-06 / Codex

## Outcomes & Retrospective

- `buildNewSessionAgentPatch` now lives alongside `AgentState` in `src/features/agents/state/store.tsx`.
- Deleted the standalone `src/features/agents/state/agentSessionActions.ts` module and the corresponding unit test file.
- Updated docs (`ARCHITECTURE.md`) to reference the new location.
- Validation: `npm run typecheck`, `npm run lint`, and `npm test` all passed.

## Plan of Work

### Milestone 1: Move Helper + Update Prod Import

1. Edit `src/features/agents/state/store.tsx`:
   - Add an exported function `buildNewSessionAgentPatch(agent: AgentState): Partial<AgentState>` with the exact same return value as the current helper in `src/features/agents/state/agentSessionActions.ts`.

2. Edit `src/app/page.tsx`:
   - Replace the import of `buildNewSessionAgentPatch` from `@/features/agents/state/agentSessionActions` with an import from `@/features/agents/state/store`.

3. Run:
   - `npm run typecheck`

### Milestone 2: Fold Test + Delete Files + Update Docs

1. Edit `tests/unit/agentStore.test.ts`:
   - Add a new test case that asserts `buildNewSessionAgentPatch` clears runtime session state fields (copy the existing assertions from `tests/unit/agentSessionActions.test.ts`).
   - Import `buildNewSessionAgentPatch` and (if needed) `AgentState` from `@/features/agents/state/store`.

2. Delete:
   - `src/features/agents/state/agentSessionActions.ts`
   - `tests/unit/agentSessionActions.test.ts`

3. Update `ARCHITECTURE.md`:
   - In the “Session lifecycle actions” bullet, remove the reference to `src/features/agents/state/agentSessionActions.ts` and instead reference `src/features/agents/state/store.tsx` (or omit the helper name if the bullet is clearer without it).

4. Validate:
   - `rg -n "@/features/agents/state/agentSessionActions" src tests` (expect no hits)
   - `npm run lint`
   - `npm test`

## Concrete Steps

From repo root:

1. `rg -n "@/features/agents/state/agentSessionActions" src tests`
2. Implement Milestone 1 edits.
3. `npm run typecheck`
4. Implement Milestone 2 edits.
5. `rg -n "@/features/agents/state/agentSessionActions" src tests`
6. `npm run lint`
7. `npm test`

## Validation and Acceptance

This is accepted when:

- Both files are deleted and no imports remain.
- Typecheck, lint, and unit tests pass.
- `ARCHITECTURE.md` matches the new file locations.

## Idempotence and Recovery

This change is safe to retry.

Rollback plan:

- Restore `src/features/agents/state/agentSessionActions.ts` and `tests/unit/agentSessionActions.test.ts`.
- Revert `src/app/page.tsx` to import from `agentSessionActions`.
- Re-run `npm test` to confirm the rollback.
