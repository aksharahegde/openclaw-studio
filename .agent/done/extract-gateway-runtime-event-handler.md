# Extract A Testable Gateway Runtime Event Handler (Option 2)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan rules live at `.agent/PLANS.md` from the repo root. This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

After this change, the core “what should happen when the gateway emits an event” rules will live in a dedicated, unit-tested module instead of being implemented as one large `client.onEvent` callback inside `src/app/page.tsx`.

This matters because the gateway event loop currently mixes domain decisions (when a run is “running” vs “idle”, when to append output, how to merge streams, when to load history) with infrastructure (timers, refs, dispatch calls). The result is hard to test and risky to change. After this refactor, we can validate behavior by running unit tests that simulate gateway event sequences without standing up a gateway or React UI, and `src/app/page.tsx` becomes wiring instead of policy.

You can see it working by running `npm test` and observing a new unit test file that drives the handler with representative `chat` / `agent` events and asserts the resulting store mutations and side-effect intents (summary refresh debounce, history load requests). Then start the app and confirm the UI behaves identically when streaming responses, tools, and lifecycle events.

## Progress

- [x] (2026-02-08) Milestone 1: Introduce a `GatewayRuntimeEventHandler` module with injected dependencies and unit tests for runtime-chat events.
- [x] (2026-02-08) Milestone 2: Extend the handler to support runtime-agent streams (`assistant`, reasoning streams, `tool`, `lifecycle`) with unit tests.
- [x] (2026-02-08) Milestone 3: Move summary-refresh debounce/timer logic into the handler with fake-timer tests; wire `src/app/page.tsx` to use the handler and delete the in-page god callback.
- [x] (2026-02-08) Milestone 4: Run `npm test`, `npm run lint`, `npm run typecheck`; do a manual smoke test against a real gateway.

## Surprises & Discoveries

- Observation: `src/app/page.tsx` was also clearing per-run tracking state outside the gateway event subscription (for example during “New session” and when generating a new run id before sending).
  Evidence: `src/app/page.tsx` calls `clearRunTracking(agent.runId)` in `handleNewSession`, and previously deleted `assistantStreamByRunRef` entries when generating `runId` in `handleSend`.

## Decision Log

- Decision: Implement an object-style handler (`createGatewayRuntimeEventHandler`) that owns its own internal event-loop memory (sets/maps and timer id) and interacts with the app only through injected functions.
  Rationale: This keeps the policy testable (deps can be mocked), reduces coupling to React refs, and lets `src/app/page.tsx` shrink to wiring while preserving current behavior.
  Date/Author: 2026-02-08 / Codex

- Decision: Expose `clearRunTracking(runId)` on the handler to preserve existing cleanup calls from non-event code paths (`handleNewSession`, pre-run send) without keeping duplicate tracking state in `src/app/page.tsx`.
  Rationale: Avoids leaking run-scoped dedupe buffers and keeps cleanup semantics roughly aligned with the previous ref-based implementation.
  Date/Author: 2026-02-08 / Codex

## Outcomes & Retrospective

- Outcome: Gateway event policy is extracted into `src/features/agents/state/gatewayRuntimeEventHandler.ts` with dependency injection and a small public surface (`handleEvent`, `clearRunTracking`, `dispose`).
- Outcome: Unit tests cover runtime `chat` handling, runtime `agent` streams, and debounced summary refresh logic:
  - `tests/unit/gatewayRuntimeEventHandler.chat.test.ts`
  - `tests/unit/gatewayRuntimeEventHandler.agent.test.ts`
  - `tests/unit/gatewayRuntimeEventHandler.summaryRefresh.test.ts`
- Outcome: `src/app/page.tsx` no longer contains the large `client.onEvent` god callback; it wires gateway events into the extracted handler.
- Outcome: `npm test`, `npm run lint`, and `npm run typecheck` pass.
- Gap: Manual smoke testing against a real gateway was not performed as part of this automated run; it should still be done to confirm real streaming behavior is unchanged.

## Context and Orientation

OpenClaw Studio is a Next.js App Router UI. The main screen is implemented in `src/app/page.tsx`. It connects directly to an OpenClaw gateway over WebSocket via `src/lib/gateway/GatewayClient.ts`, and subscribes to streaming events using `client.onEvent`.

The current event handling is concentrated in `src/app/page.tsx` inside the `useEffect` that calls `client.onEvent(...)` (roughly around `src/app/page.tsx:1955` in the current tree). That callback:

1. Classifies events using `classifyGatewayEventKind` from `src/features/agents/state/runtimeEventBridge.ts`.
2. For `presence` / `heartbeat`, it debounces and triggers summary refresh (`loadSummarySnapshot`) and bumps a heartbeat tick counter.
3. For `chat` events, it updates agent UI state (stream text, thinking trace), appends output on final, and sometimes triggers `loadAgentHistory`.
4. For `agent` events, it merges assistant/reasoning streams, formats tool calls, applies lifecycle transitions, and tracks per-run dedupe state.

This plan’s goal is to move steps 2-4 into a new module that is unit-tested and dependency-injected, so we can simulate event sequences in tests and so `src/app/page.tsx` is primarily wiring.

Important constraints:

- We must not change user-visible behavior intentionally. This is a refactor with tests, not a redesign.
- We are making changes to OpenClaw Studio only (this repo). Do not change `/Users/georgepickett/openclaw`.
- Avoid adding noisy logs. Where observability is needed for restore/failure cases, use existing `console.*` patterns.

## Plan of Work

We will add a new handler module under `src/features/agents/state/` that:

1. Owns the event-loop memory currently stored in React refs in `src/app/page.tsx` (for example: per-run tool line dedupe, merged stream buffers, “seen chat run ids”, and the summary refresh timer id).
2. Takes its dependencies as injected functions so it can be tested:
   - reading the current agent list (from `stateRef.current.agents`)
   - applying store mutations (dispatching `updateAgent` / `appendOutput` / `markActivity`)
   - scheduling / clearing timers (for summary refresh debounce)
   - requesting async side effects (load summary snapshot, load agent history, refresh heartbeat latest update)
3. Exposes a single `handleEvent(event: EventFrame)` method that `src/app/page.tsx` can call from the existing subscription.

We will port logic from `src/app/page.tsx` into the handler in small steps, with tests added before wiring, to keep behavior stable.

## Concrete Steps

All commands below are run from the repo root:

    cd /Users/georgepickett/.codex/worktrees/5e63/openclaw-studio

### Milestone 1: New handler module + tests for runtime-chat

1. Create `src/features/agents/state/gatewayRuntimeEventHandler.ts` that exports:

   - A factory:

         export function createGatewayRuntimeEventHandler(deps: GatewayRuntimeEventHandlerDeps): GatewayRuntimeEventHandler

   - A handler interface:

         export type GatewayRuntimeEventHandler = {
           handleEvent: (event: EventFrame) => void;
           dispose: () => void;
         };

   - Dependencies (inject everything that would otherwise be “global” or “React ref”):

         export type GatewayRuntimeEventHandlerDeps = {
           getStatus: () => "disconnected" | "connecting" | "connected";
           getAgents: () => AgentState[];
           dispatch: (action: { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }
             | { type: "appendOutput"; agentId: string; line: string }
             | { type: "markActivity"; agentId: string; at?: number }) => void;
           queueLivePatch: (agentId: string, patch: Partial<AgentState>) => void;
           now?: () => number;

           loadSummarySnapshot: () => Promise<void>;
           loadAgentHistory: (agentId: string) => Promise<void>;
           refreshHeartbeatLatestUpdate: () => void;
           bumpHeartbeatTick: () => void;

           setTimeout: (fn: () => void, delayMs: number) => number;
           clearTimeout: (id: number) => void;

           isDisconnectLikeError: (err: unknown) => boolean;
           logWarn?: (message: string, meta?: unknown) => void;
         };

   Notes:
   - Keep `dispatch` action types minimal and local to the handler. Do not export the store’s internal `Action` type (it is not exported today).
   - The handler should not import `window` or use `window.setTimeout` directly; use injected timer functions.
   - The handler should not know about React; it should be plain TypeScript.

2. Port only runtime-chat logic first (the `eventKind === "runtime-chat"` branch). Keep behavior identical, including:
   - ignoring events with missing `sessionKey`
   - tracking `runId` in a “seen” set
   - updating summary fields via `getChatSummaryPatch`
   - ignoring `role === "user"` and `role === "system"` for streaming
   - delta behavior: update `thinkingTrace` and/or `streamText` via `queueLivePatch`
   - final behavior: clear stream fields, append thinking/tool lines, append final output, update `lastResult`, and conditionally request history load
   - aborted/error behavior: append “Run aborted.” / error lines and clear stream fields

   During this milestone, keep runtime-agent and summary-refresh logic in `src/app/page.tsx` to reduce blast radius. The handler can ignore those event kinds for now.

3. Add `tests/unit/gatewayRuntimeEventHandler.chat.test.ts` that tests representative chat event sequences without React:
   - Use `vi.fn()` for `dispatch`, `queueLivePatch`, `loadAgentHistory`, etc.
   - Provide a small in-memory `agents` array with one agent whose `sessionKey` matches the event payload.
   - Include tests that assert:
     - delta assistant chat updates call `queueLivePatch` with `status: "running"` and set `streamText` and/or `thinkingTrace` when present
     - final assistant chat appends output and clears `streamText` / `thinkingTrace` via `dispatch(updateAgent, ...)`
     - user/system roles are ignored for streaming output as in current code
     - aborted/error emits the same strings as today (“Run aborted.”, `Error: ...`), and clears stream fields

4. Run tests:

    npm test

Expected: tests pass. Keep a short transcript in `Surprises & Discoveries` if behavior differs.

5. Commit Milestone 1 with a message like:

    Milestone 1: add runtime chat event handler + tests

### Milestone 2: Extend handler for runtime-agent streams

1. Expand `src/features/agents/state/gatewayRuntimeEventHandler.ts` to fully own the runtime-agent branch from `src/app/page.tsx`, including:
   - locating the agent by `payload.sessionKey` or by matching `runId` to `agent.runId`
   - “reasoning-like” streams using `isReasoningRuntimeAgentStream` and `mergeRuntimeStream`
   - assistant stream merging and stream publish policy using `shouldPublishAssistantStream`
   - tool stream handling that formats tool calls / results and dedupes tool lines per run (move `dedupeRunLines` usage into handler-owned state)
   - lifecycle stream handling using `getAgentSummaryPatch` and `resolveLifecyclePatch`, including the “append final text on end when no chat events” behavior

2. Move the following per-run/per-session tracking structures out of `src/app/page.tsx` and into the handler:
   - chat run seen set (`chatRunSeenRef`)
   - assistant stream buffer map (`assistantStreamByRunRef`)
   - thinking stream buffer map (`thinkingStreamByRunRef`)
   - per-run tool line dedupe map (`toolLinesSeenRef`)
   - “thinking debug” set (`thinkingDebugRef`) used to warn once per session key

   The handler should expose `dispose()` that clears any internal memory and cancels pending timers.

3. Add `tests/unit/gatewayRuntimeEventHandler.agent.test.ts` that covers:
   - reasoning stream merges deltas into the stored buffer and produces `queueLivePatch` updates with `thinkingTrace`
   - assistant stream merges and publishes/does-not-publish based on `hasChatEvents` and `shouldPublishAssistantStream`
   - tool events:
     - phase != result formats a tool call line and dedupes it per run id
     - phase == result formats tool result lines and dedupes per run id
   - lifecycle events:
     - start sets running status + runId (via `resolveLifecyclePatch`)
     - end clears run tracking and can append a final streamText when there were no chat events, matching current behavior

4. Run tests:

    npm test

5. Commit Milestone 2 with a message like:

    Milestone 2: handle runtime agent streams in extracted handler

### Milestone 3: Summary refresh debounce + wire `src/app/page.tsx`

1. Move the `summary-refresh` branch into the handler:
   - On `presence` / `heartbeat` events, if `getStatus() !== "connected"`, do nothing.
   - If `event.event === "heartbeat"`, call `bumpHeartbeatTick()` and `refreshHeartbeatLatestUpdate()`.
   - Debounce `loadSummarySnapshot()` by 750ms, cancelling any pending scheduled refresh on subsequent summary-refresh events.

2. Add `tests/unit/gatewayRuntimeEventHandler.summaryRefresh.test.ts` that uses fake timers:
   - Use `vi.useFakeTimers()` and provide injected `setTimeout` / `clearTimeout` that delegate to the global timers.
   - Assert multiple `presence` / `heartbeat` events only trigger one `loadSummarySnapshot()` call after 750ms, and that the timer is cancelled/rescheduled properly.

3. Wire `src/app/page.tsx`:
   - Replace the large `client.onEvent((event) => { ... })` body with a handler instance created in the effect.
   - Keep `loadSummarySnapshot` and `loadAgentHistory` as they exist, but pass them into the handler as deps.
   - Delete the now-redundant refs and helper functions from `src/app/page.tsx` that the handler owns.
   - Ensure cleanup: unsubscribe from gateway events, call `handler.dispose()`, and clear any timers.

4. Run:

    npm test

5. Commit Milestone 3 with a message like:

    Milestone 3: wire page gateway events through extracted handler

### Milestone 4: Full verification

1. Run:

    npm run lint
    npm run typecheck
    npm test

2. Manual smoke test (requires a real OpenClaw gateway you can connect to):
   - Start Studio:

         npm run dev

   - Connect to a gateway and verify:
     - streaming assistant output continues to appear incrementally
     - tool call lines appear and do not duplicate excessively
     - lifecycle “running/idle” transitions still work
     - summary preview refresh still updates after presence/heartbeat events
     - “Load history” behavior and any auto-history-load heuristics still behave as before

3. Commit any final fixes needed for Milestone 4 and record outcomes in `Outcomes & Retrospective`.

## Validation and Acceptance

Acceptance is met when:

1. `src/app/page.tsx` no longer contains a large policy-heavy `client.onEvent` callback; it is primarily wiring to an extracted handler module.
2. New unit tests pass that simulate gateway `chat` and `agent` events and assert the same mutations/effects the UI relied on before.
3. `npm test`, `npm run lint`, and `npm run typecheck` pass.
4. Manual smoke testing against a real gateway confirms UI behavior is unchanged for streaming, tool output, lifecycle transitions, and summary refresh.

## Idempotence and Recovery

This refactor should be safe to apply incrementally. Each milestone is designed to be independently verifiable with unit tests. If a milestone introduces behavior drift, revert to the last passing commit and adjust the handler logic until tests and manual smoke match baseline behavior.

## Artifacts and Notes

Key current locations (for implementers):

- Current god callback: `src/app/page.tsx` in the `useEffect` that subscribes to `client.onEvent(...)`.
- Pure helper functions already used by the callback: `src/features/agents/state/runtimeEventBridge.ts`.
- Store mutations used by the callback: `src/features/agents/state/store.tsx` (internal `Action` union is not exported).

## Interfaces and Dependencies

At the end of Milestone 3, `src/features/agents/state/gatewayRuntimeEventHandler.ts` must exist and be the single place that encodes the runtime gateway event policy. It must be testable with mocked dependencies and must not require React to execute.

Plan revision note (required for living plans):

- (2026-02-08) Initial ExecPlan created for Option 2 (extract and test gateway runtime event handling currently embedded in `src/app/page.tsx`).
