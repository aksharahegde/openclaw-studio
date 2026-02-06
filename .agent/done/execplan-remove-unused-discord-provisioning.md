# Remove Dead Discord Provisioning Integration

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan format requirements live at `.agent/PLANS.md` from the repository root. This document must be maintained in accordance with that file.

## Purpose / Big Picture

OpenClaw Studio currently carries an unused “Discord provisioning” integration in `src/lib/discord/discordChannel.ts` plus a single-use local config loader in `src/lib/clawdbot/config.ts`. There is no App Router API route under `src/app/api` that exposes this behavior, and there are no UI call sites. The code exists as dead surface area and the docs (`README.md`, `ARCHITECTURE.md`) currently claim the feature exists.

After this refactor, the unused Discord provisioning implementation will be removed, along with its single-use local-config helper and any now-unused path helpers. Documentation will be updated to match reality. There should be no user-visible behavior change because the feature is not reachable today.

You can see this working by running the repo gates and verifying that the Studio still builds and the unit tests still pass.

## Progress

- [x] (2026-02-06 17:25Z) Remove the unused Discord provisioning implementation and its single-use config helper; update docs to stop claiming the feature exists.
- [x] (2026-02-06 17:26Z) Run repo gates (`lint`, `test`, `typecheck`, `build`) and commit as one atomic refactor.

## Surprises & Discoveries

- Observation: `ARCHITECTURE.md` and `README.md` claim Studio “provisions Discord channels”, but there is no API route under `src/app/api` that exposes this, and `createDiscordChannelForAgent` is not referenced anywhere outside `src/lib/discord/discordChannel.ts`.
  Evidence: `rg -n "createDiscordChannelForAgent" src` only matches `src/lib/discord/discordChannel.ts`.
- Observation: Typecheck initially failed after deleting `src/lib/discord/discordChannel.ts` because a CLI script still imported it.
  Evidence: `npm run typecheck` failed with `scripts/create-discord-channel.ts` missing module errors; deleting `scripts/create-discord-channel.ts` fixed typecheck.

## Decision Log

- Decision: Delete the unused Discord provisioning module and related single-use local config module, and update docs accordingly.
  Rationale: These modules add cognitive load and drift risk while providing no reachable behavior in the current app (no route, no UI call sites). Removing them reduces surface area and makes documentation accurate.
  Date/Author: 2026-02-06 / Codex

## Outcomes & Retrospective

- Deleted dead Discord provisioning code (`src/lib/discord/discordChannel.ts`) and its unused local-config helper (`src/lib/clawdbot/config.ts`).
- Deleted a dead CLI script (`scripts/create-discord-channel.ts`) and the associated unit test file (`tests/unit/clawdbotConfig.test.ts`).
- Removed the unused `resolveClawdbotEnvPath` export from `src/lib/clawdbot/paths.ts`.
- Updated `README.md` and `ARCHITECTURE.md` so they no longer claim Discord provisioning is a supported Studio feature.
- Repo gates were run successfully: `lint`, `test`, `typecheck`, `build`.

## Context and Orientation

The current relevant files are:

- `src/lib/discord/discordChannel.ts`: implements `createDiscordChannelForAgent` and reads `DISCORD_BOT_TOKEN` from a resolved state-dir `.env`.
- `src/lib/clawdbot/config.ts`: loads/saves the local `openclaw.json` config and reads/writes the `agents.list` portion via shared helpers.
- `src/lib/clawdbot/paths.ts`: contains state/config path resolution, plus `resolveClawdbotEnvPath` which is only used by the Discord module.
- `tests/unit/clawdbotConfig.test.ts`: only exists to test `src/lib/clawdbot/config.ts`.
- `README.md` and `ARCHITECTURE.md`: currently describe Discord provisioning as a supported feature.

There are only three API routes under `src/app/api` (`/api/studio`, `/api/task-control-plane`, `/api/path-suggestions`). None are Discord-related.

## Plan of Work

First, remove the dead code:

1. Delete `src/lib/discord/discordChannel.ts`.
2. Delete `src/lib/clawdbot/config.ts`.
3. Delete `tests/unit/clawdbotConfig.test.ts`.
4. Remove `resolveClawdbotEnvPath` from `src/lib/clawdbot/paths.ts` (it is only referenced by the deleted Discord module).

Second, update documentation to remove or reword Discord-related claims so the docs match the product:

1. In `README.md`, remove the “Provisions Discord channels when you need them” bullet (keep the community Discord link/badge).
2. In `ARCHITECTURE.md`, remove the Discord bounded-context bullet and remove Discord from the data flow section and Mermaid diagrams. Also reword any `src/lib/clawdbot/config.ts` references, since the module will be deleted.

Finally, run the repo gates and commit the entire change as one atomic refactor.

## Concrete Steps

All commands below assume the working directory is the repo root: `/Users/georgepickett/.codex/worktrees/f6e9/openclaw-studio`.

### Milestone 1: Remove Dead Discord Integration + Sync Docs

1. Implementation:

   - Delete `src/lib/discord/discordChannel.ts`.
   - Delete `src/lib/clawdbot/config.ts`.
   - Delete `tests/unit/clawdbotConfig.test.ts`.
   - Update `src/lib/clawdbot/paths.ts`:
     - Remove the `resolveClawdbotEnvPath` export entirely.
   - Update `README.md`:
     - Remove the “Provisions Discord channels when you need them” bullet.
   - Update `ARCHITECTURE.md`:
     - Remove the “Discord integration” module entry.
     - Remove Discord from the data flow section.
     - Remove Discord from the Mermaid diagrams.
     - Update any references to `src/lib/clawdbot/config.ts` so they no longer claim local config access is a module boundary.

2. Verification:

     rg -n "discordChannel|createDiscordChannelForAgent|DISCORD_BOT_TOKEN" -S src tests

   Expect no matches under `src/` or `tests/` after deletions (docs may still mention “Discord” as community, which is fine).

   Then run:

     npm run test
     npm run typecheck

   Confirm both pass.

### Milestone 2: Gates and Commit

1. Run the full gates:

     npm run lint
     npm run test
     npm run typecheck
     npm run build

2. Commit:

   Commit everything as one atomic commit with a message like:

     refactor: remove unused discord provisioning

3. Move the completed ExecPlan:

   Copy `.agent/execplan-pending.md` to `.agent/done/execplan-remove-unused-discord-provisioning.md` and then delete `.agent/execplan-pending.md`.

## Validation and Acceptance

Acceptance criteria:

- `src/lib/discord/discordChannel.ts` and `src/lib/clawdbot/config.ts` are deleted and have no remaining references in the repo.
- `src/lib/clawdbot/paths.ts` no longer exports `resolveClawdbotEnvPath`.
- `README.md` and `ARCHITECTURE.md` no longer claim Studio provisions Discord channels as a feature.
- `npm run lint`, `npm run test`, `npm run typecheck`, and `npm run build` all succeed.

## Idempotence and Recovery

This refactor is safe to repeat because it only removes unused code and updates documentation. If the removal turns out to break a real, out-of-tree consumer, rollback is to restore the deleted files from git history and revert the doc changes, then re-run the repo gates.

## Artifacts and Notes

- None yet.

## Interfaces and Dependencies

- No new runtime dependencies are introduced.
- Existing state/config path resolution remains in `src/lib/clawdbot/paths.ts` and is still used by `/api/studio` and other local-only helpers.
