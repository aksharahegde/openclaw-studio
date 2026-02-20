import { NextResponse } from "next/server";

import type { TaskBoardTask } from "@/lib/task-board/read-model";
import {
  createTaskFile,
  getVaultTaskDir,
  type TaskPayload,
} from "@/lib/task-board/vault-io";
import { loadStudioSettings } from "@/lib/studio/settings-store";

export const runtime = "nodejs";

function isTaskCreateBody(
  value: unknown
): value is { title: string; status?: string; assignee?: string } {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return typeof o.title === "string" && o.title.trim().length > 0;
}

export async function POST(request: Request) {
  try {
    const settings = loadStudioSettings();
    const vaultTaskDir = getVaultTaskDir(settings);
    if (!vaultTaskDir) {
      return NextResponse.json(
        { error: "Task board vault not configured." },
        { status: 400 }
      );
    }
    const body = (await request.json()) as unknown;
    if (!isTaskCreateBody(body)) {
      return NextResponse.json(
        { error: "Invalid payload: title (non-empty string) required." },
        { status: 400 }
      );
    }
    const payload: TaskPayload = {
      title: body.title.trim(),
      status: body.status as TaskPayload["status"],
      assignee: body.assignee,
    };
    const { id } = createTaskFile(vaultTaskDir, payload);
    const task: TaskBoardTask = {
      id,
      title: payload.title,
      status: payload.status ?? "todo",
      assignee: payload.assignee?.trim() ?? "me",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: null,
      body: "",
    };
    return NextResponse.json(task);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create task.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
