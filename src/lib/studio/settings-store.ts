import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "@/lib/clawdbot/paths";
import {
  defaultStudioSettings,
  mergeStudioSettings,
  normalizeStudioSettings,
  type StudioSettings,
  type StudioSettingsPatch,
} from "@/lib/studio/settings";

const SETTINGS_DIRNAME = "openclaw-studio";
const SETTINGS_FILENAME = "settings.json";
const OPENCLAW_CONFIG_FILENAME = "openclaw.json";

export const resolveStudioSettingsPath = () =>
  path.join(resolveStateDir(), SETTINGS_DIRNAME, SETTINGS_FILENAME);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

const readOpenclawGatewayDefaults = (): { url: string; token: string } | null => {
  try {
    const configPath = path.join(resolveStateDir(), OPENCLAW_CONFIG_FILENAME);
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const gateway = isRecord(parsed.gateway) ? parsed.gateway : null;
    if (!gateway) return null;
    const auth = isRecord(gateway.auth) ? gateway.auth : null;
    const token = typeof auth?.token === "string" ? auth.token.trim() : "";
    const port = typeof gateway.port === "number" && Number.isFinite(gateway.port) ? gateway.port : null;
    if (!token) return null;
    const url = port ? `ws://localhost:${port}` : "";
    if (!url) return null;
    return { url, token };
  } catch {
    return null;
  }
};

export const loadLocalGatewayDefaults = () => {
  return readOpenclawGatewayDefaults();
};

const TASK_BOARD_VAULT_PATH_ENV = "OPENCLAW_TASK_BOARD_VAULT_PATH";

export const loadStudioSettings = (
  env: NodeJS.ProcessEnv = process.env
): StudioSettings => {
  const settingsPath = resolveStudioSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    const defaults = defaultStudioSettings();
    const gateway = loadLocalGatewayDefaults();
    const withGateway = gateway ? { ...defaults, gateway } : defaults;
    const vaultOverride = env[TASK_BOARD_VAULT_PATH_ENV]?.trim();
    return vaultOverride
      ? { ...withGateway, taskBoardVaultPath: vaultOverride }
      : withGateway;
  }
  const raw = fs.readFileSync(settingsPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const settings = normalizeStudioSettings(parsed);
  const vaultOverride = env[TASK_BOARD_VAULT_PATH_ENV]?.trim();
  const withVaultEnv = vaultOverride
    ? { ...settings, taskBoardVaultPath: vaultOverride }
    : settings;
  if (!withVaultEnv.gateway?.token) {
    const gateway = loadLocalGatewayDefaults();
    if (gateway) {
      return {
        ...withVaultEnv,
        gateway: withVaultEnv.gateway?.url?.trim()
          ? { url: withVaultEnv.gateway.url.trim(), token: gateway.token }
          : gateway,
      };
    }
  }
  return withVaultEnv;
};

export const saveStudioSettings = (next: StudioSettings) => {
  const settingsPath = resolveStudioSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), "utf8");
};

export const applyStudioSettingsPatch = (patch: StudioSettingsPatch): StudioSettings => {
  const current = loadStudioSettings();
  const next = mergeStudioSettings(current, patch);
  saveStudioSettings(next);
  return next;
};
