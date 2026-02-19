# Remove Unused Studio Session Key Helpers From `sessionKeys.ts`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository has an ExecPlan format and requirements documented at `.agent/PLANS.md` (from the repository root). This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

`src/lib/gateway/sessionKeys.ts` currently contains two distinct concepts:

1. Runtime session key helpers that are used by the app (building/parsing the main session key and comparing keys).
2. “Studio session” helpers (`buildAgentStudioSessionKey`, `extractStudioSessionEntries`, `reconcileStudioSessionSelection`) that are not imported anywhere in `src/` and only exist to satisfy `tests/unit/sessionKey.test.ts`.

Keeping unused helper flows increases cognitive load and bug surface area because it looks like there is a supported “studio session selection” concept in production code, when it is currently dead.

After this change, `src/lib/gateway/sessionKeys.ts` will contain only the helpers that are actually used by the app today, and the unit tests will only cover that remaining surface.

## Progress

- [ ] (2026-02-08) Prove the “studio session” helpers are unused in production code (no `src/` imports).
- [ ] (2026-02-08) Delete unused exports and types from `src/lib/gateway/sessionKeys.ts`.
- [ ] (2026-02-08) Update `tests/unit/sessionKey.test.ts` to only test the remaining, used exports.
- [ ] (2026-02-08) Run `npm run test`, `npm run typecheck`, and `npm run lint`.
- [ ] (2026-02-08) Move this ExecPlan to `.agent/done/` with a descriptive filename.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Delete the “studio session” helpers from `src/lib/gateway/sessionKeys.ts` rather than keeping them for hypothetical future use.
  Rationale: They are currently dead code (no production imports). If/when the UI needs studio session selection again, re-introduce it in the context of a real feature so the shapes and semantics match actual usage.
  Date/Author: 2026-02-08 / Codex

## Outcomes & Retrospective

- Not started yet.

## Context and Orientation

Current usage in production code:

- `src/app/page.tsx` imports and uses:
  - `buildAgentMainSessionKey`
  - `parseAgentIdFromSessionKey`
  - `isSameSessionKey`

No other file in `src/` imports the “studio session” helpers. The only reference is:

- `tests/unit/sessionKey.test.ts` which imports and tests:
  - `extractStudioSessionEntries`
  - `reconcileStudioSessionSelection`
  - (and others)

## Plan of Work

### Milestone 1: Confirm Unused Surface

1. From repo root, run:

   rg -n "buildAgentStudioSessionKey|extractStudioSessionEntries|reconcileStudioSessionSelection" src

2. Expected result: only `src/lib/gateway/sessionKeys.ts` matches (no call sites elsewhere).

If that is true, proceed.

### Milestone 2: Delete Unused Helpers

In `src/lib/gateway/sessionKeys.ts`, delete:

- `buildAgentStudioSessionKey`
- `extractStudioSessionEntries`
- `reconcileStudioSessionSelection`
- The related types used only by those helpers:
  - `SessionListEntry`
  - `StudioSessionEntry`
  - `StudioSessionsForAgent`
  - `StudioSessionSelection`

Keep and do not change semantics for:

- `buildAgentMainSessionKey`
- `parseAgentIdFromSessionKey`
- `isSameSessionKey`

Verification:

- Run `npm run test -- tests/unit/sessionKey.test.ts` and confirm it fails because the test still references removed exports (expected at this point).

### Milestone 3: Update Unit Tests To Match Remaining Surface

In `tests/unit/sessionKey.test.ts`:

1. Remove tests for deleted exports.
2. Keep coverage for:
   - `buildAgentMainSessionKey`
   - `parseAgentIdFromSessionKey`
   - `isSameSessionKey`

Verification:

- Run `npm run test -- tests/unit/sessionKey.test.ts` and confirm it passes.

Commit after verification with message: `Remove unused studio session key helpers`.

### Milestone 4: Full Validation

1. Run:

   npm run test
   npm run typecheck
   npm run lint

Acceptance is satisfied when all commands exit 0 and `rg -n "extractStudioSessionEntries|reconcileStudioSessionSelection" src` has no matches.

If Milestone 4 introduces no additional code changes beyond verification, do not create an extra “validation-only” commit; record the results in `Outcomes & Retrospective` instead.

### Milestone 5: Archive The ExecPlan

Move `.agent/execplan-pending.md` to `.agent/done/execplan-remove-unused-studio-sessionkeys.md` (or similarly descriptive name).

Commit the done ExecPlan file if the repository convention is to track `.agent/done/*`.

## Concrete Steps

All commands should be run from the repository root:

  cd /Users/georgepickett/openclaw-studio

1. Confirm unused helpers:

   rg -n "buildAgentStudioSessionKey|extractStudioSessionEntries|reconcileStudioSessionSelection" src

2. Edit `src/lib/gateway/sessionKeys.ts` to remove the unused exports/types.
3. Update `tests/unit/sessionKey.test.ts`.
4. Run:

   npm run test -- tests/unit/sessionKey.test.ts
   npm run test
   npm run typecheck
   npm run lint

## Validation and Acceptance

The change is accepted when:

1. `npm run test` passes.
2. `npm run typecheck` passes.
3. `npm run lint` passes.
4. Production code still builds and `src/app/page.tsx` imports for session keys remain valid.
5. The deleted exports no longer exist and are not referenced anywhere in `src/`.

## Idempotence and Recovery

This is a safe refactor. If a hidden production usage is discovered (an import outside `src/`), stop and re-evaluate whether the helper should be moved closer to its actual call site instead of deleted.

## Artifacts and Notes

Files expected to change:

- `src/lib/gateway/sessionKeys.ts`
- `tests/unit/sessionKey.test.ts`

