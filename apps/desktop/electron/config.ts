/**
 * Shared Config Module
 *
 * Handles reading/writing the TalkCAD config file.
 * Used by both Electron main process and CLI.
 *
 * Config location:
 * - macOS: ~/Library/Application Support/TalkCAD/config.json
 * - Linux: ~/.config/TalkCAD/config.json
 * - Windows: %APPDATA%/TalkCAD/config.json
 */

import { existsSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { TalkCADConfig } from '@talkcad/shared';
import { DEFAULT_CONFIG } from '@talkcad/shared';

/**
 * Pluggable secret storage. The Electron main process registers a safeStorage
 * codec; the CLI leaves it unset and keeps reading plaintext / env vars.
 */
export interface SecretCodec {
  readonly available: boolean;
  encrypt(plain: string): Promise<string>;
  decrypt(blob: string): Promise<string>;
}

let secretCodec: SecretCodec | null = null;

export function setSecretCodec(codec: SecretCodec | null): void {
  secretCodec = codec;
}

export function hasSecretCodec(): boolean {
  return !!secretCodec?.available;
}


/**
 * Get the config directory path (cross-platform)
 * When running in Electron, prefer app.getPath('userData')
 * When running in CLI/Node, use platform-specific paths
 */
export function getConfigDir(electronUserDataPath?: string): string {
  if (electronUserDataPath) {
    return electronUserDataPath;
  }

  // CLI/Node.js fallback - use platform-specific paths
  const platform = process.platform;
  const home = homedir();

  switch (platform) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'TalkCAD');
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'TalkCAD');
    default: // linux and others
      return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'TalkCAD');
  }
}

/**
 * Get the full path to the config file
 */
export function getConfigPath(electronUserDataPath?: string): string {
  return join(getConfigDir(electronUserDataPath), 'config.json');
}

/**
 * Load config from disk, returning defaults if file doesn't exist
 */
export async function loadConfig(electronUserDataPath?: string): Promise<TalkCADConfig> {
  const configPath = getConfigPath(electronUserDataPath);

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content) as Partial<TalkCADConfig>;

    // Merge with defaults to handle missing fields from older config versions
    const merged = mergeWithDefaults(parsed);

    // Encrypted secrets: decrypt into the live config when a codec is available.
    if (parsed.llm?.apiKeyEnc) {
      merged.llm.apiKeyEnc = parsed.llm.apiKeyEnc;
      if (secretCodec?.available) {
        try {
          merged.llm.apiKey = await secretCodec.decrypt(parsed.llm.apiKeyEnc);
        } catch (error) {
          console.error('[Config] Failed to decrypt API key:', error);
        }
      }
    }

    return merged;
  } catch (error) {
    console.error('[Config] Failed to load config, using defaults:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save config to disk
 */
export async function saveConfig(
  config: TalkCADConfig,
  electronUserDataPath?: string
): Promise<void> {
  const configPath = getConfigPath(electronUserDataPath);
  const configDir = dirname(configPath);

  // Ensure directory exists
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }

  // Encrypt the API key at rest when the OS keychain is available.
  // The plaintext field is removed so it cannot linger in backups or greps.
  const output: TalkCADConfig = {
    ...config,
    llm: { ...config.llm },
  };
  if (output.llm.apiKey && secretCodec?.available) {
    try {
      output.llm.apiKeyEnc = await secretCodec.encrypt(output.llm.apiKey);
      output.llm.apiKey = '';
    } catch (error) {
      console.error('[Config] Failed to encrypt API key, leaving it in plaintext:', error);
    }
  }

  // Write with pretty formatting
  const content = JSON.stringify(output, null, 2);
  await writeFile(configPath, content, 'utf-8');

  // Set restrictive permissions on Unix systems (contains API key)
  if (process.platform !== 'win32') {
    const { chmod } = await import('fs/promises');
    await chmod(configPath, 0o600);
  }
}

/**
 * Merge partial config with defaults, handling nested objects
 */
function mergeWithDefaults(partial: Partial<TalkCADConfig>): TalkCADConfig {
  return {
    version: 1,
    llm: {
      ...DEFAULT_CONFIG.llm,
      ...partial.llm,
    },
    researcher: partial.researcher,
    autonomy: {
      ...DEFAULT_CONFIG.autonomy,
      ...partial.autonomy,
    },
    webToolsEnabled: partial.webToolsEnabled ?? DEFAULT_CONFIG.webToolsEnabled,
    verification: {
      ...DEFAULT_CONFIG.verification,
      ...partial.verification,
    },
    openscadPath: partial.openscadPath,
    context: partial.context ? {
      ...DEFAULT_CONFIG.context,
      ...partial.context,
    } : DEFAULT_CONFIG.context,
  };
}

/**
 * Update specific fields in config (partial update)
 */
export async function updateConfig(
  updates: Partial<TalkCADConfig>,
  electronUserDataPath?: string
): Promise<TalkCADConfig> {
  const current = await loadConfig(electronUserDataPath);
  const updated = mergeWithDefaults({ ...current, ...updates });
  await saveConfig(updated, electronUserDataPath);
  return updated;
}
