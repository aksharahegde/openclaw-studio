# Consolidate Path Autocomplete Types Into fs.server.ts

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository defines ExecPlan requirements in `.agent/PLANS.md`. This document must be maintained in accordance with that file.

## Purpose / Big Picture

Path autocomplete is a server-only feature implemented in `src/lib/fs.server.ts` and exposed via `src/app/api/path-suggestions/route.ts`. Today, its types live in a separate leaf module, `src/lib/path-suggestions/types.ts`, but those types are only imported by `src/lib/fs.server.ts`.

This is an unnecessary extra module to discover and maintain. After this change, path autocomplete types will live alongside the implementation in `src/lib/fs.server.ts`, and the standalone types file will be removed. This reduces surface area (one fewer file and one fewer concept) with minimal risk.

You can see it working by running `npm run typecheck` and `npm test` successfully, and by hitting the API route in dev mode (optional) to confirm it still returns the same JSON shape.

## Progress

- [x] (2026-02-06 03:32Z) Confirm `src/lib/path-suggestions/types.ts` is only used by `src/lib/fs.server.ts`.
- [x] (2026-02-06 03:32Z) Move `PathAutocompleteEntry` and `PathAutocompleteResult` types into `src/lib/fs.server.ts` and remove the import.
- [x] (2026-02-06 03:32Z) Delete `src/lib/path-suggestions/types.ts` and confirm there are no remaining references.
- [x] (2026-02-06 03:32Z) Run `npm run lint`, `npm run typecheck`, and `npm test`.
- [x] (2026-02-06 03:32Z) Commit with message `Milestone 1: Consolidate path autocomplete types`.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Inline path autocomplete types into `src/lib/fs.server.ts` and delete `src/lib/path-suggestions/types.ts`.
  Rationale: The types are private to the fs-server implementation (single import site), so a separate module adds cognitive load without reuse. Inlining deletes a file and keeps the feature self-contained.
  Date/Author: 2026-02-06 (Codex)

## Outcomes & Retrospective

- Not started yet.

## Context and Orientation

Path autocomplete is implemented in:

- `src/lib/fs.server.ts`: `listPathAutocompleteEntries(...)` builds and returns an object currently typed as `PathAutocompleteResult`, with each entry matching `PathAutocompleteEntry`.
- `src/app/api/path-suggestions/route.ts`: calls `listPathAutocompleteEntries` and returns it via `NextResponse.json(...)`.
- `tests/unit/pathAutocomplete.test.ts`: validates the behavior of `listPathAutocompleteEntries` directly.

The types currently live in:

- `src/lib/path-suggestions/types.ts`: exports `PathAutocompleteEntry` and `PathAutocompleteResult`.

## Plan of Work

1. In `src/lib/fs.server.ts`, define `PathAutocompleteEntry` and `PathAutocompleteResult` in the same file (near the other internal types such as `PathAutocompleteOptions`).
2. Remove the import of `PathAutocompleteEntry` and `PathAutocompleteResult` from `@/lib/path-suggestions/types` in `src/lib/fs.server.ts`.
3. Delete `src/lib/path-suggestions/types.ts`.
4. Validate with lint, typecheck, and tests.

## Concrete Steps

All commands below assume the working directory is:

  `/Users/georgepickett/.codex/worktrees/dbb8/openclaw-studio`

1. Confirm usage:

   - `rg -n "path-suggestions/types" -S src tests`
   - `rg -n "PathAutocompleteEntry|PathAutocompleteResult" -S src tests`

2. Edit `src/lib/fs.server.ts`:

   - Add:

     `export type PathAutocompleteEntry = { name: string; fullPath: string; displayPath: string; isDirectory: boolean };`
     `export type PathAutocompleteResult = { query: string; directory: string; entries: PathAutocompleteEntry[] };`

     Keep the shape identical to the deleted file.

   - Remove the `import type { PathAutocompleteEntry, PathAutocompleteResult } from "@/lib/path-suggestions/types";`.

3. Delete `src/lib/path-suggestions/types.ts`.

4. Confirm no remaining references:

   - `rg -n "path-suggestions/types" -S src tests`

5. Run validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`

   Expected result is that all commands succeed and `tests/unit/pathAutocomplete.test.ts` still passes.

6. Optional smoke check:

   - `npm run dev`
   - Open `http://localhost:3000/api/path-suggestions?q=~/`
   - Confirm you get HTTP 200 with JSON containing `query`, `directory`, and `entries`.

7. Commit:

   - Stage the changes (`git add -A src/lib/fs.server.ts src/lib/path-suggestions/types.ts`).
   - `git commit -m "Milestone 1: Consolidate path autocomplete types"`.

## Validation and Acceptance

Milestone 1 (Consolidate path autocomplete types):

1. Tests to write: None. Existing unit test coverage in `tests/unit/pathAutocomplete.test.ts` should remain green.
2. Implementation:
   - Inline `PathAutocompleteEntry` and `PathAutocompleteResult` types into `src/lib/fs.server.ts`.
   - Delete `src/lib/path-suggestions/types.ts`.
3. Verification:
   - Run `npm run lint`, `npm run typecheck`, `npm test` and confirm they pass.
4. Commit:
   - Commit with message `Milestone 1: Consolidate path autocomplete types`.

Acceptance criteria:

- `src/lib/path-suggestions/types.ts` no longer exists.
- `src/lib/fs.server.ts` exports `PathAutocompleteEntry` and `PathAutocompleteResult` with the same shapes as before.
- `src/app/api/path-suggestions/route.ts` continues to compile without changes and returns the same JSON shape.
- `npm run lint`, `npm run typecheck`, and `npm test` all succeed.

## Idempotence and Recovery

This change is safe to retry. If you delete the file but miss a reference, TypeScript will fail the build and ripgrep will show any remaining imports. Recovery options:

- Recreate `src/lib/path-suggestions/types.ts` with the previous contents and revert the import removal, or
- Finish migrating any missed import to `src/lib/fs.server.ts`.

## Artifacts and Notes

If any consumer unexpectedly imports `@/lib/path-suggestions/types` outside this repository path suggestions flow, note the file path and error message here and update the plan to include that migration.

## Interfaces and Dependencies

After this refactor, the authoritative types for path autocomplete are:

- `src/lib/fs.server.ts`: exports `PathAutocompleteEntry` and `PathAutocompleteResult`.

No other module should import from `src/lib/path-suggestions/types.ts` because it will be deleted.
