# Consolidate gateway config mutation flow for `config.get` + `config.patch`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md` in the repository root.

## Purpose / Big Picture

This change reduces duplicated mutation logic in `src/lib/gateway/agentConfig.ts` by introducing one reusable gateway-config mutation flow that all agent config operations use. Today each mutation path (`create`, `rename`, `delete`, `update heartbeat`, and `remove heartbeat override`) independently performs the same sequence: load a config snapshot, normalize to `baseConfig`, compute a new `agents.list`, and call `config.patch` with retry-on-stale-hash behavior.

After this refactor, the behavior users see in the UI remains the same, but the repository has fewer ways to perform a gateway config patch, reducing drift risk and simplifying future changes to config patching rules.

## Progress

- [x] (2026-02-06 00:00Z) Completed deep analysis and selected one high-payoff consolidation target.
- [x] (2026-02-06 00:00Z) Implement reusable gateway config mutation transaction helper in `src/lib/gateway/agentConfig.ts`.
- [x] (2026-02-06 00:00Z) Refactor all mutation entry points in `src/lib/gateway/agentConfig.ts` to use the helper.
- [x] (2026-02-06 00:00Z) Add focused unit tests and run targeted/full verification.

## Surprises & Discoveries

- Observation: The same mutation prelude and patch call logic is repeated in five functions in `src/lib/gateway/agentConfig.ts`.
  Evidence: `config.get` + `snapshot` parsing + `readConfigAgentList` + `applyGatewayConfigPatch` appears at lines 167, 208, 230, 269, and 301.

- Observation: Retry-on-stale-hash behavior already exists and is centralized in `applyGatewayConfigPatch`, making it a stable anchor for consolidation.
  Evidence: The retry branch is implemented once at lines 143-153.

## Decision Log

- Decision: Consolidate within `src/lib/gateway/agentConfig.ts` instead of introducing a broad new module.
  Rationale: The duplicate code is localized to one file; keeping scope tight minimizes blast radius and rollback complexity.
  Date/Author: 2026-02-06 / Codex.

- Decision: Keep call-site behavior unchanged and preserve all user-facing success/failure paths.
  Rationale: This is a structural refactor; it should be behavior-safe and lower risk.
  Date/Author: 2026-02-06 / Codex.

- Decision: Add/extend tests around helper-level transaction flow rather than only individual public methods.
  Rationale: This catches regression risk from subtle no-op or patch-shape edge cases and gives confidence before touching mutator call sites.
  Date/Author: 2026-02-06 / Codex.

## Outcomes & Retrospective

Completed on 2026-02-06 after implementation and validation:

- Added `withGatewayConfigMutation` to centralize `config.get`, base config normalization, and delegated patch execution with a single result path.
- Refactored `renameGatewayAgent`, `createGatewayAgent`, `deleteGatewayAgent`, `updateGatewayHeartbeat`, and `removeGatewayHeartbeatOverride` to use the helper without changing exported signatures.
- Preserved no-op branches for delete and heartbeat override removal.
- Verified behavior parity with 8 focused tests in `tests/unit/gatewayConfigPatch.test.ts`, plus full suite/typecheck.
- Removed duplicated `config.get` + `applyGatewayConfigPatch` boilerplate from these entry points.

## Context and Orientation

`src/lib/gateway/agentConfig.ts` is the gateway-facing mutation module for agent runtime config. It performs patch operations used by agent creation, rename, deletion, heartbeat override creation/removal, and returns derived heartbeat state.

The UI call sites for these mutations are primarily in `src/app/page.tsx` and keep the same external contracts via functions in `src/lib/gateway/agentConfig.ts`; there is no direct HTTP API involved for these paths.

`tests/unit/gatewayConfigPatch.test.ts` is the principal coverage for this module and already exercises all major mutation functions.

## Plan of Work

Introduce one shared internal helper, e.g. `withGatewayConfigMutation`, that owns:

- loading the latest snapshot (`config.get`)
- extracting normalized base config and list data
- computing the new config patch via a callback
- applying the patch via `applyGatewayConfigPatch`
- returning a computed result to the caller

Then refactor each mutation function to pass its specific list transformation logic into that helper. Functions should remain exported from the same module and keep signatures unchanged.

Add unit tests for the helper’s core behavior in a backward-compatible way (new test cases can live in `tests/unit/gatewayConfigPatch.test.ts` or a new adjacent helper-focused test file). Keep the existing tests for each public helper as-is and expand only where behavior edge cases are currently uncovered.

## Concrete Steps

From the repository root:

1. Validate current baseline

   npm run test -- tests/unit/gatewayConfigPatch.test.ts

2. Open `src/lib/gateway/agentConfig.ts` and implement one reusable mutation transaction helper. The helper should accept a typed callback that receives `{ snapshot, baseConfig, list, sessionKey, client }` and returns `{ shouldPatch, nextConfig?, result }`-style output.

3. Refactor all mutation functions to use the helper:

   - `renameGatewayAgent`
   - `createGatewayAgent`
   - `deleteGatewayAgent`
   - `updateGatewayHeartbeat`
   - `removeGatewayHeartbeatOverride`

4. Ensure patch/no-op behavior stays identical where existing code intentionally avoids writing when nothing changed:

   - delete returns `{ removed: false, removedBindings: 0 }` when patch is empty
   - heartbeat removal returns current heartbeat settings when there is no override to remove

5. Run focused tests and full verification:

   npm run test -- tests/unit/gatewayConfigPatch.test.ts
   npm run typecheck
   npm run test

6. Commit the refactor only after all commands pass.

## Validation and Acceptance

Acceptance is complete when:

1. `src/lib/gateway/agentConfig.ts` contains one reusable internal mutation helper for gateway config patching, and all five mutation entry points use it.
2. The behavior of these public functions is unchanged for successful and no-op paths:
   - create/rename still succeed with patched list persisted
   - delete still updates agent list and bindings when changed
   - heartbeat update and remove still return normalized heartbeat state
3. `npm run test -- tests/unit/gatewayConfigPatch.test.ts` passes.
4. `npm run typecheck` and `npm run test` pass.
5. No direct duplicate `config.get` + `applyGatewayConfigPatch` mutation boilerplate remains in `src/lib/gateway/agentConfig.ts`.

## Idempotence and Recovery

This is a low-risk code-only refactor because only function internals and shared helper extraction change. If regression appears, revert the helper and restore each function to the pre-change path.

If validation fails after partial implementation, keep the repository in compilable state by completing one function migration at a time and rerunning the focused `gatewayConfigPatch` test before proceeding.

## Artifacts and Notes

Capture command output and key diffs for handoff:

- npm run test -- tests/unit/gatewayConfigPatch.test.ts
- npm run typecheck
- npm run test

Track the final function layout by checking:

- rg -n "config\.get\(\"config.get\"\)|applyGatewayConfigPatch\(" src/lib/gateway/agentConfig.ts

Expected result is that shared logic appears in one helper and each public mutation function delegates to it.

## Interfaces and Dependencies

No external API contracts change.

- Input/output and errors for each of these exports must remain unchanged:
  - `renameGatewayAgent`
  - `createGatewayAgent`
  - `deleteGatewayAgent`
  - `updateGatewayHeartbeat`
  - `removeGatewayHeartbeatOverride`

- The existing types in this module (`GatewayConfigSnapshot`, `AgentHeartbeatResult`, `GatewayClient`) remain unchanged.

## Plan Revision Note

2026-02-06: Initial plan created from a repository-wide sweep. This is a one-refactor recommendation focused on reducing duplicated `config.get`/`config.patch` mutation code in `src/lib/gateway/agentConfig.ts`.
