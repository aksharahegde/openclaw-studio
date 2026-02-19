# Make SSH Target Resolution Explicit (Option 3)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan rules live at `.agent/PLANS.md` from the repo root. This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

After this change, “which SSH target do we run remote commands on?” will be derived explicitly by API routes and passed into SSH runners, instead of being implicitly pulled from the Studio settings file deep inside `src/lib/ssh/gateway-host.ts`.

This matters because today the task control plane and agent-state routes have a hidden filesystem dependency: `resolveGatewaySshTarget()` reads `openclaw-studio/settings.json` via `loadStudioSettings()` if env vars are not set. That makes behavior surprising, harder to test, and makes multi-gateway / per-request scenarios harder to implement.

You can see it working by running unit tests that verify SSH target resolution from env and from a passed `gatewayUrl`, and by confirming that the task control plane SSH mode and agent-state SSH mode still invoke `ssh ubuntu@<gateway-host>` when Studio settings contain `ws://<gateway-host>:18789`.

## Progress

- [x] (2026-02-08) Milestone 1: Introduce a pure SSH target resolver that takes `gatewayUrl` and `env`, with unit tests.
- [x] (2026-02-08) Milestone 2: Update `/api/task-control-plane` and Beads runner to resolve `gatewayUrl` at the route boundary and pass it into the runner (no settings reads in the runner path).
- [x] (2026-02-08) Milestone 3: Update `/api/gateway/agent-state` to resolve `gatewayUrl` at the route boundary (no settings reads in the SSH helper path).
- [x] (2026-02-08) Milestone 4: Run `npm test`, `npm run lint`, `npm run typecheck`, then do a manual smoke test against a real remote gateway (EC2) when convenient.

## Surprises & Discoveries

- (Fill in during implementation.) Capture any mismatches between expected gateway URL formats and what Studio settings actually store (for example `ws://` vs `wss://`, hostnames vs IPs).

## Decision Log

- Decision: Keep `runSshJson` unchanged (it only executes ssh and parses JSON) and refactor only the ssh-target selection logic.
  Rationale: This minimizes blast radius and keeps the SSH execution boundary stable and well-tested.
  Date/Author: 2026-02-08 / Codex

- Decision: Preserve the existing env override behavior (`OPENCLAW_TASK_CONTROL_PLANE_SSH_TARGET`, `OPENCLAW_TASK_CONTROL_PLANE_SSH_USER`) and the default user fallback of `ubuntu`.
  Rationale: This matches current behavior and avoids breaking remote setups.
  Date/Author: 2026-02-08 / Codex

## Outcomes & Retrospective

- Studio settings reads for SSH target resolution now happen only at API route boundaries (task control plane + agent-state), not inside SSH helpers or runners.
- Added pure SSH target resolvers and unit tests to cover env override, URL parsing, and missing/invalid configuration cases.
- Manual smoke test against a real EC2 gateway is still pending, but all unit tests + lint + typecheck pass.

## Context and Orientation

OpenClaw Studio has server-side API routes that sometimes run commands on the gateway host over SSH:

1. Task control plane (`src/app/api/task-control-plane/route.ts`) can run `br ... --json` locally, or over SSH when `OPENCLAW_TASK_CONTROL_PLANE_GATEWAY_BEADS_DIR` is set. The local/remote selection and runner live in `src/lib/task-control-plane/br-runner.ts`.
2. Agent-state trash/restore (`src/app/api/gateway/agent-state/route.ts`) runs an embedded Bash script over SSH to move `~/.openclaw/workspace-<agentId>` and `~/.openclaw/agents/<agentId>` into a trash folder, and optionally restore on rollback.

Both routes currently call `resolveGatewaySshTarget()` from `src/lib/ssh/gateway-host.ts`. That function:

- Uses env var overrides first.
- Otherwise reads Studio settings from disk via `loadStudioSettings()` to get `settings.gateway.url`, parses it as a URL, and derives `ubuntu@<hostname>`.

This plan’s goal is to make settings reads explicit at the API route boundary. That means:

- The SSH target resolver becomes pure and takes `gatewayUrl` as an argument (plus env for overrides).
- API routes decide what `gatewayUrl` to use (by reading Studio settings once, at the route boundary) and pass it to the runner/resolver.
- The Beads runner and SSH helper path stop reading Studio settings implicitly.

We are making changes to OpenClaw Studio only (this repo). Do not change `/Users/georgepickett/openclaw`.

## Plan of Work

We will refactor SSH target resolution into two layers:

1. A pure resolver that takes `(gatewayUrl, env)` and returns the SSH target string or throws a clear error.
2. API routes (`/api/task-control-plane`, `/api/gateway/agent-state`) that load Studio settings and pass `gatewayUrl` into the pure resolver (unless `OPENCLAW_TASK_CONTROL_PLANE_SSH_TARGET` already provides a full target).

Then we will update the Beads runner factory (`createTaskControlPlaneBrRunner`) to accept the resolved `sshTarget` explicitly when running via SSH.

Finally we will update/extend unit tests to ensure behavior remains identical.

## Concrete Steps

All commands below are run from the repo root:

    cd /Users/georgepickett/.codex/worktrees/5e63/openclaw-studio

### Milestone 1: Pure SSH target resolver + unit tests

1. Update `src/lib/ssh/gateway-host.ts` to add new exports that do not read Studio settings:

   - A helper that resolves env overrides only:

         export const resolveConfiguredSshTarget = (env: NodeJS.ProcessEnv = process.env): string | null => ...

     It should implement the existing env behavior:
     - If `OPENCLAW_TASK_CONTROL_PLANE_SSH_TARGET` is set and contains `@`, return it as-is.
     - If it is set without `@` and `OPENCLAW_TASK_CONTROL_PLANE_SSH_USER` is set, return `<user>@<target>`.
     - If it is set without `@` and user is missing, return `<target>`.
     - If no target is configured, return `null`.

   - A pure resolver that derives the SSH target from a passed `gatewayUrl` (and env for default user / overrides):

         export const resolveGatewaySshTargetFromGatewayUrl = (
           gatewayUrl: string,
           env: NodeJS.ProcessEnv = process.env
         ): string => ...

     Behavior:
     - If `resolveConfiguredSshTarget(env)` returns non-null, return it.
     - Otherwise, parse `gatewayUrl` with `new URL(gatewayUrl)` and extract `.hostname`.
     - If `gatewayUrl` is blank/missing, throw:
       `Gateway URL is missing. Set it in Studio settings or set OPENCLAW_TASK_CONTROL_PLANE_SSH_TARGET.`
     - If parsing fails or hostname is empty, throw:
       `Invalid gateway URL: <gatewayUrl>`
     - Determine SSH user as `OPENCLAW_TASK_CONTROL_PLANE_SSH_USER` or default `"ubuntu"`.
     - Return `<user>@<hostname>`.

   - Keep the existing `resolveGatewaySshTarget()` export for now, but re-implement it as a thin wrapper:
     - Load Studio settings.
     - Call `resolveGatewaySshTargetFromGatewayUrl(settings.gateway?.url ?? "", env)`.
     This preserves backward compatibility, but new call sites in this plan should not call this wrapper.

2. Add a new unit test file `tests/unit/gatewaySshTarget.test.ts` that tests `resolveConfiguredSshTarget` and `resolveGatewaySshTargetFromGatewayUrl` directly without writing any settings files:

   - `uses_configured_target_with_at_sign`
   - `combines_user_and_target_when_target_missing_at_sign`
   - `derives_target_from_gateway_url_with_default_user_ubuntu`
   - `throws_on_missing_gateway_url_when_no_env_override`
   - `throws_on_invalid_gateway_url`

3. Run:

    npm test

4. Commit Milestone 1:

    Milestone 1: add pure ssh target resolver + tests

### Milestone 2: Task control plane resolves gatewayUrl at the route boundary

1. Update `src/lib/task-control-plane/br-runner.ts`:

   - Remove any use of `resolveGatewaySshTarget()` (the settings-reading wrapper).
   - Change `createTaskControlPlaneBrRunner` to accept an optional parameter:

         export const createTaskControlPlaneBrRunner = (opts?: { sshTarget?: string | null }): ...

     Behavior:
     - If `OPENCLAW_TASK_CONTROL_PLANE_GATEWAY_BEADS_DIR` is set, the runner must run via SSH.
     - In that case, require `opts?.sshTarget` to be a non-empty string; if missing, throw a clear error explaining the route must supply it (or that env must set `OPENCLAW_TASK_CONTROL_PLANE_SSH_TARGET`).
     - Keep local mode behavior unchanged.

2. Update `src/app/api/task-control-plane/route.ts` to make SSH target resolution explicit:

   - If `OPENCLAW_TASK_CONTROL_PLANE_GATEWAY_BEADS_DIR` is set:
     - Load Studio settings once at the route boundary via `loadStudioSettings()` from `src/lib/studio/settings-store.ts`.
     - Compute `sshTarget` via `resolveGatewaySshTargetFromGatewayUrl(settings.gateway?.url ?? "", process.env)`.
     - Call `createTaskControlPlaneBrRunner({ sshTarget })`.
   - Otherwise (local mode), call `createTaskControlPlaneBrRunner()` without an ssh target.

3. Update `tests/unit/taskControlPlaneRoute.test.ts` if needed:

   - The existing SSH test already writes Studio settings and expects `ssh ubuntu@example.test ...`.
   - Ensure it still passes after the refactor (it should, as the route still reads settings in SSH mode).
   - Add one new test to ensure the route returns a 502 (or 400 if you choose) with an actionable error if SSH mode is configured but there is no gateway URL and no `OPENCLAW_TASK_CONTROL_PLANE_SSH_TARGET`.

4. Run:

    npm test

5. Commit Milestone 2:

    Milestone 2: make task control plane ssh target explicit

### Milestone 3: Agent-state route resolves gatewayUrl at the route boundary

1. Update `src/app/api/gateway/agent-state/route.ts`:

   - Replace calls to `resolveGatewaySshTarget()` with explicit resolution at the route boundary:
     - Load Studio settings via `loadStudioSettings()` from `src/lib/studio/settings-store.ts`.
     - Compute `sshTarget` via `resolveGatewaySshTargetFromGatewayUrl(settings.gateway?.url ?? "", process.env)`.
     - Pass that sshTarget into `runSshJson`.

   This keeps env override behavior identical (because the resolver checks env first), but removes the hidden settings read from the helper path.

2. Update `tests/unit/agentStateRoute.test.ts` if needed:

   - The existing tests write Studio settings and assert `ubuntu@example.test` is used.
   - Ensure they still pass.
   - Add one test case that proves the env override is used even if settings are missing (set `OPENCLAW_TASK_CONTROL_PLANE_SSH_TARGET=me@host` and omit settings; expect ssh called with `me@host`).

3. Run:

    npm test

4. Commit Milestone 3:

    Milestone 3: make agent-state ssh target explicit

### Milestone 4: Full verification + manual smoke test

1. Run:

    npm run lint
    npm run typecheck
    npm test

2. Manual smoke test (remote gateway):
   - Start Studio:

         npm run dev

   - Configure Studio to connect to a remote gateway (EC2) and ensure SSH is non-interactive.
   - Visit http://localhost:3000/control-plane and confirm it loads in SSH mode when `OPENCLAW_TASK_CONTROL_PLANE_GATEWAY_BEADS_DIR` is set.
   - Delete a disposable agent and confirm the `/api/gateway/agent-state` trash path still runs on the correct SSH host (the gateway host) and behaves as before.

3. Record outcomes in `Outcomes & Retrospective`.

## Validation and Acceptance

Acceptance is met when:

1. There is a pure SSH target resolver in `src/lib/ssh/gateway-host.ts` that can be tested without writing settings files.
2. In the task control plane SSH path, `src/lib/task-control-plane/br-runner.ts` no longer calls a settings-reading function to find the SSH target; the API route passes the ssh target explicitly.
3. In the agent-state SSH path, `src/app/api/gateway/agent-state/route.ts` no longer calls a settings-reading function to find the SSH target; it resolves it explicitly at the route boundary.
4. `npm test`, `npm run lint`, and `npm run typecheck` pass.

## Idempotence and Recovery

This change should be safe to apply incrementally. Each milestone is test-driven and should be committed after tests pass. If a refactor breaks SSH mode, revert to the last passing commit and adjust resolver behavior to match the previous env/settings precedence.

## Artifacts and Notes

Relevant files:

- SSH helpers: `src/lib/ssh/gateway-host.ts`
- Beads runner: `src/lib/task-control-plane/br-runner.ts`
- Task control plane API route: `src/app/api/task-control-plane/route.ts`
- Agent-state API route: `src/app/api/gateway/agent-state/route.ts`
- Existing tests:
  - `tests/unit/taskControlPlaneRoute.test.ts`
  - `tests/unit/agentStateRoute.test.ts`

## Interfaces and Dependencies

At the end of Milestone 1, `src/lib/ssh/gateway-host.ts` must export:

    export const resolveConfiguredSshTarget: (env?: NodeJS.ProcessEnv) => string | null;
    export const resolveGatewaySshTargetFromGatewayUrl: (gatewayUrl: string, env?: NodeJS.ProcessEnv) => string;

Plan revision note (required for living plans):

- (2026-02-08) Initial ExecPlan created for Option 3 (make SSH target resolution explicit and remove hidden Studio settings reads from infrastructure helpers).
