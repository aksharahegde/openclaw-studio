"use client";

import { useEffect, useState } from "react";
import type { TaskBoardStatus } from "@/lib/task-board/read-model";

const STATUSES: { value: TaskBoardStatus; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

export type TaskBoardCreatePayload = {
  title: string;
  status: TaskBoardStatus;
  assignee: string;
};

type TaskBoardCreateModalProps = {
  open: boolean;
  busy?: boolean;
  submitError?: string | null;
  onClose: () => void;
  onSubmit: (payload: TaskBoardCreatePayload) => Promise<void> | void;
};

const fieldClassName =
  "ui-input w-full rounded-md px-3 py-2 text-sm text-foreground outline-none";
const labelClassName =
  "font-mono text-[11px] font-semibold tracking-[0.05em] text-muted-foreground";

export function TaskBoardCreateModal({
  open,
  busy = false,
  submitError = null,
  onClose,
  onSubmit,
}: TaskBoardCreateModalProps) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskBoardStatus>("todo");
  const [assignee, setAssignee] = useState("me");

  useEffect(() => {
    if (open) {
      setTitle("");
      setStatus("todo");
      setAssignee("me");
    }
  }, [open]);

  const canSubmit = title.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit || busy) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    void onSubmit({
      title: trimmedTitle,
      status,
      assignee: assignee.trim() || "me",
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="New task"
      onClick={busy ? undefined : onClose}
    >
      <form
        className="glass-panel ui-panel w-full max-w-md rounded-lg border border-border/60 p-6 shadow-lg"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="task-board-create-modal"
      >
        <h2 className="mb-4 font-mono text-sm font-semibold tracking-[0.06em] text-foreground">
          New task
        </h2>
        <div className="flex flex-col gap-3">
          <label className={labelClassName}>
            Title
            <input
              className={fieldClassName}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              disabled={busy}
              autoFocus
            />
          </label>
          <label className={labelClassName}>
            Status
            <select
              className={fieldClassName}
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskBoardStatus)}
              disabled={busy}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClassName}>
            Assignee
            <input
              className={fieldClassName}
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="me or agent id"
              disabled={busy}
            />
          </label>
        </div>
        {submitError ? (
          <p className="mt-3 text-sm text-destructive">{submitError}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="ui-btn-ghost px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="ui-btn-secondary px-4 py-2 text-xs font-semibold disabled:opacity-60"
            disabled={!canSubmit || busy}
            data-testid="task-board-create-submit"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
