"use client";

import type { TaskBoardStatus, TaskBoardTask } from "@/lib/task-board/read-model";
import { useDroppable } from "@dnd-kit/core";
import { TaskCard } from "./TaskCard";

type TaskColumnProps = {
  columnKey: TaskBoardStatus;
  label: string;
  tasks: TaskBoardTask[];
  "data-testid"?: string;
  onEditTask?: (task: TaskBoardTask) => void;
};

export function TaskColumn({
  columnKey,
  label,
  tasks,
  "data-testid": dataTestId,
  onEditTask,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });

  return (
    <div
      ref={setNodeRef}
      className={`glass-panel ui-panel flex min-w-[260px] max-w-[320px] flex-col rounded-lg border p-3 ${isOver ? "border-primary/60 ring-1 ring-primary/20" : "border-border/60"}`}
      data-testid={dataTestId}
    >
      <h2 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h2>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEditTask}
          />
        ))}
      </div>
    </div>
  );
}
