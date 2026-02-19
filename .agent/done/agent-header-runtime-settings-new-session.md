# Move Runtime Controls To Agent Header And Add Settings-Only Rename/New Session

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows `.agent/PLANS.md` from the repository root and must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, per-agent runtime controls (`model` and `thinking level`) are immediately available in the agent header near the avatar, while the settings panel becomes focused on lower-frequency agent management tasks. A user can only rename an agent from settings, can still toggle `Show tool calls` and `Show thinking` there, and can click `New session` to move that agent to a fresh session and clear the visible transcript. The behavior is visible in one flow: open an agent, change model/thinking from the header, open settings to rename, then click `New session` and observe an empty transcript for that agent.

## Progress

- [x] (2026-02-04 20:38Z) Reviewed `.agent/PLANS.md` from the main branch and inspected current `c9af` implementations of `AgentChatPanel`, `AgentSettingsPanel`, and `src/app/page.tsx` to define scope.
- [x] (2026-02-04 20:17Z) Wrote and ran failing Milestone 1 tests for header runtime controls and chat inline-name removal in `tests/unit/agentChatPanel-controls.test.ts`.
- [x] (2026-02-04 20:18Z) Implemented Milestone 1 in `AgentChatPanel` and `src/app/page.tsx` (runtime controls moved to chat header, inline rename removed), then passed targeted tests.
- [x] (2026-02-04 20:19Z) Wrote and ran failing Milestone 2 tests for settings rename and runtime-section removal in `tests/unit/agentSettingsPanel.test.ts`.
- [x] (2026-02-04 20:20Z) Implemented Milestone 2 settings redesign in `src/features/agents/components/AgentSettingsPanel.tsx` and updated page wiring (`onRename` path).
- [x] (2026-02-04 20:20Z) Wrote and ran failing Milestone 3 tests for `New session` action (`tests/unit/agentSettingsPanel.test.ts`, `tests/unit/agentSessionActions.test.ts`).
- [x] (2026-02-04 20:21Z) Implemented Milestone 3 new-session orchestration via `src/features/agents/state/agentSessionActions.ts` and `handleNewSession` wiring in `src/app/page.tsx`.
- [x] (2026-02-04 20:24Z) Completed full validation (`npm run test`, `npm run lint`, `npm run typecheck`) and updated `README.md` + `ARCHITECTURE.md` for the new runtime/settings UX.

## Surprises & Discoveries

- Observation: Runtime controls are currently coupled to `AgentSettingsPanel`, not the agent header.
  Evidence: `src/features/agents/components/AgentSettingsPanel.tsx` renders `Model` and `Thinking` under `Runtime settings`, and `src/features/agents/components/AgentChatPanel.tsx` has no model/thinking controls.
- Observation: Agent rename is currently inline in chat via editable name input, which conflicts with “rename only from settings.”
  Evidence: `src/features/agents/components/AgentChatPanel.tsx` defines `commitName` and uses `onNameChange` on blur/Enter.
- Observation: Session identity is represented by `agent.sessionKey`, and switching to a new key is enough to reset transcript rendering for that agent in the current store model.
  Evidence: `AgentState` includes `sessionKey` in `src/features/agents/state/store.tsx`, and message/history flow in `src/app/page.tsx` routes by session key.
- Observation: The `c9af` worktree had no `node_modules`, so test-first loops initially failed before dependencies were installed.
  Evidence: first run of `npm run test -- tests/unit/agentChatPanel-controls.test.ts` returned `sh: vitest: command not found`; `npm install` resolved this.
- Observation: A pre-existing FleetSidebar create-action refactor in this worktree required `onCreateAgent` props and test fixture updates to keep typecheck green while implementing this plan.
  Evidence: `npm run typecheck` failed on missing `onCreateAgent` and `lastAssistantMessageAt` in tests until `src/app/page.tsx` and affected unit fixtures were aligned.

## Decision Log

- Decision: Remove runtime controls (`Model`, `Thinking`) from `AgentSettingsPanel` and place them in `AgentChatPanel` header near avatar/status.
  Rationale: These controls are high-frequency runtime choices and should be immediately accessible while chatting.
  Date/Author: 2026-02-04 / Codex
- Decision: Make rename settings-only by removing inline rename behavior from chat and adding a dedicated rename section in settings.
  Rationale: This enforces one clear location for identity edits and reduces accidental renames.
  Date/Author: 2026-02-04 / Codex
- Decision: Implement `New session` as a per-agent settings action that assigns a fresh studio session key for that agent and clears transcript-related runtime state immediately.
  Rationale: This directly maps to the requested “clear transcript/reset session” behavior while preserving existing session-history files rather than deleting them.
  Date/Author: 2026-02-04 / Codex
- Decision: Keep heartbeat backend utilities unchanged in this scope, but remove heartbeat controls from the primary settings UX.
  Rationale: The requested settings simplification is UI-focused; removing heartbeat transport code is unnecessary risk for this milestone.
  Date/Author: 2026-02-04 / Codex
- Decision: Preserve the worktree’s pre-existing `FleetSidebar` create-action interface and satisfy it with a disabled no-op callback in `src/app/page.tsx`.
  Rationale: This plan does not include agent creation, but the existing interface had to remain type-safe without reverting unrelated work.
  Date/Author: 2026-02-04 / Codex

## Outcomes & Retrospective

Implementation is complete and validated. Runtime model/thinking controls now live in the agent header, rename is settings-only, and per-agent `New session` resets visible transcript/runtime state by switching to a fresh studio session key. Unit tests, lint, and typecheck are all passing in the `c9af` worktree.

## Context and Orientation

The main app shell and orchestration live in `src/app/page.tsx`. This file owns gateway event subscriptions, session/history loading, and callback wiring for `AgentChatPanel` and `AgentSettingsPanel`.

The chat surface lives in `src/features/agents/components/AgentChatPanel.tsx`. Today, it includes an inline editable agent name input and a settings button. It is the correct place to surface runtime controls in the header because it already renders avatar, status, and immediate interaction controls.

The settings sidebar lives in `src/features/agents/components/AgentSettingsPanel.tsx`. Today, it contains runtime controls, visibility toggles, heartbeat controls, and delete action. This change re-focuses it to management actions: rename, display toggles, new session, and delete.

Per-agent runtime state lives in `src/features/agents/state/store.tsx` (`AgentState`), including `sessionKey`, `outputLines`, `streamText`, and `thinkingTrace`. Session key helper functions are in `src/lib/gateway/sessionKeys.ts`.

The runtime settings sync transport is `sessions.patch` through `syncGatewaySessionSettings` in `src/lib/gateway/sessionSettings.ts`, currently triggered by `applySessionSettingMutation` in `src/features/agents/state/sessionSettingsMutations.ts`.

Beads note: `.beads/` is not present in this worktree at planning time, so this plan does not create Beads issues.

## Plan of Work

### Milestone 1: Move Runtime Controls To Agent Header

Add model/thinking controls to the header area of `AgentChatPanel` (next to avatar/status/settings trigger) and remove runtime controls from `AgentSettingsPanel`. Wire `src/app/page.tsx` so the selected agent chat panel receives model catalog data and model/thinking callbacks currently passed to settings.

As part of this milestone, remove inline name-edit behavior from `AgentChatPanel` so chat no longer owns rename. Replace the editable input with a non-editable display treatment.

### Milestone 2: Redesign Settings For Rename + Display Controls

Refactor `AgentSettingsPanel` into dedicated sections:
- `Identity` section with rename input and explicit `Save name` action.
- `Display` section containing only `Show tool calls` and `Show thinking` toggles.
- Existing danger zone for delete.

Move rename callback ownership to settings by introducing a new `onRename` prop and handling save success/failure there. Keep fail-fast validation (trimmed non-empty name required) and show actionable errors.

### Milestone 3: Add Per-Agent New Session Action

Add a `Session` section to `AgentSettingsPanel` with a `New session` action and explanatory copy (“starts this agent in a fresh session and clears the visible transcript”). Wire `onNewSession` to a new handler in `src/app/page.tsx` that:

1. Generates a fresh session id (`generateUUID`).
2. Builds a new key with `buildAgentStudioSessionKey(agentId, sessionId)`.
3. Updates only that agent’s state to the new key and clears transcript/runtime fields (`outputLines`, `streamText`, `thinkingTrace`, `lastResult`, `lastDiff`, `historyLoadedAt`, `lastUserMessage`, `runId`, status back to idle).
4. Marks session sync flags for the new key appropriately so the next run initializes settings safely (`sessionCreated`, `sessionSettingsSynced`).
5. Emits actionable error output if session initialization fails.

This milestone keeps old session history intact and switches the active agent context to the new session.

### Milestone 4: Verification + Documentation

Update docs so contributors and users understand where runtime controls now live and what settings panel scope is. Confirm tests, lint, and typecheck all pass and manually verify the full UX flow.

## Concrete Steps

Run all commands from:
`/Users/georgepickett/.codex/worktrees/c9af/openclaw-studio`

1. Write Milestone 1 tests first.
   - Edit `tests/unit/agentChatPanel-controls.test.ts`.
   - Add tests:
     - `it("renders model and thinking controls in agent header")`
     - `it("invokes onModelChange when model select changes")`
     - `it("invokes onThinkingChange when thinking select changes")`
     - `it("does not render inline editable name input in chat header")`

2. Implement Milestone 1.
   - Edit `src/features/agents/components/AgentChatPanel.tsx`.
   - Edit `src/app/page.tsx` to pass models/runtime callbacks into chat panel.
   - Edit `src/features/agents/components/AgentSettingsPanel.tsx` to remove runtime controls section.

3. Write Milestone 2 tests first.
   - Edit `tests/unit/agentSettingsPanel.test.ts`.
   - Add tests:
     - `it("renders identity rename section and saves trimmed name")`
     - `it("keeps show tool calls and show thinking toggles")`
     - `it("does not render runtime settings section")`

4. Implement Milestone 2.
   - Edit `src/features/agents/components/AgentSettingsPanel.tsx` for rename section and callback.
   - Edit `src/app/page.tsx` to pass `onRename` into settings panel and remove rename callback from chat panel props.

5. Write Milestone 3 tests first.
   - Add `tests/unit/agentSessionActions.test.ts` for any extracted pure helper that builds the agent reset patch for `New session`, or extend an existing relevant unit suite.
   - Add `tests/unit/agentSettingsPanel.test.ts` assertion:
     - `it("invokes onNewSession when New session is clicked")`

6. Implement Milestone 3.
   - Edit `src/app/page.tsx` to add `handleNewSession(agentId)` and pass to settings.
   - Edit `src/features/agents/components/AgentSettingsPanel.tsx` to add `Session` section and button.
   - If needed for testability, add a small pure helper under `src/features/agents/state/` to construct the new-session patch.

7. Update docs.
   - Edit `README.md` and `ARCHITECTURE.md` to reflect runtime controls in chat header and narrowed settings scope.

8. Run verification commands.

    npm run test -- tests/unit/agentChatPanel-controls.test.ts tests/unit/agentSettingsPanel.test.ts
    npm run test
    npm run lint
    npm run typecheck

9. Run manual validation flow.

    npm run dev

## Validation and Acceptance

Milestone 1 verification workflow:
1. Tests to write: extend `tests/unit/agentChatPanel-controls.test.ts` with the four tests listed above. They must fail first because controls are not in chat header yet.
2. Implementation: move model/thinking controls into `AgentChatPanel` and wire callbacks/models from `src/app/page.tsx`.
3. Verification: run `npm run test -- tests/unit/agentChatPanel-controls.test.ts` and confirm pass.
4. Commit: `Milestone 1: move runtime controls to agent chat header`.

Milestone 2 verification workflow:
1. Tests to write: extend `tests/unit/agentSettingsPanel.test.ts` for rename section behavior and runtime-section removal.
2. Implementation: add settings-driven rename flow and remove inline rename behavior from chat.
3. Verification: run `npm run test -- tests/unit/agentSettingsPanel.test.ts tests/unit/agentChatPanel-controls.test.ts`.
4. Commit: `Milestone 2: make rename settings-only and simplify settings panel`.

Milestone 3 verification workflow:
1. Tests to write: add tests for `New session` click behavior and for the state patch helper (or equivalent deterministic logic).
2. Implementation: add per-agent `handleNewSession` in `src/app/page.tsx` and settings button wiring.
3. Verification: run targeted tests, then `npm run test`.
4. Commit: `Milestone 3: add per-agent new session action`.

Milestone 4 verification workflow:
1. Tests to write: none if docs-only changes.
2. Implementation: update `README.md` and `ARCHITECTURE.md`.
3. Verification: run `npm run lint` and `npm run typecheck` and ensure no regressions.
4. Commit: `Milestone 4: document runtime and settings UX changes`.

Behavioral acceptance criteria:

- `Model` and `Thinking` controls are visible in the active agent header near avatar/status.
- `Runtime settings` is no longer shown in the settings panel.
- Agent name is not editable in chat header; rename is only available in settings and successfully persists through `renameGatewayAgent`.
- Settings panel still includes `Show tool calls` and `Show thinking` toggles.
- Clicking `New session` in settings clears visible transcript state for that agent and routes subsequent messages through a fresh session key.
- Delete-agent behavior remains available and unchanged.

Manual acceptance walkthrough:

1. Open the app and pick an agent.
2. Change model/thinking from the agent header.
3. Open settings and rename the agent; confirm name updates in fleet/chat.
4. Send one message, then click `New session`.
5. Confirm transcript area resets; send another message and confirm only new-session conversation appears.

## Idempotence and Recovery

This plan is safe to re-run. UI refactors are localized to `AgentChatPanel`, `AgentSettingsPanel`, and callback wiring in `src/app/page.tsx`. If a milestone fails mid-way, restore only the touched files for that milestone and rerun the corresponding targeted tests before continuing.

For `New session`, recovery is straightforward: if session initialization fails, keep the previous session key unchanged and surface a visible error line in agent output. Do not silently swallow errors.

## Artifacts and Notes

Expected targeted test output pattern:

    > npm run test -- tests/unit/agentChatPanel-controls.test.ts tests/unit/agentSettingsPanel.test.ts
    ✓ AgentChatPanel controls > renders model and thinking controls in agent header
    ✓ AgentSettingsPanel > renders identity rename section and saves trimmed name

Expected UX artifacts after implementation:

- Agent header shows model/thinking controls without opening settings.
- Settings panel shows clear `Identity`, `Display`, `Session`, and `Delete agent` sections.

## Interfaces and Dependencies

No new external dependencies are required.

Expected interface updates:

- `src/features/agents/components/AgentChatPanel.tsx` props add:

    models: GatewayModelChoice[]
    onModelChange: (value: string | null) => void
    onThinkingChange: (value: string | null) => void

  and remove:

    onNameChange: (name: string) => Promise<boolean>

- `src/features/agents/components/AgentSettingsPanel.tsx` props add:

    onRename: (value: string) => Promise<boolean>
    onNewSession: () => Promise<void> | void

  and remove now-unused runtime props:

    models
    onModelChange
    onThinkingChange

- `src/app/page.tsx` adds:

    const handleNewSession = useCallback(async (agentId: string) => { ... }, [...deps])

This scope preserves gateway-first boundaries: rename continues through `config.patch`, and runtime session behavior continues through existing session key + session sync flows.

Revision note (2026-02-04): Replaced prior pending plan (sidebar new-agent creation) with a new ExecPlan based on the latest UX direction: runtime controls in chat header, settings-only rename, and per-agent New session action.
Revision note (2026-02-04): Marked all milestones complete, recorded validation evidence, and captured implementation-time discoveries/decisions before archiving this ExecPlan to `.agent/done/`.
