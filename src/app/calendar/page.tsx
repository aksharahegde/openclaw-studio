"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useGatewayConnection } from "@/lib/gateway/GatewayClient";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";
import { listCronJobs } from "@/lib/cron/types";
import type { CronJobSummary } from "@/lib/cron/types";
import { GatewayConnectScreen } from "@/features/agents/components/GatewayConnectScreen";
import { ScheduledTasksCalendar } from "@/features/calendar/components/ScheduledTasksCalendar";
import { ArrowLeft } from "lucide-react";

const POLL_INTERVAL_MS = 60_000;

export default function CalendarPage() {
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

  const [jobs, setJobs] = useState<CronJobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    setError(null);
    try {
      const result = await listCronJobs(client, { includeDisabled: true });
      setJobs(result.jobs);
    } catch (err) {
      setJobs([]);
      setError(err instanceof Error ? err.message : "Failed to load scheduled tasks.");
    } finally {
      setLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (status !== "connected") return;
    const interval = setInterval(fetchJobs, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, fetchJobs]);

  const notConnected = status !== "connected";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="glass-panel fade-up ui-panel ui-topbar relative z-[180] px-3.5 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              data-testid="calendar-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Studio
            </Link>
            <h1
              className="console-title type-page-title text-foreground"
              data-testid="calendar-scheduled-tasks-title"
            >
              Scheduled Tasks
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4">
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
        ) : loading && jobs.length === 0 ? (
          <p className="font-mono text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No scheduled tasks. Add cron jobs in an agent&apos;s Settings to see them here.
          </p>
        ) : (
          <ScheduledTasksCalendar jobs={jobs} />
        )}
      </main>
    </div>
  );
}
