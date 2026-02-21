import { NextResponse } from "next/server";

import type { TaskBoardStatus, TaskBoardTask } from "@/lib/task-board/read-model";
import {
  deleteTaskFile,
  findTaskFileById,
  getVaultTaskDir,
  writeTaskFile,
} from "@/lib/task-board/vault-io";
import { loadStudioSettings } from "@/lib/studio/settings-store";

export const runtime = "nodejs";

const VALID_STATUSES: TaskBoardStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "done",
];

function coerceStatus(value: unknown): TaskBoardStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (VALID_STATUSES.includes(normalized as TaskBoardStatus)) {
    return normalized as TaskBoardStatus;
  }
  return null;
}

function isTaskPatchBody(
  value: unknown
): value is { title?: string; status?: string; assignee?: string } {
  if (!value || typeof value !== "object") return false;
  return true;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const settings = loadStudioSettings();
    const vaultTaskDir = getVaultTaskDir(settings);
    if (!vaultTaskDir) {
      return NextResponse.json(
        { error: "Task board vault not configured." },
        { status: 400 }
      );
    }
    const { id } = await context.params;
    const found = findTaskFileById(vaultTaskDir, id);
    if (!found) {
      return NextResponse.json(
        { error: `Task not found: ${id}` },
        { status: 404 }
      );
    }
    const body = (await request.json()) as unknown;
    if (!isTaskPatchBody(body)) {
      return NextResponse.json(
        { error: "Invalid payload." },
        { status: 400 }
      );
    }
    const { task } = found;
    if (body.title !== undefined) task.title = body.title.trim() || task.title;
    if (body.assignee !== undefined)
      task.assignee = body.assignee.trim() || "me";
    const status = coerceStatus(body.status);
    if (status !== null) task.status = status;
    task.updatedAt = new Date().toISOString();
    writeTaskFile(vaultTaskDir, found.filename, task);
    const out: TaskBoardTask = {
      id: task.id,
      title: task.title,
      status: task.status,
      assignee: task.assignee,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      description: task.description,
      body: task.body,
    };
    return NextResponse.json(out);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update task.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const settings = loadStudioSettings();
    const vaultTaskDir = getVaultTaskDir(settings);
    if (!vaultTaskDir) {
      return NextResponse.json(
        { error: "Task board vault not configured." },
        { status: 400 }
      );
    }
    const { id } = await context.params;
    const found = findTaskFileById(vaultTaskDir, id);
    if (!found) {
      return NextResponse.json(
        { error: `Task not found: ${id}` },
        { status: 404 }
      );
    }
    deleteTaskFile(vaultTaskDir, found.filename);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete task.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
