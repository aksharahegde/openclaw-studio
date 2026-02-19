# Fix Chat Markdown Semantics and Streaming Transcript Reliability

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `/Users/georgepickett/openclaw-studio/.agent/PLANS.md`.

## Purpose / Big Picture

Users should be able to trust that assistant replies render as assistant replies, not as synthetic tool-output UI. When a model returns bullet points and a fenced code block, the transcript should show visible bullets and an inline fenced code block in the assistant message body. Only explicit tool transcript lines (`[[tool]]` and `[[tool-result]]`) should render with collapsible tool-card UI. Runtime chat-final commit, lifecycle fallback commit, and history reconciliation must converge on the same transcript semantics so chat behavior remains stable and predictable.

## Progress

- [x] (2026-02-16 19:33Z) Investigated current behavior in UI and identified user-facing mismatch (`Output` wrapper appears for plain assistant markdown; bullets not visibly rendered).
- [x] (2026-02-16 19:36Z) Read `/Users/georgepickett/openclaw-studio/docs/pi-chat-streaming.md` and traced runtime chat pipeline from gateway events to transcript rendering.
- [x] (2026-02-16 19:38Z) Read `/Users/georgepickett/openclaw-studio/src/features/agents/components/AgentChatPanel.tsx`, `/Users/georgepickett/openclaw-studio/src/features/agents/components/chatItems.ts`, `/Users/georgepickett/openclaw-studio/src/features/agents/state/gatewayRuntimeEventHandler.ts`, `/Users/georgepickett/openclaw-studio/src/features/agents/state/runtimeEventBridge.ts`, and relevant unit tests.
- [x] (2026-02-16 19:47Z) Audited adjacent execution paths in `/Users/georgepickett/openclaw-studio/src/features/agents/state/store.tsx`, `/Users/georgepickett/openclaw-studio/src/features/agents/operations/chatSendOperation.ts`, and `/Users/georgepickett/openclaw-studio/src/features/agents/operations/historySyncOperation.ts`.
- [x] (2026-02-16 20:09Z) Re-ran `execplan-improve`, deep-read transcript-v2 and history-sync tests, and tightened scope/verification for rendering and streaming consistency.
- [x] (2026-02-16 20:24Z) Re-ran `execplan-improve` again, verified `.agent/PLANS.md` as source of truth, and tightened lifecycle fallback validation coverage in addition to chat-final and history paths.
- [x] (2026-02-16 20:31Z) Re-ran `execplan-improve`, identified cross-layer normalization reuse risk, and specified a shared text-helper location plus direct unit coverage for that helper.
- [x] (2026-02-16 22:08Z) Verified in source that assistant-path synthetic `Output`/`Extract output` rendering has been removed from `/Users/georgepickett/openclaw-studio/src/features/agents/components/AgentChatPanel.tsx` and guarded by `/Users/georgepickett/openclaw-studio/tests/unit/agentChatPanel-markdown-rendering.test.ts`.
- [x] (2026-02-16 22:09Z) Verified explicit list-marker styling exists in `/Users/georgepickett/openclaw-studio/src/app/styles/markdown.css` (`disc`, `decimal`, and nested list styles).
- [x] (2026-02-16 22:10Z) Verified assistant text normalization is shared in `/Users/georgepickett/openclaw-studio/src/lib/text/assistantText.ts` and consumed by rendering/runtime/history paths.
- [x] (2026-02-16 22:11Z) Ran deterministic verification suite and confirmed pass:
  - `npx vitest run tests/unit/chatItems.test.ts tests/unit/agentChatPanel-markdown-rendering.test.ts tests/unit/gatewayRuntimeEventHandler.chat.test.ts tests/unit/gatewayRuntimeEventHandler.agent.test.ts tests/unit/runtimeEventBridge.test.ts tests/unit/historySyncOperation.test.ts tests/unit/agentChatPanel-controls.test.ts tests/unit/agentChatPanel-scroll.test.ts tests/unit/messageExtract.test.ts`
  - Result: `Test Files 9 passed`, `Tests 75 passed`, exit code `0`.
- [x] (2026-02-16 22:14Z) Verified transcript merge adjacency coverage and expanded deterministic suite to include `/Users/georgepickett/openclaw-studio/tests/unit/historySyncOperation.integration.test.ts`; confirmed `Test Files 10 passed`, `Tests 76 passed`.
- [x] (2026-02-16 22:16Z) Expanded reliability adjacency validation to include transcript primitives, lifecycle workflow/policy, and send-path tests; confirmed `Test Files 16 passed`, `Tests 104 passed`.
- [x] (2026-02-16 22:18Z) Verified deterministic maximized-browser helper exists for reproducible manual viewport checks: `/Users/georgepickett/openclaw-studio/scripts/playwright-open-maximized.sh` and `npm run pw:open:max`.
- [x] (2026-02-16 22:20Z) Verified markdown style wiring and transcript flag sources for reproducible manual checks: `/Users/georgepickett/openclaw-studio/src/app/globals.css` imports `/Users/georgepickett/openclaw-studio/src/app/styles/markdown.css`; transcript flags are read in `/Users/georgepickett/openclaw-studio/src/features/agents/state/transcript.ts`.
- [ ] Run one manual browser scenario in local Studio to confirm list-marker visibility on real rendered output after a fresh dev-server start.
- [ ] If manual behavior still diverges, capture transcript-line evidence (`outputLines` content and `toolCallingEnabled` flag) and add a focused failing test before changing rendering logic again.

## Surprises & Discoveries

- Observation: The source no longer contains assistant `Output` wrapper heuristics; assistant markdown now renders in the assistant markdown body and the regression test asserts no `Output`/`Extract output` text appears.
  Evidence: `/Users/georgepickett/openclaw-studio/src/features/agents/components/AgentChatPanel.tsx` and `/Users/georgepickett/openclaw-studio/tests/unit/agentChatPanel-markdown-rendering.test.ts`.

- Observation: Tool cards are intentionally still rendered, but only from explicit marker lines (`[[tool]]`, `[[tool-result]]`).
  Evidence: tool parsing helpers in `/Users/georgepickett/openclaw-studio/src/lib/text/message-extract.ts` and tool item handling in `/Users/georgepickett/openclaw-studio/src/features/agents/components/chatItems.ts`.

- Observation: List marker visibility is now guaranteed in CSS and does not depend on browser defaults.
  Evidence: `/Users/georgepickett/openclaw-studio/src/app/styles/markdown.css` defines `.agent-markdown ul/ol` marker types plus nested marker styles.

- Observation: Normalization consistency is already centralized and reused by UI/runtime/history.
  Evidence: `/Users/georgepickett/openclaw-studio/src/lib/text/assistantText.ts` is imported in `chatItems.ts`, `gatewayRuntimeEventHandler.ts`, `runtimeEventBridge.ts`, `historySyncOperation.ts`, and `AgentChatPanel.tsx`.

- Observation: Deterministic unit coverage now spans chat-final, lifecycle fallback, transcript-v2 history merge, and rendering semantics; remaining risk is browser-level visual drift that unit tests do not fully capture.
  Evidence: passing test suites listed in Progress and manual visual checks still pending.

- Observation: History sync correctness depends on both history line construction and transcript-entry merge heuristics (`confirmed`, timestamp tolerance, and conflict counting), so plan-level validation should include transcript merge primitives rather than only operation wrappers.
  Evidence: `/Users/georgepickett/openclaw-studio/src/features/agents/state/transcript.ts` (`mergeTranscriptEntriesWithHistory`) and `/Users/georgepickett/openclaw-studio/src/features/agents/operations/historySyncOperation.ts`.

- Observation: Runtime behavior is intentionally split into pure policy/workflow modules (`runtimeEventPolicy`, `historyLifecycleWorkflow`) and effectful handlers/operations; plan verification is incomplete if only effectful wrappers are tested.
  Evidence: `/Users/georgepickett/openclaw-studio/src/features/agents/state/runtimeEventPolicy.ts`, `/Users/georgepickett/openclaw-studio/src/features/agents/operations/historyLifecycleWorkflow.ts`, and corresponding `*.test.ts` + `*.integration.test.ts` files.

- Observation: The repo already provides a maximized Playwright launch path (`pw:open:max`) that disables auto-resize and asks Chrome to maximize the window via CDP, which reduces viewport-dependent false positives during manual UI checks.
  Evidence: `/Users/georgepickett/openclaw-studio/scripts/playwright-open-maximized.sh` and `/Users/georgepickett/openclaw-studio/package.json`.

- Observation: Chat markdown list styling is applied through global CSS import wiring, so manual debugging should confirm both style rules and import path rather than only inspecting markdown.css in isolation.
  Evidence: `/Users/georgepickett/openclaw-studio/src/app/globals.css` (`@import "./styles/markdown.css";`) and `/Users/georgepickett/openclaw-studio/src/app/styles/markdown.css`.

## Decision Log

- Decision: Keep the original plan intent (assistant markdown semantics + streaming reliability), but update execution state to reflect that core code changes are already present and passing tests.
  Rationale: The previous plan revision lagged behind current repository state, which made next steps ambiguous and duplicated already-completed work.
  Date/Author: 2026-02-16 / Codex

- Decision: Preserve strict rendering boundary: only explicit tool markers render tool cards; assistant text remains assistant markdown.
  Rationale: This aligns with transcript protocol and user mental model while avoiding heuristic reclassification regressions.
  Date/Author: 2026-02-16 / Codex

- Decision: Keep list-marker fixes in CSS, not parser logic.
  Rationale: Markdown structure already exists; marker visibility is presentational and is best enforced in stylesheet rules.
  Date/Author: 2026-02-16 / Codex

- Decision: Treat remaining work as closeout validation and targeted debugging only if manual repro still fails.
  Rationale: Automated coverage is strong; broad new refactors are unnecessary unless evidence shows a live mismatch.
  Date/Author: 2026-02-16 / Codex

- Decision: Include transcript merge adjacency (`transcript.ts`) and history sync command execution coverage in the default verification set.
  Rationale: Streaming reliability claims depend on reducer-level merge semantics and command execution behavior, not just high-level operation outputs.
  Date/Author: 2026-02-16 / Codex

- Decision: Extend default reliability verification to include policy/workflow unit coverage and local-send transcript emission coverage.
  Rationale: Regressions often occur at the pure-decision layer (`runtimeEventPolicy`, `historyLifecycleWorkflow`) or optimistic-send layer (`chatSendOperation`) before they surface in UI rendering tests.
  Date/Author: 2026-02-16 / Codex

- Decision: Use the maximized Playwright helper for manual validation runs when possible.
  Rationale: Fixed viewport geometry makes visual checks more reproducible and aligns with available project tooling.
  Date/Author: 2026-02-16 / Codex

- Decision: For manual mismatch repros that involve transcript merges, run dev with transcript-v2 and transcript-debug flags enabled.
  Rationale: This makes transcript-entry behavior observable and keeps manual evidence aligned with the transcript-v2 path used by the reliability tests.
  Date/Author: 2026-02-16 / Codex

## Outcomes & Retrospective

The repository currently reflects the intended rendering contract in code and tests: assistant markdown is rendered as assistant markdown, tool-card UI is driven by explicit tool marker lines, assistant text normalization is shared across runtime/history/rendering, and deterministic unit tests pass for the targeted paths.

Remaining gap is operational confidence from one real browser run (fresh dev server, real DOM/CSS) because unit tests validate structure but cannot fully prove visual marker appearance across all local runtime conditions.

## Context and Orientation

OpenClaw Studio stores transcript lines in `AgentState.outputLines` and (when transcript v2 is enabled) structured entries in `AgentState.transcriptEntries` (`/Users/georgepickett/openclaw-studio/src/features/agents/state/store.tsx`).

Transcript line conventions are:
- user line: `> ...`
- assistant line: plain markdown text
- tool lines: `[[tool]]...` or `[[tool-result]]...`
- metadata line: `[[meta]]{...}`
- thinking line: `[[trace]]...`

The UI converts transcript lines into structured items in `/Users/georgepickett/openclaw-studio/src/features/agents/components/chatItems.ts` and renders cards/messages in `/Users/georgepickett/openclaw-studio/src/features/agents/components/AgentChatPanel.tsx`.

Runtime and recovery producers are:
- live/runtime event handling: `/Users/georgepickett/openclaw-studio/src/features/agents/state/gatewayRuntimeEventHandler.ts`
- history parsing and patch support: `/Users/georgepickett/openclaw-studio/src/features/agents/state/runtimeEventBridge.ts`
- history sync workflow: `/Users/georgepickett/openclaw-studio/src/features/agents/operations/historySyncOperation.ts`
- transcript-entry merge and ordering primitives: `/Users/georgepickett/openclaw-studio/src/features/agents/state/transcript.ts`
- runtime decision policy and history lifecycle orchestration: `/Users/georgepickett/openclaw-studio/src/features/agents/state/runtimeEventPolicy.ts`, `/Users/georgepickett/openclaw-studio/src/features/agents/operations/historyLifecycleWorkflow.ts`
- markdown styling import chain for chat rendering: `/Users/georgepickett/openclaw-studio/src/app/globals.css` -> `/Users/georgepickett/openclaw-studio/src/app/styles/markdown.css`

Assistant text normalization is shared by `/Users/georgepickett/openclaw-studio/src/lib/text/assistantText.ts`.

## Plan of Work

Milestone 1 is closeout verification against current code. Reconfirm rendering and streaming invariants in source and deterministic tests. Do not re-implement completed fixes.

Milestone 2 is manual browser validation. Run a single reproducible chat prompt that exercises bullets plus fenced code and verify the visible UI behavior matches the contract.

Milestone 3 is conditional debugging. Only if manual behavior diverges, capture actual transcript lines and relevant flags (`toolCallingEnabled`, run stream source) and add a focused failing test before changing production logic.

## Concrete Steps

All commands below run from:

    cd /Users/georgepickett/openclaw-studio

1. Re-run deterministic verification suite.

    npx vitest run tests/unit/chatItems.test.ts tests/unit/agentChatPanel-markdown-rendering.test.ts tests/unit/gatewayRuntimeEventHandler.chat.test.ts tests/unit/gatewayRuntimeEventHandler.agent.test.ts tests/unit/gatewayRuntimeEventHandler.policyDelegation.test.ts tests/unit/runtimeEventBridge.test.ts tests/unit/historySyncOperation.test.ts tests/unit/historySyncOperation.integration.test.ts tests/unit/historyLifecycleWorkflow.test.ts tests/unit/historyLifecycleWorkflow.integration.test.ts tests/unit/runtimeEventPolicy.test.ts tests/unit/transcript.test.ts tests/unit/chatSendOperation.test.ts tests/unit/agentChatPanel-controls.test.ts tests/unit/agentChatPanel-scroll.test.ts tests/unit/messageExtract.test.ts

   Expected terminal signal:

    Test Files  16 passed
    Tests      104 passed
    exit code 0

2. Manual browser validation.

    npm run dev

   Open `http://localhost:3000` and send:

    Reply with exactly two bullet points and one fenced code block containing echo 'ui-regression-check'.

   For deterministic viewport sizing, prefer a maximized Playwright window:

    npm run pw:open:max -- http://localhost:3000

   When investigating transcript-entry merge behavior, run with explicit flags:

    NEXT_PUBLIC_STUDIO_TRANSCRIPT_V2=1 NEXT_PUBLIC_STUDIO_TRANSCRIPT_DEBUG=1 npm run dev

   Verify:
   - assistant markdown shows list items as list markup with visible markers,
   - fenced code block renders in assistant markdown body,
   - no synthetic assistant `Output` wrapper or `Extract output` control appears,
   - explicit tool-marker lines still appear in tool cards when present.

3. Conditional evidence capture if mismatch persists.

   If the UI still looks wrong, capture the exact transcript semantics before code changes:
   - copy the affected raw `outputLines` entries for that run,
   - capture the corresponding `transcriptEntries` slice for the same run when transcript-v2 is enabled,
   - note whether `toolCallingEnabled` was `true` or `false`,
   - record whether the problematic block originated from assistant text or tool marker lines.
   - if ordering/merge looks suspect, temporarily enable transcript debug output (`NEXT_PUBLIC_STUDIO_TRANSCRIPT_DEBUG=1`) to confirm whether conflicts or reordering occurred.

   Then add/extend the smallest failing unit test in one of:
   - `/Users/georgepickett/openclaw-studio/tests/unit/agentChatPanel-markdown-rendering.test.ts`
   - `/Users/georgepickett/openclaw-studio/tests/unit/chatItems.test.ts`
   - `/Users/georgepickett/openclaw-studio/tests/unit/gatewayRuntimeEventHandler.agent.test.ts`

   Only after the failing test exists should rendering/runtime logic be changed.

## Validation and Acceptance

Automated acceptance: the deterministic `vitest run` command above passes with exit code 0.

Manual acceptance: one real browser run shows visible markdown bullets and fenced code in assistant content without synthetic assistant `Output` UI, while tool-card behavior remains tied to explicit tool marker lines.
Manual acceptance should be performed in a stable viewport (preferably via `npm run pw:open:max`) to reduce viewport-dependent visual variance.

Regression acceptance (conditional): if a mismatch is found, a new focused test reproduces it before code changes and passes after the fix.

## Idempotence and Recovery

Re-running test commands is safe and idempotent.

If manual validation fails after any local code edits, revert only the latest touched files related to the attempted fix and re-run the deterministic suite before making a second attempt.

If mismatch evidence shows tool-marker lines were rendered as tool cards, treat that as expected protocol behavior and adjust prompt/expectation rather than rewriting parser logic.

## Artifacts and Notes

Evidence used for this plan revision:

- Assistant rendering component: `/Users/georgepickett/openclaw-studio/src/features/agents/components/AgentChatPanel.tsx`
- Transcript parsing to items: `/Users/georgepickett/openclaw-studio/src/features/agents/components/chatItems.ts`
- Runtime chat/agent handling: `/Users/georgepickett/openclaw-studio/src/features/agents/state/gatewayRuntimeEventHandler.ts`
- History parse/sync: `/Users/georgepickett/openclaw-studio/src/features/agents/state/runtimeEventBridge.ts`, `/Users/georgepickett/openclaw-studio/src/features/agents/operations/historySyncOperation.ts`
- Runtime/history decision workflows: `/Users/georgepickett/openclaw-studio/src/features/agents/state/runtimeEventPolicy.ts`, `/Users/georgepickett/openclaw-studio/src/features/agents/operations/historyLifecycleWorkflow.ts`
- Transcript merge primitives: `/Users/georgepickett/openclaw-studio/src/features/agents/state/transcript.ts`
- Local send path: `/Users/georgepickett/openclaw-studio/src/features/agents/operations/chatSendOperation.ts`
- Normalization helper: `/Users/georgepickett/openclaw-studio/src/lib/text/assistantText.ts`
- Tool marker protocol helpers: `/Users/georgepickett/openclaw-studio/src/lib/text/message-extract.ts`
- Markdown styling: `/Users/georgepickett/openclaw-studio/src/app/styles/markdown.css`
- Markdown import wiring: `/Users/georgepickett/openclaw-studio/src/app/globals.css`
- Streaming architecture doc: `/Users/georgepickett/openclaw-studio/docs/pi-chat-streaming.md`
- Maximized Playwright helper: `/Users/georgepickett/openclaw-studio/scripts/playwright-open-maximized.sh`
- Rendering/reliability tests: `/Users/georgepickett/openclaw-studio/tests/unit/agentChatPanel-markdown-rendering.test.ts`, `/Users/georgepickett/openclaw-studio/tests/unit/chatItems.test.ts`, `/Users/georgepickett/openclaw-studio/tests/unit/gatewayRuntimeEventHandler.chat.test.ts`, `/Users/georgepickett/openclaw-studio/tests/unit/gatewayRuntimeEventHandler.agent.test.ts`, `/Users/georgepickett/openclaw-studio/tests/unit/gatewayRuntimeEventHandler.policyDelegation.test.ts`, `/Users/georgepickett/openclaw-studio/tests/unit/historySyncOperation.test.ts`, `/Users/georgepickett/openclaw-studio/tests/unit/historySyncOperation.integration.test.ts`, `/Users/georgepickett/openclaw-studio/tests/unit/historyLifecycleWorkflow.test.ts`, `/Users/georgepickett/openclaw-studio/tests/unit/historyLifecycleWorkflow.integration.test.ts`, `/Users/georgepickett/openclaw-studio/tests/unit/runtimeEventPolicy.test.ts`, `/Users/georgepickett/openclaw-studio/tests/unit/transcript.test.ts`, `/Users/georgepickett/openclaw-studio/tests/unit/chatSendOperation.test.ts`, `/Users/georgepickett/openclaw-studio/tests/unit/runtimeEventBridge.test.ts`

## Interfaces and Dependencies

No new runtime dependencies are required.

The implementation contract remains:

- `/Users/georgepickett/openclaw-studio/src/features/agents/components/chatItems.ts`: `buildFinalAgentChatItems(...)` returns `AgentChatItem[]` with stable kinds (`user`, `assistant`, `tool`, `thinking`).
- `/Users/georgepickett/openclaw-studio/src/features/agents/components/chatItems.ts`: `toolCallingEnabled=false` continues to coerce exec tool results into assistant text via `coerceToolMarkdownToAssistantText(...)`.
- `/Users/georgepickett/openclaw-studio/src/lib/text/message-extract.ts`: tool parsing/formatting helpers remain source of marker semantics.
- `/Users/georgepickett/openclaw-studio/src/lib/text/assistantText.ts`: shared assistant normalization is safe for UI, runtime, and history modules.
- `/Users/georgepickett/openclaw-studio/src/features/agents/state/gatewayRuntimeEventHandler.ts`, `/Users/georgepickett/openclaw-studio/src/features/agents/state/runtimeEventBridge.ts`, and `/Users/georgepickett/openclaw-studio/src/features/agents/operations/historySyncOperation.ts`: transcript production remains compatible with transcript-v2 and legacy output-line mode.
- `/Users/georgepickett/openclaw-studio/src/features/agents/state/transcript.ts`: transcript merge must preserve ordering guarantees while confirming optimistic entries against canonical history.
- `/Users/georgepickett/openclaw-studio/src/features/agents/state/runtimeEventPolicy.ts` and `/Users/georgepickett/openclaw-studio/src/features/agents/operations/historyLifecycleWorkflow.ts`: decision outputs must remain compatible with handler/operation call sites.
- `/Users/georgepickett/openclaw-studio/src/features/agents/operations/chatSendOperation.ts`: optimistic user-line append (`> ...`) and transcript metadata emission must remain stable for downstream history reconciliation.
- `/Users/georgepickett/openclaw-studio/src/features/agents/state/store.tsx`: reducer `appendOutput` and transcript-entry synchronization preserve ordering semantics.

Plan revision notes:

- Initial draft created on 2026-02-16 to address assistant markdown misclassification and list marker visibility.
- 2026-02-16 improvement revision: corrected source-of-truth reference, added adjacent execution paths, replaced watch-prone test command with deterministic `vitest run`, and strengthened acceptance criteria.
- 2026-02-16 improvement revision 2: added explicit guardrails for `toolCallingEnabled=false`, added transcript-v2/history-sync coverage requirements, and expanded deterministic validation set.
- 2026-02-16 improvement revision 3: aligned with `/Users/georgepickett/openclaw-studio/.agent/PLANS.md`, added explicit lifecycle fallback validation coverage, corrected expected test-file count, and clarified manual bullet-visibility checks.
- 2026-02-16 improvement revision 4: added dependency-safe normalization strategy and direct helper-level unit coverage expectations.
- 2026-02-16 improvement revision 5: reconciled plan state with current repository reality (core fixes and tests already landed), converted remaining work to closeout manual verification plus evidence-first debugging if any mismatch persists.
- 2026-02-16 improvement revision 6: added transcript merge adjacency coverage (`transcript.ts`), expanded deterministic verification to include `historySyncOperation.integration.test.ts`, and tightened mismatch evidence capture to include `transcriptEntries` plus debug-mode guidance.
- 2026-02-16 improvement revision 7: expanded default verification to include policy/workflow and send-path adjacency tests (`runtimeEventPolicy`, `historyLifecycleWorkflow`, `chatSendOperation`, `transcript`), and updated expected deterministic pass counts to `16` files / `104` tests.
- 2026-02-16 improvement revision 8: added deterministic viewport guidance for manual validation via `npm run pw:open:max`, linked to the existing maximized Playwright helper script, and recorded viewport stability as part of manual acceptance.
- 2026-02-16 improvement revision 9: added markdown import-chain verification (`globals.css` -> `markdown.css`) and explicit transcript-v2/debug manual repro command to improve self-contained observability guidance.
