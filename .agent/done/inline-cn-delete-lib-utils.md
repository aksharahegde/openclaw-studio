# Inline `cn()` and Delete `src/lib/utils.ts`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan requirements live at `.agent/PLANS.md` and this document must be maintained in accordance with it.

## Purpose / Big Picture

Today the codebase has a generic module `src/lib/utils.ts` that exports a single function `cn()` (Tailwind class name merge helper). That module is only imported by one component: `src/features/agents/components/EmptyStatePanel.tsx`.

After this change, `cn()` will be defined locally inside `EmptyStatePanel.tsx` (still using the same `clsx` + `tailwind-merge` implementation), and the standalone `src/lib/utils.ts` file will be deleted. This reduces file-level surface area by removing a broad, easy-to-grow “utils” module that currently exists only to support one component.

User-visible behavior should not change. The rendered HTML class names should be equivalent to what `cn()` produced before (same merge behavior).

## Mental Model (Evidence-Based)

In this repo, class name composition is mostly done inline with Tailwind utility strings. A single component, `EmptyStatePanel`, uses `cn()` to conditionally merge base classes, optional modifier classes, and a `className` prop.

Evidence this is a thin wrapper:

1. `src/lib/utils.ts` exports only `cn()`.
2. There is only one import site of `@/lib/utils`:
   - `src/features/agents/components/EmptyStatePanel.tsx`

## Candidate Refactors Ranked

Scores: 1 (low) to 5 (high). For Blast radius, higher means smaller/safer.

| Candidate | Payoff (30%) | Blast Radius (25%) | Cognitive Load (20%) | Velocity Unlock (15%) | Validation / Rollback (10%) | Weighted |
|---|---:|---:|---:|---:|---:|---:|
| Inline `cn()` into `EmptyStatePanel.tsx` and delete `src/lib/utils.ts` | 3 | 5 | 4 | 1 | 5 | 3.55 |
| Delete unused `src/lib/names/agentNames.ts` | 2 | 5 | 2 | 1 | 5 | 2.70 |

## Proposed Change (The Call)

Inline `cn()` into `src/features/agents/components/EmptyStatePanel.tsx` and delete `src/lib/utils.ts`.

## Progress

- [x] Milestone 1: Inline `cn()` into `EmptyStatePanel.tsx` and remove the `@/lib/utils` import. (2026-02-06 04:47:38Z)
- [x] Milestone 2: Delete `src/lib/utils.ts`, run checks, and commit. (2026-02-06 04:48:06Z)

## Surprises & Discoveries

- None.

## Decision Log

- Decision: Delete the standalone `src/lib/utils.ts` module by inlining `cn()` into its only caller.
  Rationale: A generic “utils” module increases long-term surface area and tends to accumulate unrelated helpers. Since `cn()` has only one caller, keeping it local reduces concepts without changing behavior.
  Date/Author: 2026-02-06 / Codex

## Outcomes & Retrospective

- `cn()` is now a local helper in `src/features/agents/components/EmptyStatePanel.tsx`.
- Deleted `src/lib/utils.ts` and removed the only `@/lib/utils` import site.
- Validation: `npm run typecheck`, `npm run lint`, and `npm test` all passed.

## Plan of Work

### Milestone 1: Inline `cn()` Into the Component

At the end of this milestone, `EmptyStatePanel.tsx` no longer imports `@/lib/utils` and instead defines `cn()` locally with the same implementation.

1. Edit `src/features/agents/components/EmptyStatePanel.tsx`.
2. Remove `import { cn } from "@/lib/utils";`.
3. Add imports for `clsx` and `tailwind-merge` at the top of the file:
   - `import { clsx, type ClassValue } from "clsx";`
   - `import { twMerge } from "tailwind-merge";`
4. Define a local `cn()` function (or const) immediately below the imports with the same behavior as `src/lib/utils.ts`:
   - `const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));`

Verification steps:

1. From repo root, run `npm run typecheck` and confirm it passes.

### Milestone 2: Delete `src/lib/utils.ts` and Verify

At the end of this milestone, the standalone module is removed, there are no remaining imports of `@/lib/utils`, and all checks pass.

1. Delete `src/lib/utils.ts`.
2. From repo root, confirm there are no imports left:
   - `rg -n "@/lib/utils" src tests` should return no results.
3. Run:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
4. Commit after checks pass with message: `Inline cn and delete lib/utils`.

## Concrete Steps

From repo root:

1. `rg -n "@/lib/utils" src tests`
2. Apply Milestone 1 edits.
3. `npm run typecheck`
4. Apply Milestone 2 deletion.
5. `rg -n "@/lib/utils" src tests`
6. `npm run typecheck && npm run lint && npm test`
7. Commit.

## Validation and Acceptance

This work is accepted when:

1. `src/lib/utils.ts` does not exist.
2. `rg -n "@/lib/utils" src tests` returns no results.
3. `npm run typecheck`, `npm run lint`, and `npm test` all pass.
4. `EmptyStatePanel` still renders without class name regressions (covered indirectly by build and lint/typecheck; no behavior changes are intended beyond moving `cn()`).

## Idempotence and Recovery

This change is safe to retry.

Rollback plan:

1. Restore `src/lib/utils.ts`.
2. Revert `EmptyStatePanel.tsx` to import `cn` from `@/lib/utils`.
3. Run `npm test` to confirm the rollback is healthy.
