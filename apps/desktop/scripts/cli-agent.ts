#!/usr/bin/env npx tsx
/**
 * TalkCAD CLI Debug Harness
 *
 * Run with: npx tsx scripts/cli-agent.ts "your message here"
 *
 * This uses the OrchestratorLoop to match the GUI behavior.
 * Settings are loaded from the shared config file (same as GUI).
 *
 * Config location:
 * - macOS: ~/Library/Application Support/TalkCAD/config.json
 * - Linux: ~/.config/TalkCAD/config.json
 * - Windows: %APPDATA%/TalkCAD/config.json
 *
 * Environment variables override config file values:
 * - LLM_PROVIDER, LLM_MODEL, OPENROUTER_API_KEY, LLM_BASE_URL
 * - RESEARCHER_MODEL, AUTONOMY_MODE, WEB_TOOLS, DEBUG, OUTPUT_CODE
 */

import {
    OrchestratorLoop,
    type OrchestratorConfig,
    type OrchestratorCallbacks,
    type OrchestratorDeps,
    type ActiveAgent,
} from '../src/lib/agent';
import type { Spec, TalkCADConfig } from '@talkcad/shared';
import { DEFAULT_CONFIG } from '@talkcad/shared';
import { loadConfig, getConfigPath } from '../electron/config';

// ============================================
// Load Config (shared with GUI)
// ============================================

async function buildConfig(): Promise<OrchestratorConfig> {
    // Load shared config from disk
    let fileConfig: TalkCADConfig = DEFAULT_CONFIG;
    try {
        fileConfig = await loadConfig();
        console.log(`[CONFIG] Loaded from: ${getConfigPath()}`);
    } catch (error) {
        console.warn(`[CONFIG] Could not load config file, using defaults: ${error}`);
    }

    // Environment variables override file config
    const config: OrchestratorConfig = {
        // LLM - env vars take precedence
        llmProvider: (process.env.LLM_PROVIDER as OrchestratorConfig['llmProvider']) || fileConfig.llm.provider,
        llmModel: process.env.LLM_MODEL || fileConfig.llm.model,
        llmApiKey: process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || fileConfig.llm.apiKey || '',
        llmBaseUrl: process.env.LLM_BASE_URL || fileConfig.llm.baseUrl,

        // Research
        researcherModel: process.env.RESEARCHER_MODEL || fileConfig.researcher?.model,
        researcherProvider: 'openrouter',

        // Web tools
        webToolsEnabled: process.env.WEB_TOOLS !== undefined
            ? process.env.WEB_TOOLS !== 'false'
            : fileConfig.webToolsEnabled,

        // Budgets (from file, no env override)
        maxResearchRoundTrips: fileConfig.autonomy.maxResearchRoundTrips,
        maxBuilderAttempts: fileConfig.autonomy.maxBuilderAttempts,
        maxRepairAttempts: fileConfig.autonomy.maxRepairAttempts,

        // Autonomy
        autonomyMode: (process.env.AUTONOMY_MODE as OrchestratorConfig['autonomyMode']) || fileConfig.autonomy.mode,
        maxIterations: fileConfig.autonomy.maxIterations,
        maxAgentToolCalls: 30,

        // Debug
        debugMode: process.env.DEBUG === 'true',

        // Verification (from file)
        verification: {
            codeVerifierModel: fileConfig.verification.codeVerifierModel,
            visualVerifierModel: fileConfig.verification.visualVerifierModel,
            visualEnabled: fileConfig.verification.visualEnabled,
            enabledAngles: fileConfig.verification.enabledAngles,
            tolerance: fileConfig.verification.tolerance,
        },
    };

    return config;
}

// ============================================
// Logging Utilities
// ============================================

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function log(prefix: string, color: string, ...args: unknown[]) {
    console.log(`${color}[${prefix}]${colors.reset}`, ...args);
}

const logInfo = (...args: unknown[]) => log('INFO', colors.blue, ...args);
const logTool = (...args: unknown[]) => log('TOOL', colors.magenta, ...args);
const logAgent = (agent: string, ...args: unknown[]) => log(agent.toUpperCase(), colors.cyan, ...args);
const logError = (...args: unknown[]) => log('ERROR', colors.red, ...args);
const logSuccess = (...args: unknown[]) => log('OK', colors.green, ...args);
const logWarn = (...args: unknown[]) => log('WARN', colors.yellow, ...args);

// ============================================
// Main Agent Runner
// ============================================

async function runCLIAgent(userMessage: string) {
    // Build config from shared file + env overrides
    const CONFIG = await buildConfig();

    if (!CONFIG.llmApiKey) {
        logError('No API key found!');
        logError('Either set OPENROUTER_API_KEY environment variable,');
        logError('or configure via the GUI (saves to shared config file).');
        process.exit(1);
    }

    logInfo(`Provider: ${CONFIG.llmProvider}`);
    logInfo(`Model: ${CONFIG.llmModel}`);
    logInfo(`Autonomy: ${CONFIG.autonomyMode}`);
    logInfo(`Web tools: ${CONFIG.webToolsEnabled ? 'enabled' : 'disabled'}`);
    logInfo(`User message: "${userMessage}"`);
    console.log('---');

    // Track state for summary
    let currentCode = '';
    const specs = new Map<string, Spec>();

    // Setup Callbacks
    const callbacks: OrchestratorCallbacks = {
        onStateChange: (state) => {
            if (CONFIG.debugMode) {
                logInfo(`State: ${state.status}, Builder attempts: ${state.builderAttemptsUsed}, Research trips: ${state.researchRoundTripsUsed}`);
            }
        },
        onCodeChange: (code) => {
            currentCode = code;
            logTool('Code updated, length:', code.length);
            if (CONFIG.debugMode) {
                console.log(colors.dim + '--- Code Preview ---' + colors.reset);
                console.log(code.substring(0, 500) + (code.length > 500 ? '...' : ''));
                console.log(colors.dim + '--- End Preview ---' + colors.reset);
            }
        },
        onSpecSet: (spec) => {
            specs.set(spec.key, spec);
            logTool(`Spec set: ${spec.key} = ${spec.value}${spec.unit ? ` ${spec.unit}` : ''}`);
        },
        onSpecVerified: (spec) => {
            logSuccess(`Spec verified: ${spec.key} = ${spec.verifiedValue}`);
        },
        onAskUser: (question, options) => {
            logWarn('Agent asks user:');
            console.log(`  ${question}`);
            if (options?.length) {
                console.log(`  Options: ${options.join(', ')}`);
            }
            // In CLI mode, we can't interactively answer - would need readline
            logWarn('(CLI mode cannot respond interactively - agent will use defaults or fail)');
        },
        onMessage: (message, agent) => {
            logAgent(agent, message);
        },
        onComplete: (success, summary) => {
            console.log(`\n${colors.bright}=== Summary ===${colors.reset}`);
            logInfo(`Status: ${success ? 'Success' : 'Failure'}`);
            logInfo(`Result: ${summary}`);
            logInfo(`Specs collected: ${specs.size}`);
            logInfo(`Code generated: ${currentCode.length > 0 ? 'Yes' : 'No'}`);
        },
        onAgentChange: (agent: ActiveAgent) => {
            if (agent) {
                console.log(`\n${colors.bright}=== ${agent.toUpperCase()} ===${colors.reset}`);
            }
        },
        onAgentActivity: (activity) => {
            if (activity.status === 'tool_call' && activity.currentTool) {
                logTool(`${activity.agent}: ${activity.currentTool}`);
            }
        },
        onToolCall: (agent, toolName, args) => {
            if (CONFIG.debugMode) {
                logTool(`${agent}: ${toolName}(${JSON.stringify(args).slice(0, 100)})`);
            }
        },
        onToolResult: (agent, toolName, success, preview) => {
            if (CONFIG.debugMode) {
                const status = success ? colors.green + '✓' : colors.red + '✗';
                logTool(`${status}${colors.reset} ${agent}: ${toolName} ${preview ? `→ ${preview.slice(0, 50)}` : ''}`);
            }
        },
        onHandoff: (from, to, reason) => {
            logInfo(`Handoff: ${from} → ${to} (${reason})`);
        },
        onVerificationProgress: (phase, current, total, detail) => {
            logInfo(`Verification [${phase}]: ${current}/${total}${detail ? ` - ${detail}` : ''}`);
        },
        onVerificationComplete: () => {
            logSuccess('Verification complete');
        },
    };

    // Mock Dependencies (for CLI testing without full Electron environment)
    const deps: OrchestratorDeps = {
        skills: {
            search: async (_query, _category) => {
                logTool('Mock skill search');
                return [];
            },
            getFull: async (_path) => {
                return null;
            },
            create: async (args) => {
                logTool(`Mock skill create: ${args.title}`);
                return { success: true, path: `learned/${args.title.toLowerCase().replace(/\s+/g, '-')}.md` };
            },
        },
        openscad: {
            validate: async (code, options) => {
                logTool(`Mock validate (${options?.geometry ? 'geometry' : 'syntax'})`);
                // Basic syntax check - look for common issues
                const errors: string[] = [];
                const warnings: string[] = [];

                if (!code.trim()) {
                    errors.push('Empty code');
                }

                // Check for unclosed braces
                const openBraces = (code.match(/{/g) || []).length;
                const closeBraces = (code.match(/}/g) || []).length;
                if (openBraces !== closeBraces) {
                    errors.push(`Mismatched braces: ${openBraces} open, ${closeBraces} close`);
                }

                return { valid: errors.length === 0, errors, warnings };
            },
            render: async (_code, _format, _options) => {
                logTool('Mock render');
                return {
                    success: true,
                    format: 'stl',
                    output: 'mock-base64-stl-data',
                    stats: {
                        dimensions: { x: 50, y: 50, z: 50 },
                        volume: 125000,
                        surfaceArea: 15000,
                        manifold: true,
                        triangles: 12,
                        renderTime: 0.1,
                    },
                };
            },
            renderImage: async (_code, angle) => {
                logTool(`Mock renderImage (${angle})`);
                return { success: true, image: 'mock-base64-image' };
            },
        },
        fetch: {
            image: async (url, options) => {
                logTool(`Mock fetch image: ${url}`);
                return { success: false, error: 'Mock: Image fetch not implemented in CLI' };
            },
            html: async (url) => {
                logTool(`Mock fetch HTML: ${url}`);
                return { success: false, error: 'Mock: HTML fetch not implemented in CLI' };
            },
        },
        vectorize: {
            image: async (args) => {
                logTool(`Mock vectorize: ${args.name}`);
                return { success: false, error: 'Mock: Vectorization not implemented in CLI' };
            },
        },
        pdf: {
            extractImages: async (args) => {
                logTool(`Mock PDF extract: ${args.url}`);
                return { success: false, error: 'Mock: PDF extraction not implemented in CLI' };
            },
        },
    };

    // Initialize Orchestrator
    const orchestrator = new OrchestratorLoop(CONFIG, callbacks, deps);

    // Run
    try {
        await orchestrator.processRequest(userMessage);
    } catch (err) {
        logError('Fatal error running orchestrator:', err);
        process.exit(1);
    }

    // Output final code if generated
    if (currentCode && process.env.OUTPUT_CODE === 'true') {
        console.log(`\n${colors.bright}=== Generated OpenSCAD Code ===${colors.reset}`);
        console.log(currentCode);
    }
}

// ============================================
// Entry Point
// ============================================

const userMessage = process.argv[2] || 'Make a simple box 50mm x 30mm x 20mm';

runCLIAgent(userMessage).catch((err) => {
    console.error(err);
    process.exit(1);
});
