import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveAgentWorkspaceDir } from "./agentWorkspace";

export const resolveHomePath = (inputPath: string) => {
  if (inputPath === "~") {
    return os.homedir();
  }
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
};

export const resolveClawdbotStateDir = () => {
  const stateDirRaw = process.env.CLAWDBOT_STATE_DIR ?? "~/.clawdbot";
  return resolveHomePath(stateDirRaw);
};

export const resolveAgentStateDir = (agentId: string) => {
  return path.join(resolveClawdbotStateDir(), "agents", agentId);
};

export const deleteDirIfExists = (targetPath: string, label: string, warnings: string[]) => {
  if (!fs.existsSync(targetPath)) {
    warnings.push(`${label} not found at ${targetPath}.`);
    return;
  }
  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    throw new Error(`${label} path is not a directory: ${targetPath}`);
  }
  fs.rmSync(targetPath, { recursive: true, force: false });
};

export const deleteAgentArtifacts = (projectId: string, agentId: string, warnings: string[]) => {
  const workspaceDir = resolveAgentWorkspaceDir(projectId, agentId);
  deleteDirIfExists(workspaceDir, "Agent workspace", warnings);

  const agentDir = resolveAgentStateDir(agentId);
  deleteDirIfExists(agentDir, "Agent state", warnings);
};
