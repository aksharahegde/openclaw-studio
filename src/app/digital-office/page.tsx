"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GatewayConnectScreen } from "@/features/agents/components/GatewayConnectScreen";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";
import { buildAgentMainSessionKey, useGatewayConnection } from "@/lib/gateway/GatewayClient";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CircleHelp, Laptop, Search, UserRound, UsersRound, Video } from "lucide-react";
import { buildAvatarDataUrl } from "@/lib/avatars/multiavatar";

type AgentStatus = "working" | "idle" | "meeting" | "offline" | "needs-help";
type GroupMode = "team" | "project" | "timezone";
type DensityMode = "desk" | "grid";

type OfficeAgent = {
  id: string;
  name: string;
  role: string;
  team: string;
  project: string;
  timezone: string;
  status: AgentStatus;
  activeTask: string;
  statusForMins: number;
};

type AgentListEntry = {
  id: string;
  name?: string;
  identity?: {
    name?: string;
  };
};

type SessionListEntry = {
  key?: string;
  updatedAt?: number | null;
  modelProvider?: string | null;
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

const STATUS_META: Record<
  AgentStatus,
  { label: string; icon: typeof Laptop; ring: string; badge: string; pulse: string }
> = {
  working: {
    label: "Working",
    icon: Laptop,
    ring: "ring-emerald-500/70",
    badge: "bg-emerald-500/15 text-emerald-300",
    pulse: "shadow-[0_0_0_6px_rgba(16,185,129,0.12)]",
  },
  idle: {
    label: "Idle",
    icon: UserRound,
    ring: "ring-amber-500/70",
    badge: "bg-amber-500/15 text-amber-300",
    pulse: "",
  },
  meeting: {
    label: "In Meeting",
    icon: Video,
    ring: "ring-sky-500/70",
    badge: "bg-sky-500/15 text-sky-300",
    pulse: "shadow-[0_0_0_6px_rgba(14,165,233,0.1)]",
  },
  offline: {
    label: "Offline",
    icon: UsersRound,
    ring: "ring-zinc-500/50",
    badge: "bg-zinc-500/15 text-zinc-300",
    pulse: "",
  },
  "needs-help": {
    label: "Needs Help",
    icon: CircleHelp,
    ring: "ring-rose-500/80",
    badge: "bg-rose-500/15 text-rose-300",
    pulse: "shadow-[0_0_0_8px_rgba(244,63,94,0.16)]",
  },
};

const STATUSES: AgentStatus[] = ["working", "idle", "meeting", "offline", "needs-help"];
const POLL_INTERVAL_MS = 30_000;
const ACTIVE_WINDOW_MS = 2 * 60_000;

const normalizeTimestamp = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return null;
};

const resolveAgentName = (agent: AgentListEntry): string => {
  const identityName = agent.identity?.name?.trim();
  if (identityName) return identityName;
  const listedName = agent.name?.trim();
  if (listedName) return listedName;
  return agent.id;
};

const inferOfficeStatus = (params: {
  statusText: string;
  isRunning: boolean;
  updatedAt: number | null;
  now: number;
}): AgentStatus => {
  const statusText = params.statusText;
  if (
    statusText.includes("approval") ||
    statusText.includes("needs_help") ||
    statusText.includes("needs-help") ||
    statusText.includes("awaiting_user_input") ||
    statusText.includes("blocked")
  ) {
    return "needs-help";
  }
  if (statusText.includes("meeting")) return "meeting";
  if (params.isRunning || statusText.includes("running") || statusText.includes("working")) {
    return "working";
  }
  if (typeof params.updatedAt === "number" && params.now - params.updatedAt <= ACTIVE_WINDOW_MS) {
    return "idle";
  }
  return "offline";
};

const GROUP_BY_FIELD: Record<GroupMode, keyof Pick<OfficeAgent, "team" | "project" | "timezone">> = {
  team: "team",
  project: "project",
  timezone: "timezone",
};

export default function DigitalOfficePage() {
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

  const [agents, setAgents] = useState<OfficeAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");
  const [groupBy, setGroupBy] = useState<GroupMode>("team");
  const [density, setDensity] = useState<DensityMode>("desk");
  const [focused, setFocused] = useState<OfficeAgent | null>(null);

  const fetchOffice = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    setLoadError(null);
    try {
      const [agentsResultRaw, statusSnapshotRaw] = await Promise.all([
        client.call("agents.list", {}),
        client.call("status", {}),
      ]);
      const agentsResult = agentsResultRaw as { agents?: AgentListEntry[]; mainKey?: string };
      const statusSnapshot = statusSnapshotRaw as StatusSnapshot;
      const listedAgents = Array.isArray(agentsResult.agents) ? agentsResult.agents : [];
      const mainKey = typeof agentsResult.mainKey === "string" ? agentsResult.mainKey.trim() : "main";
      const now = Date.now();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";

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

      const nextAgents = await Promise.all(
        listedAgents.map(async (agent): Promise<OfficeAgent> => {
          const agentId = agent.id.trim();
          const sessionKey = buildAgentMainSessionKey(agentId, mainKey);
          const sessionsResult = (await client.call("sessions.list", {
            agentId,
            includeGlobal: false,
            includeUnknown: false,
            search: sessionKey,
            limit: 5,
          })) as { sessions?: SessionListEntry[] };
          const sessions = Array.isArray(sessionsResult.sessions) ? sessionsResult.sessions : [];
          const mainSession = sessions.find((entry) => (entry.key?.trim() ?? "") === sessionKey) ?? null;
          const updatedAt = normalizeTimestamp(mainSession?.updatedAt) ?? updatedAtBySession.get(sessionKey) ?? null;
          const rawStatus =
            (statusSnapshot.agents ?? [])
              .find((entry) => entry.id?.trim() === agentId)
              ?.status?.trim()
              .toLowerCase() ?? "";
          const mappedStatus = inferOfficeStatus({
            statusText: rawStatus,
            isRunning: runningSessionKeys.has(sessionKey),
            updatedAt,
            now,
          });
          return {
            id: agentId,
            name: resolveAgentName(agent),
            role: "OpenClaw Agent",
            team: "Operations",
            project: mainSession?.modelProvider?.trim() || "General",
            timezone,
            status: mappedStatus,
            activeTask: mappedStatus === "offline" ? "No recent activity" : `Session: ${sessionKey}`,
            statusForMins:
              typeof updatedAt === "number" && updatedAt > 0
                ? Math.max(1, Math.floor((now - updatedAt) / 60_000))
                : 0,
          };
        })
      );

      nextAgents.sort((left, right) => left.name.localeCompare(right.name));
      setAgents(nextAgents);
    } catch (err) {
      setAgents([]);
      setLoadError(err instanceof Error ? err.message : "Failed to load digital office data.");
    } finally {
      setLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    void fetchOffice();
  }, [fetchOffice]);

  useEffect(() => {
    if (status !== "connected") return;
    const interval = setInterval(() => {
      void fetchOffice();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOffice, status]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return agents.filter((agent) => {
      if (statusFilter !== "all" && agent.status !== statusFilter) return false;
      if (!needle) return true;
      return [agent.name, agent.role, agent.team, agent.project, agent.activeTask].join(" ").toLowerCase().includes(needle);
    });
  }, [agents, query, statusFilter]);

  const grouped = useMemo(() => {
    const groups = new Map<string, OfficeAgent[]>();
    const field = GROUP_BY_FIELD[groupBy];
    for (const agent of filtered) {
      const key = String(agent[field]);
      const current = groups.get(key) ?? [];
      current.push(agent);
      groups.set(key, current);
    }
    return Array.from(groups.entries());
  }, [filtered, groupBy]);

  const counts = useMemo(() => {
    const map: Record<AgentStatus, number> = {
      working: 0,
      idle: 0,
      meeting: 0,
      offline: 0,
      "needs-help": 0,
    };
    for (const agent of agents) {
      map[agent.status] += 1;
    }
    return map;
  }, [agents]);

  useEffect(() => {
    if (!focused) {
      setFocused(filtered[0] ?? null);
      return;
    }
    const refreshed = filtered.find((entry) => entry.id === focused.id) ?? null;
    setFocused(refreshed ?? (filtered[0] ?? null));
  }, [filtered, focused]);

  const notConnected = status !== "connected";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="glass-panel fade-up ui-panel ui-topbar relative z-[180] px-3.5 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="ui-btn-ghost inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Studio
            </Link>
            <h1 className="console-title type-page-title text-foreground">Digital Office Dashboard</h1>
          </div>
          <div className="ui-chip px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.08em]">
            Scales 5 to 100+
          </div>
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
          <div className="mx-auto grid h-[calc(100vh-7.5rem)] max-w-[1580px] grid-cols-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          <aside className="glass-panel ui-panel ui-scroll min-h-0 overflow-auto p-3">
            <h2 className="type-secondary-heading">Controls</h2>
            <div className="mt-3 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agents, role, task..." className="ui-input h-10 w-full rounded-md pl-10 pr-3 text-sm" />
              </div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AgentStatus | "all")} className="ui-input h-10 w-full rounded-md px-3 text-sm">
                <option value="all">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_META[status].label}
                  </option>
                ))}
              </select>
              <select value={groupBy} onChange={(event) => setGroupBy(event.target.value as GroupMode)} className="ui-input h-10 w-full rounded-md px-3 text-sm">
                <option value="team">Group by Team</option>
                <option value="project">Group by Project</option>
                <option value="timezone">Group by Timezone</option>
              </select>
              <div className="ui-segment grid-cols-2 p-1">
                <button type="button" className="ui-segment-item px-2 py-1.5" data-active={density === "desk"} onClick={() => setDensity("desk")}>
                  Desk mode
                </button>
                <button type="button" className="ui-segment-item px-2 py-1.5" data-active={density === "grid"} onClick={() => setDensity("grid")}>
                  Grid mode
                </button>
              </div>
            </div>
            <h3 className="mt-6 type-secondary-heading">Status Overview</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {STATUSES.map((status) => (
                <div key={status} className={`ui-card rounded-md px-2.5 py-2 text-xs ${STATUS_META[status].badge}`}>
                  <div className="font-medium">{STATUS_META[status].label}</div>
                  <div className="mt-1 font-mono text-[11px]">{counts[status]}</div>
                </div>
              ))}
            </div>
            {loading ? <p className="mt-3 text-xs text-muted-foreground">Syncing live office view...</p> : null}
            {loadError ? <p className="mt-3 text-xs text-destructive">{loadError}</p> : null}
            <h3 className="mt-6 type-secondary-heading">User Flow</h3>
            <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>1. Scan status summary and alert counts.</li>
              <li>2. Filter/search the floor to isolate a team.</li>
              <li>3. Hover desks for quick health and workload.</li>
              <li>4. Click a desk for detail + actions panel.</li>
            </ol>
          </aside>

          <section className="glass-panel ui-panel ui-scroll min-h-0 overflow-auto p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="type-secondary-heading">Virtual Office Layout</h2>
              <div className="text-xs text-muted-foreground">{filtered.length} visible agents</div>
            </div>
            <div className="space-y-4">
              {grouped.map(([group, agents]) => (
                <article key={group} className="ui-card rounded-xl p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{group}</h3>
                    <span className="ui-chip px-2 py-1 text-[10px]">{agents.length}</span>
                  </div>
                  <div className={density === "desk" ? "grid gap-3 md:grid-cols-2 2xl:grid-cols-3" : "grid gap-2 md:grid-cols-3 xl:grid-cols-4"}>
                    {agents.map((agent) => {
                      const meta = STATUS_META[agent.status];
                      const Icon = meta.icon;
                      return (
                        <button
                          key={agent.id}
                          type="button"
                          className={`relative rounded-xl border p-3 text-left transition hover:bg-surface-2/60 ${density === "desk" ? "min-h-[164px]" : "min-h-[122px]"} ${focused?.id === agent.id ? "border-primary/60 bg-surface-2/70" : "border-border/60 bg-surface-1/60"}`}
                          onClick={() => setFocused(agent)}
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full ring-2 ${meta.ring}`}>
                                <Image
                                  src={buildAvatarDataUrl(agent.id)}
                                  alt={`${agent.name} avatar`}
                                  width={40}
                                  height={40}
                                  unoptimized
                                  className={`h-10 w-10 rounded-full object-cover ${agent.status === "offline" ? "opacity-45 grayscale" : ""}`}
                                />
                                {agent.status === "working" ? <span className={`absolute -bottom-1 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ${meta.pulse} animate-pulse`} /> : null}
                              </span>
                              <div>
                                <div className="text-sm font-semibold">{agent.name}</div>
                                <div className="text-[11px] text-muted-foreground">{agent.role}</div>
                              </div>
                            </div>
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium ${meta.badge}`}>
                              <Icon className="h-3 w-3" />
                              {meta.label}
                            </span>
                          </div>
                          <div className={`rounded-lg border border-border/55 px-2.5 py-2 ${agent.status === "working" ? "bg-emerald-500/10" : "bg-surface-2/55"}`}>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Workspace</span>
                              <span>{agent.timezone}</span>
                            </div>
                            <div className="mt-1 text-xs">{density === "desk" ? `Desk + computer + ${agent.project} environment` : agent.activeTask}</div>
                          </div>
                          <div className="mt-2 text-[11px] text-muted-foreground">Status for {agent.statusForMins} min</div>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
              {!loading && filtered.length === 0 ? (
                <div className="ui-card rounded-xl p-4 text-sm text-muted-foreground">
                  No agents match your current filters.
                </div>
              ) : null}
            </div>
          </section>

          <aside className="glass-panel ui-panel ui-scroll min-h-0 overflow-auto p-3">
            <h2 className="type-secondary-heading">Agent Detail</h2>
            {focused ? (
              <div className="mt-3 space-y-3">
                <div className="ui-card rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <Image
                      src={buildAvatarDataUrl(focused.id)}
                      alt={`${focused.name} avatar`}
                      width={56}
                      height={56}
                      unoptimized
                      className="h-14 w-14 rounded-full ring-2 ring-primary/55"
                    />
                    <div>
                      <div className="font-semibold">{focused.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {focused.role} · {focused.team}
                      </div>
                    </div>
                  </div>
                  <div className={`mt-3 inline-flex rounded-md px-2 py-1 text-xs ${STATUS_META[focused.status].badge}`}>
                    {STATUS_META[focused.status].label}
                  </div>
                </div>
                <div className="ui-card rounded-xl p-3 text-sm">
                  <div className="mb-1 text-xs text-muted-foreground">Current task</div>
                  <div>{focused.activeTask}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-surface-2/65 p-2">Project: {focused.project}</div>
                    <div className="rounded-md bg-surface-2/65 p-2">Timezone: {focused.timezone}</div>
                  </div>
                </div>
                <div className="ui-card rounded-xl p-3 text-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key Features</h3>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    <li>Distinct avatar + desk pod per agent</li>
                    <li>Motion cues for active work states</li>
                    <li>Color + icon + label status redundancy</li>
                    <li>Search, filters, grouping, clustering</li>
                  </ul>
                </div>
                <div className="ui-card rounded-xl p-3 text-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Future Enhancements</h3>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    <li>Predictive overload and SLA risk alerts</li>
                    <li>Timeline playback of team transitions</li>
                    <li>Scenario simulation for reassignment</li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Select an agent workspace to inspect details.</p>
            )}
          </aside>
        </div>
        )}
      </main>
    </div>
  );
}
