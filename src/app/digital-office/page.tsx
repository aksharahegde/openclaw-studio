"use client";

import { useMemo, useState } from "react";
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

const AGENTS: OfficeAgent[] = [
  { id: "a01", name: "Mira", role: "Planner", team: "Strategy", project: "Atlas", timezone: "PT", status: "working", activeTask: "Prioritizing backlog", statusForMins: 17 },
  { id: "a02", name: "Noah", role: "Builder", team: "Execution", project: "Atlas", timezone: "ET", status: "meeting", activeTask: "Daily sync", statusForMins: 8 },
  { id: "a03", name: "Ari", role: "Analyst", team: "Insights", project: "Nova", timezone: "CET", status: "idle", activeTask: "Awaiting assignment", statusForMins: 13 },
  { id: "a04", name: "Tess", role: "Researcher", team: "Insights", project: "Nova", timezone: "PT", status: "needs-help", activeTask: "Blocked on data source", statusForMins: 21 },
  { id: "a05", name: "Kian", role: "Operator", team: "Execution", project: "Helix", timezone: "ET", status: "working", activeTask: "Deploying patch", statusForMins: 25 },
  { id: "a06", name: "Leah", role: "Coordinator", team: "Strategy", project: "Helix", timezone: "GMT", status: "offline", activeTask: "Offline", statusForMins: 44 },
  { id: "a07", name: "Zara", role: "QA", team: "Execution", project: "Nova", timezone: "PT", status: "working", activeTask: "Regression pass", statusForMins: 5 },
  { id: "a08", name: "Jude", role: "Support", team: "Ops", project: "Atlas", timezone: "IST", status: "idle", activeTask: "Queue monitoring", statusForMins: 11 },
  { id: "a09", name: "Elio", role: "Designer", team: "Experience", project: "Helix", timezone: "ET", status: "meeting", activeTask: "Review session", statusForMins: 14 },
  { id: "a10", name: "Rae", role: "Manager", team: "Ops", project: "Atlas", timezone: "PT", status: "working", activeTask: "Escalation triage", statusForMins: 32 },
  { id: "a11", name: "Bea", role: "Writer", team: "Experience", project: "Nova", timezone: "GMT", status: "working", activeTask: "Drafting brief", statusForMins: 9 },
  { id: "a12", name: "Ivo", role: "DevRel", team: "Experience", project: "Helix", timezone: "CET", status: "offline", activeTask: "Offline", statusForMins: 78 },
];

const GROUP_BY_FIELD: Record<GroupMode, keyof Pick<OfficeAgent, "team" | "project" | "timezone">> = {
  team: "team",
  project: "project",
  timezone: "timezone",
};

export default function DigitalOfficePage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");
  const [groupBy, setGroupBy] = useState<GroupMode>("team");
  const [density, setDensity] = useState<DensityMode>("desk");
  const [focused, setFocused] = useState<OfficeAgent | null>(AGENTS[0] ?? null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return AGENTS.filter((agent) => {
      if (statusFilter !== "all" && agent.status !== statusFilter) return false;
      if (!needle) return true;
      return [agent.name, agent.role, agent.team, agent.project, agent.activeTask].join(" ").toLowerCase().includes(needle);
    });
  }, [query, statusFilter]);

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
    for (const agent of AGENTS) {
      map[agent.status] += 1;
    }
    return map;
  }, []);

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
      </main>
    </div>
  );
}
