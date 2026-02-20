"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import { GatewayConnectScreen } from "@/features/agents/components/GatewayConnectScreen";
import { useGatewayConnection } from "@/lib/gateway/GatewayClient";
import { readGatewayAgentFile } from "@/lib/gateway/agentFiles";
import { buildHistoryLines, type ChatHistoryMessage } from "@/features/agents/state/runtimeEventBridge";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";

const POLL_INTERVAL_MS = 45_000;
const HISTORY_LIMIT = 80;
const HISTORY_PREVIEW_LINES = 10;

type AgentListEntry = {
  id: string;
  name?: string;
  identity?: {
    name?: string;
  };
};

type MemoryDoc = {
  agentId: string;
  agentName: string;
  memoryContent: string;
  conversationPreview: string[];
  searchText: string;
};

const resolveAgentName = (agent: AgentListEntry): string => {
  const identityName = agent.identity?.name?.trim();
  if (identityName) return identityName;
  const listedName = agent.name?.trim();
  if (listedName) return listedName;
  return agent.id;
};

export default function MemoryPage() {
  const [settingsCoordinator] = useState(() => createStudioSettingsCoordinator());
  const {
    client,
    status,
    gatewayUrl,
    token,
    localGatewayDefaults,
    error: gatewayError,
    connect,
    useLocalGatewayDefaults,
    setGatewayUrl,
    setToken,
  } = useGatewayConnection(settingsCoordinator);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<MemoryDoc[]>([]);

  const fetchMemoryDocs = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    setError(null);
    try {
      const listed = (await client.call("agents.list", {})) as {
        agents?: AgentListEntry[];
        mainKey?: string;
      };
      const agents = Array.isArray(listed.agents) ? listed.agents : [];
      const mainKey = listed.mainKey?.trim() || "main";
      const loadedDocs = await Promise.all(
        agents.map(async (agent) => {
          const agentName = resolveAgentName(agent);
          const sessionKey = `agent:${agent.id}:${mainKey}`;
          const [memoryFile, historyResult] = await Promise.all([
            readGatewayAgentFile({ client, agentId: agent.id, name: "MEMORY.md" }),
            client
              .call<{ messages?: ChatHistoryMessage[] }>("chat.history", {
                sessionKey,
                limit: HISTORY_LIMIT,
              })
              .catch(() => ({ messages: [] })),
          ]);
          const messages = Array.isArray(historyResult.messages) ? historyResult.messages : [];
          const historyLines = buildHistoryLines(messages).lines.filter((line) => line.trim().length > 0);
          const conversationPreview = historyLines.slice(-HISTORY_PREVIEW_LINES);
          const memoryContent = memoryFile.content.trim();
          const searchText = [agentName, agent.id, memoryContent, historyLines.join("\n")]
            .join("\n")
            .toLowerCase();
          return {
            agentId: agent.id,
            agentName,
            memoryContent,
            conversationPreview,
            searchText,
          } satisfies MemoryDoc;
        })
      );
      loadedDocs.sort((left, right) => left.agentName.localeCompare(right.agentName));
      setDocs(loadedDocs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories.");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    void fetchMemoryDocs();
  }, [fetchMemoryDocs]);

  useEffect(() => {
    if (status !== "connected") return;
    const interval = setInterval(() => {
      void fetchMemoryDocs();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMemoryDocs, status]);

  const filteredDocs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return docs;
    return docs.filter((doc) => doc.searchText.includes(needle));
  }, [docs, query]);

  const notConnected = status !== "connected";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="glass-panel fade-up ui-panel ui-topbar relative z-[180] px-3.5 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              data-testid="memory-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Studio
            </Link>
            <h1 className="console-title type-page-title text-foreground">Memory</h1>
          </div>
          {!notConnected ? (
            <button
              type="button"
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => void fetchMemoryDocs()}
              data-testid="memory-refresh"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          ) : null}
        </div>
      </header>

      <main className="flex-1 p-4">
        {notConnected ? (
          <div className="mx-auto flex min-h-0 w-full max-w-[820px] flex-1 flex-col gap-5">
            <GatewayConnectScreen
              gatewayUrl={gatewayUrl}
              token={token}
              localGatewayDefaults={localGatewayDefaults}
              status={status}
              error={gatewayError}
              onGatewayUrlChange={setGatewayUrl}
              onTokenChange={setToken}
              onUseLocalDefaults={useLocalGatewayDefaults}
              onConnect={() => void connect()}
            />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
            <div className="glass-panel ui-panel px-4 py-3">
              <label
                htmlFor="memory-search"
                className="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
              >
                Global memory search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="memory-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search all agent memories and conversations..."
                  className="ui-input h-10 w-full rounded-md pl-10 pr-4 text-sm text-foreground"
                  data-testid="memory-global-search"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {loading
                  ? "Updating memory index..."
                  : `${filteredDocs.length} result${filteredDocs.length === 1 ? "" : "s"} from ${docs.length} agent${docs.length === 1 ? "" : "s"}`}
              </p>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {filteredDocs.length === 0 && !loading ? (
              <div className="ui-card px-4 py-5 text-sm text-muted-foreground">
                No matching memories found.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {filteredDocs.map((doc) => (
                  <article
                    key={doc.agentId}
                    className="glass-panel ui-panel flex min-h-[300px] flex-col gap-3 p-4"
                    data-testid={`memory-doc-${doc.agentId}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-foreground">{doc.agentName}</h2>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">{doc.agentId}</p>
                      </div>
                      <span className="ui-badge">MEMORY.md</span>
                    </div>

                    <section className="ui-card min-h-[120px] flex-1 overflow-auto px-3 py-3">
                      {doc.memoryContent ? (
                        <div className="agent-markdown text-xs text-foreground">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {doc.memoryContent}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No durable memory saved yet.
                        </p>
                      )}
                    </section>

                    <section className="ui-card px-3 py-3">
                      <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        Recent conversation
                      </p>
                      {doc.conversationPreview.length > 0 ? (
                        <pre className="max-h-36 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">
                          {doc.conversationPreview.join("\n")}
                        </pre>
                      ) : (
                        <p className="text-xs text-muted-foreground">No conversation history loaded.</p>
                      )}
                    </section>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
