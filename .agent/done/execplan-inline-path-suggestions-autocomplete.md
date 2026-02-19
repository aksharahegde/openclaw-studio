# Inline Path Suggestions Autocomplete Into `/api/path-suggestions`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan format requirements live at `.agent/PLANS.md` from the repository root. This document must be maintained in accordance with that file.

## Purpose / Big Picture

OpenClaw Studio includes a Node runtime API route (`/api/path-suggestions`) that returns home-scoped path autocomplete suggestions. Today that route delegates to a grab-bag server helper module (`src/lib/fs.server.ts`) that exports many filesystem helpers, most of which are not used anywhere in the app.

After this refactor, `/api/path-suggestions` will own its path autocomplete logic directly (as local helper functions in the route module), and `src/lib/fs.server.ts` will be deleted. The endpoint’s request/response behavior should not change.

You can see this working by running unit tests and by starting the app (`npm run dev`) and calling `http://localhost:3000/api/path-suggestions?q=~/`.

## Progress

- [x] (2026-02-06 17:16Z) Add unit tests that characterize `/api/path-suggestions` by calling `GET()` while mocking `node:os.homedir`, then delete the old pure-function tests for `listPathAutocompleteEntries`.
- [x] (2026-02-06 17:17Z) Inline the path autocomplete helpers into `src/app/api/path-suggestions/route.ts`, delete `src/lib/fs.server.ts`, delete any orphaned tests that are no longer executed, and update `ARCHITECTURE.md` to remove references to `fs.server.ts`.
- [x] (2026-02-06 17:18Z) Run repo gates (`lint`, `test`, `typecheck`, `build`) and commit as one atomic refactor.

## Surprises & Discoveries

- Observation: `vitest.config.ts` only includes `tests/unit/**/*.test.ts`, so `src/lib/fs.server.test.ts` is currently not executed.
  Evidence: `vitest.config.ts` has `include: ["tests/unit/**/*.test.ts"]`.

## Decision Log

- Decision: Keep `/api/path-suggestions` behavior stable while deleting `src/lib/fs.server.ts` and moving the path autocomplete logic into the route file.
  Rationale: `src/lib/fs.server.ts` is only imported by `src/app/api/path-suggestions/route.ts` and `tests/unit/pathAutocomplete.test.ts`, but it exports additional helpers (git init, delete helpers, ensureDir/ensureFile) that are not used by the app. Keeping them in a shared `lib` module adds a concept and future bug surface without reuse.
  Date/Author: 2026-02-06 / Codex

## Outcomes & Retrospective

- `/api/path-suggestions` now owns the home-scoped path autocomplete implementation in `src/app/api/path-suggestions/route.ts`.
- Deleted `src/lib/fs.server.ts` and `src/lib/fs.server.test.ts`.
- Route behavior is covered by `tests/unit/pathSuggestionsRoute.test.ts` (route-level tests via `GET()`), and the old helper-level test file was deleted.
- Synced `ARCHITECTURE.md` to remove references to `src/lib/fs.server.ts`.
- Repo gates were run successfully: `lint`, `test`, `typecheck`, `build`.

## Context and Orientation

There are three Next.js App Router API routes under `src/app/api`:

- `src/app/api/studio/route.ts`: reads/writes the local Studio settings file.
- `src/app/api/task-control-plane/route.ts`: runs Beads (`br`) and returns a snapshot for `/control-plane`.
- `src/app/api/path-suggestions/route.ts`: returns home-scoped path autocomplete suggestions as JSON.

The path suggestions route currently imports `listPathAutocompleteEntries` from `src/lib/fs.server.ts`. That module includes:

- `listPathAutocompleteEntries`: the only helper used by production code today.
- `PathAutocompleteEntry`/`PathAutocompleteResult`: types returned by the endpoint.
- A set of unrelated filesystem helpers (`ensureDir`, `ensureFile`, `ensureGitRepo`, delete helpers) that are not referenced by the app.

The endpoint contract (as implemented today) is:

- Request: `GET /api/path-suggestions?q=<query>`, where `q` is a user-entered path.
  - If `q` is missing/empty, the route defaults to `"~/"`.
- Response (success): HTTP 200 with JSON:
  - `query`: the normalized query (always `~/...`)
  - `directory`: the resolved directory path on disk
  - `entries`: list of non-hidden entries with `name`, `fullPath`, `displayPath`, `isDirectory`
- Response (error): JSON `{ error: string }`
  - HTTP 404 when the error message contains `does not exist`
  - HTTP 400 otherwise

The safety property for this endpoint is: it must never list entries outside the user’s home directory.

## Plan of Work

First, add unit tests that exercise `src/app/api/path-suggestions/route.ts` directly by calling `GET()` with a real `Request` URL. These tests will use a temporary directory as the home directory and will mock `node:os.homedir` so the route’s logic runs against that temp directory. This keeps the tests end-to-end for the route without mocking filesystem reads.

Second, inline the path autocomplete logic currently in `src/lib/fs.server.ts` into `src/app/api/path-suggestions/route.ts` as local helper functions. The route should no longer import from `@/lib/fs.server`, and `src/lib/fs.server.ts` should be deleted.

Finally, update `ARCHITECTURE.md` so it no longer claims filesystem helpers live in `src/lib/fs.server.ts`, and run the repo quality gates and commit as one atomic change.

## Concrete Steps

All commands below assume the working directory is the repo root: `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio`.

### Milestone 1: Route Characterization Tests (Mock `os.homedir`)

1. Tests to write:

   Create `tests/unit/pathSuggestionsRoute.test.ts` that:

   - Creates a temporary directory that will act as the home directory.
   - Populates it with:
     - `Documents/` and `Downloads/` directories
     - `Doc.txt` and `Notes.txt` files
     - `.secret` hidden file (should not be returned)
   - Mocks `node:os` so `homedir()` returns that temp directory.
   - Imports `GET` from `src/app/api/path-suggestions/route.ts` only after the mock is installed (use dynamic `await import(...)`).

   Add tests that assert:

   - Success default query:
     - Call `GET(new Request("http://localhost/api/path-suggestions"))`
     - Expect HTTP 200 and that the returned `entries[].displayPath` is `["~/Documents/", "~/Downloads/", "~/Doc.txt", "~/Notes.txt"]` in that order.

   - Prefix filtering:
     - Call `GET(new Request("http://localhost/api/path-suggestions?q=~/Doc"))`
     - Expect HTTP 200 and `entries[].displayPath` is `["~/Documents/", "~/Doc.txt"]`.

   - Reject outside home:
     - Call `GET(new Request("http://localhost/api/path-suggestions?q=~/../"))`
     - Expect HTTP 400 and `{ error }` contains `home`.

   - Missing directory maps to 404:
     - Call `GET(new Request("http://localhost/api/path-suggestions?q=~/Missing/"))`
     - Expect HTTP 404 and `{ error }` contains `does not exist`.

2. Tests to remove/replace:

   Delete `tests/unit/pathAutocomplete.test.ts`, since it currently tests `listPathAutocompleteEntries` directly from a module that will be removed.

3. Verification:

   Run:

     npm run test

   Confirm the new route tests pass and the deleted file no longer exists.

### Milestone 2: Inline Path Autocomplete Into the Route and Delete `fs.server.ts`

1. Implementation:

   Edit `src/app/api/path-suggestions/route.ts`:

   - Copy the path autocomplete logic from `src/lib/fs.server.ts` into this route module as local (non-exported) helpers:
     - `normalizeQuery`
     - `isWithinHome`
     - `listPathAutocompleteEntries`
     - any small helper types (`PathAutocompleteEntry`, `PathAutocompleteResult`, options type)
   - Continue to use `resolveUserPath` from `src/lib/clawdbot/paths.ts` to resolve `~/...` paths.
   - Keep the response JSON shape and status mapping unchanged.

   Delete `src/lib/fs.server.ts`.

   Delete `src/lib/fs.server.test.ts` (it is not executed by Vitest today, and it depends on a module that is being deleted).

   Update `ARCHITECTURE.md`:

   - In the “Cross-cutting concerns” filesystem helpers bullet, remove references to `src/lib/fs.server.ts` and update the text to reflect that path autocomplete is implemented directly in `src/app/api/path-suggestions/route.ts`.

2. Verification:

   Run:

     rg -n "@/lib/fs.server" -S src tests

   Expect no results.

   Then run:

     npm run test
     npm run typecheck

   Confirm both succeed.

### Milestone 3: Gates and Commit

1. Run the full gates:

     npm run lint
     npm run test
     npm run typecheck
     npm run build

2. Commit:

   Commit everything as one atomic commit with a message like:

     refactor: inline path suggestions autocomplete

3. Move the completed ExecPlan:

   Copy `.agent/execplan-pending.md` to `.agent/done/execplan-inline-path-suggestions-autocomplete.md` and then delete `.agent/execplan-pending.md`.

## Validation and Acceptance

Acceptance criteria:

- `/api/path-suggestions` behavior is preserved:
  - returns HTTP 200 with a list of non-hidden entries under the resolved directory
  - returns HTTP 400 for invalid queries or attempts to traverse outside the home directory
  - returns HTTP 404 for missing directories (based on the existing error mapping)
- `src/lib/fs.server.ts` is deleted and has no remaining references in the repo.
- Unit tests cover the endpoint behavior by calling `GET()` and controlling the home directory via `node:os.homedir` mocking (not by importing a deleted helper module).
- `npm run lint`, `npm run test`, `npm run typecheck`, and `npm run build` all succeed.

## Idempotence and Recovery

This is a behavior-preserving refactor. If issues are found:

- Roll back by restoring `src/lib/fs.server.ts` from git history and switching `src/app/api/path-suggestions/route.ts` back to importing `listPathAutocompleteEntries`, then re-run the gates.

## Artifacts and Notes

- None yet.

## Interfaces and Dependencies

- The route will continue to depend on:
  - `node:fs`, `node:path`, `node:os` for filesystem listing and home directory resolution.
  - `src/lib/clawdbot/paths.ts` `resolveUserPath` for `~/...` resolution.
  - `src/lib/logger` for error logging.
