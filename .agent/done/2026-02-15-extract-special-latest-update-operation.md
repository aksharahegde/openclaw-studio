# Extract Special Latest Update Refresh From `src/app/page.tsx`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan format is defined in `.agent/PLANS.md`, and this document must be maintained in accordance with it.

## Purpose / Big Picture

Today, `src/app/page.tsx` contains the “special latest update” refresh flow that decides when an agent’s fleet-row `latestOverride` should be replaced by a derived “Heartbeat” or “Cron” preview, and it performs the required gateway calls (`sessions.list`, `chat.history`, `cron.list`) inline. This mixes domain policy (how to interpret “heartbeat” vs “cron”, how to choose the “heartbeat session”, what to display) with infrastructure side effects (gateway I/O, dispatching patches) inside a 2956-line page component.

After this refactor, the special latest update refresh flow will live in a dedicated operation module with an explicit interface and unit tests. `src/app/page.tsx` will become wiring: it will construct the updater with dependencies and call it, without embedding the gateway-response parsing and derivation logic in the page component. There must be no user-visible behavior change.

## Progress

- [x] (2026-02-15 19:43Z) Create `src/features/agents/operations/specialLatestUpdateOperation.ts` with `createSpecialLatestUpdateOperation` (`update`, `refreshHeartbeat`, `clearInFlight`).
- [x] (2026-02-15 19:43Z) Rewire `src/app/page.tsx` to use the extracted operation; remove the inlined special-latest-update logic and in-flight ref.
- [x] (2026-02-15 19:43Z) Add `tests/unit/specialLatestUpdateOperation.test.ts` covering reset, heartbeat selection/history parsing, cron formatting, and in-flight dedupe.
- [x] (2026-02-15 19:43Z) Validate with `npm run typecheck` and `npm test` (all tests passing).

## Surprises & Discoveries

- `npm run typecheck` initially failed because `tsc` was not available (dependencies not installed). Running `npm ci` installed `node_modules` and unblocked typecheck + tests.

## Decision Log

- Decision: Extract the “special latest update” refresh flow (heartbeat + cron) out of `src/app/page.tsx` into a dedicated operation module.
  Rationale: It is a cohesive, high-leverage seam already injected into the runtime event handler (`createGatewayRuntimeEventHandler` deps). It currently mixes domain derivation and gateway I/O inside the page; extracting it reduces the page’s god-flow surface area and makes the derivation testable without mounting the full page component.
  Date/Author: 2026-02-15 / Codex

## Outcomes & Retrospective

- Extracted the special latest-update refresh flow into a dedicated operation module and added focused unit tests for it. `src/app/page.tsx` is now wiring for this flow (delegates to the operation), reducing page-level infrastructure/domain interleaving while keeping behavior stable.

## Context and Orientation

Definitions (in this repo’s terms):

“Gateway”: the upstream OpenClaw Gateway that Studio talks to over WebSocket via `GatewayClient.call(method, params)`.

“Special latest update”: the behavior that, when a user’s last message contains the word “heartbeat” or “cron”, overrides the agent’s `latestPreview` display in the fleet list using derived content. The override is stored in `AgentState.latestOverride` and `AgentState.latestOverrideKind` (see `src/features/agents/state/store.tsx`).

Key files and the exact code we are extracting from:

- `src/app/page.tsx` (2956 lines): main Studio page “god flow”. It owns gateway connection wiring, fleet hydration, pending guided setup retry, exec approvals lifecycle, cron/heartbeat settings loaders, and also special latest-update refresh.
- `src/features/agents/operations/latestUpdateWorkflow.ts`: pure policy for identifying “latest update” kind and intent (`resolveLatestUpdateIntent`) and for producing `latestOverride` patches (`buildLatestUpdatePatch`).
- `src/features/agents/state/gatewayRuntimeEventHandler.ts`: runtime event handler which depends on `updateSpecialLatestUpdate` and `refreshHeartbeatLatestUpdate` (injected from `src/app/page.tsx`).

The entangled flow we are extracting lives in `src/app/page.tsx`:

- `findLatestHeartbeatResponse` at `src/app/page.tsx:213`.
- `updateSpecialLatestUpdate` at `src/app/page.tsx:585`.
- `refreshHeartbeatLatestUpdate` at `src/app/page.tsx:664`.
- The “scan agents and enqueue updates” effect at `src/app/page.tsx:1225` which calls `updateSpecialLatestUpdate` for each agent.
- Runtime event wiring injects this function into the handler at `src/app/page.tsx:2082` and the handler invokes it for `queueLatestUpdate` intents at `src/features/agents/state/gatewayRuntimeEventHandler.ts:331`.

There is one additional page-level coupling that must keep working after extraction: starting a new session explicitly clears the in-flight tracker for this flow at `src/app/page.tsx:1820` by calling `specialUpdateInFlightRef.current.delete(agentId)`. After extraction we need an equivalent “clear in-flight for agent” call so new sessions do not get stuck behind a stale in-flight key.

What makes this architectural entanglement (not a single impure function):

- Domain rules (what counts as a “heartbeat session”, how to extract the heartbeat result, how to format the cron latest-update display, when to reset overrides) are embedded inside a React page component and interleaved with gateway I/O and `dispatch` calls.
- Testing the domain behavior today requires mounting `src/app/page.tsx` or re-implementing the logic in tests, because there is no boundary module to call with plain inputs.

## Plan of Work

Create a new module, `src/features/agents/operations/specialLatestUpdateOperation.ts`, that owns the extracted flow. This module will be a plain TypeScript module (no React hooks) and will be constructed with explicit dependencies (gateway call function, cron listing, dispatch patch callback, logging). It will return an updater with three responsibilities:

1. `update(agentId, agent, message)`: replicate the current `updateSpecialLatestUpdate` behavior exactly, including intent resolution, heartbeat-session selection, history parsing, cron selection, and patch dispatch.
2. `refreshHeartbeat(agents)`: replicate the current “force refresh heartbeat” loop.
3. `clearInFlight(agentId)`: replace the one existing usage of `specialUpdateInFlightRef.current.delete(agentId)` in `handleNewSession` so the in-flight guard stays correct.

Then, update `src/app/page.tsx` to delete the embedded functions and wire the new updater instead.

Finally, add unit tests for the new module to prove behavior without rendering the page.

## Concrete Steps

1. Create the new operation module at `src/features/agents/operations/specialLatestUpdateOperation.ts`.

   In this file, implement a factory function (name it exactly as below) that closes over an in-flight `Set<string>` and exposes three functions:

   `export function createSpecialLatestUpdateOperation(deps: SpecialLatestUpdateDeps): SpecialLatestUpdateOperation`

   The concrete behavior must be lifted from the existing implementation in `src/app/page.tsx:585` (do not reinterpret it). Keep the same intent resolution and patch shapes by importing and using:

   - `resolveLatestUpdateIntent` and `buildLatestUpdatePatch` from `src/features/agents/operations/latestUpdateWorkflow.ts`
   - `resolveLatestUpdateKind` remains in the page (used for the scan marker), but the operation should not need it.

   The operation needs these dependencies (all explicit so tests can stub them):

   - `callGateway(method: string, params: unknown): Promise<unknown>`; this will be `client.call.bind(client)` at the call site.
   - `listCronJobs(): Promise<{ jobs: CronJobSummary[] }>`; the page can provide `() => listCronJobs(client, { includeDisabled: true })` to preserve the current `includeDisabled` behavior.
   - `resolveCronJobForAgent(jobs: CronJobSummary[], agentId: string): CronJobSummary | null`; the page already has this callback around `resolveLatestCronJobForAgent`.
   - `formatCronJobDisplay(job: CronJobSummary): string`; use the existing function from `src/lib/cron/types.ts`.
   - `dispatchUpdateAgent(agentId: string, patch: { latestOverride: string | null; latestOverrideKind: "heartbeat" | "cron" | null }): void`; the page will implement this by dispatching `{ type: "updateAgent", ... }`.
   - `isDisconnectLikeError(err: unknown): boolean`; use the existing `isGatewayDisconnectLikeError`.
   - `logError(message: string): void`; default call site should use `console.error(message)`.

   The operation must accept an `agent` value as an `AgentState` (type-only import from `src/features/agents/state/store.tsx`) because the current function reads `agent.agentId`, `agent.sessionKey`, and checks whether an override exists via `agent.latestOverride` / `agent.latestOverrideKind`.

   Implement a helper inside the module that is moved from the page:

   - `findLatestHeartbeatResponse(messages: Array<Record<string, unknown>>): string | null` (lift `src/app/page.tsx:213`). This helper must keep using `extractText`, `stripUiMetadata`, and `isHeartbeatPrompt` from `src/lib/text/message-extract.ts` so that it stays aligned with how Studio interprets heartbeat prompts elsewhere.

   Implement `operation.update(agentId, agent, message)` with the same behavior as the page:

   - Resolve intent using `resolveLatestUpdateIntent({ message, agentId: agent.agentId, sessionKey: agent.sessionKey, hasExistingOverride: Boolean(agent.latestOverride || agent.latestOverrideKind) })`.
   - If intent is `noop`, return without dispatch.
   - If intent is `reset`, call `dispatchUpdateAgent(agent.agentId, buildLatestUpdatePatch(""))` and return.
   - Enforce the same per-agent in-flight guard that exists today (the `Set` is keyed by the `agentId` argument, matching the current code).
   - Heartbeat path:
     - Call `callGateway("sessions.list", { agentId: intent.agentId, includeGlobal: false, includeUnknown: false, limit: intent.sessionLimit })` and treat the result shape the same way the page does (if `sessions.sessions` is not an array, treat it as `[]`).
     - Filter entries where `entry.origin?.label` exists and is `"heartbeat"` case-insensitive, else fall back to the whole list. Sort descending by `updatedAt ?? 0`.
     - If there is no `sessionKey`, dispatch a reset patch (same as the page does) and return.
     - Call `callGateway("chat.history", { sessionKey, limit: intent.historyLimit })` and pass `history.messages ?? []` into `findLatestHeartbeatResponse`.
     - Dispatch `buildLatestUpdatePatch(content, "heartbeat")`.
   - Cron path:
     - Call `listCronJobs()`, resolve the job for `intent.agentId`, build `content` using `formatCronJobDisplay(job)` (or empty string), and dispatch `buildLatestUpdatePatch(content, "cron")`.
   - In all cases, remove the `agentId` key from the in-flight set in a `finally` block, matching the page’s behavior.
   - Preserve the current logging behavior: on exceptions, if `!isDisconnectLikeError(err)`, log the same message the page uses today (“Failed to load latest cron/heartbeat update.”) and do not throw.

   Implement `operation.refreshHeartbeat(agents)` to loop over the passed array and call `void operation.update(agent.agentId, agent, "heartbeat")`, matching `src/app/page.tsx:664`.

   Implement `operation.clearInFlight(agentId)` to delete the given key from the in-flight set. This is required because `src/app/page.tsx:1837` currently clears the ref directly.

2. Wire the operation into `src/app/page.tsx` and remove the extracted code.

   - Remove `findLatestHeartbeatResponse` (currently at `src/app/page.tsx:213`).
   - Remove `specialUpdateInFlightRef` (currently at `src/app/page.tsx:321`).
   - Remove `updateSpecialLatestUpdate` and `refreshHeartbeatLatestUpdate` (currently at `src/app/page.tsx:585` and `src/app/page.tsx:664`).
   - Add an import for the new factory from `src/features/agents/operations/specialLatestUpdateOperation.ts`.
   - Construct the operation once per page instance using `useMemo` so the in-flight set is stable:

     - Its `callGateway` should be `(method, params) => client.call(method, params)`.
     - Its `listCronJobs` should be `() => listCronJobs(client, { includeDisabled: true })` (this preserves the current behavior).
     - Its `dispatchUpdateAgent` should call the existing `dispatch({ type: "updateAgent", agentId, patch })`.

   - Update the “scan agents and enqueue updates” effect at `src/app/page.tsx:1225` to call `void specialLatestUpdate.update(agent.agentId, agent, lastMessage)` instead of the removed callback.

   - Update the runtime handler wiring at `src/app/page.tsx:2082`:

     - Replace `refreshHeartbeatLatestUpdate` with a wrapper that calls `specialLatestUpdate.refreshHeartbeat(stateRef.current.agents)`.
     - Replace `updateSpecialLatestUpdate` with `specialLatestUpdate.update`.

   - Update `handleNewSession` at `src/app/page.tsx:1820`:

     - Replace `specialUpdateInFlightRef.current.delete(agentId)` with `specialLatestUpdate.clearInFlight(agentId)`.
     - Keep `specialUpdateRef.current.delete(agentId)` as-is (this is a separate “marker seen” cache and should stay in the page).

   Acceptance check for this step (before writing tests): `src/app/page.tsx` should no longer mention `sessions.list`, `chat.history`, or `cron.list` inside a latest-update refresh helper. Those gateway calls should only exist in `src/features/agents/operations/specialLatestUpdateOperation.ts` after extraction.

3. Add unit tests for the extracted operation in `tests/unit/specialLatestUpdateOperation.test.ts`.

   Follow the existing testing style (see `tests/unit/agentFleetHydration.test.ts` for stubbing `client.call` with `vi.fn`).

   Write tests that validate behavior with plain stubs and no React rendering:

   - `it("dispatches reset patch when intent resolves to reset")`:
     - Construct the operation with a stubbed `dispatchUpdateAgent` and `callGateway` that would throw if invoked.
     - Call `update(agent.agentId, agent, "plain user prompt")` with `agent.latestOverrideKind` pre-set to force `hasExistingOverride: true`.
     - Assert `dispatchUpdateAgent` was called with `buildLatestUpdatePatch("")`.

   - `it("selects heartbeat session, reads history, and stores last assistant response after a heartbeat prompt")`:
     - Stub `callGateway` for `sessions.list` to return `sessions` entries where only one has `origin.label: "heartbeat"` and that one has the highest `updatedAt`.
     - Stub `callGateway` for `chat.history` to return `messages` that include:
       - a user message whose extracted text matches `isHeartbeatPrompt` (use the real regex behavior by providing a message whose `content` begins with `Read HEARTBEAT.md if it exists`), followed by multiple assistant messages; the last such assistant message is the expected result.
     - Assert the dispatched patch equals `buildLatestUpdatePatch(expected, "heartbeat")`.

   - `it("fetches cron jobs, selects latest cron for agentId, and stores formatted cron display")`:
     - Provide `listCronJobs` returning multiple jobs, including at least two with matching `agentId` and different `updatedAtMs`.
     - Use the real `resolveLatestCronJobForAgent`/`formatCronJobDisplay` behavior by passing the same resolver/formatter as production (or stub the formatter to return a unique string and assert it is used).
     - Assert dispatch uses `buildLatestUpdatePatch(content, "cron")`.

   - `it("dedupes concurrent updates for same agentId while first is in flight")`:
     - Make `callGateway("sessions.list", ...)` return a promise that you control (create it with `new Promise` and hold its resolver).
     - Invoke `update(...)` twice for the same agent id before resolving the first promise.
     - Assert `callGateway` was called only once for `sessions.list`.
     - Resolve the promise and complete the flow so the test does not leak.

4. Validate the refactor with the repo’s standard commands (run from `/Users/georgepickett/.codex/worktrees/f6bd/openclaw-studio`):

   - `npm run typecheck`
     Expected result: success with no output (exit code 0).

   - `npm test`
     Expected result: all unit tests pass, including the new `specialLatestUpdateOperation` tests.

## Validation and Acceptance

Code-level acceptance (verifiable):

1. `src/app/page.tsx` no longer defines `findLatestHeartbeatResponse`, `updateSpecialLatestUpdate`, or `refreshHeartbeatLatestUpdate`, and it no longer contains the gateway call chain (`sessions.list` + `chat.history` + `cron.list`) that used to live in `updateSpecialLatestUpdate`.

2. The extracted implementation lives in `src/features/agents/operations/specialLatestUpdateOperation.ts` and is unit-testable with stubbed dependencies. It must not import React hooks or read browser globals (`window`, `document`) directly.

3. Unit tests in `tests/unit/specialLatestUpdateOperation.test.ts` demonstrate:
   - heartbeat-session selection + history parsing behavior
   - cron selection + formatting behavior
   - per-agent in-flight dedupe behavior
   - reset/noop semantics derived from `resolveLatestUpdateIntent`

Manual smoke acceptance (optional but recommended):

1. `npm run dev`
2. Connect Studio to a gateway.
3. For an agent, send a message containing “heartbeat” and confirm the fleet row’s latest update resolves to a derived heartbeat response.
4. For an agent with cron jobs, send a message containing “cron” and confirm the fleet row’s latest update resolves to the formatted latest cron job display.

## Idempotence and Recovery

This refactor is additive and reversible:

- Add one new file and update imports/wiring in `src/app/page.tsx`.
- If anything goes wrong, `git checkout -- src/app/page.tsx` and `git checkout -- src/features/agents/operations/specialLatestUpdateOperation.ts` reverts the entire change.

## Artifacts and Notes

Revision note (2026-02-15): Strengthened this ExecPlan by reading the actual call sites and adding the missing wiring constraint from `handleNewSession` (`src/app/page.tsx:1837`) that clears the special-update in-flight guard. Corrected the agent-scan call site reference to `src/app/page.tsx:1225` and grounded the runtime-handler dependency path (`src/features/agents/state/gatewayRuntimeEventHandler.ts:331`). Rewrote the extraction steps to specify an explicit operation interface (`update`, `refreshHeartbeat`, `clearInFlight`) and concrete dependency injection matching existing repo test patterns.
