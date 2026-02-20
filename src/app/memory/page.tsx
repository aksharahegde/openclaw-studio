"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, FileText, RefreshCw, Search } from "lucide-react";
import { GatewayConnectScreen } from "@/features/agents/components/GatewayConnectScreen";
import { useGatewayConnection } from "@/lib/gateway/GatewayClient";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";
import { fetchJson } from "@/lib/http";

const POLL_INTERVAL_MS = 45_000;
const DEFAULT_FILE_PATH = "memory";
const DEFAULT_PATTERN = "^\\d{4}-\\d{2}-\\d{2}\\.md$";

type AgentListEntry = {
  id: string;
  name?: string;
  identity?: {
    name?: string;
  };
};

type MemoryDoc = {
  id: string;
  agentId: string;
  agentName: string;
  fileName: string;
  relativePath: string;
  content: string;
  wordCount: number;
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
  const [agentFilter, setAgentFilter] = useState("all");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<MemoryDoc[]>([]);

  const [filePathDraft, setFilePathDraft] = useState(DEFAULT_FILE_PATH);
  const [patternDraft, setPatternDraft] = useState(DEFAULT_PATTERN);
  const [filePath, setFilePath] = useState(DEFAULT_FILE_PATH);
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);

  const fetchMemoryDocs = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    setError(null);
    try {
      const listed = (await client.call("agents.list", {})) as {
        agents?: AgentListEntry[];
      };
      const agents = (Array.isArray(listed.agents) ? listed.agents : []).map((agent) => ({
        id: agent.id,
        name: resolveAgentName(agent),
      }));

      const response = await fetchJson<{
        docs?: Array<{
          id: string;
          agentId: string;
          agentName: string;
          fileName: string;
          relativePath: string;
          content: string;
          wordCount: number;
        }>;
      }>("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agents,
          filePath,
          pattern,
        }),
      });

      const loadedDocs = (Array.isArray(response.docs) ? response.docs : [])
        .map((doc) => ({
          ...doc,
          searchText: [doc.agentName, doc.agentId, doc.fileName, doc.relativePath, doc.content]
            .join("\n")
            .toLowerCase(),
        }))
        .sort((left, right) => {
          if (left.fileName !== right.fileName) return right.fileName.localeCompare(left.fileName);
          return left.agentName.localeCompare(right.agentName);
        });

      setDocs(loadedDocs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories.");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [client, filePath, pattern, status]);

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
    let next = docs;
    if (agentFilter !== "all") {
      next = next.filter((doc) => doc.agentId === agentFilter);
    }
    if (!needle) return next;
    return next.filter((doc) => doc.searchText.includes(needle));
  }, [agentFilter, docs, query]);

  useEffect(() => {
    if (filteredDocs.length === 0) {
      setSelectedDocId(null);
      return;
    }
    if (selectedDocId && filteredDocs.some((doc) => doc.id === selectedDocId)) return;
    setSelectedDocId(filteredDocs[0]?.id ?? null);
  }, [filteredDocs, selectedDocId]);

  const selectedDoc = useMemo(() => {
    if (!selectedDocId) return null;
    return filteredDocs.find((doc) => doc.id === selectedDocId) ?? null;
  }, [filteredDocs, selectedDocId]);

  const agentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const doc of docs) {
      if (!seen.has(doc.agentId)) {
        seen.set(doc.agentId, doc.agentName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [docs]);

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
            <h1 className="console-title type-page-title text-foreground">Memory Mission Control</h1>
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

      <main className="min-h-0 flex-1 p-4">
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
          <div className="mx-auto grid h-[calc(100vh-7.5rem)] w-full max-w-[1400px] grid-cols-1 gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="glass-panel ui-panel min-h-0 overflow-hidden p-3">
              <div className="mb-3 grid grid-cols-1 gap-2">
                <input
                  type="text"
                  value={filePathDraft}
                  onChange={(event) => setFilePathDraft(event.target.value)}
                  placeholder="filepath (e.g. memory)"
                  className="ui-input h-9 w-full rounded-md px-3 text-xs"
                  data-testid="memory-filepath-input"
                />
                <input
                  type="text"
                  value={patternDraft}
                  onChange={(event) => setPatternDraft(event.target.value)}
                  placeholder="pattern (regex)"
                  className="ui-input h-9 w-full rounded-md px-3 text-xs"
                  data-testid="memory-pattern-input"
                />
                <button
                  type="button"
                  className="ui-btn-secondary px-3 py-2 text-xs"
                  onClick={() => {
                    setFilePath(filePathDraft.trim() || DEFAULT_FILE_PATH);
                    setPattern(patternDraft.trim() || DEFAULT_PATTERN);
                  }}
                  data-testid="memory-source-apply"
                >
                  Apply file source
                </button>
              </div>

              <div className="mb-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="memory-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search memory..."
                    className="ui-input h-10 w-full rounded-md pl-10 pr-3 text-sm text-foreground"
                    data-testid="memory-global-search"
                  />
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-2 border-b border-border/60 pb-3">
                <button
                  type="button"
                  onClick={() => setAgentFilter("all")}
                  className={`ui-badge border px-2 py-1 text-[11px] ${agentFilter === "all" ? "border-foreground/45 bg-foreground/10 text-foreground" : "border-border/70 text-muted-foreground"}`}
                  data-testid="memory-filter-agent-all"
                >
                  All agents
                </button>
                {agentOptions.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setAgentFilter(agent.id)}
                    className={`ui-badge border px-2 py-1 text-[11px] ${agentFilter === agent.id ? "border-foreground/45 bg-foreground/10 text-foreground" : "border-border/70 text-muted-foreground"}`}
                    data-testid={`memory-filter-agent-${agent.id}`}
                  >
                    {agent.name}
                  </button>
                ))}
              </div>

              <div className="mb-2 flex items-center justify-between px-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                <span>Memory docs</span>
                <span>{filteredDocs.length}</span>
              </div>

              <div className="ui-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-auto pr-1">
                {filteredDocs.map((doc) => {
                  const isActive = doc.id === selectedDocId;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`ui-card w-full rounded-lg border px-3 py-3 text-left transition ${
                        isActive
                          ? "border-foreground/35 bg-foreground/10"
                          : "border-border/65 bg-background/55 hover:bg-background/75"
                      }`}
                      data-testid={`memory-doc-${doc.id}`}
                    >
                      <div className="text-sm font-semibold text-foreground">{doc.fileName}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{doc.agentName}</div>
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">{doc.relativePath}</div>
                      <div className="mt-2 text-xs text-muted-foreground">{doc.wordCount} words</div>
                    </button>
                  );
                })}
                {filteredDocs.length === 0 && !loading ? (
                  <div className="ui-card px-3 py-3 text-xs text-muted-foreground">No matching files.</div>
                ) : null}
              </div>
            </aside>

            <section className="glass-panel ui-panel min-h-0 overflow-hidden p-0">
              {error ? <p className="px-4 py-3 text-sm text-destructive">{error}</p> : null}
              {!selectedDoc ? (
                <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
                  {loading ? "Updating memory index..." : "Select a memory document from the sidebar."}
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex items-center justify-between border-b border-border/65 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-foreground">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <h2 className="truncate text-lg font-semibold">{selectedDoc.fileName}</h2>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {selectedDoc.relativePath} • {selectedDoc.wordCount} words • {loading ? "Updating" : "Live"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedDoc.agentName}</p>
                  </div>

                  <div className="ui-scroll min-h-0 flex-1 overflow-auto px-5 py-4">
                    {selectedDoc.content ? (
                      <div className="agent-markdown text-sm text-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedDoc.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">File is empty.</p>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
