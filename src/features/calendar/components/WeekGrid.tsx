import { useMemo } from "react";
import type { CronJobSummary } from "@/lib/cron/types";
import type { CalendarOccurrence } from "@/features/calendar/calendar-model";
import { getOccurrencesInRange } from "@/features/calendar/calendar-model";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekRange(anchor: Date): { startMs: number; endMs: number; days: { label: string; startMs: number; endMs: number }[] } {
  const start = new Date(anchor);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const days: { label: string; startMs: number; endMs: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(start);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    days.push({
      label: DAY_LABELS[i],
      startMs: dayStart.getTime(),
      endMs: dayEnd.getTime(),
    });
  }
  const endMs = days[6].endMs;
  return { startMs, endMs, days };
}

function getTodayRange(anchor: Date): { startMs: number; endMs: number; days: { label: string; startMs: number; endMs: number }[] } {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  const endMs = end.getTime();
  const label = DAY_LABELS[start.getDay()];
  return {
    startMs,
    endMs,
    days: [{ label, startMs, endMs }],
  };
}

function groupByDay(
  occurrences: CalendarOccurrence[],
  days: { startMs: number; endMs: number }[]
): Map<number, CalendarOccurrence[]> {
  const map = new Map<number, CalendarOccurrence[]>();
  for (const d of days) {
    map.set(d.startMs, []);
  }
  for (const occ of occurrences) {
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      if (occ.atMs >= d.startMs && occ.atMs <= d.endMs) {
        const list = map.get(d.startMs) ?? [];
        list.push(occ);
        map.set(d.startMs, list);
        break;
      }
    }
  }
  return map;
}

const accentByIndex = [
  "bg-primary/15 border-primary/30 text-foreground",
  "bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-300",
  "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300",
  "bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300",
  "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
];

function getBlockClass(index: number, enabled: boolean): string {
  const base = accentByIndex[index % accentByIndex.length] ?? "bg-muted border-border text-foreground";
  if (!enabled) return "bg-muted/50 border-border/50 text-muted-foreground opacity-70";
  return base;
}

type WeekGridProps = {
  jobs: CronJobSummary[];
  viewMode: "week" | "today";
  anchorDate: Date;
};

export function WeekGrid({ jobs, viewMode, anchorDate }: WeekGridProps) {
  const { days, startMs, endMs } = useMemo(
    () => (viewMode === "today" ? getTodayRange(anchorDate) : getWeekRange(anchorDate)),
    [viewMode, anchorDate]
  );

  const occurrences = useMemo(
    () => getOccurrencesInRange(jobs, startMs, endMs),
    [jobs, startMs, endMs]
  );

  const byDay = useMemo(() => groupByDay(occurrences, days), [occurrences, days]);

  const jobIndexMap = useMemo(() => {
    const seen = new Set<string>();
    const map = new Map<string, number>();
    let i = 0;
    for (const occ of occurrences) {
      if (!seen.has(occ.jobId)) {
        seen.add(occ.jobId);
        map.set(occ.jobId, i++);
      }
    }
    return map;
  }, [occurrences]);

  const dataTestId = viewMode === "week" ? "calendar-week-view" : "calendar-today-view";

  return (
    <section className="flex flex-col gap-3" data-testid={dataTestId}>
      <div
        className={`grid gap-2 ${viewMode === "week" ? "grid-cols-7" : "grid-cols-1"}`}
      >
        {days.map((day) => {
          const list = byDay.get(day.startMs) ?? [];
          return (
            <div
              key={day.startMs}
              className="ui-card flex min-h-[120px] flex-col gap-1.5 rounded-md border border-border/60 p-2"
            >
              <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {day.label}
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1">
                {list.map((occ) => (
                  <div
                    key={`${occ.jobId}-${occ.atMs}`}
                    className={`rounded border px-2 py-1 font-mono text-[11px] ${getBlockClass(
                      jobIndexMap.get(occ.jobId) ?? 0,
                      occ.enabled
                    )}`}
                  >
                    <div className="truncate font-medium">{occ.jobName}</div>
                    <div className="text-[10px] opacity-80">
                      {new Date(occ.atMs).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
