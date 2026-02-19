# Inline Tracing Registration and Delete `src/lib/tracing.ts`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan requirements live at `.agent/PLANS.md` and this document must be maintained in accordance with it.

## Purpose / Big Picture

Tracing initialization currently spans two tiny modules:

- `src/instrumentation.ts` (Next.js entrypoint) calls `registerTracing()`.
- `src/lib/tracing.ts` wraps `@vercel/otel` and defines `registerTracing()`.

The wrapper module is only imported from one place and does not provide a stable abstraction (it is a one-liner). After this change, tracing registration is defined directly in `src/instrumentation.ts`, and the thin wrapper file `src/lib/tracing.ts` is deleted.

You can see this working by running typecheck/lint/unit tests; `src/instrumentation.ts` should still register OTel with the same service name (`openclaw-studio`) and nothing else should import `@/lib/tracing`.

## Scope and Constraints (Assumptions)

- Repo is production-cautious (it has lint/typecheck/unit tests).
- The only purpose of `src/lib/tracing.ts` is to initialize `@vercel/otel` for this app.
- Next.js will continue to invoke `src/instrumentation.ts` via its conventional `register` export.

## Mental Model (Evidence-Based)

Core concepts and locations:

- Next.js tracing entrypoint: `src/instrumentation.ts`
- OpenTelemetry registration helper (to remove): `src/lib/tracing.ts`

Dependency graph highlights:

- `src/instrumentation.ts` imports `registerTracing` from `@/lib/tracing`.
- `src/lib/tracing.ts` is not imported anywhere else (single caller).

Smell:

- Thin wrapper module: `src/lib/tracing.ts` adds a file-level concept for a one-liner and is not reused.

## Candidate Refactors Ranked

Scores: 1 (low) to 5 (high). For Blast radius, higher means smaller/safer.

| Candidate | Payoff (30%) | Blast Radius (25%) | Cognitive Load (20%) | Velocity Unlock (15%) | Validation / Rollback (10%) | Weighted |
|---|---:|---:|---:|---:|---:|---:|
| Inline tracing registration in `src/instrumentation.ts`, delete `src/lib/tracing.ts` | 3 | 5 | 3 | 1 | 5 | 3.40 |
| Delete `src/features/agents/state/agentSessionActions.ts` by moving its helper into `store.tsx` | 3 | 4 | 3 | 2 | 5 | 3.30 |

## Proposed Change (The Call)

Inline `registerTracing` into `src/instrumentation.ts` and delete `src/lib/tracing.ts`.

### Current State

- `src/instrumentation.ts`:
  - Imports `registerTracing` from `@/lib/tracing`
  - Exports `register()` which calls `registerTracing()`
- `src/lib/tracing.ts`:
  - Imports `registerOTel` from `@vercel/otel`
  - Exports `registerTracing()` which calls `registerOTel({ serviceName: "openclaw-studio" })`

### Proposed State

- `src/instrumentation.ts` imports `registerOTel` directly from `@vercel/otel` and calls it with the same service name.
- `src/lib/tracing.ts` is deleted.

### Files Impacted

- `src/instrumentation.ts`
- `src/lib/tracing.ts` (delete)

### Acceptance Criteria

1. `src/lib/tracing.ts` does not exist.
2. `rg -n "@/lib/tracing" src tests` returns no results.
3. `npm run typecheck`, `npm run lint`, and `npm test` all pass.
4. `src/instrumentation.ts` still registers OTel with `serviceName: "openclaw-studio"`.

### Risks and Mitigations

- Risk: instrumentation no longer registers tracing due to import/path mistakes.
  Mitigation: keep the `register()` export shape unchanged; validate with `npm run typecheck` + `npm run lint`.

## Progress

- [x] (2026-02-06 04:26Z) Milestone 1: Inlined `registerOTel({ serviceName: "openclaw-studio" })` into `src/instrumentation.ts` and verified `npm run typecheck` passes.
- [x] (2026-02-06 04:26Z) Milestone 2: Deleted `src/lib/tracing.ts`, verified no remaining `@/lib/tracing` imports, and verified `npm run lint` and `npm test` pass.

## Surprises & Discoveries

- No surprises.

## Decision Log

- Decision: Inline tracing registration into `src/instrumentation.ts` and delete `src/lib/tracing.ts`.
  Rationale: The wrapper is a single-use, one-liner abstraction; deleting it removes a file-level concept with minimal risk.
  Date/Author: 2026-02-06 / Codex

## Outcomes & Retrospective

- Tracing registration is now defined directly in `src/instrumentation.ts`; the single-use wrapper module `src/lib/tracing.ts` is removed.

## Plan of Work

### Milestone 1: Inline Tracing Registration

1. Edit `src/instrumentation.ts`:
   - Replace the import of `registerTracing` from `@/lib/tracing` with `import { registerOTel } from "@vercel/otel";`
   - Update `register()` to call `registerOTel({ serviceName: "openclaw-studio" });`

2. Run:
   - `npm run typecheck`

### Milestone 2: Delete Wrapper + Validate

1. Delete `src/lib/tracing.ts`.

2. Ensure no references remain:
   - `rg -n "@/lib/tracing" src tests` (expect no hits)

3. Run:
   - `npm run lint`
   - `npm test`

## Concrete Steps

From repo root:

1. `rg -n "@/lib/tracing" src tests`
2. Implement Milestone 1 edits.
3. `npm run typecheck`
4. Implement Milestone 2 edits.
5. `rg -n "@/lib/tracing" src tests`
6. `npm run lint`
7. `npm test`

## Validation and Acceptance

This work is accepted when:

- The wrapper file is gone and there are no imports of it.
- Typecheck, lint, and unit tests pass.
- The tracing registration uses the same `serviceName` as before.

## Idempotence and Recovery

This change is safe to retry.

Rollback plan:

- Restore `src/lib/tracing.ts` and revert `src/instrumentation.ts` to import and call `registerTracing()` again.
- Re-run `npm test` to confirm the rollback compiles and tests pass.
