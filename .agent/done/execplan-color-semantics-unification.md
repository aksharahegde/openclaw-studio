# Unify and Harden Color Semantics Across OpenClaw Studio

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

After this change, OpenClaw Studio will use color as a consistent semantic signaling system instead of a mostly decorative warm tint system. Primary actions will stand out clearly, status colors will communicate state without ambiguity, destructive actions will be unmistakable, and panel layering will be easier to scan during long sessions.

A user should be able to identify three things instantly in the three-pane layout: what they should click next, what state the system is in, and what is dangerous to trigger. The visible proof is straightforward: run Studio, open fleet/chat/settings/brain panels, and verify that action controls share one action tone, statuses are semantically distinct, destructive controls are reserved, and chat/panel backgrounds no longer compete with action/status signal colors.

## Progress

- [x] (2026-02-20 00:04Z) Captured baseline color behavior from screenshots and source inspection across the token layer and component usage.
- [x] (2026-02-20 00:04Z) Identified concrete color inconsistencies: accent reused for both action and status, warm-tinted chat surfaces dominating, weak layer hierarchy, and mixed semantic vs raw color usage.
- [x] (2026-02-20 00:08Z) Audited referenced files/tests/commands against the repository and rewrote this plan to remove ambiguity and align milestones with actual code paths.
- [x] (2026-02-20 16:14Z) Re-audited all referenced files/commands and tightened this plan for command correctness (`rg` token query fix), known baseline test instability, and status-type source consistency notes.
- [x] (2026-02-20 00:21Z) Defined and documented semantic color contract in `docs/color-system.md`, including status mapping rules and file-level migration checklist.
- [x] (2026-02-20 00:22Z) Refactored shared token and utility layer in `src/app/globals.css` and `src/app/styles/markdown.css` to separate action, danger, status, and surface semantics.
- [x] (2026-02-20 00:24Z) Added `src/features/agents/components/colorSemantics.ts` and migrated fleet/chat/connection/header status rendering to centralized semantic mappings with `data-status` markers.
- [x] (2026-02-20 00:25Z) Migrated inspect/connect/modal/page error and destructive affordances to semantic classes; removed dead `CRON_TEMPLATE_OPTIONS.accent` config.
- [x] (2026-02-20 00:26Z) Added regression tests (`tests/unit/colorSemantics.test.ts`, `tests/unit/colorSemanticsGuard.test.ts`) and updated existing unit tests to assert semantic class usage.
- [x] (2026-02-20 00:29Z) Ran lint, typecheck, targeted/new unit tests, full unit tests, and selected e2e tests; documented baseline failures (existing `agentSettingsPanel` timeouts and current e2e selector drift).

## Surprises & Discoveries

- Observation: most “neutral” surfaces derive from one warm base tint (`--neutral-tint-rgb`) with close alpha steps, so multiple structural layers read as one tonal band.
  Evidence: `src/app/globals.css` defines `--surface-2`, `--surface-3`, `--sidebar-card-bg`, `--chat-user-bg`, and `--chat-user-header-bg` all as alpha blends of the same tint.

- Observation: action and running-state semantics are partially conflated.
  Evidence: running badge uses `bg-accent/70` in both `src/features/agents/components/FleetSidebar.tsx` and `src/features/agents/components/AgentChatPanel.tsx`, while primary action buttons use `ui-btn-primary` from `src/app/globals.css`.

- Observation: several semantic tokens appear underused or unused, while some color semantics are encoded directly in component class strings.
  Evidence: `--sidebar-card-border`, `--panel-border`, and `--surface-selected-border` are defined in `src/app/globals.css` but not consumed by component styles, while classes such as `bg-amber-500/12` and `text-amber-700` appear directly in component files.

- Observation: light-theme readability is reduced in some metadata chips and timestamp treatments.
  Evidence: baseline checks during planning showed low effective contrast in selected muted-on-muted combinations in user-message and idle-status styling.

- Observation: `CRON_TEMPLATE_OPTIONS` defines `accent` values that are not used in rendering.
  Evidence: `accent` is declared in `src/features/agents/components/AgentInspectPanels.tsx` but not applied in the template button class composition.

- Observation: current e2e tests do not validate color semantics directly.
  Evidence: `tests/e2e/fleet-sidebar.spec.ts`, `tests/e2e/agent-inspect-panel.spec.ts`, and `tests/e2e/connection-settings.spec.ts` validate flow/visibility/persistence but not class or token semantics.

- Observation: the command to grep CSS custom properties must use argument termination for `rg`.
  Evidence: `rg -n "--[a-z0-9-]+" src/app/globals.css` fails with `unrecognized flag`; `rg -n -- "--[a-z0-9-]+" src/app/globals.css` works.

- Observation: `GatewayStatus` is duplicated in two modules.
  Evidence: `src/lib/gateway/GatewayClient.ts` and `src/features/agents/operations/gatewayRestartPolicy.ts` both declare `"disconnected" | "connecting" | "connected"`.

- Observation: one planned iterative unit command includes a file with baseline hanging tests unrelated to color behavior.
  Evidence: `npm run test -- --run tests/unit/agentSettingsPanel.test.ts` currently times out in three existing tests (`autosaves_updated_permissions_draft`, `submits_modal_with_agent_scoped_draft`, `keeps_modal_open_and_shows_error_when_create_fails`).

- Observation: full unit-suite regressions from this color migration were contained to one assertion in `agentCreateModal` tests and were resolved by updating the test query to target the submit button role.
  Evidence: `tests/unit/agentCreateModal.test.ts` now passes (`7/7`) after replacing ambiguous `getByText("Launch agent")` with role-based lookup.

- Observation: selected e2e tests are currently brittle against current connection-screen copy and flow assumptions (for example `"Remote Gateway"` exact casing and immediate visibility of local command controls).
  Evidence: `npm run e2e -- tests/e2e/fleet-sidebar.spec.ts tests/e2e/agent-inspect-panel.spec.ts tests/e2e/connection-settings.spec.ts` fails in 4 tests due missing expected elements, while 2 tests pass.

## Decision Log

- Decision: implement color unification as a semantic-token migration first, then component rewiring second.
  Rationale: changing component classes before establishing token semantics would duplicate work and increase drift across panels.
  Date/Author: 2026-02-20 / Codex

- Decision: keep one primary action hue and one destructive hue, while separating status tones from action tones.
  Rationale: this resolves the current overlap where action emphasis and running state can look too similar, and matches the UX goal of rapid operator scanning.
  Date/Author: 2026-02-20 / Codex

- Decision: include automated regression checks for color semantics rather than relying only on visual review.
  Rationale: this app has many UI entry points (fleet, chat, settings, brain, connect screen), and snapshot/manual checks alone will miss drift.
  Date/Author: 2026-02-20 / Codex

- Decision: use existing domain types for status mapping (`AgentStatus` and `GatewayStatus`) instead of introducing disconnected status unions.
  Rationale: these types already exist in `src/features/agents/state/store.tsx` and `src/lib/gateway/GatewayClient.ts`; reusing them prevents drift.
  Date/Author: 2026-02-20 / Codex

- Decision: enforce color semantics with both behavior tests and a node-based source guard test.
  Rationale: component tests verify rendering intent, while a source guard catches future raw utility drift that behavior tests might miss.
  Date/Author: 2026-02-20 / Codex

- Decision: keep iterative color-work validation focused on stable, color-adjacent unit tests and run `agentSettingsPanel` tests as a non-blocking informational check until their baseline timeout issue is resolved.
  Rationale: this keeps the color migration loop executable while still preserving visibility into unrelated existing test instability.
  Date/Author: 2026-02-20 / Codex

- Decision: preserve a terminal-like visual treatment for local command snippets, but move it behind semantic tokens/classes (`--command-*`, `ui-command-*`) rather than raw `zinc-*` utilities.
  Rationale: this keeps the intentional affordance while honoring the no-raw-hue guardrail and centralized token ownership.
  Date/Author: 2026-02-20 / Codex

## Outcomes & Retrospective

Implementation is complete for the scoped color-system migration.

What shipped:

- Semantic color contract documentation in `docs/color-system.md` and README linkage.
- Token-layer unification in `src/app/globals.css` and `src/app/styles/markdown.css` for action, danger, status, surface hierarchy, and command-preview semantics.
- Shared status/approval mapping module in `src/features/agents/components/colorSemantics.ts`.
- Component migrations across fleet/chat/connection/header/inspect/connect/modal/page error surfaces to semantic classes.
- Source guardrail and mapping tests (`tests/unit/colorSemanticsGuard.test.ts`, `tests/unit/colorSemantics.test.ts`) plus updates to core unit tests.

Validation outcome:

- `npm run lint` passes with warnings only (no errors).
- `npm run typecheck` passes.
- Color-targeted/new unit tests pass.
- Full unit suite has only the previously documented `agentSettingsPanel` timeout failures (3 tests).
- Selected e2e suite currently has 4 failures tied to pre-existing/out-of-sync selector assumptions in connection-related specs.

Residual follow-up outside this color migration:

- Stabilize/fix the three long-running `agentSettingsPanel` unit tests.
- Update connection-screen e2e selectors/assertions to reflect current UI copy/flow.

## Context and Orientation

OpenClaw Studio’s color system is centralized in `src/app/globals.css`, which defines theme variables and shared utility classes (`ui-panel`, `ui-card`, `ui-btn-primary`, `ui-switch`, `ui-segment`, `ui-chip`, `sidebar-*`). Markdown rendering colors are defined in `src/app/styles/markdown.css` and should stay aligned with token semantics.

Most user-visible UI affected by this migration lives in:

- `src/app/page.tsx`
- `src/features/agents/components/FleetSidebar.tsx`
- `src/features/agents/components/AgentChatPanel.tsx`
- `src/features/agents/components/ConnectionPanel.tsx`
- `src/features/agents/components/HeaderBar.tsx`
- `src/features/agents/components/AgentInspectPanels.tsx`
- `src/features/agents/components/GatewayConnectScreen.tsx`
- `src/features/agents/components/AgentCreateModal.tsx`
- `src/features/agents/components/EmptyStatePanel.tsx`

`AgentStatus` is currently defined as `"idle" | "running" | "error"` in `src/features/agents/state/store.tsx`. `GatewayStatus` is currently defined as `"disconnected" | "connecting" | "connected"` in both `src/lib/gateway/GatewayClient.ts` and `src/features/agents/operations/gatewayRestartPolicy.ts`. For UI color mapping, use the client-side gateway status type used by UI components (`@/lib/gateway/GatewayClient`) so component contracts stay aligned.

In this plan, “semantic token” means a variable name that encodes meaning (`status-running-bg`) rather than appearance (`blue-500`). “Surface layer” means depth levels that separate app background, panel shells, cards, and inline blocks. “Status tone” means a color family used only for state signaling (idle/running/error/connected/connecting), not for action emphasis.

## Plan of Work

The migration begins with a color contract that maps intent to token names and class usage. Then the token layer is refactored in `globals.css` and `markdown.css` so shared classes express semantics directly. Next, duplicated status class strings in fleet/chat/connection components are replaced with centralized mappings and testable hooks.

After core panes are migrated, the right-side panels and modal flows are updated to improve structural separation and destructive clarity. Raw color utility usage in core files is either eliminated or explicitly allow-listed for intentional exceptions (for example, terminal-like command preview styling, if retained).

The last phase hardens the system with tests and guardrails, then completes visual verification in both light and dark themes and in mobile pane mode.

## Milestones

### Milestone 1: Author semantic contract and baseline inventory

Create `docs/color-system.md` and capture a baseline inventory of token usage, raw color utility usage, and duplicated status mappings. Include explicit mapping rules for action, danger, warning, success/running, idle/neutral, and surfaces.

This milestone must include concrete mapping decisions for currently duplicated status rendering in `FleetSidebar.tsx`, `AgentChatPanel.tsx`, and `ConnectionPanel.tsx`, and document whether the terminal-like zinc styling in `GatewayConnectScreen.tsx` remains an intentional exception.

Acceptance for this milestone is a committed document that lists current sources of color truth and a migration checklist tied to exact files.

### Milestone 2: Refactor token primitives and shared classes

Update `src/app/globals.css` to add or rename semantic variables for:

- Action emphasis
- Destructive emphasis
- Status backgrounds/text/borders
- Layer surfaces (app/panel/card/subsurface)
- User-message surfaces

Update shared classes (`ui-btn-primary`, `ui-chip`, `ui-switch`, `ui-segment-item[data-active]`, `ui-selected`, `ui-card`, `sidebar-card`, `sidebar-input`) to consume semantic tokens instead of broad warm-neutral blends where inappropriate.

Update `src/app/styles/markdown.css` so inline code/pre/code blockquote link accents continue to match the revised semantic palette.

Acceptance for this milestone is that no component file changes are needed to observe improved baseline semantics for shared class users.

### Milestone 3: Centralize status and approval color mappings

Add `src/features/agents/components/colorSemantics.ts` and centralize status/approval class mapping using existing status types from store/gateway code.

Define stable exports such as:

    import type { AgentStatus } from "@/features/agents/state/store";
    import type { GatewayStatus } from "@/lib/gateway/GatewayClient";

    export const AGENT_STATUS_BADGE_CLASS: Record<AgentStatus, string> = ...;
    export const GATEWAY_STATUS_BADGE_CLASS: Record<GatewayStatus, string> = ...;
    export const NEEDS_APPROVAL_BADGE_CLASS = ...;

Use these in:

- `src/features/agents/components/FleetSidebar.tsx`
- `src/features/agents/components/AgentChatPanel.tsx`
- `src/features/agents/components/ConnectionPanel.tsx`

If needed for durable tests, add explicit `data-status` attributes to rendered status badges.

Acceptance for this milestone is removal of duplicated status class fragments from these three components and passing unit tests.

### Milestone 4: Migrate inspect, modal, and connect panes

Migrate color usage in:

- `src/features/agents/components/AgentInspectPanels.tsx`
- `src/features/agents/components/GatewayConnectScreen.tsx`
- `src/features/agents/components/AgentCreateModal.tsx`
- `src/features/agents/components/HeaderBar.tsx`
- `src/features/agents/components/EmptyStatePanel.tsx`

Focus on three outcomes: clearer section hierarchy, clearer destructive affordance, and clearer importance for high-impact controls (for example Model/Thinking selectors). Remove dead color config (`CRON_TEMPLATE_OPTIONS.accent`) unless actively applied in rendering with semantic tokens.

Acceptance for this milestone is that right-side panels no longer rely on one tonal band and destructive actions are visually reserved everywhere they appear.

### Milestone 5: Add regression tests and source guardrails

Add tests that pin semantic behavior:

- `tests/unit/colorSemantics.test.ts` for status mapping outputs.
- Update `tests/unit/fleetSidebar-create.test.ts` to assert status/approval badge semantic classes or `data-status` attributes.
- Update `tests/unit/agentChatPanel-controls.test.ts` to assert semantic status rendering for idle/running/error.
- Update `tests/unit/connectionPanel-close.test.ts` to assert gateway status semantic class mapping.

Add a node-environment guard test, for example `tests/unit/colorSemanticsGuard.test.ts`, that reads core component files and fails if disallowed raw color utility classes are introduced, with an explicit allow-list for intentional exceptions.

Acceptance for this milestone is green unit tests including the new guard test.

### Milestone 6: Validate end-to-end and document outcomes

Run lint/typecheck/unit/e2e checks and manual visual validation in light and dark themes, desktop and mobile pane mode. Add `docs/color-system.md` to `README.md` under documentation links so the contract is discoverable.

Acceptance for this milestone is passing automation, visual confirmation against purpose goals, and updated plan evidence snippets.

## Concrete Steps

Run all commands from repo root:

    cd /Users/georgepickett/openclaw-studio

Baseline inventory commands:

    rg -n "bg-(amber|cyan|emerald|orange|violet|red|green|blue|zinc)|text-(amber|cyan|emerald|orange|violet|red|green|blue|zinc)|border-(amber|cyan|emerald|orange|violet|red|green|blue|zinc)" src/features/agents/components src/app
    rg -n -- "--[a-z0-9-]+" src/app/globals.css
    rg -n "statusClassName|statusColor|ui-switch--on|ui-btn-primary|chat-user-bg|chat-user-header-bg" src/features/agents/components src/app/globals.css

Iterative validation during migration:

    npm run lint
    npm run typecheck
    npm run test -- --run tests/unit/fleetSidebar-create.test.ts tests/unit/agentChatPanel-controls.test.ts tests/unit/connectionPanel-close.test.ts

Informational check for inspect-panel-adjacent behavior (currently contains known baseline timeouts that should be tracked but not treated as color-regression blockers unless failures change):

    npm run test -- --run tests/unit/agentSettingsPanel.test.ts

Run new semantic tests once added:

    npm run test -- --run tests/unit/colorSemantics.test.ts tests/unit/colorSemanticsGuard.test.ts

Full unit suite before completion:

    npm run test -- --run

Preflight e2e selection:

    npm run e2e -- --list tests/e2e/fleet-sidebar.spec.ts tests/e2e/agent-inspect-panel.spec.ts tests/e2e/connection-settings.spec.ts

Selected e2e execution:

    npm run e2e -- tests/e2e/fleet-sidebar.spec.ts tests/e2e/agent-inspect-panel.spec.ts tests/e2e/connection-settings.spec.ts

Manual visual verification:

    npm run dev

Open `http://127.0.0.1:3000`, inspect fleet/chat/settings/brain/connect views, toggle theme, then verify action/state/danger/surface hierarchy behavior.

## Validation and Acceptance

Acceptance is behavior-first.

Primary actions (`New agent`, `Send`, `Create`, `Launch agent`) share one action semantic style and are clearly more prominent than secondary controls.

Statuses are unambiguous and non-overlapping with action semantics. `idle`, `running`, `error`, `connecting`, `connected`, and `disconnected` each present a distinct semantic treatment.

Destructive actions (`Delete agent`, cron/heartbeat delete buttons, deny buttons) use reserved destructive semantics and are never visually equivalent to neutral or primary controls.

Surface hierarchy is clearer in both themes. Background, panel shell, cards, and inline surfaces are visually separable without relying on heavy saturation.

Chat readability improves: user-message surfaces no longer dominate transcript hierarchy and metadata remains readable.

Critical selectors (Model, Thinking) appear intentionally higher-priority than ordinary passive fields.

Guard tests prevent accidental reintroduction of raw color utility drift in core UI files.

Known baseline instability in `tests/unit/agentSettingsPanel.test.ts` should be tracked as a separate quality issue; acceptance for this plan requires that color changes do not introduce additional failures beyond that current baseline.

## Idempotence and Recovery

This migration is additive and safe to execute in small commits. If a token refactor causes wide visual regressions, restore previous token values in `src/app/globals.css` while keeping new semantic class wiring, then retune in a follow-up commit.

Guard test allow-lists must remain explicit and small; if a new intentional exception is required, add it with a comment explaining why that exception cannot use semantic tokens.

No data migrations or destructive runtime operations are required. Failed test or lint steps are recoverable by editing touched files and rerunning the same commands.

## Artifacts and Notes

Capture concise evidence snippets and screenshot paths as work proceeds.

Expected unit test transcript shape:

    npm run test -- --run tests/unit/fleetSidebar-create.test.ts

     RUN  v4.0.18 /Users/georgepickett/openclaw-studio
     ✓ tests/unit/fleetSidebar-create.test.ts (4 tests)

Expected e2e list preflight shape:

    npm run e2e -- --list tests/e2e/fleet-sidebar.spec.ts tests/e2e/agent-inspect-panel.spec.ts tests/e2e/connection-settings.spec.ts

    Listing tests:
      agent-inspect-panel.spec.ts:29:5 › connection panel reflects disconnected state
      connection-settings.spec.ts:3:5 › connection settings persist to the studio settings API
      fleet-sidebar.spec.ts:105:5 › switches_active_agent_from_sidebar
      ...
    Total: 6 tests in 3 files

Keep before/after visual artifacts in `test-results/` (Playwright default) or a dedicated folder like `tests/artifacts/color-system/`, and reference exact paths in this plan as milestones complete.

## Interfaces and Dependencies

Introduce one small semantic mapping module in `src/features/agents/components/colorSemantics.ts` and consume existing status types.

Required interface shape:

    import type { AgentStatus } from "@/features/agents/state/store";
    import type { GatewayStatus } from "@/lib/gateway/GatewayClient";

    export const AGENT_STATUS_BADGE_CLASS: Record<AgentStatus, string>;
    export const GATEWAY_STATUS_BADGE_CLASS: Record<GatewayStatus, string>;
    export const NEEDS_APPROVAL_BADGE_CLASS: string;

    export const resolveAgentStatusBadgeClass: (status: AgentStatus) => string;
    export const resolveGatewayStatusBadgeClass: (status: GatewayStatus) => string;

Consumers that must be updated:

- `src/features/agents/components/FleetSidebar.tsx`
- `src/features/agents/components/AgentChatPanel.tsx`
- `src/features/agents/components/ConnectionPanel.tsx`

Supporting files likely touched during migration:

- `src/app/globals.css`
- `src/app/styles/markdown.css`
- `src/app/page.tsx`
- `src/features/agents/components/AgentInspectPanels.tsx`
- `src/features/agents/components/GatewayConnectScreen.tsx`
- `src/features/agents/components/AgentCreateModal.tsx`
- `src/features/agents/components/HeaderBar.tsx`
- `src/features/agents/components/EmptyStatePanel.tsx`
- `README.md`
- `docs/color-system.md`

Tests to add or update:

- `tests/unit/colorSemantics.test.ts`
- `tests/unit/colorSemanticsGuard.test.ts`
- `tests/unit/fleetSidebar-create.test.ts`
- `tests/unit/agentChatPanel-controls.test.ts`
- `tests/unit/connectionPanel-close.test.ts`
- `tests/unit/agentSettingsPanel.test.ts` (for destructive/section hierarchy semantics where practical)

## Revision Note

2026-02-20 (Codex): Created the initial ExecPlan for full color-system unification and UX-focused semantic improvements, based on the documented findings from screenshot review and source-level token/component analysis.

2026-02-20 (Codex): Improved the ExecPlan by validating all referenced files and commands against the current codebase, tightening milestones to match real modules and test patterns, reusing existing `AgentStatus`/`GatewayStatus` types, adding concrete source-guard testing strategy, and documenting dead color config paths that must be resolved during migration.

2026-02-20 (Codex): Performed a second strict improve pass and corrected the CSS-token inventory command syntax, documented duplicated `GatewayStatus` definitions, captured baseline `agentSettingsPanel` timeout risk in validation guidance, and aligned the iterative command sequence with currently stable color-adjacent tests.

2026-02-20 (Codex): Implemented the plan end-to-end: added semantic color contract docs, refactored token/class usage across core UI surfaces, centralized status mappings, removed raw hue utilities from color-owned components, added guard/mapping tests, and captured remaining baseline verification gaps (agent settings unit timeouts and connection e2e selector drift).
