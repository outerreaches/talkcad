/**
 * Configuration/Settings IPC handlers
 */
import { ipcMain, app } from 'electron';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { loadConfig, saveConfig } from '../config';
import type { TalkCADConfig } from '@talkcad/shared';

export function registerConfigHandlers() {
    const legacyPath = join(app.getPath('userData'), 'settings.json');

    ipcMain.handle('config:load', async () => {
        try {
            const config = await loadConfig(app.getPath('userData'));

            // Migrate from legacy settings.json if needed
            if (existsSync(legacyPath) && !config.llm.apiKey) {
                try {
                    const legacy = JSON.parse(await readFile(legacyPath, 'utf-8'));
                    if (legacy.llmApiKey) {
                        config.llm.apiKey = legacy.llmApiKey;
                        await saveConfig(config, app.getPath('userData'));
                    }
                } catch { /* ignore legacy migration errors */ }
            }
            return config;
        } catch (e) {
            console.error('[Config] Load failed:', e);
            return null;
        }
    });

    ipcMain.handle('config:save', async (_, config: TalkCADConfig) => {
        await saveConfig(config, app.getPath('userData'));
    });

    // Legacy handlers for backward compatibility
    ipcMain.handle('settings:load', async () => {
        const config = await loadConfig(app.getPath('userData'));
        return {
            llmProvider: config.llm.provider,
            llmModel: config.llm.model,
            llmApiKey: config.llm.apiKey,
            llmBaseUrl: config.llm.baseUrl,
            autonomyMode: config.autonomy.mode,
            maxIterations: config.autonomy.maxIterations,
            maxResearchRoundTrips: config.autonomy.maxResearchRoundTrips,
            maxBuilderAttempts: config.autonomy.maxBuilderAttempts,
            maxRepairAttempts: config.autonomy.maxRepairAttempts,
            webToolsEnabled: config.webToolsEnabled,
            codeVerifierModel: config.verification.codeVerifierModel,
            visualVerifierModel: config.verification.visualVerifierModel,
            visualVerificationEnabled: config.verification.visualEnabled,
            verificationAngles: config.verification.enabledAngles,
            verificationTolerance: config.verification.tolerance,
            openscadPath: config.openscadPath,
            autoCompression: config.context?.autoCompression,
            summarizerModel: config.context?.summarizerModel,
            contextThreshold: config.context?.threshold,
        };
    });

    ipcMain.handle('settings:save', async (_, settings: Record<string, unknown>) => {
        const config: TalkCADConfig = {
            version: 1,
            llm: {
                provider: (settings.llmProvider as TalkCADConfig['llm']['provider']) || 'openrouter',
                model: (settings.llmModel as string) || 'google/gemini-3-flash-preview',
                apiKey: settings.llmApiKey as string,
                baseUrl: settings.llmBaseUrl as string,
            },
            autonomy: {
                mode: (settings.autonomyMode as TalkCADConfig['autonomy']['mode']) || 'verified',
                maxIterations: (settings.maxIterations as number) || 3,
                maxResearchRoundTrips: (settings.maxResearchRoundTrips as number) || 3,
                maxBuilderAttempts: (settings.maxBuilderAttempts as number) || 10,
                maxRepairAttempts: (settings.maxRepairAttempts as number) || 10,
            },
            webToolsEnabled: (settings.webToolsEnabled as boolean) ?? true,
            verification: {
                codeVerifierModel: (settings.codeVerifierModel as string) || 'google/gemini-3-flash-preview',
                visualVerifierModel: (settings.visualVerifierModel as string) || 'google/gemini-3-flash-preview',
                visualEnabled: (settings.visualVerificationEnabled as boolean) ?? true,
                enabledAngles: (settings.verificationAngles as TalkCADConfig['verification']['enabledAngles']) || ['front', 'right', 'top', 'iso'],
                tolerance: (settings.verificationTolerance as number) || 0.1,
            },
            openscadPath: settings.openscadPath as string,
            context: {
                autoCompression: (settings.autoCompression as boolean) ?? true,
                summarizerModel: (settings.summarizerModel as string) || 'google/gemini-3-flash-preview',
                threshold: (settings.contextThreshold as number) || 80,
            },
        };
        await saveConfig(config, app.getPath('userData'));
    });
}
