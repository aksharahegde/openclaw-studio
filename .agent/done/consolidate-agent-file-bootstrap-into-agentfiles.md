# Consolidate Gateway Agent File Bootstrap Into agentFiles Module

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `.agent/PLANS.md` and must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, all gateway-backed “agent file” operations will live in one module: `src/lib/gateway/agentFiles.ts`. Today, basic read/write lives in `src/lib/gateway/agentFiles.ts`, but the bootstrap behavior used after creating a new agent lives in a separate file, `src/lib/gateway/agentFilesBootstrap.ts`.

This refactor keeps behavior the same (new agent brain files can still be bootstrapped from an existing template agent) while reducing surface area: one fewer file and one fewer import path for gateway agent-file operations.

The easiest way to see this working is that `npm run test -- tests/unit/agentFilesBootstrap.test.ts` continues to pass, and `src/app/page.tsx` still bootstraps new agents successfully (validated by typecheck + tests).

## Progress

- [x] (2026-02-08 18:36Z) Baseline: run `npm run test -- tests/unit/agentFilesBootstrap.test.ts` to confirm current behavior. [no-beads]
- [x] (2026-02-08 18:37Z) Milestone 1: Move `bootstrapAgentBrainFilesFromTemplate` and its related types/helpers into `src/lib/gateway/agentFiles.ts`, update imports, and delete `src/lib/gateway/agentFilesBootstrap.ts`. [no-beads]
- [x] (2026-02-08 18:37Z) Milestone 2: Run `typecheck`, unit tests, and `lint`, then commit. [no-beads]

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Merge bootstrap into `src/lib/gateway/agentFiles.ts` instead of inlining the bootstrap logic into `src/app/page.tsx`.
  Rationale: The bootstrap behavior is a gateway agent-file operation (same boundary as read/write), it is already unit tested, and it is used by the create-agent flow. Keeping it as a shared helper preserves reuse and testability while still deleting a file.
  Date/Author: 2026-02-08 / Codex

## Outcomes & Retrospective

Completed.

- Consolidated `bootstrapAgentBrainFilesFromTemplate` into `src/lib/gateway/agentFiles.ts` so gateway agent-file operations are in one module.
- Deleted `src/lib/gateway/agentFilesBootstrap.ts` and updated imports.
- Verified `npm run typecheck`, `npm run test`, and `npm run lint` pass.

## Context and Orientation

Gateway agent files (for example `AGENTS.md`, `MEMORY.md`) are edited via gateway WebSocket methods `agents.files.get` and `agents.files.set`, wrapped by `readGatewayAgentFile` and `writeGatewayAgentFile` in `src/lib/gateway/agentFiles.ts`.

When a new agent is created, `src/app/page.tsx` waits for the gateway to restart and then bootstraps the new agent’s brain files by copying missing/empty files from a template agent. That logic currently lives in `src/lib/gateway/agentFilesBootstrap.ts` as `bootstrapAgentBrainFilesFromTemplate`.

The current split means anyone working on “agent file” behavior needs to remember two modules:

- `src/lib/gateway/agentFiles.ts` for basic read/write
- `src/lib/gateway/agentFilesBootstrap.ts` for the create-agent bootstrap flow

This plan consolidates them.

## Plan of Work

First, confirm the existing bootstrap unit tests pass as a baseline.

Then move the entire bootstrap implementation into `src/lib/gateway/agentFiles.ts`. This includes the exported type `BootstrapAgentBrainFilesResult`, the exported function `bootstrapAgentBrainFilesFromTemplate`, and its internal helper `resolveTemplateAgentId` along with any local response types it needs.

After the move, update import sites to use `src/lib/gateway/agentFiles.ts` instead of `src/lib/gateway/agentFilesBootstrap.ts`, then delete `src/lib/gateway/agentFilesBootstrap.ts`.

Finally, run repo gates (typecheck, unit tests, lint) and commit.

## Concrete Steps

Run from repo root:

    cd /Users/georgepickett/openclaw-studio

Baseline:

    npm run test -- tests/unit/agentFilesBootstrap.test.ts

Milestone 1 (implementation):

1. Edit `src/lib/gateway/agentFiles.ts` and add the bootstrap exports:
   - `export type BootstrapAgentBrainFilesResult = { templateAgentId: string; updated: AgentFileName[]; skipped: AgentFileName[] }`
   - `export const bootstrapAgentBrainFilesFromTemplate = async (...) => ...`
   - Keep the current `readGatewayAgentFile` / `writeGatewayAgentFile` behavior unchanged.
   - Import `AGENT_FILE_NAMES` from `src/lib/agents/agentFiles.ts` (it is already used by the bootstrap code).
2. Update call sites:
   - `src/app/page.tsx`: change the import of `bootstrapAgentBrainFilesFromTemplate` to come from `@/lib/gateway/agentFiles`.
   - `tests/unit/agentFilesBootstrap.test.ts`: change the import of `bootstrapAgentBrainFilesFromTemplate` to come from `@/lib/gateway/agentFiles`.
3. Delete `src/lib/gateway/agentFilesBootstrap.ts`.
4. Confirm there are no remaining references:

    rg -n \"agentFilesBootstrap\" src tests

Milestone 2 (verification + commit):

    npm run typecheck
    npm run test
    npm run lint

Commit:

    git status --porcelain=v1
    git add -A
    git commit -m \"Refactor: consolidate agent file bootstrap into agentFiles\"

## Validation and Acceptance

Acceptance criteria:

1. `tests/unit/agentFilesBootstrap.test.ts` passes without changes to its assertions (only import path changes).
2. `src/app/page.tsx` still imports `bootstrapAgentBrainFilesFromTemplate` and typechecks.
3. `src/lib/gateway/agentFilesBootstrap.ts` no longer exists, and `rg -n "agentFilesBootstrap" src tests` returns no matches.
4. `npm run typecheck`, `npm run test`, and `npm run lint` all pass.
