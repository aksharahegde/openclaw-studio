"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { GatewayConnectScreen } from "@/features/agents/components/GatewayConnectScreen";
import { buildAgentMainSessionKey, useGatewayConnection } from "@/lib/gateway/GatewayClient";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";

const POLL_INTERVAL_MS = 30_000;
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

type AgentListEntry = {
  id: string;
  name?: string;
  identity?: {
    name?: string;
  };
};

type SessionListEntry = {
  key?: string;
  displayName?: string;
  updatedAt?: number | null;
};

type StatusSnapshot = {
  sessions?: {
    recent?: Array<{ key?: string; updatedAt?: number | null }>;
    byAgent?: Array<{
      agentId?: string;
      recent?: Array<{ key?: string; updatedAt?: number | null }>;
    }>;
  };
  runs?: {
    active?: Array<{ sessionKey?: string }>;
    byAgent?: Array<{
      agentId?: string;
      active?: Array<{ sessionKey?: string }>;
    }>;
  };
  agents?: Array<{
    id?: string;
    status?: string;
  }>;
};

type SubagentRow = {
  sessionKey: string;
  name: string;
  status: "running" | "active" | "idle";
  updatedAt: number | null;
};

type TeamRow = {
  agentId: string;
  name: string;
  status: "running" | "active" | "idle";
  updatedAt: number | null;
  subagents: SubagentRow[];
};

const resolveAgentName = (agent: AgentListEntry): string => {
  const identityName = agent.identity?.name?.trim();
  if (identityName) return identityName;
  const listedName = agent.name?.trim();
  if (listedName) return listedName;
  return agent.id;
};

const normalizeTimestamp = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return null;
};

const normalizeSessionDisplayName = (entry: SessionListEntry): string => {
  const explicit = entry.displayName?.trim();
  if (explicit) return explicit;
  const key = entry.key?.trim() ?? "";
  const parts = key.split(":");
  return parts[parts.length - 1] || key || "session";
};

const resolveSessionStatus = (params: {
  sessionKey: string;
  updatedAt: number | null;
  runningSessionKeys: Set<string>;
  now: number;
}): "running" | "active" | "idle" => {
  if (params.runningSessionKeys.has(params.sessionKey)) return "running";
  if (typeof params.updatedAt === "number" && params.now - params.updatedAt <= ACTIVE_WINDOW_MS) {
    return "active";
  }
  return "idle";
};

const statusBadgeClass = (status: "running" | "active" | "idle") => {
  if (status === "running") {
    return "border-emerald-400/55 bg-emerald-500/15 text-emerald-300";
  }
  if (status === "active") {
    return "border-sky-400/55 bg-sky-500/15 text-sky-300";
  }
  return "border-border/70 bg-muted/35 text-muted-foreground";
};

const formatUpdated = (timestamp: number | null): string => {
  if (typeof timestamp !== "number") return "No recent activity";
  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 45_000) return "Updated just now";
  const deltaMinutes = Math.floor(deltaMs / 60_000);
  if (deltaMinutes < 60) return `Updated ${deltaMinutes}m ago`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `Updated ${deltaHours}h ago`;
  const deltaDays = Math.floor(deltaHours / 24);
  return `Updated ${deltaDays}d ago`;
};

const cardToneClass = (index: number): string => {
  const tones = [
    "border-cyan-500/40 shadow-[0_0_0_1px_rgba(6,182,212,0.15)]",
    "border-violet-500/40 shadow-[0_0_0_1px_rgba(139,92,246,0.15)]",
    "border-fuchsia-500/40 shadow-[0_0_0_1px_rgba(217,70,239,0.15)]",
    "border-sky-500/40 shadow-[0_0_0_1px_rgba(14,165,233,0.15)]",
    "border-emerald-500/40 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]",
  ];
  return tones[index % tones.length] ?? tones[0];
};

const chipToneClass = (index: number): string => {
  const tones = [
    "bg-cyan-500/15 text-cyan-300",
    "bg-violet-500/15 text-violet-300",
    "bg-fuchsia-500/15 text-fuchsia-300",
    "bg-sky-500/15 text-sky-300",
    "bg-emerald-500/15 text-emerald-300",
  ];
  return tones[index % tones.length] ?? tones[0];
};

export default function TeamPage() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    try {
      localStorage.setItem("theme", "light");
    } catch {
      // no-op
    }
  }, []);

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

  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    setError(null);

    try {
      const [agentsResultRaw, statusSnapshotRaw] = await Promise.all([
        client.call("agents.list", {}),
        client.call("status", {}),
      ]);

      const agentsResult = agentsResultRaw as { agents?: AgentListEntry[]; mainKey?: string };
      const statusSnapshot = statusSnapshotRaw as StatusSnapshot;
      const agents = Array.isArray(agentsResult.agents) ? agentsResult.agents : [];
      const mainKey = typeof agentsResult.mainKey === "string" ? agentsResult.mainKey.trim() : "main";
      const now = Date.now();

      const updatedAtBySession = new Map<string, number>();
      for (const entry of statusSnapshot.sessions?.recent ?? []) {
        const key = entry?.key?.trim() ?? "";
        const updatedAt = normalizeTimestamp(entry?.updatedAt);
        if (!key || updatedAt === null) continue;
        updatedAtBySession.set(key, updatedAt);
      }
      for (const agentGroup of statusSnapshot.sessions?.byAgent ?? []) {
        for (const entry of agentGroup?.recent ?? []) {
          const key = entry?.key?.trim() ?? "";
          const updatedAt = normalizeTimestamp(entry?.updatedAt);
          if (!key || updatedAt === null) continue;
          const current = updatedAtBySession.get(key) ?? 0;
          if (updatedAt > current) updatedAtBySession.set(key, updatedAt);
        }
      }

      const runningSessionKeys = new Set<string>();
      for (const run of statusSnapshot.runs?.active ?? []) {
        const key = run?.sessionKey?.trim() ?? "";
        if (key) runningSessionKeys.add(key);
      }
      for (const group of statusSnapshot.runs?.byAgent ?? []) {
        for (const run of group?.active ?? []) {
          const key = run?.sessionKey?.trim() ?? "";
          if (key) runningSessionKeys.add(key);
        }
      }

      const mappedRows = await Promise.all(
        agents.map(async (agent): Promise<TeamRow> => {
          const agentId = agent.id.trim();
          const mainSessionKey = buildAgentMainSessionKey(agentId, mainKey);

          const sessionsResultRaw = (await client.call("sessions.list", {
            agentId,
            includeGlobal: false,
            includeUnknown: false,
            limit: 200,
          })) as { sessions?: SessionListEntry[] };
          const sessions = Array.isArray(sessionsResultRaw.sessions) ? sessionsResultRaw.sessions : [];
          const subagents = sessions
            .map((entry) => {
              const key = entry.key?.trim() ?? "";
              if (!key || key === mainSessionKey) return null;
              const updatedAt = normalizeTimestamp(entry.updatedAt) ?? updatedAtBySession.get(key) ?? null;
              return {
                sessionKey: key,
                name: normalizeSessionDisplayName(entry),
                status: resolveSessionStatus({
                  sessionKey: key,
                  updatedAt,
                  runningSessionKeys,
                  now,
                }),
                updatedAt,
              } as SubagentRow;
            })
            .filter((entry): entry is SubagentRow => Boolean(entry))
            .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));

          const updatedAt = updatedAtBySession.get(mainSessionKey) ?? null;
          const fallbackFromAgentStatus = (statusSnapshot.agents ?? []).find(
            (entry) => entry.id?.trim() === agentId && entry.status?.trim().toLowerCase() === "running"
          );
          const statusValue = fallbackFromAgentStatus
            ? "running"
            : resolveSessionStatus({
                sessionKey: mainSessionKey,
                updatedAt,
                runningSessionKeys,
                now,
              });

          return {
            agentId,
            name: resolveAgentName(agent),
            status: statusValue,
            updatedAt,
            subagents,
          };
        })
      );

      mappedRows.sort((left, right) => left.name.localeCompare(right.name));
      setRows(mappedRows);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Failed to load team structure.");
    } finally {
      setLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    void fetchTeam();
  }, [fetchTeam]);

  useEffect(() => {
    if (status !== "connected") return;
    const interval = setInterval(() => {
      void fetchTeam();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchTeam, status]);

  const totalSubagents = useMemo(
    () => rows.reduce((sum, row) => sum + row.subagents.length, 0),
    [rows]
  );
  const leadRow = useMemo(() => {
    if (rows.length === 0) return null;
    return [...rows].sort((a, b) => {
      if (b.subagents.length !== a.subagents.length) return b.subagents.length - a.subagents.length;
      return a.name.localeCompare(b.name);
    })[0] ?? null;
  }, [rows]);
  const secondaryRow = useMemo(() => {
    if (!leadRow) return null;
    return rows.find((row) => row.agentId !== leadRow.agentId) ?? null;
  }, [leadRow, rows]);
  const leadSubagents = useMemo(() => {
    if (!leadRow) return [];
    return leadRow.subagents.slice(0, 6);
  }, [leadRow]);

  const notConnected = status !== "connected";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="glass-panel fade-up ui-panel ui-topbar relative z-[180] px-3.5 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              data-testid="team-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Studio
            </Link>
            <h1 className="console-title type-page-title text-foreground">Team Structure</h1>
          </div>
          {!notConnected ? (
            <button
              type="button"
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => void fetchTeam()}
              data-testid="team-refresh"
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
          <div className="mx-auto w-full max-w-[1220px] space-y-5">
            <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_34%),radial-gradient(circle_at_80%_30%,rgba(217,70,239,0.12),transparent_35%),linear-gradient(180deg,#ffffff,#f8fafc)] px-4 py-8 md:px-8">
              <div className="mx-auto max-w-[920px] text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Team Topology
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                  Meet The Team
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {rows.length} AI agents, with {totalSubagents} recurring subagent session
                  {totalSubagents === 1 ? "" : "s"} actively supporting execution.
                </p>
                {loading ? <p className="mt-2 font-mono text-xs text-slate-500">Syncing live status...</p> : null}
                {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
              </div>

              {!loading && rows.length === 0 ? (
                <div className="mx-auto mt-8 max-w-[760px] rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-600">
                  No agents found. Create agents in Studio to build your team structure.
                </div>
              ) : null}

              {leadRow ? (
                <div className="mx-auto mt-8 max-w-[760px]">
                  <article
                    className={`rounded-xl border bg-white/95 p-4 md:p-5 ${cardToneClass(0)}`}
                    data-testid="team-lead-card"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-xl">
                        {leadRow.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">{leadRow.name}</h3>
                          <span className="font-mono text-[10px] text-slate-500">{leadRow.agentId}</span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${statusBadgeClass(leadRow.status)}`}
                          >
                            {leadRow.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          Lead coordinator for this team. {leadRow.subagents.length} regular subagent
                          session{leadRow.subagents.length === 1 ? "" : "s"}.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                            orchestration
                          </span>
                          <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                            delegation
                          </span>
                          <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                            accountability
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>

                  <div className="mx-auto my-5 h-7 w-px bg-slate-300" />
                  <div className="mx-auto flex w-full max-w-[560px] items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-300">
                      Input Signal
                    </span>
                    <div className="h-px flex-1 bg-slate-300" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-sky-300">
                      Output Action
                    </span>
                  </div>
                </div>
              ) : null}

              {leadSubagents.length > 0 ? (
                <div className="mx-auto mt-4 grid max-w-[980px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {leadSubagents.map((subagent, index) => (
                    <article
                      key={subagent.sessionKey}
                      className={`rounded-xl border bg-white/95 p-3 ${cardToneClass(index + 1)}`}
                      data-testid="team-subagent-card"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{subagent.name}</p>
                        <span
                          className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] ${statusBadgeClass(subagent.status)}`}
                        >
                          {subagent.status}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                        Session key: {subagent.sessionKey}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${chipToneClass(index)}`}>
                          focus
                        </span>
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${chipToneClass(index)}`}>
                          execution
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-[10px] text-slate-500">
                        {formatUpdated(subagent.updatedAt)}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}

              {secondaryRow ? (
                <div className="mx-auto mt-7 max-w-[560px]">
                  <div className="mx-auto mb-3 flex w-full items-center gap-2">
                    <div className="h-px flex-1 bg-slate-300" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      Meta Layer
                    </span>
                    <div className="h-px flex-1 bg-slate-300" />
                  </div>
                  <article className={`rounded-xl border bg-white/95 p-4 ${cardToneClass(4)}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{secondaryRow.name}</h3>
                      <span className="font-mono text-[10px] text-slate-500">{secondaryRow.agentId}</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${statusBadgeClass(secondaryRow.status)}`}
                      >
                        {secondaryRow.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Reliability and guardrail layer. {formatUpdated(secondaryRow.updatedAt)}.
                    </p>
                  </article>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
