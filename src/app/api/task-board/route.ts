import { NextResponse } from "next/server";

import { buildTaskBoardSnapshot } from "@/lib/task-board/read-model";
import {
  getVaultTaskDir,
  listTaskFiles,
  readTaskFile,
} from "@/lib/task-board/vault-io";
import { loadStudioSettings } from "@/lib/studio/settings-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = loadStudioSettings();
    const vaultTaskDir = getVaultTaskDir(settings);
    if (!vaultTaskDir) {
      return NextResponse.json(
        { error: "Task board vault not configured." },
        { status: 400 }
      );
    }
    const filenames = listTaskFiles(vaultTaskDir);
    const parsedTasks = filenames
      .map((name) => readTaskFile(vaultTaskDir, name))
      .filter((t): t is NonNullable<typeof t> => t !== null);
    const snapshot = buildTaskBoardSnapshot(parsedTasks, {
      scopePath: vaultTaskDir,
    });
    return NextResponse.json({ snapshot });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load task board.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
