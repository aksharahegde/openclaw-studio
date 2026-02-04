import type { AgentState } from "@/features/agents/state/store";

export const buildNewSessionAgentPatch = (agent: AgentState): Partial<AgentState> => {
  return {
    sessionKey: agent.sessionKey,
    status: "idle",
    runId: null,
    streamText: null,
    thinkingTrace: null,
    outputLines: [],
    lastResult: null,
    lastDiff: null,
    latestOverride: null,
    latestOverrideKind: null,
    lastAssistantMessageAt: null,
    lastActivityAt: null,
    latestPreview: null,
    lastUserMessage: null,
    draft: "",
    historyLoadedAt: null,
    awaitingUserInput: false,
    hasUnseenActivity: false,
    sessionCreated: true,
    sessionSettingsSynced: true,
  };
};
