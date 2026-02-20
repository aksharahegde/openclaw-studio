"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/http";
import type { TaskBoardSnapshot } from "@/lib/task-board/read-model";
import { TaskBoard as TaskBoardView } from "@/features/task-board/components/TaskBoard";
import type { StudioSettings } from "@/lib/studio/settings";
import { ArrowLeft } from "lucide-react";

const POLL_INTERVAL_MS = 8000;

type TaskBoardApiResponse =
  | { snapshot: TaskBoardSnapshot }
  | { error: string };

export default function TaskBoardPage() {
  const [response, setResponse] = useState<TaskBoardApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [vaultPathDraft, setVaultPathDraft] = useState("");
  const [savingVault, setSavingVault] = useState(false);
  const [vaultSaveError, setVaultSaveError] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    try {
      const data = await fetchJson<TaskBoardApiResponse>("/api/task-board", {
        cache: "no-store",
      });
      setResponse(data);
    } catch (err) {
      setResponse({
        error: err instanceof Error ? err.message : "Failed to load task board.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBoard();
    const interval = setInterval(fetchBoard, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchBoard]);

  const isVaultNotConfigured =
    response &&
    "error" in response &&
    response.error.includes("vault not configured");

  const loadSettingsForVaultInput = useCallback(async () => {
    try {
      const envelope = await fetchJson<{ settings: StudioSettings }>("/api/studio", {
        cache: "no-store",
      });
      setVaultPathDraft(envelope.settings?.taskBoardVaultPath ?? "");
    } catch {
      setVaultPathDraft("");
    }
  }, []);

  useEffect(() => {
    if (isVaultNotConfigured) {
      void loadSettingsForVaultInput();
    }
  }, [isVaultNotConfigured, loadSettingsForVaultInput]);

  const saveVaultPath = useCallback(async () => {
    setVaultSaveError(null);
    setSavingVault(true);
    try {
      await fetchJson<{ settings: unknown }>("/api/studio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskBoardVaultPath: vaultPathDraft.trim() || null,
        }),
      });
      await fetchBoard();
    } catch (err) {
      setVaultSaveError(
        err instanceof Error ? err.message : "Failed to save vault path."
      );
    } finally {
      setSavingVault(false);
    }
  }, [vaultPathDraft, fetchBoard]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="glass-panel fade-up ui-panel ui-topbar relative z-[180] px-3.5 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              data-testid="task-board-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Studio
            </Link>
            <h1 className="console-title type-page-title text-foreground">
              Task board
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4">
        {loading ? (
          <p className="font-mono text-sm text-muted-foreground">
            Loading…
          </p>
        ) : isVaultNotConfigured ? (
          <div
            className="glass-panel ui-panel max-w-md rounded-lg border border-border/60 p-6"
            data-testid="task-board-configure-vault"
          >
            <p className="mb-3 text-sm text-muted-foreground">
              Set the path to your Obsidian vault (e.g. ~/Documents/MyVault).
              Tasks are stored in a <code className="rounded bg-muted px-1">TaskBoard/</code> folder
              as markdown files with frontmatter.
            </p>
            <label className="mb-2 flex flex-col gap-1 font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
              Vault path
              <input
                className="ui-input h-10 rounded-md px-4 font-sans text-sm text-foreground"
                type="text"
                value={vaultPathDraft}
                onChange={(e) => setVaultPathDraft(e.target.value)}
                placeholder="~/Documents/ObsidianVault"
              />
            </label>
            {vaultSaveError ? (
              <p className="mb-2 text-sm text-destructive">{vaultSaveError}</p>
            ) : null}
            <button
              type="button"
              className="ui-btn-secondary px-4 py-2 text-xs font-semibold disabled:opacity-60"
              onClick={saveVaultPath}
              disabled={savingVault}
              data-testid="task-board-vault-save"
            >
              {savingVault ? "Saving…" : "Save"}
            </button>
          </div>
        ) : response && "error" in response ? (
          <p className="text-sm text-destructive">{response.error}</p>
        ) : response && "snapshot" in response ? (
          <div>
            <div className="mb-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className="ui-btn-ghost px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => void fetchBoard()}
                data-testid="task-board-refresh"
              >
                Refresh
              </button>
            </div>
            {response.snapshot.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tasks yet. Add markdown files in your vault&apos;s{" "}
                <code className="rounded bg-muted px-1">TaskBoard/</code> folder
                with frontmatter: title, status (todo | in_progress | blocked |
                done), assignee (e.g. &quot;me&quot; or agent id).
              </p>
            ) : (
              <TaskBoardView snapshot={response.snapshot} />
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
