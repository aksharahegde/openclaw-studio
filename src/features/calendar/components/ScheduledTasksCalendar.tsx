"use client";

import { useState, useMemo, useEffect } from "react";
import type { CronJobSummary } from "@/lib/cron/types";
import { AlwaysRunningSection } from "./AlwaysRunningSection";
import { WeekGrid } from "./WeekGrid";
import { NextUpList } from "./NextUpList";

const NEXT_UP_TICK_MS = 60_000;

type ScheduledTasksCalendarProps = {
  jobs: CronJobSummary[];
};

export function ScheduledTasksCalendar({ jobs }: ScheduledTasksCalendarProps) {
  const [viewMode, setViewMode] = useState<"week" | "today">("week");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const anchorDate = useMemo(() => new Date(), []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), NEXT_UP_TICK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">Your automated routines</p>

      <AlwaysRunningSection jobs={jobs} />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Calendar
          </h2>
          <div className="flex rounded-md border border-border/60 p-0.5">
            <button
              type="button"
              className={`rounded px-2.5 py-1 font-mono text-[11px] font-medium ${
                viewMode === "week"
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setViewMode("week")}
              data-testid="calendar-view-week"
            >
              Week
            </button>
            <button
              type="button"
              className={`rounded px-2.5 py-1 font-mono text-[11px] font-medium ${
                viewMode === "today"
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setViewMode("today")}
              data-testid="calendar-view-today"
            >
              Today
            </button>
          </div>
        </div>
        <WeekGrid jobs={jobs} viewMode={viewMode} anchorDate={anchorDate} />
      </section>

      <NextUpList jobs={jobs} nowMs={nowMs} />
    </div>
  );
}
