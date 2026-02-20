import { getNextUp } from "@/features/calendar/calendar-model";
import { formatRelativeTime } from "@/features/calendar/formatRelativeTime";
import type { CronJobSummary } from "@/lib/cron/types";

const NEXT_UP_LIMIT = 10;

const accentByIndex = [
  "text-foreground",
  "text-red-600 dark:text-red-400",
  "text-purple-600 dark:text-purple-400",
  "text-amber-600 dark:text-amber-400",
  "text-emerald-600 dark:text-emerald-400",
];

function getAccentClass(index: number): string {
  return accentByIndex[index % accentByIndex.length] ?? "text-foreground";
}

type NextUpListProps = {
  jobs: CronJobSummary[];
  nowMs: number;
};

export function NextUpList({ jobs, nowMs }: NextUpListProps) {
  const nextUp = getNextUp(jobs, NEXT_UP_LIMIT, nowMs);
  if (nextUp.length === 0) return null;

  return (
    <section
      className="flex flex-col gap-2"
      data-testid="calendar-next-up"
    >
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Next Up
      </h2>
      <ul className="flex flex-col gap-1.5">
        {nextUp.map((item, i) => (
          <li
            key={`${item.jobId}-${item.atMs}`}
            className="ui-card flex items-center justify-between px-3 py-2 text-sm"
            data-testid={`calendar-next-up-row-${item.jobId}`}
          >
            <span className={getAccentClass(i)}>{item.jobName}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatRelativeTime(item.atMs, nowMs)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
