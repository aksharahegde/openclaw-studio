"use client";

import type { TaskBoardSnapshot, TaskBoardStatus } from "@/lib/task-board/read-model";
import { TaskColumn } from "./TaskColumn";

const COLUMNS: { key: TaskBoardStatus; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

type TaskBoardProps = {
  snapshot: TaskBoardSnapshot;
};

export function TaskBoard({ snapshot }: TaskBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(({ key, label }) => {
        const tasks = snapshot.tasks.filter((t) => t.status === key);
        return (
          <TaskColumn
            key={key}
            columnKey={key}
            label={label}
            tasks={tasks}
            data-testid={`task-board-column-${key}`}
          />
        );
      })}
    </div>
  );
}
