# Consolidate Gateway Protocol + Session Key Helpers into GatewayClient Module

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `.agent/PLANS.md` and must be maintained in accordance with that file.

## Purpose / Big Picture

After this refactor, gateway “protocol shape” types (event/req/res frames) and agent session-key helpers will have a single import path: `src/lib/gateway/GatewayClient.ts`.

Today, these helpers live in two tiny, low-fan-in modules:

- `src/lib/gateway/sessionKeys.ts` (used only by `src/app/page.tsx` and `tests/unit/sessionKey.test.ts`)
- `src/lib/gateway/frames.ts` (frame types used only by `src/lib/gateway/GatewayClient.ts` and `src/app/page.tsx`; `parseGatewayFrame` is used only by `tests/unit/gatewayFrames.test.ts`)

This split adds conceptual overhead without meaningful separation. Consolidating into `GatewayClient.ts` reduces surface area (two fewer files) while keeping runtime behavior unchanged.

The easiest way to see this working is that the existing unit tests for session keys and frame parsing still pass, and the full repo gates (`typecheck`, `lint`, `test`) are green.

## Progress

- [x] (2026-02-08 18:47Z) Baseline: run existing unit tests for session keys and gateway frames. [no-beads]
- [x] (2026-02-08 18:48Z) Milestone 1: Move exports from `sessionKeys.ts` and `frames.ts` into `GatewayClient.ts`, update imports, and delete the old modules. [no-beads]
- [x] (2026-02-08 18:49Z) Milestone 2: Run repo gates (typecheck, lint, unit tests) and commit. [no-beads]

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Consolidate into `src/lib/gateway/GatewayClient.ts` rather than introducing a new `src/lib/gateway/index.ts` barrel file.
  Rationale: A new barrel file adds another module and often increases indirection. Consolidating into the existing high-fan-in gateway entrypoint reduces file count without adding a new concept.
  Date/Author: 2026-02-08 / Codex

## Outcomes & Retrospective

Completed.

- Consolidated gateway frame types and parsing (`parseGatewayFrame`) into `src/lib/gateway/GatewayClient.ts`.
- Consolidated agent session key helpers into `src/lib/gateway/GatewayClient.ts`.
- Deleted `src/lib/gateway/frames.ts` and `src/lib/gateway/sessionKeys.ts` and migrated all imports.
- Verified `npm run typecheck`, `npm run lint`, and `npm run test` pass.

## Context and Orientation

`src/lib/gateway/GatewayClient.ts` is the primary client-side gateway boundary. It owns:

- The `GatewayClient` class (connect/disconnect/call/onEvent/onStatus)
- `GatewayResponseError`
- `isGatewayDisconnectLikeError`
- `syncGatewaySessionSettings`

Two tiny helper modules sit next to it:

- `src/lib/gateway/sessionKeys.ts`:
  - `buildAgentMainSessionKey(agentId, mainKey)` -> `agent:<agentId>:<mainKey>`
  - `parseAgentIdFromSessionKey(sessionKey)` -> extracts agent id
  - `isSameSessionKey(a, b)` -> trims and compares
  This module is only imported by `src/app/page.tsx` and `tests/unit/sessionKey.test.ts`.

- `src/lib/gateway/frames.ts`:
  - Frame types `ReqFrame`, `ResFrame`, `EventFrame`, `GatewayFrame`
  - `parseGatewayFrame(raw)` which JSON-parses and returns null on invalid JSON
  Frame types are used by `src/lib/gateway/GatewayClient.ts` (for the `onEvent` handler type) and `src/app/page.tsx` (type annotation), and `parseGatewayFrame` is only used by `tests/unit/gatewayFrames.test.ts`.

This plan collapses these two leaf modules into `GatewayClient.ts` so there is one place to look for gateway protocol and identifier helpers.

## Plan of Work

First, run the existing unit tests that cover these helpers as a baseline.

Then edit `src/lib/gateway/GatewayClient.ts` to include:

- the exported session key helpers (`buildAgentMainSessionKey`, `parseAgentIdFromSessionKey`, `isSameSessionKey`)
- the exported frame types (`ReqFrame`, `ResFrame`, `GatewayStateVersion`, `EventFrame`, `GatewayFrame`)
- the exported `parseGatewayFrame` function

Once those exports exist, update imports:

- `src/app/page.tsx` should import the session key helpers and `EventFrame` type from `@/lib/gateway/GatewayClient`.
- `tests/unit/sessionKey.test.ts` should import session key helpers from `@/lib/gateway/GatewayClient`.
- `tests/unit/gatewayFrames.test.ts` should import `parseGatewayFrame` from `@/lib/gateway/GatewayClient`.

Finally, delete:

- `src/lib/gateway/sessionKeys.ts`
- `src/lib/gateway/frames.ts`

Run repo gates and commit.

## Concrete Steps

Run from repo root:

    cd /Users/georgepickett/openclaw-studio

Baseline:

    npm run test -- tests/unit/sessionKey.test.ts
    npm run test -- tests/unit/gatewayFrames.test.ts

Milestone 1 (implementation):

1. Edit `src/lib/gateway/GatewayClient.ts`:
   - Add and export the frame types and `parseGatewayFrame`.
   - Add and export the session key helper functions.
   - Remove the `import type { EventFrame } from "./frames";` line and use the local `EventFrame` type.
2. Update imports:
   - `src/app/page.tsx`: replace imports from `@/lib/gateway/sessionKeys` and `@/lib/gateway/frames` with imports from `@/lib/gateway/GatewayClient`.
   - `tests/unit/sessionKey.test.ts`: import session key helpers from `@/lib/gateway/GatewayClient`.
   - `tests/unit/gatewayFrames.test.ts`: import `parseGatewayFrame` from `@/lib/gateway/GatewayClient`.
3. Delete:
   - `src/lib/gateway/sessionKeys.ts`
   - `src/lib/gateway/frames.ts`
4. Confirm there are no remaining references:

    rg -n \"@/lib/gateway/sessionKeys|@/lib/gateway/frames\" src tests

Milestone 2 (verification + commit):

    npm run typecheck
    npm run lint
    npm run test

Commit:

    git status --porcelain=v1
    git add -A
    git commit -m \"Refactor: consolidate gateway helpers into GatewayClient\"

## Validation and Acceptance

Acceptance criteria:

1. `npm run test -- tests/unit/sessionKey.test.ts` passes without changing assertions (only import paths change).
2. `npm run test -- tests/unit/gatewayFrames.test.ts` passes without changing assertions (only import paths change).
3. `rg -n "@/lib/gateway/sessionKeys|@/lib/gateway/frames" src tests` returns no matches.
4. `src/lib/gateway/sessionKeys.ts` and `src/lib/gateway/frames.ts` no longer exist.
5. `npm run typecheck`, `npm run lint`, and `npm run test` all pass.
