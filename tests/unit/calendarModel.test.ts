import { describe, expect, it } from "vitest";
import {
  getAlwaysRunningJobs,
  getOccurrencesInRange,
  getNextUp,
} from "@/features/calendar/calendar-model";
import type { CronJobSummary } from "@/lib/cron/types";

const baseJob = (): CronJobSummary => ({
  id: "job-1",
  name: "test job",
  enabled: true,
  updatedAtMs: 0,
  schedule: { kind: "every", everyMs: 60_000 },
  sessionTarget: "main",
  wakeMode: "next-heartbeat",
  payload: { kind: "systemEvent", text: "ping" },
  state: {},
});

describe("getAlwaysRunningJobs", () => {
  it("returns_only_jobs_with_schedule_kind_every", () => {
    const jobs: CronJobSummary[] = [
      { ...baseJob(), id: "a", schedule: { kind: "every", everyMs: 30_000 } },
      { ...baseJob(), id: "b", schedule: { kind: "at", at: "2025-01-01T09:00:00Z" } },
      { ...baseJob(), id: "c", schedule: { kind: "cron", expr: "0 9 * * *" } },
    ];
    const result = getAlwaysRunningJobs(jobs);
    expect(result.map((j) => j.id)).toEqual(["a"]);
  });

  it("returns_empty_when_no_every_jobs", () => {
    const jobs: CronJobSummary[] = [
      { ...baseJob(), schedule: { kind: "at", at: "2025-01-01T09:00:00Z" } },
    ];
    expect(getAlwaysRunningJobs(jobs)).toEqual([]);
  });
});

describe("getOccurrencesInRange", () => {
  it("expands_every_schedule_occurrences_in_range", () => {
    const start = new Date("2025-01-06T00:00:00Z").getTime();
    const end = new Date("2025-01-06T00:05:00Z").getTime();
    const jobs: CronJobSummary[] = [
      {
        ...baseJob(),
        id: "every-1m",
        schedule: { kind: "every", everyMs: 60_000 },
        state: { nextRunAtMs: new Date("2025-01-06T00:01:00Z").getTime() },
      },
    ];
    const occ = getOccurrencesInRange(jobs, start, end, 10);
    expect(occ.length).toBeGreaterThanOrEqual(1);
    expect(occ[0].jobName).toBe("test job");
    expect(occ[0].atMs).toBe(new Date("2025-01-06T00:01:00Z").getTime());
  });

  it("includes_at_schedule_once_when_in_range", () => {
    const start = new Date("2025-01-06T00:00:00Z").getTime();
    const end = new Date("2025-01-07T00:00:00Z").getTime();
    const atMs = new Date("2025-01-06T09:00:00Z").getTime();
    const jobs: CronJobSummary[] = [
      {
        ...baseJob(),
        id: "at-one",
        schedule: { kind: "at", at: "2025-01-06T09:00:00Z" },
        state: {},
      },
    ];
    const occ = getOccurrencesInRange(jobs, start, end);
    expect(occ).toHaveLength(1);
    expect(occ[0].atMs).toBe(atMs);
  });

  it("returns_sorted_by_atMs", () => {
    const start = new Date("2025-01-06T00:00:00Z").getTime();
    const end = new Date("2025-01-06T12:00:00Z").getTime();
    const jobs: CronJobSummary[] = [
      {
        ...baseJob(),
        id: "later",
        schedule: { kind: "at", at: "2025-01-06T10:00:00Z" },
        state: {},
      },
      {
        ...baseJob(),
        id: "earlier",
        schedule: { kind: "at", at: "2025-01-06T08:00:00Z" },
        state: {},
      },
    ];
    const occ = getOccurrencesInRange(jobs, start, end);
    expect(occ).toHaveLength(2);
    expect(occ[0].atMs).toBeLessThanOrEqual(occ[1].atMs);
  });
});

describe("getNextUp", () => {
  it("returns_next_run_per_job_sorted_by_time", () => {
    const afterMs = new Date("2025-01-06T00:00:00Z").getTime();
    const jobs: CronJobSummary[] = [
      {
        ...baseJob(),
        id: "first",
        state: { nextRunAtMs: new Date("2025-01-06T02:00:00Z").getTime() },
      },
      {
        ...baseJob(),
        id: "second",
        state: { nextRunAtMs: new Date("2025-01-06T01:00:00Z").getTime() },
      },
    ];
    const next = getNextUp(jobs, 5, afterMs);
    expect(next).toHaveLength(2);
    expect(next[0].jobId).toBe("second");
    expect(next[1].jobId).toBe("first");
  });

  it("limits_results_by_limit_param", () => {
    const afterMs = new Date("2025-01-06T00:00:00Z").getTime();
    const jobs: CronJobSummary[] = [
      { ...baseJob(), id: "a", state: { nextRunAtMs: afterMs + 1000 } },
      { ...baseJob(), id: "b", state: { nextRunAtMs: afterMs + 2000 } },
      { ...baseJob(), id: "c", state: { nextRunAtMs: afterMs + 3000 } },
    ];
    const next = getNextUp(jobs, 2, afterMs);
    expect(next).toHaveLength(2);
  });

  it("computes_next_for_every_when_nextRunAtMs_missing", () => {
    const afterMs = new Date("2025-01-06T00:00:00Z").getTime();
    const jobs: CronJobSummary[] = [
      {
        ...baseJob(),
        id: "every",
        schedule: { kind: "every", everyMs: 60_000 },
        state: { lastRunAtMs: afterMs - 30_000 },
      },
    ];
    const next = getNextUp(jobs, 5, afterMs);
    expect(next.length).toBeGreaterThanOrEqual(1);
    expect(next[0].atMs).toBeGreaterThanOrEqual(afterMs);
  });
});
