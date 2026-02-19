# Consolidate useGatewayConnection Hook into GatewayClient Module

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `.agent/PLANS.md` and must be maintained in accordance with that file.

## Purpose / Big Picture

After this refactor, the gateway connection hook (`useGatewayConnection`) will live in the same module as the gateway client boundary (`src/lib/gateway/GatewayClient.ts`). Today, the hook is the only export in `src/lib/gateway/useGatewayConnection.ts`, and it is only used by `src/app/page.tsx` (plus its dedicated unit test). Consolidating eliminates one file and one import path while keeping behavior identical.

The easiest way to see this working is that `tests/unit/useGatewayConnection.test.ts` still passes, and repo gates (`npm run typecheck`, `npm run lint`, `npm run test`) remain green.

## Progress

- [x] (2026-02-08 18:54Z) Baseline: run the existing hook unit test. [no-beads]
- [x] (2026-02-08 18:55Z) Milestone 1: Move `useGatewayConnection` into `src/lib/gateway/GatewayClient.ts`, update imports, and delete `src/lib/gateway/useGatewayConnection.ts`. [no-beads]
- [x] (2026-02-08 19:00Z) Milestone 2: Run repo gates and commit; move this plan to `.agent/done/`. [no-beads]

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Consolidate into `src/lib/gateway/GatewayClient.ts` rather than creating a new barrel file or a new “client-only gateway” module.
  Rationale: This deletes one file and one import path without introducing a new concept. The hook is tightly coupled to `GatewayClient` and already effectively client-only via import graph (`src/app/page.tsx`).
  Date/Author: 2026-02-08 / Codex

## Outcomes & Retrospective

Completed.

- Moved `useGatewayConnection` into `src/lib/gateway/GatewayClient.ts` and updated imports.
- Deleted `src/lib/gateway/useGatewayConnection.ts`.
- Updated `tests/unit/useGatewayConnection.test.ts` to stub the underlying `GatewayBrowserClient` so auto-connect remains safe in tests.
- Verified `npm run typecheck`, `npm run lint`, and `npm run test` pass.

## Context and Orientation

Relevant files:

- `src/lib/gateway/GatewayClient.ts`: the gateway client boundary and related helpers/types.
- `src/lib/gateway/useGatewayConnection.ts`: a React hook that creates/owns a `GatewayClient`, loads gateway URL/token from Studio settings via a coordinator-like interface, auto-connects once, and persists changes back to Studio settings.
- `src/app/page.tsx`: the only production import of `useGatewayConnection`.
- `tests/unit/useGatewayConnection.test.ts`: unit tests for `useGatewayConnection` (currently dynamic-imports `@/lib/gateway/useGatewayConnection`).

We will keep the hook behavior the same; this is a consolidation-only change.

## Plan of Work

First, run the existing unit test to establish a baseline.

Then move the hook implementation from `src/lib/gateway/useGatewayConnection.ts` into `src/lib/gateway/GatewayClient.ts` (as a named export `useGatewayConnection`). This requires adding React imports (`useCallback`, `useEffect`, `useRef`, `useState`) in `GatewayClient.ts`.

Update import sites to use `@/lib/gateway/GatewayClient` instead of `@/lib/gateway/useGatewayConnection`, then delete the old file.

Finally, run repo gates and commit, and move this plan into `.agent/done/`.

## Concrete Steps

Run from repo root:

    cd /Users/georgepickett/openclaw-studio

Baseline:

    npm run test -- tests/unit/useGatewayConnection.test.ts

Milestone 1 (implementation):

1. Edit `src/lib/gateway/GatewayClient.ts`:
   - Add React imports near the top: `useCallback`, `useEffect`, `useRef`, `useState`.
   - Move the following exports from `src/lib/gateway/useGatewayConnection.ts` into this file unchanged:
     - `DEFAULT_GATEWAY_URL` constant behavior (env default + fallback)
     - `formatGatewayError`
     - `GatewayConnectionState` type
     - `useGatewayConnection` hook and its internal `StudioSettingsCoordinatorLike` type
2. Update imports:
   - `src/app/page.tsx`: replace `import { useGatewayConnection } from "@/lib/gateway/useGatewayConnection";` with `import { useGatewayConnection } from "@/lib/gateway/GatewayClient";`
   - `tests/unit/useGatewayConnection.test.ts`: update the dynamic import to `@/lib/gateway/GatewayClient` and return `mod.useGatewayConnection`.
3. Delete `src/lib/gateway/useGatewayConnection.ts`.
4. Confirm no remaining references:

    rg -n \"@/lib/gateway/useGatewayConnection\" src tests

Milestone 2 (verification + commit):

    npm run typecheck
    npm run lint
    npm run test

Commit:

    git status --porcelain=v1
    git add -A
    git commit -m \"Refactor: consolidate useGatewayConnection into GatewayClient\"

Move ExecPlan:

    mv .agent/execplan-pending.md .agent/done/consolidate-usegatewayconnection-into-gatewayclient.md
    git add -A
    git commit -m \"Docs: ExecPlan consolidate useGatewayConnection into GatewayClient\"

## Validation and Acceptance

Acceptance criteria:

1. `npm run test -- tests/unit/useGatewayConnection.test.ts` passes (assertions unchanged; only import paths change).
2. `rg -n \"@/lib/gateway/useGatewayConnection\" src tests` returns no matches.
3. `src/lib/gateway/useGatewayConnection.ts` no longer exists, and `useGatewayConnection` is exported from `src/lib/gateway/GatewayClient.ts`.
4. `npm run typecheck`, `npm run lint`, and `npm run test` all pass.
