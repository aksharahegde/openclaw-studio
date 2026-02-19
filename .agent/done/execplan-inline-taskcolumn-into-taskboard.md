# Inline TaskColumn Into TaskBoard (Delete `TaskColumn.tsx`)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md` in this repository.

## Purpose / Big Picture

The task control-plane UI is currently split across two components:

- `src/features/task-control-plane/components/TaskBoard.tsx`
- `src/features/task-control-plane/components/TaskColumn.tsx`

`TaskColumn` is not reused anywhere else. It exists only to support `TaskBoard`, which means it is an extra file-level concept a new contributor must open and understand without providing reuse or meaningful isolation.

After this change, `TaskBoard.tsx` contains the column rendering implementation inline (as a local component), `TaskColumn.tsx` is deleted, and there are no remaining imports of `TaskColumn`. This reduces surface area (one fewer file/component concept) while keeping behavior the same.

You can see it working by visiting `/control-plane` and by running unit tests and the normal build gates.

## Progress

- [x] (2026-02-06 20:21Z) Characterize current TaskColumn usage and behavior; capture evidence in this plan.
- [x] (2026-02-06 20:22Z) Inline TaskColumn implementation into `TaskBoard.tsx` and delete `TaskColumn.tsx`.
- [x] (2026-02-06 20:23Z) Update tests (and add one small regression test if needed), then run lint/test/typecheck/build.
- [x] (2026-02-06 20:24Z) Commit the refactor and archive this ExecPlan to `.agent/done/`.

## Surprises & Discoveries

- (none yet)

## Decision Log

- Decision: Inline `TaskColumn` into `TaskBoard` and delete `TaskColumn.tsx`.
  Rationale: `TaskColumn` has a single caller and no independent reuse; deleting the extra module reduces cognitive load with minimal blast radius and an easy rollback (git revert).
  Date/Author: 2026-02-06 / Codex

## Outcomes & Retrospective

- Inlined the task control-plane column renderer into `src/features/task-control-plane/components/TaskBoard.tsx` and deleted `src/features/task-control-plane/components/TaskColumn.tsx`.
- Added a regression test that locks `updatedAt: null` to render `Updated: Unknown update time`.
- Gates pass: `npm run lint`, `npm run test`, `npm run typecheck`, `npm run build`.
- Refactor commit: 8a6f1e6

## Context and Orientation

Relevant files:

- `src/app/control-plane/page.tsx`: fetches the snapshot and renders `<TaskBoard snapshot={...} />`.
- `src/features/task-control-plane/components/TaskBoard.tsx`: renders the header and three columns.
- `src/features/task-control-plane/components/TaskColumn.tsx`: renders a single column and formats `updatedAt` for cards; this file is imported only by `TaskBoard.tsx`.
- `tests/unit/taskControlPlaneBoard.test.ts`: renders `TaskBoard` and asserts columns exist and the “Decision Needed” badge is shown.

Evidence of single-caller usage (run this before refactor and capture the output in Artifacts):

  rg -n "task-control-plane/components/TaskColumn|TaskColumn" src tests

## Plan of Work

### Milestone 1: Inline TaskColumn Into TaskBoard

Goal: remove `src/features/task-control-plane/components/TaskColumn.tsx` as a separate module without changing any user-visible behavior.

Edits:

1. In `src/features/task-control-plane/components/TaskBoard.tsx`:
   - Remove the import of `TaskColumn` from `TaskColumn.tsx`.
   - Copy the `TaskColumn` implementation into this file as a local component (do not export it).
   - Keep `TaskBoard`’s public API unchanged (still `export function TaskBoard({ snapshot }) { ... }`).
   - Keep `data-testid` values unchanged (`task-control-column-ready`, `task-control-column-in-progress`, `task-control-column-blocked`), and keep the “Decision Needed” badge text unchanged so tests keep passing.
   - Keep the `formatUpdatedAt` behavior identical:
     - When `updatedAt` is null, render `Unknown update time`.
     - When `updatedAt` is unparseable, render the raw string.
     - Otherwise render `date.toLocaleString()`.

2. Delete `src/features/task-control-plane/components/TaskColumn.tsx`.

3. Confirm there are no remaining references:

  rg -n "task-control-plane/components/TaskColumn|TaskColumn" src tests

### Milestone 2: Tests + Gates

1. Update `tests/unit/taskControlPlaneBoard.test.ts` only if needed.

2. Add one small regression test if coverage is missing:
   - Extend `tests/unit/taskControlPlaneBoard.test.ts` with a second test that renders a snapshot where a card’s `updatedAt` is `null` and asserts the UI shows `Updated: Unknown update time`.
   - This locks the `formatUpdatedAt` behavior while we inline the code.

3. Run the standard gates from repo root:

  npm run lint
  npm run test
  npm run typecheck
  npm run build

### Milestone 3: Commit + Archive The ExecPlan

1. Commit the refactor:

  git commit -am "Refactor: inline task control-plane column component"

2. Archive this ExecPlan:
   - Move `.agent/execplan-pending.md` to `.agent/done/execplan-inline-taskcolumn-into-taskboard.md`.
   - Commit the doc move:

       git add .agent/done/execplan-inline-taskcolumn-into-taskboard.md
       git commit -m "Docs: archive execplan for task control-plane consolidation"

## Concrete Steps

From repo root (`/Users/georgepickett/openclaw-studio`):

1. Evidence capture:

     rg -n "task-control-plane/components/TaskColumn|TaskColumn" src tests

2. Implement Milestone 1 edits.

3. Verify no remaining references:

     rg -n "task-control-plane/components/TaskColumn|TaskColumn" src tests

4. Implement Milestone 2 (tests + gates):

     npm run lint
     npm run test
     npm run typecheck
     npm run build

5. Commit Milestone 3 and archive this plan per instructions above.

## Validation and Acceptance

This work is accepted when:

1. `src/features/task-control-plane/components/TaskColumn.tsx` is deleted.
2. `rg -n "task-control-plane/components/TaskColumn|TaskColumn" src tests` returns no matches.
3. `npm run lint`, `npm run test`, `npm run typecheck`, and `npm run build` all pass.
4. `/control-plane` still renders three columns and shows decision badges (no visible behavior regressions).

## Idempotence and Recovery

This change is safe to retry.

Rollback is a normal git revert of the refactor commit. If tests fail after inlining, revert the commit and re-run `npm run test` to confirm recovery.

## Artifacts and Notes

- Paste the output of:

    rg -n "task-control-plane/components/TaskColumn|TaskColumn" src tests

Captured: 2026-02-06 20:21Z

```txt
src/features/task-control-plane/components/TaskBoard.tsx:2:import { TaskColumn } from "@/features/task-control-plane/components/TaskColumn";
src/features/task-control-plane/components/TaskBoard.tsx:37:        <TaskColumn
src/features/task-control-plane/components/TaskBoard.tsx:42:        <TaskColumn
src/features/task-control-plane/components/TaskBoard.tsx:47:        <TaskColumn
src/features/task-control-plane/components/TaskColumn.tsx:3:type TaskColumnProps = {
src/features/task-control-plane/components/TaskColumn.tsx:16:export function TaskColumn({ title, cards, dataTestId }: TaskColumnProps) {
```
