import fs from "node:fs";
import path from "node:path";

import { resolveUserPath } from "@/lib/clawdbot/paths";
import type { StudioSettings } from "@/lib/studio/settings";
import matter from "gray-matter";
import type { ParsedTaskFile, TaskBoardStatus } from "./read-model";
import { parseTaskFromFrontmatter } from "./read-model";

const TASK_BOARD_DIRNAME = "TaskBoard";

export function getVaultTaskDir(settings: StudioSettings): string | null {
  const raw = settings.taskBoardVaultPath;
  if (!raw || typeof raw !== "string" || !raw.trim()) return null;
  const resolved = resolveUserPath(raw.trim());
  return path.join(resolved, TASK_BOARD_DIRNAME);
}

export function listTaskFiles(vaultTaskDir: string): string[] {
  if (!fs.existsSync(vaultTaskDir)) return [];
  const entries = fs.readdirSync(vaultTaskDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name);
}

export function readTaskFile(
  vaultTaskDir: string,
  filename: string
): ParsedTaskFile | null {
  const filePath = path.join(vaultTaskDir, filename);
  if (!fs.existsSync(filePath)) return null;
  const stem = path.basename(filename, ".md");
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const dataRecord =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  return parseTaskFromFrontmatter(stem, dataRecord, content ?? "");
}

export type TaskPayload = {
  title: string;
  status?: TaskBoardStatus;
  assignee?: string;
  description?: string;
  body?: string;
};

function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "task";
}

function safeFilename(base: string): string {
  const safe = base.replace(/[<>:"/\\|?*]/g, "-").replace(/-+/g, "-");
  return safe || "task";
}

export function writeTaskFile(
  vaultTaskDir: string,
  filename: string,
  task: ParsedTaskFile
): void {
  const frontmatter: Record<string, unknown> = {
    id: task.id,
    title: task.title,
    status: task.status,
    assignee: task.assignee,
  };
  if (task.createdAt) frontmatter.createdAt = task.createdAt;
  if (task.updatedAt) frontmatter.updatedAt = task.updatedAt;
  if (task.description) frontmatter.description = task.description;
  const now = new Date().toISOString();
  if (!frontmatter.updatedAt) frontmatter.updatedAt = now;
  const content = matter.stringify(task.body, frontmatter);
  const filePath = path.join(vaultTaskDir, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, "utf8");
}

export function createTaskFile(
  vaultTaskDir: string,
  payload: TaskPayload
): { id: string; filename: string } {
  const title = payload.title?.trim() || "Untitled";
  const baseSlug = slugify(title);
  let filename = `${safeFilename(baseSlug)}.md`;
  let counter = 0;
  const fullDir = vaultTaskDir;
  if (!fs.existsSync(fullDir)) {
    fs.mkdirSync(fullDir, { recursive: true });
  }
  while (fs.existsSync(path.join(fullDir, filename))) {
    counter += 1;
    filename = `${safeFilename(baseSlug)}-${counter}.md`;
  }
  const stem = path.basename(filename, ".md");
  const now = new Date().toISOString();
  const task: ParsedTaskFile = {
    id: stem,
    title,
    status: payload.status ?? "todo",
    assignee: payload.assignee?.trim() || "me",
    createdAt: now,
    updatedAt: now,
    description: payload.description?.trim() ?? null,
    body: payload.body?.trim() ?? "",
  };
  writeTaskFile(vaultTaskDir, filename, task);
  return { id: task.id, filename };
}

export function findTaskFileById(
  vaultTaskDir: string,
  id: string
): { filename: string; task: ParsedTaskFile } | null {
  const files = listTaskFiles(vaultTaskDir);
  for (const filename of files) {
    const task = readTaskFile(vaultTaskDir, filename);
    if (!task) continue;
    const stem = path.basename(filename, ".md");
    if (stem === id || task.id === id) {
      return { filename, task };
    }
  }
  return null;
}
