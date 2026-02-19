# Consolidate Studio Settings Server Helpers Into `/api/studio`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan format requirements live at `.agent/PLANS.md` from the repository root. This document must be maintained in accordance with that file.

## Purpose / Big Picture

OpenClaw Studio persists “studio settings” (gateway URL/token plus focused preferences) to a local JSON file under the OpenClaw state directory. Today, the `/api/studio` route handler is a thin wrapper over a separate server-only module `src/lib/studio/settings.server.ts` that does filesystem I/O.

After this refactor, the server-only filesystem helpers will live directly in `src/app/api/studio/route.ts`, and `src/lib/studio/settings.server.ts` will be removed. The user-visible behavior should not change: Studio should still load and persist settings via `/api/studio` the same way as before.

You can see this working by running unit tests, then starting the app (`npm run dev`) and confirming the gateway URL/token still persists across reloads.

## Progress

- [x] (2026-02-06 16:48Z) Add unit tests for `src/app/api/studio/route.ts` GET/PUT behavior using a temp `OPENCLAW_STATE_DIR`.
- [x] (2026-02-06 16:49Z) Inline the filesystem helpers into `src/app/api/studio/route.ts`, delete `src/lib/studio/settings.server.ts`, and update `ARCHITECTURE.md`.
- [x] (2026-02-06 16:49Z) Run repo gates (`lint`, `test`, `typecheck`, `build`) and commit as one atomic refactor.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Delete `src/lib/studio/settings.server.ts` and inline its filesystem I/O into `src/app/api/studio/route.ts`.
  Rationale: The module is only imported by one route, and it is pure thin-wrapper server code. Removing it reduces the number of “where is settings actually persisted?” concepts a new contributor has to load.
  Date/Author: 2026-02-06 / Codex

## Outcomes & Retrospective

- Outcome: The `/api/studio` route now owns the studio settings filesystem I/O directly, and `src/lib/studio/settings.server.ts` was removed.
- Outcome: Added unit coverage in `tests/unit/studioSettingsRoute.test.ts` to lock down GET default behavior, PUT payload validation, and PUT persistence behavior.
- Verification: `npm run lint`, `npm run test`, `npm run typecheck`, and `npm run build` succeed after the refactor.

## Context and Orientation

Studio settings persistence spans three layers:

1. Client-side scheduling and transport lives in `src/lib/studio/coordinator.ts`, which reads/writes settings through HTTP calls to `/api/studio`.
2. The API endpoint lives in `src/app/api/studio/route.ts` and defines `GET` and `PUT` handlers that return JSON `{ settings }` or `{ error }`.
3. The settings format and merge/normalize semantics live in `src/lib/studio/settings.ts`. This module defines `defaultStudioSettings`, `normalizeStudioSettings`, and `mergeStudioSettings`.

The file I/O currently lives in `src/lib/studio/settings.server.ts` and is only imported by `src/app/api/studio/route.ts`. It resolves a settings path under the state dir (from `src/lib/clawdbot/paths.ts`), reads/writes JSON, and applies patches.

The refactor goal is to keep the semantics in `src/lib/studio/settings.ts` unchanged, while removing the extra “server settings module” hop.

## Plan of Work

First, add a unit test that characterizes the `/api/studio` route’s behavior against the real filesystem in a temporary directory. The test should set `process.env.OPENCLAW_STATE_DIR` to a temp path so the route writes into a sandbox location.

Then, move the content of `src/lib/studio/settings.server.ts` into `src/app/api/studio/route.ts` as local helper functions (do not export them). Replace the import of `loadStudioSettings` and `applyStudioSettingsPatch` with those local helpers. After the route compiles, delete `src/lib/studio/settings.server.ts` and update `ARCHITECTURE.md` so it no longer references the deleted file.

Finally, run the full repo quality gates and commit as one atomic refactor commit.

## Concrete Steps

All commands below assume the working directory is the repo root: `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio`.

### Milestone 1: Characterize `/api/studio` Behavior

At the end of this milestone, there will be a unit test that fails if the `/api/studio` route stops reading/writing the expected settings shape on disk.

1. Tests to write:

   Create `tests/unit/studioSettingsRoute.test.ts`.

   Write `describe("studio settings route", ...)` tests that:

   - `GET` returns HTTP 200 and a default settings object when the settings file does not exist.
     Assertions: `response.status === 200`, and `body.settings.gateway === null`, and `body.settings.version === 1`.

   - `PUT` returns HTTP 400 for a non-object JSON body (for example, `"nope"`).
     Assertions: `response.status === 400` and `body.error` is a non-empty string.

   - `PUT` persists a valid patch and a subsequent `GET` returns the merged settings.
     Setup: create a temp directory (for example with `fs.mkdtempSync(path.join(os.tmpdir(), "studio-settings-"))`) and set `process.env.OPENCLAW_STATE_DIR` to that path for the test.
     Action: call `PUT` with a patch like `{ gateway: { url: "ws://example.test:1234", token: "t" } }`, then call `GET`.
     Assertions: the returned settings contain the gateway URL/token, and the file `<OPENCLAW_STATE_DIR>/openclaw-studio/settings.json` exists and parses as JSON with matching fields.

   Use `afterEach` to clean up the temp directory and to restore `process.env.OPENCLAW_STATE_DIR` to its prior value so tests are isolated.

2. Verification:

   Run:

     npm run test

   Confirm `tests/unit/studioSettingsRoute.test.ts` passes.

3. Commit:

   Do not commit yet; this milestone’s test can be committed together with the refactor in milestone 2 for a single atomic change.

### Milestone 2: Inline Settings I/O and Delete `settings.server.ts`

At the end of this milestone, the route will contain the same filesystem behavior it had before, but `src/lib/studio/settings.server.ts` will be gone.

1. Implementation:

   Edit `src/app/api/studio/route.ts`.

   - Remove the import from `@/lib/studio/settings.server`.
   - Add Node imports (`node:fs`, `node:path`) and add `resolveStateDir` import from `src/lib/clawdbot/paths.ts`.
   - Add local helper functions mirroring the deleted module’s behavior:
     - `resolveSettingsPath()`
     - `loadStudioSettings()`
     - `saveStudioSettings(next)`
     - `applyStudioSettingsPatch(patch)`
   - Keep the existing request validation and error handling behavior the same (status codes and `{ error }` payload shape).
   - Ensure the route continues to call `mergeStudioSettings` and `normalizeStudioSettings` from `src/lib/studio/settings.ts` so settings semantics remain centralized.

   Delete `src/lib/studio/settings.server.ts`.

   Update `ARCHITECTURE.md` to remove references to `src/lib/studio/settings.server.ts` and to describe `src/app/api/studio/route.ts` as the server-side filesystem boundary for studio settings.

2. Verification:

   Run:

     npm run lint
     npm run test
     npm run typecheck
     npm run build

   Confirm all commands succeed.

3. Commit:

   Commit the entire refactor (tests + route + doc update + file deletion) as one atomic commit with a message like: `refactor: inline studio settings server helpers`.

## Validation and Acceptance

Acceptance criteria:

- `src/lib/studio/settings.server.ts` is deleted and has no remaining references in the repo.
- `src/app/api/studio/route.ts` performs the settings file read/write and patch application directly, while continuing to use `src/lib/studio/settings.ts` for merge/normalize semantics.
- `tests/unit/studioSettingsRoute.test.ts` exists and covers `GET` default settings, `PUT` invalid payload, and `PUT` persistence behavior.
- `npm run lint`, `npm run test`, `npm run typecheck`, and `npm run build` all succeed.

Optional manual validation:

- Run `npm run dev`, open `http://localhost:3000`, set a custom gateway URL/token in the connection panel, refresh the page, and confirm the gateway URL/token are restored (proving `/api/studio` persisted successfully).

## Idempotence and Recovery

This is intended as a behavior-preserving refactor. If the refactor introduces unexpected issues, revert by restoring `src/lib/studio/settings.server.ts` and switching the route back to importing `loadStudioSettings` and `applyStudioSettingsPatch`.

The unit test added in milestone 1 should help catch regressions during and after the refactor.

## Artifacts and Notes

- None yet.

## Interfaces and Dependencies

After this refactor:

- `src/lib/studio/settings.ts` remains the canonical location for the settings schema and merge/normalize logic.
- `src/app/api/studio/route.ts` becomes the only server-side settings file I/O module.
- Client code continues to call `/api/studio` via `src/lib/studio/coordinator.ts` without changes to its external behavior.
