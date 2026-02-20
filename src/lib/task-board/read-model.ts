export type TaskBoardStatus = "todo" | "in_progress" | "blocked" | "done";

const VALID_STATUSES: TaskBoardStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "done",
];

export type TaskBoardTask = {
  id: string;
  title: string;
  status: TaskBoardStatus;
  assignee: string;
  createdAt: string | null;
  updatedAt: string | null;
  description: string | null;
  body: string;
};

export type TaskBoardSnapshot = {
  tasks: TaskBoardTask[];
  generatedAt: string;
  scopePath: string | null;
  warnings: string[];
};

function coerceStatus(value: unknown): TaskBoardStatus {
  if (typeof value !== "string") return "todo";
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (VALID_STATUSES.includes(normalized as TaskBoardStatus)) {
    return normalized as TaskBoardStatus;
  }
  return "todo";
}

function coerceString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function coerceOptionalString(value: unknown): string | null {
  const s = coerceString(value);
  return s || null;
}

export type ParsedTaskFile = {
  id: string;
  title: string;
  status: TaskBoardStatus;
  assignee: string;
  createdAt: string | null;
  updatedAt: string | null;
  description: string | null;
  body: string;
};

export function buildTaskBoardSnapshot(
  parsedTasks: ParsedTaskFile[],
  options: { scopePath?: string | null }
): TaskBoardSnapshot {
  const tasks: TaskBoardTask[] = parsedTasks.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    assignee: p.assignee || "me",
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    description: p.description,
    body: p.body,
  }));
  return {
    tasks,
    generatedAt: new Date().toISOString(),
    scopePath: options.scopePath ?? null,
    warnings: [],
  };
}

export function parseTaskFromFrontmatter(
  filenameStem: string,
  data: Record<string, unknown>,
  body: string
): ParsedTaskFile {
  const id = coerceOptionalString(data.id) ?? filenameStem;
  const title = coerceString(data.title) || filenameStem.replace(/-/g, " ");
  const status = coerceStatus(data.status);
  const assignee = coerceString(data.assignee) || "me";
  const createdAt = coerceOptionalString(data.createdAt);
  const updatedAt = coerceOptionalString(data.updatedAt);
  const description = coerceOptionalString(data.description);
  return {
    id,
    title,
    status,
    assignee,
    createdAt,
    updatedAt,
    description,
    body: body ?? "",
  };
}
