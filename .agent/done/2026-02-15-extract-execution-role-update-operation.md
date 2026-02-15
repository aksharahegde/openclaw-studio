# Extract Execution Role Update Flow From `src/app/page.tsx`

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository’s ExecPlan format is defined in `.agent/PLANS.md`, and this document must be maintained in accordance with it.

## Purpose / Big Picture

Today, changing an agent’s “Execution role” from the settings sidebar is implemented inline inside the main page component (`src/app/page.tsx`). That single flow mixes domain decisions (how each role maps to exec approvals policy, session exec settings, and tool allow/deny rules) with infrastructure side effects (gateway reads/writes and page-level `loadAgents()` refresh) inside one long `enqueueConfigMutation` callback.

After this refactor, the execution-role update flow will live in a dedicated operation module with a small, explicit interface and unit tests for the role-mapping and tool-override derivation. `src/app/page.tsx` will become wiring: it will enqueue the mutation and call the operation. There must be no user-visible behavior change.

## Progress

- [x] Create an execution-role update operation module with pure, unit-testable derivation helpers.
- [x] Rewire `src/app/page.tsx` to call the new operation and delete the inlined flow.
- [x] Add unit tests covering role-to-policy mapping and tool allow/deny patch derivation (including `allow` vs `alsoAllow` semantics).
- [x] Run `npm run typecheck` and `npm test`.

## Surprises & Discoveries

- `src/app/page.tsx` had enough local edits since the plan was drafted that a naive patch failed; patching against the exact `handleUpdateExecutionRole` block worked cleanly.

## Decision Log

- Decision: Extract the execution-role update flow out of `src/app/page.tsx` into a dedicated operation module.
  Rationale: This is a cohesive “god flow” chunk that interleaves gateway I/O (`exec.approvals.*`, `config.get`, `config.patch` via `updateGatewayAgentOverrides`, `sessions.patch` via `syncGatewaySessionSettings`) with domain rules (role mapping and tool allowlist semantics). Extracting it makes the domain rules testable without React/page wiring and reduces churn risk in a 2800+ line page component.
  Date/Author: 2026-02-15 / Codex

## Outcomes & Retrospective

- Extracted execution-role update flow into `src/features/agents/operations/executionRoleUpdateOperation.ts`.
- Rewired `src/app/page.tsx` to call `updateExecutionRoleViaStudio(...)` and removed the inline role/policy/tool/session derivation logic.
- Added unit coverage in `tests/unit/executionRoleUpdateOperation.test.ts` for policy mapping, `allow` vs `alsoAllow` semantics, tool allow/deny derivation, and session exec settings.
- Verified `npm run typecheck` and `npm test` pass. (2026-02-15)

## Context and Orientation

“Execution role” is a UI-level setting shown in the agent settings sidebar. The selector lives in `src/features/agents/components/AgentInspectPanels.tsx` and calls a callback prop `onUpdateExecutionRole(role)` when the user clicks “Update”.

The current end-to-end execution-role update flow is implemented in the main page:

- `handleUpdateExecutionRole` in `src/app/page.tsx:2170` through `src/app/page.tsx:2311`.

Key gateway helpers involved (and where they live):

- Exec approvals read/write:
  - `readGatewayAgentExecApprovals` and `upsertGatewayAgentExecApprovals` in `src/lib/gateway/execApprovals.ts`
  - Allowlist entries are shaped like `Array<{ pattern: string }>` (not string arrays).
- Config list parsing and tool overrides write:
  - `readConfigAgentList` and `updateGatewayAgentOverrides` in `src/lib/gateway/agentConfig.ts`
- Session exec settings write:
  - `syncGatewaySessionSettings` in `src/lib/gateway/GatewayClient.ts`

In that block, the flow:

1. Reads the agent’s existing exec approvals policy via `readGatewayAgentExecApprovals`.
2. Builds and writes a new per-agent exec approvals policy via `upsertGatewayAgentExecApprovals`.
3. Reads gateway config via `client.call("config.get", {})`, parses `agents.list`, finds the agent’s config entry, and reads `sandbox.mode` and `tools` allow/deny state.
4. Mutates the agent’s gateway config overrides via `updateGatewayAgentOverrides`, specifically manipulating tool allow/deny lists to add/remove `group:runtime` depending on role.
5. Computes session exec settings (`execHost`, `execSecurity`, `execAsk`) based on role and sandbox mode, and writes them via `syncGatewaySessionSettings`.
6. Reloads agents via `loadAgents()` to reflect the change.

This is the entanglement: the role-mapping and tool-override rules are domain logic, but they are embedded directly inside the infrastructure call stack and React wiring.

## Plan of Work

Extract the flow into a new operation module that has:

1. A single side-effecting entry point that performs the gateway calls in the same order as today.
2. A small set of pure helper functions (in the same file) that compute:
   - The next exec approvals policy for a given role, preserving allowlist.
   - The next tool override patch (`allow` vs `alsoAllow`, plus `deny`) for a given role and existing tools config.
   - The next session exec settings (`execHost`, `execSecurity`, `execAsk`) for a given role and sandbox mode.

Then rewire `src/app/page.tsx` to call the new operation from inside the existing `enqueueConfigMutation` wrapper.

## Concrete Steps

1. Create `src/features/agents/operations/executionRoleUpdateOperation.ts`.

   In this file, implement:

   - Imports (use existing module boundaries; do not duplicate gateway helpers):
     - `import type { GatewayClient } from "@/lib/gateway/GatewayClient";`
     - `import { syncGatewaySessionSettings } from "@/lib/gateway/GatewayClient";`
     - `import { readGatewayAgentExecApprovals, upsertGatewayAgentExecApprovals } from "@/lib/gateway/execApprovals";`
     - `import { readConfigAgentList, updateGatewayAgentOverrides } from "@/lib/gateway/agentConfig";`

   - `export type ExecutionRoleId = "conservative" | "collaborative" | "autonomous";`

   - Pure helpers (export them so tests can import them):

     - `export function resolveExecApprovalsPolicyForRole(params: { role: ExecutionRoleId; allowlist: Array<{ pattern: string }> }): null | { security: "full" | "allowlist"; ask: "off" | "always"; allowlist: Array<{ pattern: string }> }`
       Behavior must match the current `nextPolicy` logic in `src/app/page.tsx:2194` through `src/app/page.tsx:2207`. Note: in this repo, the allowlist is stored as objects shaped like `{ pattern: string }` (see `src/lib/gateway/execApprovals.ts`), not raw strings.

     - `export function resolveRuntimeToolOverridesForRole(params: { role: ExecutionRoleId; existingTools: unknown }): { tools: { allow?: string[]; alsoAllow?: string[]; deny?: string[] } }`
       Behavior must match the current tool override logic in `src/app/page.tsx:2233` through `src/app/page.tsx:2274`, including:
       - If `existingTools.allow` is an array (even empty), treat it as the primary allowlist (`usesAllow = true`) and write back to `allow`.
       - Otherwise, treat `existingTools.alsoAllow` as the primary allowlist (`usesAllow = false`) and write back to `alsoAllow`.
       - Always trim strings and drop empties.
       - Add or remove `group:runtime` based on role.
       - Ensure `deny` does not contain entries that are present in the chosen allow list.

     - `export function resolveSessionExecSettingsForRole(params: { role: ExecutionRoleId; sandboxMode: string }): { execHost: "sandbox" | "gateway" | null; execSecurity: "deny" | "allowlist" | "full"; execAsk: "off" | "always" }`
       Behavior must match `src/app/page.tsx:2276` through `src/app/page.tsx:2296`, including the sandbox host selection when sandbox mode is `"all"`.

   - Side-effecting operation:

     - `export async function updateExecutionRoleViaStudio(params: { client: GatewayClient; agentId: string; sessionKey: string; role: ExecutionRoleId; loadAgents: () => Promise<void> }): Promise<void>`

       It should:
       - Read allowlist: `readGatewayAgentExecApprovals({ client, agentId })`.
       - Compute `nextPolicy` using `resolveExecApprovalsPolicyForRole` and write it with `upsertGatewayAgentExecApprovals`. The allowlist passed through must be `Array<{ pattern: string }>` and must be preserved exactly (it is already normalized by `readGatewayAgentExecApprovals`).
       - Read config: `client.call("config.get", {})`, parse list using the existing `readConfigAgentList` helper, find entry for `agentId`, and extract `sandbox.mode` and `tools` object.
         - Preserve the current page’s normalization behavior exactly:
           - `sandboxMode` must be computed as `typeof sandbox?.mode === "string" ? sandbox.mode.trim().toLowerCase() : ""`.
           - `existingTools` must be treated as `null` unless it is a plain object (`typeof === "object"`, not array).
       - Compute tool overrides with `resolveRuntimeToolOverridesForRole` and apply using `updateGatewayAgentOverrides`.
       - Compute session settings with `resolveSessionExecSettingsForRole` and apply using `syncGatewaySessionSettings`.
       - Call `loadAgents()` at the end.

       Keep error behavior the same as current page flow (exceptions should bubble up to the existing mutation wrapper).

2. Rewire `src/app/page.tsx` and delete the inlined logic.

   In `src/app/page.tsx`, change `handleUpdateExecutionRole` (currently `src/app/page.tsx:2170` through `src/app/page.tsx:2311`) to:

   - Keep the same outer guards (`resolveMutationStartGuard`, agent lookup, and `enqueueConfigMutation` call).
   - Replace the entire `run: async () => { ... }` body with a call to `updateExecutionRoleViaStudio({ client, agentId: resolvedAgentId, sessionKey: agent.sessionKey, role, loadAgents })`.
   - Remove now-unused imports from `src/app/page.tsx`:
     - Always expected: `readGatewayAgentExecApprovals` and `upsertGatewayAgentExecApprovals` (they are only used by this flow today).
     - Possibly expected: `syncGatewaySessionSettings` (currently only used by this flow; confirm with `rg -n "syncGatewaySessionSettings\\b" src/app/page.tsx` after rewiring).
     - Do not remove `readConfigAgentList` or `updateGatewayAgentOverrides` unless you confirm they are unused; they are referenced elsewhere in `src/app/page.tsx` (for example the sandbox-tool repair flow).
   - Keep the `enqueueConfigMutation` label string the same.

   Acceptance check for this step: `src/app/page.tsx` should no longer contain the `coerceStringArray` helper or any manipulation of `group:runtime` in tool lists.

3. Add unit tests in `tests/unit/executionRoleUpdateOperation.test.ts`.

   Write tests that validate the pure derivations without needing to mock gateway calls:

   - `it("maps roles to exec approvals policy while preserving allowlist")`
     - Provide `allowlist = [{ pattern: "a" }, { pattern: "b" }]`.
     - Assert conservative returns `null`.
     - Assert collaborative returns `{ security: "allowlist", ask: "always", allowlist }`.
     - Assert autonomous returns `{ security: "full", ask: "off", allowlist }`.

     - `it("updates tool overrides using allow when existing tools.allow is present")`
       - Input `existingTools = { allow: ["group:web"], deny: ["group:runtime"] }`.
       - For collaborative/autonomous, assert output uses `allow` (not `alsoAllow`), `allow` contains `group:runtime`, and `deny` does not contain `group:runtime`.
       - For conservative, assert `allow` does not contain `group:runtime` and `deny` contains `group:runtime`.

     - `it("updates tool overrides using alsoAllow when tools.allow is absent")`
       - Input `existingTools = { alsoAllow: ["group:web"], deny: [] }`.
       - Assert output writes to `alsoAllow` and applies the same `group:runtime` semantics.

     - `it("resolves session exec settings from role and sandbox mode")`
       - For conservative, expect `{ execHost: null, execSecurity: "deny", execAsk: "off" }`.
       - For collaborative/autonomous with `sandboxMode = "all"`, expect `execHost: "sandbox"`.
       - For collaborative/autonomous with any other sandbox mode (for example `"none"`), expect `execHost: "gateway"`.

     - Optional edge-case test (recommended because it mirrors the page’s current defaults):
       - `it("treats missing tools config as empty lists and still enforces group:runtime semantics")`
         - Input `existingTools = null` (or `undefined`).
         - Assert collaborative/autonomous returns `alsoAllow` containing `group:runtime` (since `allow` is not present, `usesAllow = false`).

4. Run validation commands from the repo root (`/Users/georgepickett/.codex/worktrees/f6bd/openclaw-studio`):

   - `npm run typecheck`
   - `npm test`

## Validation and Acceptance

This refactor is accepted when all items below are true:

1. The execution-role update flow no longer lives inline in `src/app/page.tsx` and is instead implemented in `src/features/agents/operations/executionRoleUpdateOperation.ts`.
2. `src/app/page.tsx` no longer contains the tool allow/deny manipulation logic for `group:runtime` (the `coerceStringArray` block is removed).
3. `tests/unit/executionRoleUpdateOperation.test.ts` exists and passes, and it covers:
   - role to exec approvals mapping
   - `allow` vs `alsoAllow` tool override semantics
   - session exec setting resolution from role + sandbox mode
4. `npm run typecheck` and `npm test` succeed.

## Idempotence and Recovery

This is an additive refactor (new module + rewiring) and is safe to retry:

- If partial changes break compilation, revert with `git checkout -- src/app/page.tsx` and delete the new files.
- No migrations, no deletes of runtime data, and no changes to gateway protocols are required.

## Artifacts and Notes

Revision note (2026-02-15): Improved this ExecPlan by grounding it against the actual code in `src/app/page.tsx:2170` and the gateway helper modules. Corrections and additions:

- Fixed allowlist typing to match `src/lib/gateway/execApprovals.ts` (`Array<{ pattern: string }>`), and updated the tests accordingly.
- Updated the side-effecting operation signature to take `GatewayClient` (from `src/lib/gateway/GatewayClient.ts`) so the implementation can call the existing gateway helpers without casts.
- Tightened the rewiring step to only remove imports that become unused after extraction (specifically not removing `readConfigAgentList` / `updateGatewayAgentOverrides`, which are used elsewhere in `src/app/page.tsx`).
- Added explicit notes about preserving the page’s current normalization behavior for `sandboxMode` and for treating `tools` as `null` unless it is a plain object.
- Added an optional edge-case test that mirrors the current “missing tools config” behavior.
