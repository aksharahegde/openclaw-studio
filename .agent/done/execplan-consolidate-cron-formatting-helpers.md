# Consolidate Cron Formatting Helpers Into `src/lib/cron/types.ts`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md` in this repository.

## Purpose / Big Picture

OpenClaw Studio currently formats cron schedules and cron payload text in two different places:

- `src/app/page.tsx` formats cron schedules (every/cron/at) and payload messages to build the “latest override” text for cron-driven updates.
- `src/features/agents/components/AgentInspectPanels.tsx` formats cron schedules and payload messages for the agent settings sidebar cron list.

These implementations are very similar but not identical (for example the “every” schedule label is built via different helper shapes). This is a classic drift vector: any future changes to cron scheduling or payload types risk requiring the same update in multiple places.

After this change, the cron domain has one shared formatting surface in `src/lib/cron/types.ts`, and the UI call sites reuse it. You can see it working by running unit tests and by confirming there are no longer local cron-formatting helper functions in `src/app/page.tsx` or `src/features/agents/components/AgentInspectPanels.tsx`.

## Progress

- [x] (2026-02-06 20:15Z) Add shared cron formatting helpers + unit coverage in `src/lib/cron/types.ts`.
- [x] (2026-02-06 20:16Z) Replace local cron formatting helpers in `src/app/page.tsx` and `src/features/agents/components/AgentInspectPanels.tsx` with imports from `@/lib/cron/types`.
- [x] (2026-02-06 20:16Z) Run `npm run lint`, `npm run test`, `npm run typecheck`, and `npm run build`.

## Surprises & Discoveries

- No surprises.

## Decision Log

- Decision: Centralize cron schedule/payload formatting into `src/lib/cron/types.ts`.
  Rationale: This removes duplicated UI logic with drift risk while keeping blast radius small (a few files, with unit tests to lock behavior).
  Date/Author: 2026-02-06 / Codex

## Outcomes & Retrospective

- Consolidated cron schedule/payload/job-display formatting into `src/lib/cron/types.ts`.
- Removed duplicated cron formatting helpers from `src/app/page.tsx` and `src/features/agents/components/AgentInspectPanels.tsx`.
- Verified with `npm run lint`, `npm run test`, `npm run typecheck`, and `npm run build`.

Result: one shared formatting surface for cron UI strings, reduced drift risk, and all gates passing.

## Context and Orientation

Cron domain types and gateway calls live in `src/lib/cron/types.ts`. The UI consumes cron jobs in two places:

- `src/app/page.tsx` (focused agent page): builds a human-readable string for “latest cron update” using local helpers `formatEveryMs`, `formatCronSchedule`, and `buildCronDisplay`, and duplicates a payload text extraction expression (`payload.kind === "systemEvent" ? payload.text : payload.message`).
- `src/features/agents/components/AgentInspectPanels.tsx` (agent settings sidebar): renders cron job schedule/payload rows using local helpers `formatEveryMs`, `formatCronSchedule`, and `formatCronPayload`.

The goal is to make `src/lib/cron/types.ts` the single place that knows how to turn a `CronSchedule`, `CronPayload`, and `CronJobSummary` into stable, user-facing label strings.

## Plan of Work

### Milestone 1: Add Shared Cron Formatting Helpers + Unit Tests

Add shared formatting helpers to `src/lib/cron/types.ts` and unit-test them in `tests/unit/cronSelectors.test.ts` (so we do not add a new test file for a small change).

In `src/lib/cron/types.ts`, introduce these exports (names chosen to match existing call sites and keep usage obvious):

- `formatCronSchedule(schedule: CronSchedule): string`
  - For `{ kind: "every" }`, return the same strings currently produced in the settings panel: `"Every 1h"`, `"Every 30m"`, `"Every 10s"`, `"Every 1500ms"`.
  - For `{ kind: "cron" }`, return `"Cron: <expr>"` or `"Cron: <expr> (<tz>)"` when `tz` is present.
  - For `{ kind: "at" }`, keep the current behavior: attempt `new Date(at)`, and return `"At: <date.toLocaleString()>"` when parseable, otherwise `"At: <at>"`.

- `formatCronPayload(payload: CronPayload): string`
  - For `{ kind: "systemEvent" }`, return `payload.text`.
  - For `{ kind: "agentTurn" }`, return `payload.message`.

- `formatCronJobDisplay(job: CronJobSummary): string`
  - Return a single string for “latest override” display with 3 lines: job name, formatted schedule, formatted payload.
  - This should match the existing `buildCronDisplay` behavior in `src/app/page.tsx`.

Tests to add in `tests/unit/cronSelectors.test.ts`:

1. Add a new `describe("cron formatting", () => { ... })` block that includes:
   - `it("formats_every_schedule_with_h_m_s_ms_suffixes", () => { ... })`
     - Assert:
       - `{ kind: "every", everyMs: 3_600_000 }` -> `"Every 1h"`
       - `{ kind: "every", everyMs: 60_000 }` -> `"Every 1m"`
       - `{ kind: "every", everyMs: 1_000 }` -> `"Every 1s"`
       - `{ kind: "every", everyMs: 1_500 }` -> `"Every 1500ms"`
   - `it("formats_cron_schedule_with_optional_tz", () => { ... })`
     - Assert:
       - `{ kind: "cron", expr: "0 0 * * *" }` -> `"Cron: 0 0 * * *"`
       - `{ kind: "cron", expr: "0 0 * * *", tz: "UTC" }` -> `"Cron: 0 0 * * * (UTC)"`
   - `it("formats_at_schedule_as_raw_when_not_parseable", () => { ... })`
     - Assert:
       - `{ kind: "at", at: "not-a-date" }` -> `"At: not-a-date"`
     - Note: do not assert the `toLocaleString()` branch because it is locale/timezone dependent in CI.
   - `it("formats_cron_payload_text", () => { ... })`
     - Assert:
       - `{ kind: "systemEvent", text: "hello" }` -> `"hello"`
       - `{ kind: "agentTurn", message: "hi" }` -> `"hi"`
   - `it("formats_cron_job_display_as_three_lines", () => { ... })`
     - Build a minimal `CronJobSummary` with an `every` schedule and an `agentTurn` payload and assert the returned string is:
       - `"Job name\\nEvery 1m\\nhi"`

Verification for Milestone 1:

1. Run from repo root:

   - `npm run test -- tests/unit/cronSelectors.test.ts`

2. Confirm all tests pass.

Commit for Milestone 1:

- `git commit -am "Milestone 1: centralize cron formatting helpers"`

### Milestone 2: Replace Local Cron Formatting Helpers In UI Call Sites

Update UI call sites to use the new shared helpers and remove local helpers.

In `src/features/agents/components/AgentInspectPanels.tsx`:

- Delete the local helper functions:
  - `formatEveryMs`
  - `formatCronSchedule`
  - `formatCronPayload`
- Update imports from `@/lib/cron/types` to include:
  - `formatCronSchedule`
  - `formatCronPayload`
- Keep runtime behavior the same (the rendered strings should match the current UI).

In `src/app/page.tsx`:

- Delete the local helper functions:
  - `formatEveryMs`
  - `formatCronSchedule`
  - `buildCronDisplay`
- Update the existing import from `@/lib/cron/types` to include:
  - `formatCronJobDisplay`
- Replace:
  - `const content = job ? buildCronDisplay(job) : "";`
  with:
  - `const content = job ? formatCronJobDisplay(job) : "";`

Verification for Milestone 2:

1. Run from repo root:

   - `rg -n \"const formatCronSchedule|const formatCronPayload|const formatEveryMs|const buildCronDisplay\" src/app/page.tsx src/features/agents/components/AgentInspectPanels.tsx`
     - Expect no matches (the helpers should be gone from these files).

2. Run:

   - `npm run lint`
   - `npm run test`
   - `npm run typecheck`
   - `npm run build`

Commit for Milestone 2:

- `git commit -am "Milestone 2: reuse shared cron formatting helpers"`

## Concrete Steps

From the repo root (`/Users/georgepickett/openclaw-studio`):

1. Implement Milestone 1 edits.
2. `npm run test -- tests/unit/cronSelectors.test.ts`
3. `git commit -am "Milestone 1: centralize cron formatting helpers"`
4. Implement Milestone 2 edits.
5. `rg -n \"const formatCronSchedule|const formatCronPayload|const formatEveryMs|const buildCronDisplay\" src/app/page.tsx src/features/agents/components/AgentInspectPanels.tsx`
6. `npm run lint`
7. `npm run test`
8. `npm run typecheck`
9. `npm run build`
10. `git commit -am "Milestone 2: reuse shared cron formatting helpers"`

## Validation and Acceptance

This work is accepted when:

1. Cron schedule/payload formatting is centralized in `src/lib/cron/types.ts` with unit coverage.
2. `src/app/page.tsx` and `src/features/agents/components/AgentInspectPanels.tsx` no longer define their own cron formatting helper functions.
3. `npm run lint`, `npm run test`, `npm run typecheck`, and `npm run build` all pass.

## Idempotence and Recovery

This change is safe to retry.

If anything breaks unexpectedly:

- Revert the commits and re-run `npm run test` to confirm recovery.
- If the failures are UI-string expectation failures, adjust only the new formatting helper outputs to match the prior strings rather than reintroducing duplicated per-call-site formatting.

## Artifacts and Notes

- Evidence of duplication (before this plan):
  - `src/app/page.tsx` defines `formatEveryMs`, `formatCronSchedule`, and `buildCronDisplay`.
  - `src/features/agents/components/AgentInspectPanels.tsx` defines `formatEveryMs`, `formatCronSchedule`, and `formatCronPayload`.

## Interfaces and Dependencies

No new dependencies are required.

The new exports must exist in `src/lib/cron/types.ts` with these signatures:

  - `export const formatCronSchedule: (schedule: CronSchedule) => string`
  - `export const formatCronPayload: (payload: CronPayload) => string`
  - `export const formatCronJobDisplay: (job: CronJobSummary) => string`
