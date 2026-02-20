import type { CronJobSummary } from "@/lib/cron/types";
import { formatCronSchedule } from "@/lib/cron/types";
import { getAlwaysRunningJobs } from "@/features/calendar/calendar-model";

type AlwaysRunningSectionProps = {
  jobs: CronJobSummary[];
};

export function AlwaysRunningSection({ jobs }: AlwaysRunningSectionProps) {
  const alwaysRunning = getAlwaysRunningJobs(jobs);
  if (alwaysRunning.length === 0) return null;

  return (
    <section
      className="flex flex-col gap-2"
      data-testid="calendar-always-running"
    >
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Always Running
      </h2>
      <div className="flex flex-wrap gap-2">
        {alwaysRunning.map((job) => (
          <div
            key={job.id}
            className={`ui-card inline-flex items-center gap-2 px-3 py-2 text-sm ${
              job.enabled ? "bg-primary/10 text-foreground" : "bg-muted/50 text-muted-foreground opacity-70"
            }`}
            data-testid={`calendar-always-running-row-${job.id}`}
          >
            <span className="font-medium">{job.name}</span>
            <span className="text-muted-foreground">•</span>
            <span className="font-mono text-xs">{formatCronSchedule(job.schedule)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
