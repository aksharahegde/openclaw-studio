# Consolidate DOM Utilities Into One Module

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `.agent/PLANS.md` and must be maintained in accordance with that file.

## Purpose / Big Picture

After this refactor, OpenClaw Studio will have one import path for small DOM helpers instead of two. Today, two tiny utilities live in two separate modules:

- `src/lib/dom/rafBatcher.ts` (`createRafBatcher`)
- `src/lib/dom/scroll.ts` (`isNearBottom`)

These are both “DOM helper” concepts, and they are small enough that splitting them into separate modules adds overhead without improving clarity. Consolidating them into `src/lib/dom/index.ts` reduces surface area (one fewer file) while keeping behavior identical and well tested.

The easiest way to see this working is that the existing unit tests for these utilities continue to pass, and `npm run typecheck`, `npm run lint`, and `npm run test` are all green.

## Progress

- [x] (2026-02-08 18:41Z) Baseline: run the existing dom-helper unit tests. [no-beads]
- [x] (2026-02-08 18:42Z) Milestone 1: Create `src/lib/dom/index.ts` that exports both helpers and their types; migrate imports; delete the old modules. [no-beads]
- [x] (2026-02-08 18:43Z) Milestone 2: Run repo gates (typecheck, lint, unit tests) and commit. [no-beads]

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Consolidate into `src/lib/dom/index.ts` instead of creating a new `src/lib/dom.ts` file.
  Rationale: Avoids removing the `src/lib/dom` directory (do not remove directories without explicit user confirmation) while still deleting a file and consolidating the concept.
  Date/Author: 2026-02-08 / Codex

## Outcomes & Retrospective

Completed.

- Consolidated `createRafBatcher` and `isNearBottom` into `src/lib/dom/index.ts` with a single import path (`@/lib/dom`).
- Deleted `src/lib/dom/rafBatcher.ts` and `src/lib/dom/scroll.ts` and migrated all imports.
- Verified `npm run typecheck`, `npm run lint`, and `npm run test` pass.

## Context and Orientation

`src/lib/dom/rafBatcher.ts` exports `createRafBatcher(flush)` which returns `{ schedule, cancel }` using `requestAnimationFrame`. It is used by `src/app/page.tsx` and tested in `tests/unit/rafBatcher.test.ts`.

`src/lib/dom/scroll.ts` exports `isNearBottom(metrics, thresholdPx)` and the `ScrollMetrics` type. It is used by `src/features/agents/components/AgentChatPanel.tsx` and tested in `tests/unit/scrollNearBottom.test.ts`.

Both modules are currently imported via separate paths (`@/lib/dom/rafBatcher` and `@/lib/dom/scroll`). This plan consolidates them to a single module import (`@/lib/dom`) by adding `src/lib/dom/index.ts`.

## Plan of Work

First, establish a baseline by running the existing unit tests that cover the current behavior. Those tests should pass before any code changes.

Then create `src/lib/dom/index.ts` that exports:

- `export type RafBatcher`
- `export const createRafBatcher`
- `export type ScrollMetrics`
- `export const isNearBottom`

Move the implementation code from the existing modules into `index.ts` (behavior unchanged). Update all call sites and tests to import from `@/lib/dom`. Once no remaining imports reference the old modules, delete `src/lib/dom/rafBatcher.ts` and `src/lib/dom/scroll.ts`.

Finally, run typecheck, lint, and the full unit test suite, then commit.

## Concrete Steps

Run from repo root:

    cd /Users/georgepickett/openclaw-studio

Baseline:

    npm run test -- tests/unit/rafBatcher.test.ts
    npm run test -- tests/unit/scrollNearBottom.test.ts

Milestone 1 (implementation):

1. Create `src/lib/dom/index.ts` containing the code currently in:
   - `src/lib/dom/rafBatcher.ts`
   - `src/lib/dom/scroll.ts`
2. Update imports:
   - `src/app/page.tsx`: replace `@/lib/dom/rafBatcher` with `@/lib/dom`
   - `src/features/agents/components/AgentChatPanel.tsx`: replace `@/lib/dom/scroll` with `@/lib/dom`
   - `tests/unit/rafBatcher.test.ts`: replace `@/lib/dom/rafBatcher` with `@/lib/dom`
   - `tests/unit/scrollNearBottom.test.ts`: replace `@/lib/dom/scroll` with `@/lib/dom`
3. Delete:
   - `src/lib/dom/rafBatcher.ts`
   - `src/lib/dom/scroll.ts`
4. Confirm there are no remaining references:

    rg -n \"@/lib/dom/(rafBatcher|scroll)\" src tests

Milestone 2 (verification + commit):

    npm run typecheck
    npm run lint
    npm run test

Commit:

    git status --porcelain=v1
    git add -A
    git commit -m \"Refactor: consolidate dom helpers\"

## Validation and Acceptance

Acceptance criteria:

1. `tests/unit/rafBatcher.test.ts` and `tests/unit/scrollNearBottom.test.ts` pass (assertions unchanged, only import paths changed).
2. `rg -n \"@/lib/dom/(rafBatcher|scroll)\" src tests` returns no matches.
3. `src/lib/dom/index.ts` exists and exports `createRafBatcher` and `isNearBottom` with the same behavior as before.
4. `npm run typecheck`, `npm run lint`, and `npm run test` all pass.
