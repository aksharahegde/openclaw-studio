# Consolidate Heartbeat Types Into One Module

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository defines ExecPlan requirements in `.agent/PLANS.md`. This document must be maintained in accordance with that file.

## Purpose / Big Picture

Today, heartbeat behavior and heartbeat types are split across two modules:

1. `src/lib/heartbeat/gateway.ts` implements the gateway calls and “heartbeat summary” logic used by the UI.
2. `src/lib/gateway/heartbeat.ts` defines the `AgentHeartbeat*` type shapes that the gateway config mutation layer uses.

This split increases cognitive load (there are two “heartbeat modules” to discover) and introduces unnecessary cross-imports between “gateway” and “heartbeat” folders. After this change, there will be a single source for heartbeat shapes and gateway heartbeat helpers, so engineers only have to learn one module and future heartbeat changes are less likely to drift.

You can see it working by running `npm run typecheck` and `npm test` successfully, and by starting the app and verifying the Agent Settings panel still shows heartbeat rows (when a gateway reports them) and “Run heartbeat now” still triggers the `wake` call successfully.

## Progress

- [x] (2026-02-06 03:10Z) Read current heartbeat modules and list import sites.
- [x] (2026-02-06 03:10Z) Move `AgentHeartbeat*` types into `src/lib/heartbeat/gateway.ts` and update imports using `import type` to avoid runtime cycles.
- [x] (2026-02-06 03:10Z) Remove `src/lib/gateway/heartbeat.ts` and confirm no remaining references.
- [x] (2026-02-06 03:12Z) Run `npm run lint`, `npm run typecheck`, and `npm test`.
- [x] (2026-02-06 03:12Z) Commit with message `Milestone 1: Consolidate heartbeat types`.

## Surprises & Discoveries

- `npm install` reports `1 high severity vulnerability` and suggests `npm audit fix --force`.
  Evidence: npm output during install on 2026-02-06 03:10Z.

## Decision Log

- Decision: Consolidate heartbeat shapes into `src/lib/heartbeat/gateway.ts` (and delete `src/lib/gateway/heartbeat.ts`) rather than moving everything under `src/lib/gateway/`.
  Rationale: This removes the duplicated “heartbeat module” concept with a small blast radius and avoids removing any directories. The only required cross-module dependency (`src/lib/gateway/agentConfig.ts` referencing heartbeat shapes) can be made type-only to avoid runtime import cycles.
  Date/Author: 2026-02-06 (Codex)

## Outcomes & Retrospective

- Not started yet.

## Context and Orientation

OpenClaw Studio is a Next.js App Router UI. The agent settings and runtime UI live in `src/app/page.tsx` and `src/features/agents/*`. It talks directly to an OpenClaw WebSocket gateway using `src/lib/gateway/GatewayClient.ts`.

Heartbeat-related code currently spans:

- `src/lib/heartbeat/gateway.ts`: UI-facing gateway helpers: `listHeartbeatsForAgent`, `triggerHeartbeatNow`, and `AgentHeartbeatSummary` (used by `src/app/page.tsx` and `src/features/agents/components/AgentInspectPanels.tsx`).
- `src/lib/gateway/heartbeat.ts`: Type shapes for heartbeat configuration and mutation: `AgentHeartbeatActiveHours`, `AgentHeartbeat`, `AgentHeartbeatResult`, `AgentHeartbeatUpdatePayload` (used by `src/lib/gateway/agentConfig.ts` and imported by `src/lib/heartbeat/gateway.ts`).
- `src/lib/gateway/agentConfig.ts`: Gateway config patching and heartbeat override mutation helpers: `resolveHeartbeatSettings`, `updateGatewayHeartbeat`, `removeGatewayHeartbeatOverride`.

The key technical constraint is avoiding a runtime import cycle:

- `src/lib/heartbeat/gateway.ts` imports runtime functions from `src/lib/gateway/agentConfig.ts`.
- If `src/lib/gateway/agentConfig.ts` imports heartbeat shapes from `src/lib/heartbeat/gateway.ts` as a runtime import, the two modules will import each other and can fail at runtime depending on initialization order.

TypeScript supports `import type`, which is erased at build time. We will use `import type` for heartbeat shapes from `src/lib/heartbeat/gateway.ts` in `src/lib/gateway/agentConfig.ts` so there is no runtime cycle.

## Plan of Work

We will make `src/lib/heartbeat/gateway.ts` the single module that defines heartbeat shapes and gateway heartbeat helpers.

1. In `src/lib/heartbeat/gateway.ts`, inline the type definitions currently in `src/lib/gateway/heartbeat.ts`:
   - `AgentHeartbeatActiveHours`
   - `AgentHeartbeat`
   - `AgentHeartbeatResult`
   - `AgentHeartbeatUpdatePayload`

   Then remove the now-unnecessary `import type { AgentHeartbeat } from "@/lib/gateway/heartbeat";` from `src/lib/heartbeat/gateway.ts` and update any local references to use the in-file types.

2. In `src/lib/gateway/agentConfig.ts`, replace the import from `@/lib/gateway/heartbeat` with a type-only import from `@/lib/heartbeat/gateway`:
   - `import type { AgentHeartbeat, AgentHeartbeatResult, AgentHeartbeatUpdatePayload } from "@/lib/heartbeat/gateway";`

   This is intentionally `import type` to avoid introducing a runtime cycle with `src/lib/heartbeat/gateway.ts`.

3. Delete `src/lib/gateway/heartbeat.ts`.

4. Update any remaining imports of `@/lib/gateway/heartbeat` (if any remain after step 2) to `@/lib/heartbeat/gateway`.

## Concrete Steps

All commands below assume the working directory is:

  `/Users/georgepickett/.codex/worktrees/dbb8/openclaw-studio`

1. Confirm the current import sites:

   - `rg -n "@/lib/gateway/heartbeat" src`

2. Move the `AgentHeartbeat*` type exports into `src/lib/heartbeat/gateway.ts` and update `src/lib/gateway/agentConfig.ts` to use `import type` from `@/lib/heartbeat/gateway`.

3. Delete `src/lib/gateway/heartbeat.ts`.

4. Confirm there are no remaining references:

   - `rg -n "lib/gateway/heartbeat" src`

5. Run validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`

   Expected result is that all three commands succeed with no errors.

6. Optional smoke check (if you have a gateway running):

   - `npm run dev`
   - Open `http://localhost:3000`
   - Verify the Agent Settings panel still loads and the heartbeat actions still trigger without client-side errors.

7. Commit:

   - `git status`
   - `git commit -am "Milestone 1: Consolidate heartbeat types"` (or stage explicitly if files are added/removed)

## Validation and Acceptance

Milestone 1 (Consolidate heartbeat types):

1. Tests to write: None for this refactor. This change is a consolidation with no intended behavior change and the heartbeat gateway helpers depend on a live WebSocket gateway, so we will rely on static validation and existing test suites.
2. Implementation:
   - Move heartbeat type exports from `src/lib/gateway/heartbeat.ts` into `src/lib/heartbeat/gateway.ts`.
   - Update `src/lib/gateway/agentConfig.ts` to import those shapes via `import type` from `src/lib/heartbeat/gateway.ts`.
   - Delete `src/lib/gateway/heartbeat.ts`.
3. Verification:
   - Run `npm run lint`, `npm run typecheck`, and `npm test` and confirm they all pass.
4. Commit:
   - Commit the changes with message `Milestone 1: Consolidate heartbeat types`.

Acceptance criteria:

- `src/lib/gateway/heartbeat.ts` no longer exists.
- `src/lib/heartbeat/gateway.ts` exports the heartbeat shape types (`AgentHeartbeat*`) and the existing gateway helpers (`listHeartbeatsForAgent`, `triggerHeartbeatNow`, `AgentHeartbeatSummary`) with no behavior changes.
- `src/lib/gateway/agentConfig.ts` imports heartbeat shapes from `@/lib/heartbeat/gateway` using `import type` (no runtime cycle introduced).
- `npm run lint`, `npm run typecheck`, and `npm test` all succeed.

## Idempotence and Recovery

This refactor is safe to re-run. If something goes wrong, the simplest recovery is to revert the commit for this milestone (or, if not committed yet, use git to restore `src/lib/gateway/heartbeat.ts` and revert the import changes).

Because we are deleting one file, a failed partial state typically manifests as TypeScript import errors. Fix by either:

- Completing the migration (update remaining imports), or
- Restoring the deleted file and undoing the type moves.

## Artifacts and Notes

Keep a short note in this ExecPlan if any unexpected import cycle or Next.js build behavior appears, including the exact error string and the file it points to.

## Interfaces and Dependencies

After this milestone, the heartbeat module interface is:

- In `src/lib/heartbeat/gateway.ts`, these types are exported:
  - `AgentHeartbeatActiveHours`
  - `AgentHeartbeat`
  - `AgentHeartbeatResult`
  - `AgentHeartbeatUpdatePayload`
  - `AgentHeartbeatSummary`
  - `HeartbeatListResult`
  - `HeartbeatWakeResult`

- In `src/lib/heartbeat/gateway.ts`, these functions are exported:
  - `listHeartbeatsForAgent(client: GatewayClient, agentId: string): Promise<HeartbeatListResult>`
  - `triggerHeartbeatNow(client: GatewayClient, agentId: string): Promise<HeartbeatWakeResult>`

And `src/lib/gateway/agentConfig.ts` must import heartbeat shapes from `@/lib/heartbeat/gateway` using `import type` only.
