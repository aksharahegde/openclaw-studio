# Extract Gateway Event Ingress Decision Workflow From `src/app/page.tsx`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `.agent/PLANS.md`; this document must be maintained in accordance with it.

## Purpose / Big Picture

The highest-impact architectural entanglement in this repository is the gateway event ingress flow in `src/app/page.tsx`, where runtime event wiring, approval domain decisions, cron domain parsing, React state mutations, and transcript side effects are interleaved in one callback chain. After this refactor, ingress domain interpretation will live in one pure workflow module with plain inputs and outputs, and `page.tsx` will remain orchestration-only. This is a pure refactor with no intended user-visible behavior changes: approvals and cron transcript updates should behave exactly as they do today.

## Progress

- [x] (2026-02-17 01:13Z) Identify and lock current ingress behavior with a new unit test file for extracted decisions.
- [x] (2026-02-17 01:13Z) Add `src/features/agents/state/gatewayEventIngressWorkflow.ts` with pure resolver interfaces for approval + cron ingress decisions.
- [x] (2026-02-17 01:13Z) Refactor `src/app/page.tsx` to call the resolver and apply resulting commands/effects.
- [x] (2026-02-17 01:13Z) Run typecheck, focused tests, and full unit test run.
- [x] (2026-02-17 01:13Z) Documented deferred manual Studio sanity checks because no reachable gateway is available in this execution environment.

## Surprises & Discoveries

- Observation: The refactor removed ingress decision parsing from `src/app/page.tsx`, but total file line count only dropped from 2688 to 2686.
  Evidence: `wc -l src/app/page.tsx` before/after check; side-effect application code intentionally remains in `page.tsx` orchestration.
- Observation: Structural grep checks that verify removal of inline ingress parsing now return exit code 1 because no matches remain.
  Evidence: `rg -n "handleExecApprovalEvent|resolveExecApprovalEventEffects|parseAgentIdFromSessionKey|event\\.event === \"cron\"|record\\.action === \"finished\"" src/app/page.tsx` returned no matches after refactor.

## Decision Log

- Decision: Extract gateway event ingress decision logic from `src/app/page.tsx` before other candidates.
  Rationale: Weighted entanglement scoring across top candidates identified this as the single worst boundary violation.
  Date/Author: 2026-02-17 / Codex

- Decision: Keep `client.onEvent` subscription ownership and side-effect application in `src/app/page.tsx`; extract only domain decision interpretation into a pure workflow module.
  Rationale: This is the highest-ROI cut with minimal churn to unrelated runtime handler internals while immediately reducing mixed decision/side-effect logic in the hottest callback path.
  Date/Author: 2026-02-17 / Codex

- Decision: Preserve cron dedupe ordering semantics exactly (record dedupe key before agent-exists check) and preserve transcript metadata contract.
  Rationale: Current behavior in `src/app/page.tsx:1954-1999` relies on this order and metadata shape; changing it risks duplicate lines or regressions in transcript rendering.
  Date/Author: 2026-02-17 / Codex

- Decision: Use `removePendingApprovalEverywhere` while applying removal effects in the refactored ingress orchestrator.
  Rationale: `src/features/agents/approvals/pendingStore.ts` already provides an idempotent scoped+unscoped removal helper with unit coverage in `tests/unit/pendingExecApprovalsStore.test.ts`; reusing it reduces duplicated reducer logic and drift risk.
  Date/Author: 2026-02-17 / Codex

## Outcomes & Retrospective

Implemented the extraction end-to-end with no user-visible behavior changes intended. Ingress decision interpretation now lives in `src/features/agents/state/gatewayEventIngressWorkflow.ts`, and `src/app/page.tsx` delegates gateway ingress events through `resolveGatewayEventIngressDecision` before applying side effects.

Verification results are strong: `npm run typecheck` passed, focused regression suites passed, and full unit suite passed (`110` files, `512` tests). New unit coverage in `tests/unit/gatewayEventIngressWorkflow.test.ts` verifies malformed cron rejection, dedupe behavior, known/unknown agent handling, transcript formatting/timestamp fallback, and approval effect delegation.

Manual runtime validation was deferred because this session does not have a reachable gateway target. The implementation risk that remains is runtime-only drift in live gateway event payloads not represented in unit fixtures.

## Context and Orientation

The core user-facing flows in this codebase are:

1. Gateway connect and runtime subscription (`src/lib/gateway/GatewayClient.ts`, `src/app/page.tsx`).
2. Live agent/chat runtime streaming to transcript (`src/features/agents/state/gatewayRuntimeEventHandler.ts`, `src/app/page.tsx`).
3. Exec approval event intake and approval resolution (`src/features/agents/approvals/execApprovalLifecycleWorkflow.ts`, `src/features/agents/approvals/execApprovalResolveOperation.ts`, `src/app/page.tsx`).
4. Agent creation and guided setup lifecycle (`src/features/agents/operations/createAgentMutationLifecycleOperation.ts`, `src/app/page.tsx`).
5. History synchronization and transcript reconciliation (`src/features/agents/operations/historySyncOperation.ts`, `src/app/page.tsx`).

The worst entanglement is in flow 2+3 overlap inside `src/app/page.tsx`:

- `src/app/page.tsx:1888-1932` contains `handleExecApprovalEvent`, where approval event interpretation and React store mutation orchestration are tightly interleaved.
- `src/app/page.tsx:1954-1999` contains the `client.onEvent` callback that simultaneously:
  - delegates runtime stream handling (`handler.handleEvent`),
  - runs approval decision interpretation,
  - parses raw cron payload shape and validity,
  - performs dedupe decisions,
  - resolves agent identity,
  - emits transcript side effects and activity updates.

This file is currently 2688 lines (`wc -l src/app/page.tsx`), so this mixed callback carries substantial blast radius and merge risk.

For comparison, other high-value flows are already separated into workflow/operation modules with dedicated tests (`tests/unit/createAgentMutationLifecycleOperation.test.ts`, `tests/unit/agentConfigMutationLifecycleOperation.test.ts`, `tests/unit/historySyncOperation.test.ts`), which reduces their current entanglement score relative to ingress.

## Plan of Work

Milestone 1 introduces a new pure decision workflow module named `src/features/agents/state/gatewayEventIngressWorkflow.ts` and a test file `tests/unit/gatewayEventIngressWorkflow.test.ts`. The workflow accepts a gateway `EventFrame`, current `AgentState[]`, seen cron dedupe keys, and current time. It returns one typed decision object containing approval effects, optional cron dedupe key to record, and optional cron transcript intent. It must not import React, browser globals, fetch helpers, logging, or stateful hooks.

Milestone 2 rewires `src/app/page.tsx` ingress handling so `client.onEvent` becomes orchestration-only: runtime handler call, resolver call, then effect application. Approval decision interpretation must be delegated to the existing pure helper `resolveExecApprovalEventEffects` through the new workflow module, not directly from `page.tsx`. Cron payload parsing and decision logic must leave `page.tsx` and be represented as resolver outputs. While applying approval effects, preserve current ordering semantics (removals, then scoped upserts, then unscoped upserts, then activity dispatches) and reuse pending-store reducers where possible.

Milestone 3 validates behavior and ensures no drift: typecheck, focused tests, full tests, and structural greps proving the callback no longer carries inline ingress parsing logic.

## Concrete Steps

All commands below run from the repository root:

    cd /Users/georgepickett/.codex/worktrees/db4a/openclaw-studio

Capture baseline and ingress markers:

    wc -l src/app/page.tsx
    rg -n "handleExecApprovalEvent|resolveExecApprovalEventEffects|parseAgentIdFromSessionKey|event\.event === \"cron\"|record\.action === \"finished\"" src/app/page.tsx

Expected: line count near 2688 and inline ingress markers present.

Create tests first:

    ${EDITOR:-vi} tests/unit/gatewayEventIngressWorkflow.test.ts
    npm run test -- --run tests/unit/gatewayEventIngressWorkflow.test.ts

Expected before implementation: failing run with unresolved import/export for `gatewayEventIngressWorkflow`.

Implement pure ingress workflow module:

    ${EDITOR:-vi} src/features/agents/state/gatewayEventIngressWorkflow.ts

Refactor ingress in `page.tsx` to use the workflow:

    ${EDITOR:-vi} src/app/page.tsx

Run validations:

    npm run typecheck
    npm run test -- --run tests/unit/gatewayEventIngressWorkflow.test.ts
    npm run test -- --run tests/unit/execApprovalLifecycleWorkflow.test.ts tests/unit/execApprovalResolveOperation.test.ts tests/unit/pendingExecApprovalsStore.test.ts
    npm run test -- --run tests/unit/gatewayRuntimeEventHandler.policyDelegation.test.ts tests/unit/runtimeEventPolicy.test.ts
    npm run test -- --run

Run structural checks after refactor:

    wc -l src/app/page.tsx
    rg -n "handleExecApprovalEvent|resolveExecApprovalEventEffects|parseAgentIdFromSessionKey|event\.event === \"cron\"|record\.action === \"finished\"" src/app/page.tsx
    rg -n "resolveGatewayEventIngressDecision" src/app/page.tsx src/features/agents/state/gatewayEventIngressWorkflow.ts tests/unit/gatewayEventIngressWorkflow.test.ts
    rg -n "from \"react\"|window\.|document\.|fetchJson|useGatewayConnection|console\." src/features/agents/state/gatewayEventIngressWorkflow.ts

Expected: `page.tsx` shrinks by roughly 70-120 lines, old inline ingress markers are gone, resolver symbol appears in all three files, and the new module has no forbidden infrastructure/UI imports.

## Validation and Acceptance

Acceptance criteria are behavioral and must all hold.

The source file `src/app/page.tsx` keeps one event subscription but no longer performs inline cron payload parsing or direct approval effect derivation in the callback body.

The extracted module `src/features/agents/state/gatewayEventIngressWorkflow.ts` is independently unit-testable with plain object inputs and zero mocks for React/browser/network/timers.

`tests/unit/gatewayEventIngressWorkflow.test.ts` must verify at minimum:

- non-cron events produce no cron decision,
- malformed cron payloads are ignored (missing payload object, non-`finished` action, empty `sessionKey`, unparsable session key, empty `jobId`),
- valid finished cron with known agent yields dedupe record + transcript intent,
- valid finished cron with unknown agent still yields dedupe record but null transcript intent,
- duplicate dedupe keys suppress cron decisions,
- timestamp fallback uses `nowMs` when `runAtMs` is absent,
- transcript text remains `Cron finished (${status || "unknown"}): ${jobId}` plus body `summary || error || "(no output)"`,
- transcript metadata contract stays unchanged (`source: "runtime-agent"`, `role: "assistant"`, `kind: "assistant"`, `confirmed: true`, `entryId = dedupeKey`),
- approval requested/resolved events preserve `resolveExecApprovalEventEffects` behavior exactly,
- approval `markActivityAgentIds` propagation is unchanged.

Global acceptance:

- `npm run typecheck` passes with no new TypeScript errors.
- `npm run test -- --run` passes.
- No new runtime warnings/errors appear from this refactor path during manual sanity run.
- User-facing flows remain unchanged: runtime chat streaming still updates, approval cards still appear/clear, cron finished entries still append once.

Manual sanity check (if reachable gateway is available): connect Studio, trigger a run needing approval, resolve one approval, trigger one finished cron event, verify transcript/approval behavior matches pre-refactor behavior. If unavailable, record the deferred manual verification explicitly in `Outcomes & Retrospective`.

## Idempotence and Recovery

This extraction is additive and local: one new workflow module, one new unit test file, and focused edits in `src/app/page.tsx`. Re-running steps is safe because the workflow is deterministic and tests are idempotent.

If recovery is needed:

    git restore src/app/page.tsx
    rm -f src/features/agents/state/gatewayEventIngressWorkflow.ts tests/unit/gatewayEventIngressWorkflow.test.ts
    npm run typecheck

If tests fail mid-refactor due to stale imports, run the structural `rg` checks above, remove stale inline references, and rerun only `tests/unit/gatewayEventIngressWorkflow.test.ts` before full test execution.

## Artifacts and Notes

Capture implementation evidence directly in this plan while executing:

- baseline and post-change `wc -l src/app/page.tsx` output,
- a short before/after excerpt of the `client.onEvent` callback,
- the exported resolver interface from `gatewayEventIngressWorkflow.ts`,
- failing-before and passing-after output from `tests/unit/gatewayEventIngressWorkflow.test.ts`,
- final `npm run typecheck` and `npm run test -- --run` summaries.

Observed artifacts:

- `wc -l src/app/page.tsx`: before `2688`, after `2686`.
- `npm run test -- --run tests/unit/gatewayEventIngressWorkflow.test.ts`: `1` file passed, `7` tests passed.
- `npm run typecheck`: passed.
- `npm run test -- --run`: `110` files passed, `512` tests passed.

## Interfaces and Dependencies

Define in `src/features/agents/state/gatewayEventIngressWorkflow.ts`:

    import type { ExecApprovalEventEffects } from "@/features/agents/approvals/execApprovalLifecycleWorkflow";
    import type { AgentState } from "@/features/agents/state/store";
    import type { EventFrame } from "@/lib/gateway/GatewayClient";

    export type CronTranscriptIntent = {
      agentId: string;
      sessionKey: string;
      dedupeKey: string;
      line: string;
      timestampMs: number;
      activityAtMs: number | null;
    };

    export type GatewayEventIngressDecision = {
      approvalEffects: ExecApprovalEventEffects | null;
      cronDedupeKeyToRecord: string | null;
      cronTranscriptIntent: CronTranscriptIntent | null;
    };

    export function resolveGatewayEventIngressDecision(params: {
      event: EventFrame;
      agents: AgentState[];
      seenCronDedupeKeys: ReadonlySet<string>;
      nowMs: number;
    }): GatewayEventIngressDecision;

Behavior contract:

- `approvalEffects` is exactly derived from `resolveExecApprovalEventEffects({ event, agents })`.
- `cronDedupeKeyToRecord` is set only for valid finished cron records not already in `seenCronDedupeKeys`.
- `cronTranscriptIntent` is set only when parsing succeeds and target agent exists in current `agents`.
- The resolver never mutates `seenCronDedupeKeys` and never performs side effects.

Revision note: Created by `find-entangled-flows` after scoring flow-level entanglements. Highest score was the event ingress multiplexer in `src/app/page.tsx` (8.85/10) versus history sync ingress coupling (6.73/10), create-mutation orchestration coupling (6.40/10), and sandbox-tool auto-repair coupling (6.28/10).
Revision note (2026-02-17, execplan-improve): Re-validated file paths/signatures and adjacent test patterns, tightened approval-application non-regression criteria, expanded malformed-cron acceptance coverage, and replaced rollback instructions with a retry-safe restore+remove sequence that works for newly created files.
Revision note (2026-02-17, implement-execplan): Implemented the ingress extraction by adding `gatewayEventIngressWorkflow.ts`, wiring `page.tsx` to delegate ingress decisions, adding unit coverage, and validating with typecheck plus full unit suite.
