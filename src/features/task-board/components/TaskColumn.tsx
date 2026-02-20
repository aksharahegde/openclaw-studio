"use client";

import type { TaskBoardStatus, TaskBoardTask } from "@/lib/task-board/read-model";
import { TaskCard } from "./TaskCard";

type TaskColumnProps = {
  columnKey: TaskBoardStatus;
  label: string;
  tasks: TaskBoardTask[];
  "data-testid"?: string;
};

export function TaskColumn({
  columnKey,
  label,
  tasks,
  "data-testid": dataTestId,
}: TaskColumnProps) {
  return (
    <div
      className="glass-panel ui-panel flex min-w-[260px] max-w-[320px] flex-col rounded-lg border border-border/60 p-3"
      data-testid={dataTestId}
    >
      <h2 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h2>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
