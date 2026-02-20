import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveStateDir } from "@/lib/clawdbot/paths";

export const runtime = "nodejs";

type RequestAgent = { id?: string; name?: string };

type RequestBody = {
  agents?: RequestAgent[];
  filePath?: string;
  pattern?: string;
};

const isSafeAgentId = (value: string) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);

const resolveSafeRelativeDir = (input: string): string => {
  const trimmed = input.trim();
  const raw = trimmed.length > 0 ? trimmed : "memory";
  const normalized = path.posix.normalize(raw.replaceAll("\\", "/"));
  if (!normalized || normalized === ".") return "memory";
  if (normalized.startsWith("/")) throw new Error("filePath must be relative.");
  if (normalized.split("/").some((part) => part === "..")) {
    throw new Error("filePath cannot include '..'.");
  }
  return normalized;
};

const readFileSafe = (filePath: string): string => {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const agents = Array.isArray(body.agents) ? body.agents : [];
    const safeAgents = agents
      .map((agent) => {
        const id = typeof agent.id === "string" ? agent.id.trim() : "";
        if (!id || !isSafeAgentId(id)) return null;
        const name = typeof agent.name === "string" && agent.name.trim() ? agent.name.trim() : id;
        return { id, name };
      })
      .filter((value): value is { id: string; name: string } => Boolean(value));

    const filePath = resolveSafeRelativeDir(typeof body.filePath === "string" ? body.filePath : "memory");
    const patternRaw = typeof body.pattern === "string" && body.pattern.trim() ? body.pattern.trim() : "^\\d{4}-\\d{2}-\\d{2}\\.md$";
    let pattern: RegExp;
    try {
      pattern = new RegExp(patternRaw);
    } catch {
      return NextResponse.json({ error: "Invalid regex pattern." }, { status: 400 });
    }

    const stateDir = resolveStateDir();
    const docs: Array<{
      id: string;
      agentId: string;
      agentName: string;
      fileName: string;
      relativePath: string;
      content: string;
      wordCount: number;
    }> = [];

    for (const agent of safeAgents) {
      const agentRoot = path.join(stateDir, "agents", agent.id);
      const targetDir = path.join(agentRoot, filePath);
      if (!fs.existsSync(targetDir)) continue;
      if (!fs.statSync(targetDir).isDirectory()) continue;

      const fileNames = fs
        .readdirSync(targetDir)
        .filter((entry) => pattern.test(entry))
        .sort((left, right) => right.localeCompare(left));

      for (const fileName of fileNames) {
        const absolute = path.join(targetDir, fileName);
        if (!fs.existsSync(absolute)) continue;
        if (!fs.statSync(absolute).isFile()) continue;
        const content = readFileSafe(absolute).trim();
        docs.push({
          id: `${agent.id}:${filePath}/${fileName}`,
          agentId: agent.id,
          agentName: agent.name,
          fileName,
          relativePath: `${filePath}/${fileName}`,
          content,
          wordCount: content ? content.split(/\s+/).length : 0,
        });
      }
    }

    return NextResponse.json({ docs, filePath, pattern: patternRaw });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load memory files.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
