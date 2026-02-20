"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { GatewayConnectScreen } from "@/features/agents/components/GatewayConnectScreen";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";
import { buildAgentMainSessionKey, useGatewayConnection } from "@/lib/gateway/GatewayClient";

type AgentStatus = "working" | "idle" | "meeting" | "offline" | "needs-help";
type GroupMode = "all" | "status";

type OfficeAgent = {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  updatedAt: number | null;
  sessionKey: string;
};

type AgentListEntry = {
  id: string;
  name?: string;
  identity?: { name?: string };
};

type SessionListEntry = {
  key?: string;
  updatedAt?: number | null;
  modelProvider?: string | null;
};

type StatusSnapshot = {
  sessions?: {
    recent?: Array<{ key?: string; updatedAt?: number | null }>;
    byAgent?: Array<{ agentId?: string; recent?: Array<{ key?: string; updatedAt?: number | null }> }>;
  };
  runs?: {
    active?: Array<{ sessionKey?: string }>;
    byAgent?: Array<{ agentId?: string; active?: Array<{ sessionKey?: string }> }>;
  };
  agents?: Array<{ id?: string; status?: string }>;
};

const POLL_INTERVAL_MS = 30_000;
const ACTIVE_WINDOW_MS = 2 * 60_000;

const STATUS_COLORS: Record<AgentStatus, string> = {
  working: "#10b981",
  idle: "#f59e0b",
  meeting: "#3b82f6",
  offline: "#6b7280",
  "needs-help": "#f43f5e",
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  working: "Working",
  idle: "Idle",
  meeting: "In Meeting",
  offline: "Offline",
  "needs-help": "Needs Help",
};

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

const hashSeed = (text: string) => {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

function OfficeCanvas(props: {
  agents: OfficeAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { agents, selectedId, onSelect } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const host = hostRef.current;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;

    const render = (time: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      ctx.clearRect(0, 0, width, height);

      for (let y = 0; y < height; y += 56) {
        for (let x = 0; x < width; x += 56) {
          const dark = ((x / 56 + y / 56) | 0) % 2 === 0;
          ctx.fillStyle = dark ? "#151516" : "#231f20";
          ctx.fillRect(x, y, 56, 56);
        }
      }

      ctx.fillStyle = "#3d4b62";
      ctx.fillRect(0, 0, width, 90);
      ctx.fillStyle = "#5a6476";
      for (let i = 0; i < 10; i += 1) {
        ctx.fillRect(18 + i * (width / 10), 18, width / 14, 48);
      }

      const cols = Math.max(3, Math.min(8, Math.floor(width / 190)));
      const deskGapX = width / cols;
      const deskRows = 3;
      const deskGapY = (height - 170) / deskRows;
      const deskSlots: Array<{ x: number; y: number }> = [];
      for (let r = 0; r < deskRows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          deskSlots.push({ x: deskGapX * c + 26, y: 130 + r * deskGapY });
        }
      }

      for (const desk of deskSlots) {
        ctx.fillStyle = "#78716c";
        ctx.fillRect(desk.x, desk.y + 36, 98, 12);
        ctx.fillStyle = "#4b4541";
        ctx.fillRect(desk.x + 10, desk.y + 48, 8, 36);
        ctx.fillRect(desk.x + 80, desk.y + 48, 8, 36);
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(desk.x + 31, desk.y + 6, 36, 24);
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(desk.x + 44, desk.y + 30, 10, 8);
      }

      const tableX = width * 0.45;
      const tableY = height * 0.72;
      drawRoundedRect(ctx, tableX, tableY, 190, 95, 45);
      ctx.fillStyle = "#6b6765";
      ctx.fill();

      const meetingAgents = agents.filter((agent) => agent.status === "meeting");
      const nonMeeting = agents.filter((agent) => agent.status !== "meeting");
      const ordered = [...nonMeeting, ...meetingAgents];
      const usedPositions = new Map<string, { x: number; y: number }>();

      ordered.forEach((agent, index) => {
        let pos: { x: number; y: number };
        if (agent.status === "meeting") {
          const angle = (index * 0.9 + time / 4000) % (Math.PI * 2);
          pos = {
            x: tableX + 95 + Math.cos(angle) * 110,
            y: tableY + 45 + Math.sin(angle) * 56,
          };
        } else {
          const slot = deskSlots[index % Math.max(1, deskSlots.length)] ?? { x: 40, y: 150 };
          const jitter = hashSeed(agent.id) % 18;
          pos = { x: slot.x + 45 + jitter - 9, y: slot.y + 63 };
        }
        usedPositions.set(agent.id, pos);
      });
      positionsRef.current = usedPositions;

      for (const agent of ordered) {
        const pos = usedPositions.get(agent.id);
        if (!pos) continue;
        const statusColor = STATUS_COLORS[agent.status];
        const pulse = 0.35 + 0.65 * ((Math.sin(time / 260 + (hashSeed(agent.id) % 12)) + 1) / 2);
        const isSelected = selectedId === agent.id;

        if (agent.status === "working") {
          ctx.beginPath();
          ctx.fillStyle = `rgba(16,185,129,${0.08 + pulse * 0.18})`;
          ctx.arc(pos.x, pos.y - 14, 19 + pulse * 7, 0, Math.PI * 2);
          ctx.fill();
        }

        if (isSelected) {
          ctx.beginPath();
          ctx.strokeStyle = "#e5e7eb";
          ctx.lineWidth = 2;
          ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
          ctx.stroke();
        }

        drawRoundedRect(ctx, pos.x - 11, pos.y - 11, 22, 22, 6);
        ctx.fillStyle = statusColor;
        ctx.fill();

        if (agent.status === "idle") {
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.fillRect(pos.x - 8, pos.y - 6, 16, 4);
        }

        if (agent.status === "needs-help") {
          ctx.fillStyle = "#f9fafb";
          ctx.font = "bold 12px monospace";
          ctx.fillText("!", pos.x - 3, pos.y + 4);
        }

        ctx.fillStyle = statusColor;
        ctx.font = "600 14px var(--font-mono), monospace";
        ctx.fillText(agent.name, pos.x - 24, pos.y + 33);

        ctx.beginPath();
        ctx.fillStyle = statusColor;
        ctx.arc(pos.x + 14, pos.y - 14, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (hoverId) {
        const hovered = ordered.find((entry) => entry.id === hoverId);
        const pos = hoverId ? usedPositions.get(hoverId) : null;
        if (hovered && pos) {
          const text = `${hovered.name} • ${STATUS_LABELS[hovered.status]}`;
          ctx.font = "600 12px var(--font-mono), monospace";
          const textW = ctx.measureText(text).width + 16;
          const x = Math.min(width - textW - 8, Math.max(8, pos.x - textW / 2));
          const y = Math.max(8, pos.y - 58);
          drawRoundedRect(ctx, x, y, textW, 26, 8);
          ctx.fillStyle = "rgba(0,0,0,0.8)";
          ctx.fill();
          ctx.fillStyle = "#e5e7eb";
          ctx.fillText(text, x + 8, y + 17);
        }
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [agents, hoverId, selectedId]);

  const pickAgentFromPoint = useCallback(
    (x: number, y: number): string | null => {
      let best: { id: string; d: number } | null = null;
      for (const [id, pos] of positionsRef.current.entries()) {
        const d = Math.hypot(x - pos.x, y - pos.y);
        if (d > 20) continue;
        if (!best || d < best.d) best = { id, d };
      }
      return best?.id ?? null;
    },
    []
  );

  return (
    <div ref={hostRef} className="relative h-full min-h-[540px] overflow-hidden rounded-xl border border-border/60 bg-[#0f1013]">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const id = pickAgentFromPoint(event.clientX - rect.left, event.clientY - rect.top);
          setHoverId(id);
        }}
        onMouseLeave={() => setHoverId(null)}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const id = pickAgentFromPoint(event.clientX - rect.left, event.clientY - rect.top);
          if (id) onSelect(id);
        }}
      />
      <div className="pointer-events-none absolute right-3 top-3 flex gap-2 rounded-md bg-black/55 px-2 py-1 text-[11px] text-zinc-200">
        {(["working", "meeting", "idle", "offline", "needs-help"] as AgentStatus[]).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
            {STATUS_LABELS[status]}
          </span>
        ))}
      </div>
    </div>
  );
}

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
  const [groupMode, setGroupMode] = useState<GroupMode>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

      const updatedAtBySession = new Map<string, number>();
      for (const entry of statusSnapshot.sessions?.recent ?? []) {
        const key = entry?.key?.trim() ?? "";
        const updatedAt = normalizeTimestamp(entry?.updatedAt);
        if (!key || updatedAt === null) continue;
        updatedAtBySession.set(key, updatedAt);
      }
      for (const group of statusSnapshot.sessions?.byAgent ?? []) {
        for (const entry of group?.recent ?? []) {
          const key = entry?.key?.trim() ?? "";
          const updatedAt = normalizeTimestamp(entry?.updatedAt);
          if (!key || updatedAt === null) continue;
          const prev = updatedAtBySession.get(key) ?? 0;
          if (updatedAt > prev) updatedAtBySession.set(key, updatedAt);
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

      const next = await Promise.all(
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
            role: mainSession?.modelProvider?.trim() ? `${mainSession.modelProvider} agent` : "OpenClaw agent",
            status: mappedStatus,
            updatedAt,
            sessionKey,
          };
        })
      );

      next.sort((a, b) => a.name.localeCompare(b.name));
      setAgents(next);
    } catch (err) {
      setAgents([]);
      setLoadError(err instanceof Error ? err.message : "Failed to load office telemetry.");
    } finally {
      setLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    void fetchOffice();
  }, [fetchOffice]);

  useEffect(() => {
    if (status !== "connected") return;
    const timer = setInterval(() => {
      void fetchOffice();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchOffice, status]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return agents.filter((agent) => {
      if (statusFilter !== "all" && agent.status !== statusFilter) return false;
      if (!needle) return true;
      return [agent.name, agent.role, agent.sessionKey].join(" ").toLowerCase().includes(needle);
    });
  }, [agents, query, statusFilter]);

  const grouped = useMemo(() => {
    if (groupMode === "all") return [["All agents", filtered] as const];
    const map = new Map<string, OfficeAgent[]>();
    for (const agent of filtered) {
      const key = STATUS_LABELS[agent.status];
      const rows = map.get(key) ?? [];
      rows.push(agent);
      map.set(key, rows);
    }
    return Array.from(map.entries());
  }, [filtered, groupMode]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId && filtered.some((a) => a.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const selected = useMemo(() => filtered.find((agent) => agent.id === selectedId) ?? null, [filtered, selectedId]);
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
          <div className="mx-auto grid h-[calc(100vh-7.5rem)] max-w-[1600px] grid-cols-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
            <aside className="glass-panel ui-panel ui-scroll min-h-0 overflow-auto p-3">
              <h2 className="type-secondary-heading">Controls</h2>
              <div className="mt-3 space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by name, role, session"
                    className="ui-input h-10 w-full rounded-md pl-10 pr-3 text-sm"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as AgentStatus | "all")}
                  className="ui-input h-10 w-full rounded-md px-3 text-sm"
                >
                  <option value="all">All statuses</option>
                  {(Object.keys(STATUS_LABELS) as AgentStatus[]).map((status) => (
                    <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                  ))}
                </select>
                <select
                  value={groupMode}
                  onChange={(event) => setGroupMode(event.target.value as GroupMode)}
                  className="ui-input h-10 w-full rounded-md px-3 text-sm"
                >
                  <option value="all">Show all</option>
                  <option value="status">Group by status</option>
                </select>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                {loading ? "Syncing live OpenClaw office..." : `${filtered.length} visible agents`}
              </div>
              {loadError ? <p className="mt-2 text-xs text-destructive">{loadError}</p> : null}
            </aside>

            <section className="glass-panel ui-panel min-h-0 overflow-hidden p-3">
              <OfficeCanvas agents={filtered} selectedId={selectedId} onSelect={setSelectedId} />
            </section>

            <aside className="glass-panel ui-panel ui-scroll min-h-0 overflow-auto p-3">
              <h2 className="type-secondary-heading">Live Roster</h2>
              <div className="mt-3 space-y-3">
                {grouped.map(([label, rows]) => (
                  <div key={label} className="ui-card rounded-xl p-2.5">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</h3>
                      <span className="ui-chip px-2 py-1 text-[10px]">{rows.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {rows.map((agent) => (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => setSelectedId(agent.id)}
                          className={`w-full rounded-md px-2 py-2 text-left text-xs transition ${selectedId === agent.id ? "bg-surface-2" : "hover:bg-surface-2/70"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{agent.name}</span>
                            <span className="inline-flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[agent.status] }} />
                              <span className="text-[10px] text-muted-foreground">{STATUS_LABELS[agent.status]}</span>
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {selected ? (
                <div className="ui-card mt-3 rounded-xl p-3 text-xs">
                  <div className="font-semibold">{selected.name}</div>
                  <div className="mt-1 text-muted-foreground">{selected.role}</div>
                  <div className="mt-2">Session: <span className="font-mono">{selected.sessionKey}</span></div>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1" style={{ backgroundColor: `${STATUS_COLORS[selected.status]}22`, color: STATUS_COLORS[selected.status] }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[selected.status] }} />
                    {STATUS_LABELS[selected.status]}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
