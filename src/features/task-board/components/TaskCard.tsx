"use client";

import type { TaskBoardTask } from "@/lib/task-board/read-model";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Pencil } from "lucide-react";

type TaskCardProps = {
  task: TaskBoardTask;
  onEdit?: (task: TaskBoardTask) => void;
};

export function TaskCard({ task, onEdit }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  const assigneeLabel = task.assignee === "me" ? "me" : task.assignee;
  return (
    <div
      ref={setNodeRef}
      className={`flex items-start gap-2 rounded-md border border-border/50 bg-card/80 px-3 py-2 text-left ${isDragging ? "opacity-60 shadow-md" : ""}`}
      data-testid={`task-board-card-${task.id}`}
    >
      <button
        type="button"
        className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to move task"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{task.title}</p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {assigneeLabel}
        </p>
      </div>
      {onEdit ? (
        <button
          type="button"
          className="mt-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Edit task"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          data-testid="task-board-card-edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
