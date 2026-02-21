"use client";

import type {
  TaskBoardSnapshot,
  TaskBoardStatus,
  TaskBoardTask,
} from "@/lib/task-board/read-model";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { TaskColumn } from "./TaskColumn";

const COLUMNS: { key: TaskBoardStatus; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

const COLUMN_IDS = new Set<string>(COLUMNS.map((c) => c.key));

function isColumnId(id: string | number): id is TaskBoardStatus {
  return typeof id === "string" && COLUMN_IDS.has(id);
}

type TaskBoardProps = {
  snapshot: TaskBoardSnapshot;
  onTaskMove?: (taskId: string, newStatus: TaskBoardStatus) => void;
  onEditTask?: (task: TaskBoardTask) => void;
};

export function TaskBoard({ snapshot, onTaskMove, onEditTask }: TaskBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !onTaskMove) return;
    const taskId = String(active.id);
    const overId = typeof over.id === "string" ? over.id : String(over.id);
    if (isColumnId(overId)) {
      const task = snapshot.tasks.find((t) => t.id === taskId);
      if (task && task.status !== overId) {
        onTaskMove(taskId, overId);
      }
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
              onEditTask={onEditTask}
            />
          );
        })}
      </div>
    </DndContext>
  );
}
