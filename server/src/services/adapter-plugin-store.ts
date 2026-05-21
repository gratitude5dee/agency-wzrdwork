import fs from "node:fs";
import path from "node:path";
import { resolvePaperclipHomeDir } from "../home-paths.js";

export interface AdapterPluginRecord {
  packageName: string;
  localPath?: string;
  version?: string;
  type: string;
  installedAt: string;
  disabled?: boolean;
}

interface AdapterSettings {
  disabledTypes: string[];
}

function adapterPluginPaths() {
  const paperclipDir = resolvePaperclipHomeDir();
  return {
    adapterPluginsDir: path.join(paperclipDir, "adapter-plugins"),
    adapterPluginsStorePath: path.join(paperclipDir, "adapter-plugins.json"),
    adapterSettingsPath: path.join(paperclipDir, "adapter-settings.json"),
  };
}

let storeCache: { path: string; records: AdapterPluginRecord[] } | null = null;
let settingsCache: { path: string; settings: AdapterSettings } | null = null;

function ensureDirs(): string {
  const { adapterPluginsDir } = adapterPluginPaths();
  fs.mkdirSync(adapterPluginsDir, { recursive: true });
  const pkgJsonPath = path.join(adapterPluginsDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    fs.writeFileSync(
      pkgJsonPath,
      JSON.stringify({
        name: "paperclip-adapter-plugins",
        version: "0.0.0",
        private: true,
        description: "Managed directory for Paperclip external adapter plugins. Do not edit manually.",
      }, null, 2) + "\n",
      "utf-8",
    );
  }
  return adapterPluginsDir;
}

function readStore(): AdapterPluginRecord[] {
  const { adapterPluginsStorePath } = adapterPluginPaths();
  if (storeCache?.path === adapterPluginsStorePath) return storeCache.records;
  try {
    const raw = fs.readFileSync(adapterPluginsStorePath, "utf-8");
    const parsed = JSON.parse(raw);
    storeCache = {
      path: adapterPluginsStorePath,
      records: Array.isArray(parsed) ? (parsed as AdapterPluginRecord[]) : [],
    };
  } catch {
    storeCache = { path: adapterPluginsStorePath, records: [] };
  }
  return storeCache.records;
}

function writeStore(records: AdapterPluginRecord[]): void {
  ensureDirs();
  const { adapterPluginsStorePath } = adapterPluginPaths();
  fs.writeFileSync(adapterPluginsStorePath, JSON.stringify(records, null, 2), "utf-8");
  storeCache = { path: adapterPluginsStorePath, records };
}

function readSettings(): AdapterSettings {
  const { adapterSettingsPath } = adapterPluginPaths();
  if (settingsCache?.path === adapterSettingsPath) return settingsCache.settings;
  try {
    const raw = fs.readFileSync(adapterSettingsPath, "utf-8");
    const parsed = JSON.parse(raw);
    settingsCache = {
      path: adapterSettingsPath,
      settings: parsed && Array.isArray(parsed.disabledTypes)
        ? (parsed as AdapterSettings)
        : { disabledTypes: [] },
    };
  } catch {
    settingsCache = { path: adapterSettingsPath, settings: { disabledTypes: [] } };
  }
  return settingsCache.settings;
}

function writeSettings(settings: AdapterSettings): void {
  ensureDirs();
  const { adapterSettingsPath } = adapterPluginPaths();
  fs.writeFileSync(adapterSettingsPath, JSON.stringify(settings, null, 2), "utf-8");
  settingsCache = { path: adapterSettingsPath, settings };
}

export function listAdapterPlugins(): AdapterPluginRecord[] {
  return readStore();
}

export function addAdapterPlugin(record: AdapterPluginRecord): void {
  const store = [...readStore()];
  const index = store.findIndex((entry) => entry.type === record.type);
  if (index >= 0) {
    store[index] = record;
  } else {
    store.push(record);
  }
  writeStore(store);
}

export function removeAdapterPlugin(type: string): boolean {
  const store = [...readStore()];
  const index = store.findIndex((entry) => entry.type === type);
  if (index < 0) return false;
  store.splice(index, 1);
  writeStore(store);
  return true;
}

export function getAdapterPluginByType(type: string): AdapterPluginRecord | undefined {
  return readStore().find((entry) => entry.type === type);
}

export function getAdapterPluginsDir(): string {
  return ensureDirs();
}

export function getDisabledAdapterTypes(): string[] {
  return readSettings().disabledTypes;
}

export function isAdapterDisabled(type: string): boolean {
  return readSettings().disabledTypes.includes(type);
}

export function setAdapterDisabled(type: string, disabled: boolean): boolean {
  const settings = { ...readSettings(), disabledTypes: [...readSettings().disabledTypes] };
  const index = settings.disabledTypes.indexOf(type);

  if (disabled && index < 0) {
    settings.disabledTypes.push(type);
    writeSettings(settings);
    return true;
  }
  if (!disabled && index >= 0) {
    settings.disabledTypes.splice(index, 1);
    writeSettings(settings);
    return true;
  }
  return false;
}
