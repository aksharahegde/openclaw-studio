import type { CronJobSummary } from "@/lib/cron/types";
import { CronExpressionParser } from "cron-parser";

export type CalendarOccurrence = {
  jobId: string;
  jobName: string;
  agentId?: string;
  atMs: number;
  enabled: boolean;
};

export type NextUpItem = {
  jobId: string;
  jobName: string;
  agentId?: string;
  atMs: number;
  enabled: boolean;
};

export function getAlwaysRunningJobs(jobs: CronJobSummary[]): CronJobSummary[] {
  return jobs.filter((j) => j.schedule.kind === "every");
}

function getNextRunMs(job: CronJobSummary, afterMs: number): number | null {
  const { schedule, state } = job;
  if (schedule.kind === "every") {
    const next = state.nextRunAtMs;
    if (typeof next === "number" && Number.isFinite(next) && next >= afterMs) return next;
    const last = state.lastRunAtMs;
    const anchor = typeof last === "number" && Number.isFinite(last) ? last : afterMs;
    const step = schedule.everyMs;
    if (step <= 0) return null;
    let t = anchor;
    while (t <= afterMs) t += step;
    return t;
  }
  if (schedule.kind === "at") {
    const atMs = new Date(schedule.at).getTime();
    return Number.isFinite(atMs) && atMs >= afterMs ? atMs : null;
  }
  if (schedule.kind === "cron") {
    if (typeof state.nextRunAtMs === "number" && Number.isFinite(state.nextRunAtMs) && state.nextRunAtMs >= afterMs) {
      return state.nextRunAtMs;
    }
    try {
      const options: { currentDate: number; tz?: string } = { currentDate: afterMs };
      if (schedule.tz) options.tz = schedule.tz;
      const expr = CronExpressionParser.parse(normalizeCronExpr(schedule.expr), options);
      const next = expr.next();
      return next.getTime();
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeCronExpr(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length === 5) return `0 ${expr.trim()}`;
  return expr.trim();
}

function getOccurrencesForJob(
  job: CronJobSummary,
  startMs: number,
  endMs: number,
  maxPerJob: number
): CalendarOccurrence[] {
  const out: CalendarOccurrence[] = [];
  const { schedule, state } = job;

  if (schedule.kind === "every") {
    let nextMs: number | null =
      typeof state.nextRunAtMs === "number" && Number.isFinite(state.nextRunAtMs)
        ? state.nextRunAtMs
        : null;
    if (typeof nextMs !== "number" || !Number.isFinite(nextMs)) {
      const last = state.lastRunAtMs;
      nextMs = typeof last === "number" && Number.isFinite(last) ? last + schedule.everyMs : startMs;
    }
    if (nextMs < startMs) {
      const step = schedule.everyMs;
      if (step > 0) while (nextMs < startMs) nextMs += step;
    }
    while (nextMs <= endMs && out.length < maxPerJob) {
      out.push({
        jobId: job.id,
        jobName: job.name,
        agentId: job.agentId,
        atMs: nextMs,
        enabled: job.enabled,
      });
      nextMs += schedule.everyMs;
    }
    return out;
  }

  if (schedule.kind === "at") {
    const atMs = new Date(schedule.at).getTime();
    if (Number.isFinite(atMs) && atMs >= startMs && atMs <= endMs) {
      out.push({
        jobId: job.id,
        jobName: job.name,
        agentId: job.agentId,
        atMs,
        enabled: job.enabled,
      });
    }
    return out;
  }

  if (schedule.kind === "cron") {
    try {
      const options: { currentDate: number; endDate: number; tz?: string } = {
        currentDate: startMs,
        endDate: endMs,
      };
      if (schedule.tz) options.tz = schedule.tz;
      const expr = CronExpressionParser.parse(normalizeCronExpr(schedule.expr), options);
      const dates = expr.take(maxPerJob);
      for (const d of dates) {
        const t = d.getTime();
        if (t > endMs) break;
        out.push({
          jobId: job.id,
          jobName: job.name,
          agentId: job.agentId,
          atMs: t,
          enabled: job.enabled,
        });
      }
    } catch {
      const next = getNextRunMs(job, startMs);
      if (next !== null && next <= endMs) {
        out.push({
          jobId: job.id,
          jobName: job.name,
          agentId: job.agentId,
          atMs: next,
          enabled: job.enabled,
        });
      }
    }
    return out;
  }

  return out;
}

export function getOccurrencesInRange(
  jobs: CronJobSummary[],
  startMs: number,
  endMs: number,
  maxPerJob = 50
): CalendarOccurrence[] {
  const out: CalendarOccurrence[] = [];
  for (const job of jobs) {
    out.push(...getOccurrencesForJob(job, startMs, endMs, maxPerJob));
  }
  return out.sort((a, b) => a.atMs - b.atMs);
}

const DEFAULT_NEXT_UP_LIMIT = 10;

export function getNextUp(
  jobs: CronJobSummary[],
  limit: number = DEFAULT_NEXT_UP_LIMIT,
  afterMs: number = Date.now()
): NextUpItem[] {
  const items: NextUpItem[] = [];
  for (const job of jobs) {
    const atMs = getNextRunMs(job, afterMs);
    if (atMs !== null) {
      items.push({
        jobId: job.id,
        jobName: job.name,
        agentId: job.agentId,
        atMs,
        enabled: job.enabled,
      });
    }
  }
  items.sort((a, b) => a.atMs - b.atMs);
  return items.slice(0, limit);
}
