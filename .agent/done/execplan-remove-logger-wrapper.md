# Remove Logger Wrapper And Use Console Directly

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md` in this repository.

## Purpose / Big Picture

OpenClaw Studio currently has a `src/lib/logger.ts` module that is only a thin wrapper around `console.*`. Removing it reduces conceptual surface area (one less shared abstraction to learn), reduces import noise, and avoids an indirection layer that does not provide behavior.

After this change, the app continues to log the same information, but call sites use `console.info`, `console.warn`, and `console.error` directly. You can see it working by running the existing test and build gates and verifying there are no remaining imports of `@/lib/logger`.

## Progress

- [x] (2026-02-06 17:32Z) Characterize current `logger` usage and confirm all call sites with ripgrep.
- [x] (2026-02-06 17:34Z) Replace `logger.*` usage with `console.*`, remove `src/lib/logger.ts`, and update unit tests that mocked the wrapper.
- [x] (2026-02-06 17:34Z) Update `ARCHITECTURE.md` to remove the `src/lib/logger` boundary description.
- [x] (2026-02-06 17:35Z) Run `npm run lint`, `npm run test`, `npm run typecheck`, and `npm run build`.
- [x] (2026-02-06 17:36Z) Commit, then move this ExecPlan to `.agent/done/` with a descriptive filename.

## Surprises & Discoveries

- (none yet)

## Decision Log

- Decision: Remove `src/lib/logger.ts` rather than expanding it.
  Rationale: The module is a pass-through to `console.*` and does not add formatting, routing, or log-level control, so keeping it increases cognitive load without payoff.
  Date/Author: 2026-02-06 / Codex

## Outcomes & Retrospective

- Removed the `src/lib/logger.ts` wrapper and updated all call sites to use `console.*` directly.
- Updated unit tests that previously mocked `@/lib/logger` to instead spy on `console.error`.
- Updated `ARCHITECTURE.md` to reflect the new logging approach.

Result: one fewer shared abstraction, no behavior changes, and all existing gates passed.

## Context and Orientation

`src/lib/logger.ts` exports a `logger` object with `info`, `warn`, `error`, and `debug` methods. These methods delegate directly to `console.info`, `console.warn`, `console.error`, and `console.debug`.

Call sites import `logger` and use it in:

  - `src/lib/gateway/GatewayClient.ts`
  - `src/app/page.tsx`
  - `src/app/api/task-control-plane/route.ts`
  - `src/app/api/path-suggestions/route.ts`
  - `src/app/api/studio/route.ts`

`ARCHITECTURE.md` currently documents `src/lib/logger` as a cross-cutting concern.

## Plan of Work

First, confirm all imports and call sites of `@/lib/logger` so we can update them deterministically.

Then, update each file to:

  - Remove `import { logger } from "@/lib/logger";`
  - Replace `logger.info(...)` with `console.info(...)`
  - Replace `logger.warn(...)` with `console.warn(...)`
  - Replace `logger.error(...)` with `console.error(...)`
  - Replace `logger.debug(...)` with `console.debug(...)` (if any)

After updating all call sites, delete `src/lib/logger.ts`.

Finally, update `ARCHITECTURE.md` so the logging section reflects direct `console.*` usage (and no longer references `src/lib/logger`).

## Concrete Steps

All commands assume the working directory is the repo root:

  /Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio

1. Identify call sites:

    rg -n "@/lib/logger|\\blogger\\." -S src ARCHITECTURE.md

2. Update the call sites listed in `Context and Orientation` to use `console.*` directly.

3. Delete the wrapper:

    rm src/lib/logger.ts

4. Verify there are no remaining imports:

    rg -n "@/lib/logger" -S src || true

5. Run gates:

    npm run lint
    npm run test
    npm run typecheck
    npm run build

## Validation and Acceptance

Acceptance criteria:

  - `rg -n "@/lib/logger" -S src` returns no matches.
  - `npm run lint` succeeds.
  - `npm run test` succeeds.
  - `npm run typecheck` succeeds.
  - `npm run build` succeeds.

Verification workflow:

1. (No new tests) This is a consolidation refactor with no intended behavior changes; validation is via the existing lint/test/typecheck/build gates plus a repository grep that proves the wrapper was fully removed.
2. After all verification passes, commit with a message like: `refactor: remove logger wrapper`.
3. Move this file to `.agent/done/execplan-remove-logger-wrapper.md` (create `.agent/done` if missing).

## Idempotence and Recovery

This change is safe to retry:

  - If a build or lint failure occurs, re-run `rg -n "@/lib/logger|\\blogger\\." -S src` to find the missed call site and update it.
  - If you need to rollback entirely, restore `src/lib/logger.ts` and revert call sites to use `logger.*`.

## Artifacts and Notes

- (none yet)

## Interfaces and Dependencies

No new external dependencies.

Call sites should use built-in `console.*` methods directly.
