# Make Studio Chat Transcript Deterministic and Exactly-Once

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `.agent/PLANS.md` and must be maintained in accordance with it.

## Purpose / Big Picture

The user-visible goal is simple: each run should produce one predictable final assistant answer, in the right order, without duplicates. Today, the same run can render twice when a lifecycle terminal event arrives before the chat final event. After this plan is implemented, Studio will treat terminal output as exactly-once state, not append-only state, so event timing differences no longer change what users see.

A user should be able to send a message, watch streaming output, and always end with a single final assistant block. If the gateway replays events, delivers them late, or sends lifecycle before chat final, the transcript should still settle to one canonical final answer with stable ordering.

First-principles reliability contract for this fix:

1. One run has one terminal assistant outcome in UI state.
2. Any event replay is idempotent (same semantic event must map to same transcript identity).
3. Ordering is deterministic under races (same inputs always produce same transcript order).
4. Recovery converges to canonical history after transport gaps/reconnect.

## Progress

- [x] (2026-02-16 22:54Z) Read and applied planning rules from `.agent/PLANS.md`.
- [x] (2026-02-16 22:54Z) Investigated Studio runtime ingestion path (`gatewayRuntimeEventHandler`, `runtimeEventPolicy`, `transcript`, `store`).
- [x] (2026-02-16 22:54Z) Verified upstream gateway emits `agent:lifecycle` before `chat:final` for the same run.
- [x] (2026-02-16 22:54Z) Drafted first-principles reliability strategy and acceptance criteria.
- [x] (2026-02-16 23:03Z) Audited every referenced path and function signature in the current plan and corrected inaccuracies (notably `seq` ownership and transcript-v2 assumptions).
- [x] (2026-02-16 23:06Z) Re-audited policy and operations coverage; corrected test and milestone targets so transport-gap convergence is validated through reconcile/history operations, and corrected Vitest command form to deterministic non-watch execution.
- [x] (2026-02-16 23:12Z) Confirmed runtime terminal append path currently emits no deterministic `entryId`, which prevents exact-once replacement across replay/race scenarios.
- [x] (2026-02-16 23:15Z) Audited render-layer behavior and added explicit state-before-render reliability guardrails (`chatItems` consumes `outputLines` without assistant dedupe).
- [x] (2026-02-16 23:18Z) Tightened feasibility by removing unnecessary required `page.tsx` edits and adding explicit gateway gap callback regression coverage (`tests/unit/gatewayClient.gap.test.ts`).
- [x] (2026-02-16 23:14Z) Added failing regression tests for lifecycle-before-chat-final duplication, higher-seq terminal replacement, and reducer upsert-by-entry-id behavior.
- [x] (2026-02-16 23:18Z) Implemented reducer upsert-by-entry-id in `appendOutput`, including replacement-path `outputLines` rebuild for transcript-v2 enabled/disabled modes.
- [x] (2026-02-16 23:24Z) Implemented runtime terminalization state machine with delayed lifecycle fallback, stable terminal entry ids, fallback cancellation on chat-final, and deterministic fallback-to-final replacement.
- [x] (2026-02-16 23:27Z) Added `payload.seq` typing on chat events, switched policy contract to explicit `isStaleTerminal`, and implemented stale-terminal guard/metric emission in runtime ingestion.
- [x] (2026-02-16 23:36Z) Added gap-recovery convergence coverage across reconcile/history workflows and implemented resolved-run assistant duplicate collapse in transcript-v2 history sync.
- [x] (2026-02-16 23:42Z) Added lightweight runtime reliability metrics for stale terminal drops and lifecycle-fallback replacement by canonical chat final, with focused handler coverage.
- [x] (2026-02-16 23:46Z) Ran full focused reliability suite (13 files), `npm run typecheck`, and local runtime smoke verification via `npm run smoke:dev-server` (HTTP 200).

## Surprises & Discoveries

- Observation: Upstream gateway intentionally broadcasts `agent` lifecycle events before emitting the corresponding `chat` final event.
  Evidence: `/Users/georgepickett/openclaw/src/gateway/server-chat.ts` broadcasts `agent` first (`line 371`) and then emits chat final on lifecycle terminal (`lines 385-407`).

- Observation: Studio currently appends lifecycle fallback final text immediately when `phase === "end" && !hasChatEvents`.
  Evidence: `src/features/agents/state/gatewayRuntimeEventHandler.ts:855-900`.

- Observation: Studio also appends final assistant text on `chat.state === "final"`, so lifecycle-first ordering can produce two final entries.
  Evidence: `src/features/agents/state/gatewayRuntimeEventHandler.ts:551-615`.

- Observation: Transcript merge already has the clock-skew tolerance fix and canonical history timestamp preference, so ordering drift from local clock skew is partially addressed.
  Evidence: `src/features/agents/state/transcript.ts:361-443` and `tests/unit/transcript.test.ts:264-322`.

- Observation: Chat event sequence for a run is carried inside chat payload (`payload.seq`) from upstream `emitChatFinal`/`emitChatDelta`, not only as frame envelope metadata.
  Evidence: `/Users/georgepickett/openclaw/src/gateway/server-chat.ts:242-247` and `/Users/georgepickett/openclaw/src/gateway/server-chat.ts:273-277`.

- Observation: `appendOutput` in the reducer always appends today; if `TRANSCRIPT_V2_ENABLED` is false, `outputLines` is also append-only and will still duplicate lines even if transcript entries are deduped later.
  Evidence: `src/features/agents/state/store.tsx:325-364`.

- Observation: Runtime terminal appends currently do not pass explicit transcript `entryId`, so generated ids include `sequenceKey` and differ across replayed equivalent events.
  Evidence: `src/features/agents/state/gatewayRuntimeEventHandler.ts:568-612` and `src/features/agents/state/transcript.ts:293-297`.

- Observation: Runtime chat policy currently drops every second terminal event for a run based only on run id (`isTerminalRunSeen`), not event freshness; this can reject a newer terminal event after an older one was processed first.
  Evidence: `src/features/agents/state/runtimeEventPolicy.ts:118-120` and `tests/unit/runtimeEventPolicy.test.ts:154-180`.

- Observation: Final chat rendering consumes `outputLines` in order and appends assistant items directly; it does not perform assistant-level dedupe, so duplicate lines in state become duplicate UI messages.
  Evidence: `src/features/agents/components/chatItems.ts:249-310`.
- Observation: Transcript-v2 history merge confirmed unconfirmed matches but did not collapse same-text assistant entries for a run when duplicates already existed with different `entryId`s.
  Evidence: `src/features/agents/operations/historySyncOperation.ts` merge flow before resolved-run collapse pass and new regression in `tests/unit/historySyncOperation.integration.test.ts`.
- Observation: In the real gap callback flow, reconcile may set an agent idle before history refresh executes, so collapse logic keyed only to request-time `status === "running"` can be skipped.
  Evidence: `executeAgentReconcileCommands` ordering in `src/features/agents/operations/agentReconcileOperation.ts` and validated by updated integration tests.
- Observation: Stale terminal chat drops were already guarded but metric payload lacked previous terminal context, making production triage harder.
  Evidence: `stale_terminal_chat_event_ignored` call site in `src/features/agents/state/gatewayRuntimeEventHandler.ts` before this milestone update.

## Decision Log

- Decision: Treat `chat final` as canonical finalization signal and treat lifecycle fallback as a delayed safety net, not a primary output source.
  Rationale: Upstream event order is lifecycle-first; immediate fallback creates duplicates when canonical chat final arrives shortly after.
  Date/Author: 2026-02-16 / Codex

- Decision: Introduce deterministic transcript entry ids for terminal assistant/meta events and support upsert semantics in store reducer.
  Rationale: Exactly-once behavior requires idempotent writes; append-only is insufficient under replay/race conditions.
  Date/Author: 2026-02-16 / Codex

- Decision: Track per-run terminal state (seen final, fallback timer, committed source, last seq) inside runtime handler.
  Rationale: Reliability depends on explicit run state, not implicit checks like `hasChatEvents` alone.
  Date/Author: 2026-02-16 / Codex

- Decision: Keep history sync as reconciliation and proof of eventual correctness, but fix live ingestion first.
  Rationale: User-visible duplication occurs before history refresh; UX must be correct in real time.
  Date/Author: 2026-02-16 / Codex

- Decision: Base run-level stale terminal guards on `payload.seq` (chat payload sequence) plus terminal commit state, not on WebSocket frame-level sequence alone.
  Rationale: Run-specific ordering must use run-scoped sequence values that upstream already emits on chat payloads.
  Date/Author: 2026-02-16 / Codex

- Decision: Keep reducer writes transcript-first for replacement paths, and rebuild `outputLines` from transcript entries whenever an upsert occurs.
  Rationale: Two mutable views of the same data are a primary source of drift; replacement must update rendered lines deterministically even when transcript-v2 is off.
  Date/Author: 2026-02-16 / Codex

- Decision: Treat websocket gap notifications as reliability events that must force canonical convergence through history reconciliation for active/focused runs.
  Rationale: Transport gaps are a known replay/reorder vector; explicit reconciliation closes the loop and keeps UI predictable.
  Date/Author: 2026-02-16 / Codex

- Decision: Replace blanket terminal dedupe by run id with sequence-aware terminal acceptance (`incoming seq > last accepted seq`) plus deterministic entry-id upsert.
  Rationale: Exactly-once by run id alone is too coarse and can preserve stale terminal state; sequence-aware acceptance allows newer canonical final events to supersede older terminal data safely.
  Date/Author: 2026-02-16 / Codex

- Decision: Keep deduplication at runtime/state boundaries and do not add UI-only assistant dedupe in `chatItems`.
  Rationale: UI dedupe would hide correctness bugs and can suppress legitimate repeated assistant content; state must be correct before rendering.
  Date/Author: 2026-02-16 / Codex
- Decision: During history sync, when request snapshot was running and latest snapshot is terminal for that run, collapse same-text assistant transcript entries for the resolved run before emitting patches.
  Rationale: Gap/reconcile recovery must converge stale duplicate runtime terminal entries to one canonical assistant state without relying on render-layer dedupe.
  Date/Author: 2026-02-16 / Codex
- Decision: Collapse same-text assistant duplicates for non-active runIds based on latest active run state, rather than request-time running status.
  Rationale: This matches actual reconcile->history callback ordering and guarantees convergence even when history sync starts after run state has already been cleared.
  Date/Author: 2026-02-16 / Codex
- Decision: Emit explicit runtime debug metrics for both stale terminal drops and lifecycle-fallback-to-chat-final replacements from the runtime handler.
  Rationale: These are the two highest-value terminal race outcomes to observe in production, and both can be instrumented with near-zero overhead at existing decision points.
  Date/Author: 2026-02-16 / Codex

## Outcomes & Retrospective

Current outcome: implementation and verification completed for the deterministic transcript reliability plan. Terminal races, stale terminal replay handling, and gap-recovery convergence now have explicit runtime safeguards plus regression coverage.

Final outcome achieved: one canonical terminal assistant outcome per run in state, deterministic replacement semantics under lifecycle/chat races, and convergence after reconnect/gap recovery with all focused suites green.

## Context and Orientation

This repository is a Next.js Studio frontend. Runtime events enter through one gateway subscription in `src/app/page.tsx`, are routed to `createGatewayRuntimeEventHandler` in `src/features/agents/state/gatewayRuntimeEventHandler.ts`, and end up as reducer actions in `src/features/agents/state/store.tsx`.

The current duplicate path is:

1. `agent` lifecycle `end` path appends fallback assistant text when no chat events were seen yet (`gatewayRuntimeEventHandler.ts`, lifecycle branch).
2. `chat` final path later appends final assistant text again for the same run (`gatewayRuntimeEventHandler.ts`, final branch).
3. `appendOutput` currently appends entries/lines and does not replace prior entries with same semantic identity (`store.tsx`, `appendOutput` case).

Core files and what they do:

- `src/features/agents/state/gatewayRuntimeEventHandler.ts`: runtime side effects, line appends, run cleanup, summary refresh and history refresh triggers.
- `src/features/agents/state/runtimeEventBridge.ts`: event helper utilities and payload types, including chat/lifecycle parsing helpers.
- `src/features/agents/state/runtimeEventPolicy.ts`: pure intent decisions for chat/agent/summary events.
- `src/features/agents/state/store.tsx`: reducer with `appendOutput` and transcript/output derivation logic.
- `src/features/agents/state/transcript.ts`: transcript entries, sorting, merge with history, and debug metrics.
- `src/features/agents/components/chatItems.ts`: final transformation from `outputLines` to rendered chat items.
- `src/features/agents/operations/agentReconcileOperation.ts`: resolves stuck/racy running runs and triggers history refresh after terminal reconciliation.
- `src/features/agents/operations/historySyncOperation.ts`: canonical history merge path after `chat.history` fetch.
- `tests/unit/gatewayRuntimeEventHandler.agent.test.ts`: lifecycle and agent-stream behavior tests.
- `tests/unit/gatewayRuntimeEventHandler.chat.test.ts`: chat delta/final/aborted/error behavior tests.
- `tests/unit/gatewayRuntimeEventHandler.policyDelegation.test.ts`: verifies handler obeys policy intents.
- `tests/unit/agentReconcileOperation.test.ts`: reconcile command generation and history refresh trigger tests.
- `tests/unit/gatewayClient.gap.test.ts`: verifies gateway sequence-gap callback delivery contract used by gap recovery.
- `tests/unit/runtimeEventBridge.test.ts`: helper semantics tests.
- `tests/unit/runtimeEventPolicy.test.ts`: policy intent tests.
- `tests/unit/transcript.test.ts`: transcript ordering and merge tests.

Definitions used in this plan:

- Run: one assistant execution keyed by `runId`.
- Terminal output: final assistant text and its metadata line for a run.
- Canonical final: terminal output derived from `chat.state === "final"`.
- Lifecycle fallback: terminal output derived from `agent.streamText` at lifecycle terminal when canonical final has not arrived yet.
- Upsert-by-entry-id: replace existing transcript entry with same `entryId` instead of appending.

## Plan of Work

### Milestone 1: Add failing tests that reproduce the real race

Start with tests so the bug is measurable before code changes. In `tests/unit/gatewayRuntimeEventHandler.agent.test.ts`, add a case where lifecycle `end` arrives first and chat `final` arrives shortly after for the same run, then assert only one final assistant line and one final assistant metadata line are present in dispatched append actions. Use fake timers to model the fallback delay window deterministically.

In `tests/unit/gatewayRuntimeEventHandler.chat.test.ts`, add a case where fallback already committed and a late `chat final` arrives; assert replacement semantics (single final line in resulting reducer state after actions are reduced). Replace the current duplicate-terminal test with two sequence-aware cases: same/lower `payload.seq` is ignored, and higher `payload.seq` is accepted and replaces prior terminal output for the run. Add a reducer-focused test file `tests/unit/store.transcript-upsert.test.ts` that proves `appendOutput` with same `entryId` replaces rather than appends.

At the end of this milestone, the new tests should fail against current behavior and document the target behavior precisely.

### Milestone 2: Implement transcript entry upsert in reducer

Modify `appendOutput` in `src/features/agents/state/store.tsx` so that when `nextEntry.entryId` matches an existing entry, the reducer replaces that entry in-place (preserving `sequenceKey` ordering semantics as needed), recalculates sorted transcript entries, and rebuilds `outputLines` from transcript entries for the replacement path.

Important implementation detail: replacement must update visible lines even when `TRANSCRIPT_V2_ENABLED` is false, because legacy output mode currently appends `outputLines` directly. For replacement cases, compute `outputLines` from updated transcript entries to avoid duplicate rendered lines in legacy mode.

Do not alter behavior for appends with no `entryId`; those should remain append-only.

At the end of this milestone, idempotent writes by deterministic id are supported at the reducer boundary.

### Milestone 3: Implement run terminalization state machine in runtime handler

In `src/features/agents/state/gatewayRuntimeEventHandler.ts`, add a per-run terminal state map and helper functions that explicitly manage:

- pending lifecycle fallback timer,
- whether canonical chat final was observed,
- whether terminal output is already committed,
- last seen payload sequence for terminal events.

Behavior changes:

- Lifecycle `end/error` schedules fallback commit after a short delay (for example 300ms).
- Chat `final` cancels pending fallback and commits canonical final immediately.
- Fallback and canonical final dispatch the same deterministic transcript entry ids for meta and assistant lines:
  - `run:<runId>:assistant:meta`
  - `run:<runId>:assistant:final`
- Fallback uses `confirmed: false`; canonical final uses `confirmed: true`.
- Terminal-state map stores last accepted terminal sequence and commit source so replayed terminal writes can be rejected before dispatch.

Because Milestone 2 provides upsert-by-entry-id, if fallback commits first and canonical final arrives later, canonical final replaces fallback instead of duplicating output.

Update cleanup paths (`clearRunTracking` and `dispose`) to clear any pending fallback timers and terminal run state entries.

At the end of this milestone, lifecycle-before-chat-final no longer creates duplicate final output.

### Milestone 4: Add sequence and stale-terminal guards

Update payload typing in `src/features/agents/state/runtimeEventBridge.ts` to include optional chat payload sequence (`seq?: number`) so runtime handler can use run-scoped sequence data that upstream already emits.

In `src/features/agents/state/gatewayRuntimeEventHandler.ts`, apply stale-terminal guards: if a terminal chat event for a run has a sequence less than or equal to the last terminal sequence already processed for that run, ignore it and emit a debug metric via `logTranscriptDebugMetric`.

Update `src/features/agents/state/runtimeEventPolicy.ts` so terminal chat handling no longer short-circuits solely from `isTerminalRunSeen`; policy should stay pure but accept an explicit freshness signal from the handler path (or equivalent) so newer terminal events can still produce intents. Update `tests/unit/runtimeEventPolicy.test.ts` to cover this contract.

At the end of this milestone, replayed or regressive terminal events are deterministically ignored.

### Milestone 5: Add transport-gap convergence behavior

Use existing gap handling in `src/app/page.tsx:2054-2060` as the convergence trigger and ensure gap recovery always settles to one canonical terminal result. Cover this through the operations that page invokes: `runAgentReconcileOperation` and `runHistorySyncOperation`. Extend `tests/unit/agentReconcileOperation.test.ts`, `tests/unit/historySyncOperation.integration.test.ts`, and `tests/unit/historyLifecycleWorkflow.integration.test.ts` so the scenario is explicit: after a simulated gap-driven reconcile and history refresh, no duplicate terminal assistant lines remain for the run.

At the end of this milestone, reconnect and gap scenarios are deterministic and converge to canonical history.

### Milestone 6: Validate behavior and keep adjacent tests green

After implementation, update and run the adjacent suites that exercise the same boundaries:

- `tests/unit/gatewayRuntimeEventHandler.agent.test.ts`
- `tests/unit/gatewayRuntimeEventHandler.chat.test.ts`
- `tests/unit/gatewayRuntimeEventHandler.policyDelegation.test.ts`
- `tests/unit/agentReconcileOperation.test.ts`
- `tests/unit/chatItems.test.ts`
- `tests/unit/gatewayClient.gap.test.ts`
- `tests/unit/runtimeEventBridge.test.ts`
- `tests/unit/runtimeEventPolicy.test.ts`
- `tests/unit/transcript.test.ts`
- `tests/unit/historySyncOperation.test.ts`
- `tests/unit/historySyncOperation.integration.test.ts`
- `tests/unit/historyLifecycleWorkflow.integration.test.ts`
- `tests/unit/store.transcript-upsert.test.ts`

At the end of this milestone, the race conditions from production are covered and adjacent behavior remains stable.

## Concrete Steps

Run all commands from repository root.

    cd /Users/georgepickett/.codex/worktrees/20ca/openclaw-studio

Create failing tests first.

    npm run test -- --run tests/unit/gatewayRuntimeEventHandler.agent.test.ts tests/unit/gatewayRuntimeEventHandler.chat.test.ts tests/unit/store.transcript-upsert.test.ts

Implement reducer upsert and runtime terminalization changes in:

    src/features/agents/state/store.tsx
    src/features/agents/state/gatewayRuntimeEventHandler.ts
    src/features/agents/state/runtimeEventBridge.ts

Run focused verification after each milestone.

    npm run test -- --run tests/unit/gatewayRuntimeEventHandler.agent.test.ts tests/unit/gatewayRuntimeEventHandler.chat.test.ts tests/unit/gatewayRuntimeEventHandler.policyDelegation.test.ts
    npm run test -- --run tests/unit/agentReconcileOperation.test.ts tests/unit/historySyncOperation.integration.test.ts tests/unit/historyLifecycleWorkflow.integration.test.ts
    npm run test -- --run tests/unit/runtimeEventBridge.test.ts tests/unit/runtimeEventPolicy.test.ts tests/unit/transcript.test.ts tests/unit/historySyncOperation.test.ts tests/unit/historySyncOperation.integration.test.ts tests/unit/historyLifecycleWorkflow.integration.test.ts tests/unit/chatItems.test.ts tests/unit/gatewayClient.gap.test.ts tests/unit/store.transcript-upsert.test.ts
    npm run typecheck

Expected command-level signals:

- Vitest reports all targeted files as passed.
- No test reports duplicate terminal append behavior in new race tests.
- Gap/reconnect tests show convergence to a single canonical terminal assistant output.
- Gateway client gap callback tests still pass, proving gap notifications continue to fire the recovery pipeline.
- TypeScript check exits successfully.

For manual verification, run Studio and trigger a normal send flow.

    npm run dev

Then send one chat message and observe that final assistant output appears once even when lifecycle and chat events arrive in different order.

## Validation and Acceptance

Acceptance is satisfied only if all of the following are true:

- Lifecycle `end` followed by chat `final` for the same run produces one final assistant output block (and one associated assistant meta line) in transcript state.
- Chat `final` followed by lifecycle `end` also produces one final assistant output block.
- Replayed `chat final` for the same run and same/lower sequence does not change visible output.
- Replayed/older terminal events do not overwrite newer canonical terminal events for the run.
- If fallback commits and canonical final arrives later, canonical final replaces fallback content rather than appending a second final block.
- After a simulated websocket gap, summary+reconcile+history refresh converges to one canonical terminal assistant block with no duplicate terminal lines.
- Ordering remains user then assistant after history sync in skewed-timestamp scenarios already covered by transcript tests.
- Rendering the final transcript via `buildFinalAgentChatItems` yields exactly one terminal assistant item for the run in race/replay scenarios.

Evidence should include targeted unit test output and one manual run observation from local dev.

## Idempotence and Recovery

This plan is safe to execute incrementally. Each milestone is additive and can be retried. If a milestone fails, keep the new tests and revert only code files touched in that milestone, then rerun the same targeted test command.

When editing timer-based logic, always clear timers in both run cleanup and handler dispose; otherwise stale delayed callbacks can mutate state after disconnect/reconnect. If this happens during development, a full page reload resets handler state, but the fix must be in code before completion.

Do not introduce destructive repository operations. No migration or external state mutation is required.

## Artifacts and Notes

Planning evidence tied to code:

    Upstream ordering proof:
    /Users/georgepickett/openclaw/src/gateway/server-chat.ts
      - line 371: broadcast("agent", agentPayload)
      - lines 385-407: emitChatFinal(...) after lifecycle terminal

    Studio duplicate path:
    src/features/agents/state/gatewayRuntimeEventHandler.ts
      - lifecycle fallback append branch at lines 855-900
      - chat final append branch at lines 551-615
      - terminal append calls currently omit explicit transcript entry ids at lines 568-612 and 867-890

    Terminal short-circuit path that must become sequence-aware:
    src/features/agents/state/runtimeEventPolicy.ts
      - duplicate terminal ignore currently keyed by run id only at lines 118-120

    Reducer append-only behavior:
    src/features/agents/state/store.tsx
      - appendOutput branch at lines 325-364

    Gap/recovery trigger:
    src/app/page.tsx
      - websocket gap hook at lines 2054-2060 currently triggers summary + running reconciliation

    Existing transcript merge skew coverage:
    tests/unit/transcript.test.ts
      - canonical timestamp ordering test around lines 264-322

## Interfaces and Dependencies

No new external packages are needed.

Concrete interface adjustments expected at completion:

- `src/features/agents/state/runtimeEventBridge.ts`

    export type ChatEventPayload = {
      runId: string;
      sessionKey: string;
      state: "delta" | "final" | "aborted" | "error";
      seq?: number;
      message?: unknown;
      errorMessage?: string;
    };

- `src/features/agents/state/gatewayRuntimeEventHandler.ts`

    type RunTerminalState = {
      chatFinalSeen: boolean;
      terminalCommitted: boolean;
      fallbackTimerId: number | null;
      lastTerminalSeq: number | null;
    };

    function scheduleLifecycleFallback(runId: string, ...): void;
    function cancelLifecycleFallback(runId: string): void;
    function appendTerminalWithStableIds(runId: string, ...): void;

- `src/features/agents/state/store.tsx` (`appendOutput` case)

    if (nextEntry has entryId and existing entry with same id exists) {
      replace existing transcript entry;
      rebuild outputLines from updated transcript entries;
      increment transcriptRevision;
      keep transcriptSequenceCounter monotonic;
    } else {
      existing append behavior;
    }

- `src/features/agents/state/runtimeEventPolicy.ts`

    type RuntimeChatPolicyInput = {
      ...
      isStaleTerminal: boolean;
      ...
    };

    // terminal events
    if (input.isStaleTerminal) {
      return [{ kind: "ignore", reason: "stale-terminal-event" }];
    }

Keep `src/features/agents/state/runtimeEventPolicy.ts` as pure intent logic and avoid moving timer/orchestration concerns into policy.

Revision note (2026-02-16, Codex): Initial ExecPlan created from first-principles analysis of observed ordering/duplication failures, with explicit milestones for deterministic run finalization, idempotent transcript writes, and regression coverage.
Revision note (2026-02-16, Codex): Plan rewritten with code-grounded corrections after deep file audit. Fixed incorrect sequence assumptions, added reducer behavior needed for non-transcript-v2 mode, expanded adjacent test coverage, and made milestones test-first and implementation-specific.
Revision note (2026-02-16, Codex): Plan strengthened around first-principles reliability invariants. Added explicit deterministic-entry-id gap, transport-gap convergence milestone, and reliability-metric expectations so the implementation proves predictability under race, replay, and reconnect conditions.
Revision note (2026-02-16, Codex): Plan refined after another full code pass. Replaced run-id-only terminal dedupe assumptions with sequence-aware policy guidance, corrected gap-validation targets to operations actually invoked by `onGap`, and updated test commands to use `vitest --run` for reliable, non-interactive verification.
Revision note (2026-02-16, Codex): Plan refined with render-layer evidence. Added `chatItems` as a first-class dependency and validation target, documented why dedupe must happen before rendering, and made runtime policy interface changes explicit (`isStaleTerminal`) to avoid run-id-only terminal suppression.
Revision note (2026-02-16, Codex): Plan refined for execution feasibility. Removed a non-essential required edit target (`src/app/page.tsx`) and added `gatewayClient.gap` regression coverage so transport-gap recovery assumptions are backed by an existing callback contract test.
