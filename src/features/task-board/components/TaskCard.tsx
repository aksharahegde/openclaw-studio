"use client";

import type { TaskBoardTask } from "@/lib/task-board/read-model";

type TaskCardProps = {
  task: TaskBoardTask;
};

export function TaskCard({ task }: TaskCardProps) {
  const assigneeLabel = task.assignee === "me" ? "me" : task.assignee;
  return (
    <div
      className="rounded-md border border-border/50 bg-card/80 px-3 py-2 text-left"
      data-testid={`task-board-card-${task.id}`}
    >
      <p className="text-sm font-medium text-foreground">{task.title}</p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        {assigneeLabel}
      </p>
    </div>
  );
}
