/**
 * Context window management utilities
 * Handles token estimation and conversation compression for multi-agent system
 */

import { v4 as uuid } from 'uuid';
import type { AgentMessage } from '@talkcad/shared';
import { createProvider } from '../llm';

// Known model context limits (tokens)
// NOTE: This is a conservative fallback. Prefer dynamic provider metadata when available.
const STATIC_MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Google
  'google/gemini-2.0-flash-001': 1000000,
  'google/gemini-2.0-flash-thinking-exp-1219:free': 32768,
  'google/gemini-flash-1.5': 1000000,
  'google/gemini-pro-1.5': 2000000,
  'google/gemini-2.5-pro-preview-05-06': 1000000,
  'google/gemini-2.5-flash-preview-05-20': 1000000,

  // Anthropic
  'anthropic/claude-sonnet-4': 200000,
  'anthropic/claude-opus-4': 200000,
  'anthropic/claude-3.5-sonnet': 200000,
  'anthropic/claude-3-opus': 200000,
  'anthropic/claude-3-haiku': 200000,

  // OpenAI
  'openai/gpt-4o': 128000,
  'openai/gpt-4o-mini': 128000,
  'openai/gpt-4-turbo': 128000,
  'openai/o1': 128000,
  'openai/o3-mini': 128000,
  'openai/o3-mini-high': 128000,

  // Groq
  'groq/llama-3.3-70b-versatile': 128000,

  // Default for unknown/local models (conservative for 2026)
  'default': 32000,
};

/**
 * Get the context limit for a model
 */
const DYNAMIC_MODEL_CONTEXT_LIMITS = new Map<string, number>();

function normalizeModelId(model: string): string {
  return (model || '').trim();
}

function stripVariantSuffix(model: string): string {
  // OpenRouter-style suffixes like ":online" or ":free" (and friends).
  // If a model contains multiple colons, we treat everything after the first as a suffix.
  // This is intentionally conservative; OpenRouter model ids typically do not contain ':' otherwise.
  const idx = model.indexOf(':');
  return idx === -1 ? model : model.slice(0, idx);
}

function inferContextLimitHeuristic(model: string): number | null {
  const m = normalizeModelId(model);
  const base = stripVariantSuffix(m);

  // OpenRouter namespaced ids (provider/model)
  if (/^google\/gemini-/i.test(base)) {
    // Gemini family is typically huge-context; exact values vary by SKU.
    // Prefer dynamic lookup, but fall back to a safe high default.
    if (/gemini-(?:pro-1\.5|1\.5-pro)/i.test(base)) return 2000000;
    return 1000000;
  }
  if (/^anthropic\/claude-/i.test(base)) return 200000;
  if (/^openai\/(gpt-4|gpt-4o|o1|o3)/i.test(base)) return 128000;
  if (/^groq\/llama-3/i.test(base)) return 128000;

  // Un-namespaced ids (direct provider APIs)
  if (/^gemini-/i.test(base)) return 1000000;
  if (/^claude-/i.test(base)) return 200000;
  if (/^(gpt-4|gpt-4o|o1|o3)/i.test(base)) return 128000;

  return null;
}

export function getModelContextLimit(
  model: string,
  options?: { override?: number }
): number {
  const override = options?.override ?? 0;
  if (typeof override === 'number' && override > 0) return override;

  const m = normalizeModelId(model);
  if (!m) return STATIC_MODEL_CONTEXT_LIMITS.default;

  // 1) Dynamic provider metadata (when hydrated)
  const dyn = DYNAMIC_MODEL_CONTEXT_LIMITS.get(m);
  if (typeof dyn === 'number' && dyn > 0) return dyn;

  // 2) Static fallback table
  const stat = STATIC_MODEL_CONTEXT_LIMITS[m];
  if (typeof stat === 'number' && stat > 0) return stat;

  // 3) Strip variant suffix and try again
  const base = stripVariantSuffix(m);
  if (base !== m) {
    const dynBase = DYNAMIC_MODEL_CONTEXT_LIMITS.get(base);
    if (typeof dynBase === 'number' && dynBase > 0) return dynBase;

    const statBase = STATIC_MODEL_CONTEXT_LIMITS[base];
    if (typeof statBase === 'number' && statBase > 0) return statBase;
  }

  // 4) Heuristics by model family
  const heuristic = inferContextLimitHeuristic(m);
  if (typeof heuristic === 'number' && heuristic > 0) return heuristic;

  return STATIC_MODEL_CONTEXT_LIMITS.default;
}

/**
 * Estimate token count for a string
 * Uses the rough approximation of 4 characters per token
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function contentToTextForEstimation(content: AgentMessage['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  const parts: string[] = [];
  for (const p of content) {
    if (!p) continue;
    if (p.type === 'text' && typeof p.text === 'string') {
      parts.push(p.text);
      continue;
    }
    if (p.type === 'asset_ref') {
      // Treat asset refs as short textual context (NOT the full binary).
      const desc =
        typeof p.description === 'string' && p.description.trim().length > 0
          ? p.description
          : `[asset:${p.assetType || 'file'} ${p.assetPath || 'unknown'}]`;
      parts.push(desc);
      continue;
    }
    if (p.type === 'image') {
      // Never count base64 image data as tokens; models see images separately.
      parts.push('[image]');
      continue;
    }
  }

  return parts.join('\n');
}

/**
 * Hydrate dynamic context window limits from OpenRouter's /models endpoint.
 * This makes context limits resilient to new model ids without updating the app.
 */
let openrouterHydratedAtMs = 0;
let openrouterHydrationInFlight: Promise<number> | null = null;
const OPENROUTER_HYDRATION_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function hydrateOpenRouterModelContextLimits(
  apiKey: string,
  options?: { force?: boolean }
): Promise<{ loaded: number; fromCache: boolean }> {
  const key = (apiKey || '').trim();
  if (!key) return { loaded: 0, fromCache: true };

  const now = Date.now();
  if (!options?.force && openrouterHydratedAtMs > 0 && now - openrouterHydratedAtMs < OPENROUTER_HYDRATION_TTL_MS) {
    return { loaded: 0, fromCache: true };
  }

  if (openrouterHydrationInFlight) {
    const loaded = await openrouterHydrationInFlight;
    return { loaded, fromCache: true };
  }

  openrouterHydrationInFlight = (async () => {
    try {
      // Prefer IPC in Electron (avoids CORS)
      const ipcModels =
        typeof window !== 'undefined' ? (window as any).api?.llm?.openrouterModels : undefined;

      let payload: unknown = null;
      if (typeof ipcModels === 'function') {
        const result = await ipcModels(key);
        if (result?.ok) payload = result.data;
      } else {
        // Fallback for non-Electron environments
        const resp = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (resp.ok) {
          payload = await resp.json();
        }
      }

      const list = Array.isArray((payload as any)?.data) ? (payload as any).data : [];
      let loaded = 0;

      for (const m of list) {
        const id = (m as any)?.id;
        const ctx = (m as any)?.context_length;
        if (typeof id !== 'string' || id.trim().length === 0) continue;
        if (typeof ctx !== 'number' || !Number.isFinite(ctx) || ctx <= 0) continue;
        DYNAMIC_MODEL_CONTEXT_LIMITS.set(id, Math.floor(ctx));
        loaded++;
      }

      openrouterHydratedAtMs = Date.now();
      return loaded;
    } catch {
      return 0;
    } finally {
      // Ensure future calls can retry after completion.
      openrouterHydrationInFlight = null;
    }
  })();

  const loaded = await openrouterHydrationInFlight;
  return { loaded, fromCache: false };
}

/**
 * Estimate total tokens in a conversation
 */
export function estimateConversationTokens(messages: AgentMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(contentToTextForEstimation(msg.content));
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        total += estimateTokens(JSON.stringify(tc));
      }
    }
  }
  return total;
}

/**
 * Build a summarization prompt for conversation compression
 */
export function buildSummarizationPrompt(messages: AgentMessage[], agentRole: 'builder' | 'researcher'): string {
  const conversationText = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      let content = contentToTextForEstimation(m.content);
      // Truncate very long tool results
      if (m.role === 'tool_result' && content.length > 500) {
        content = content.slice(0, 500) + '...[truncated]';
      }
      return `[${m.role}]: ${content}`;
    })
    .join('\n\n');

  const roleContext = agentRole === 'builder'
    ? `Focus on:
- What was built (component name, purpose)
- Key specifications (dimensions, materials, tolerances)
- Design decisions made
- Code changes made
- Problems solved or pending
- Any verification results`
    : `Focus on:
- What was researched (topics, components)
- Key findings (specifications, dimensions, standards)
- Sources consulted
- Data stored to temp KB
- Questions that remain unanswered`;

  return `Summarize this ${agentRole} agent conversation. ${roleContext}

Keep under 500 tokens. Output as structured notes.

CONVERSATION:
${conversationText}`;
}

/**
 * Check if conversation needs compression
 */
export function needsCompression(
  estimatedTokens: number,
  modelLimit: number,
  thresholdPercent: number
): boolean {
  const threshold = modelLimit * (thresholdPercent / 100);
  return estimatedTokens > threshold;
}

/**
 * Split messages for compression: keep recent N messages
 */
export function splitMessagesForCompression(
  messages: AgentMessage[],
  keepRecent: number = 10
): { toSummarize: AgentMessage[]; toKeep: AgentMessage[] } {
  // Always keep system message(s)
  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  if (nonSystemMessages.length <= keepRecent) {
    return { toSummarize: [], toKeep: messages };
  }

  const splitIndex = nonSystemMessages.length - keepRecent;
  const toSummarize = nonSystemMessages.slice(0, splitIndex);
  const toKeep = [...systemMessages, ...nonSystemMessages.slice(splitIndex)];

  return { toSummarize, toKeep };
}

/**
 * Create a summary message to inject into conversation
 */
export function createSummaryMessage(summary: string): AgentMessage {
  return {
    id: `summary-${uuid()}`,
    role: 'system',
    content: `[CONVERSATION SUMMARY - Previous context was compressed]

${summary}

Continue the conversation with this context in mind.`,
    timestamp: Date.now(),
  };
}

/**
 * Context compressor configuration
 */
export interface ContextCompressorConfig {
  autoCompression: boolean;
  contextThreshold: number; // percentage (0-100)
  summarizerModel: string;
  llmProvider: 'openrouter' | 'openai' | 'gemini' | 'groq' | 'custom' | 'ollama' | 'lmstudio' | 'llamacpp';
  llmApiKey?: string;
  llmBaseUrl?: string;
  mainModel: string; // For determining context limit
  contextLimitOverride?: number; // Optional user override (0/undefined = use inferred/default)
}

/**
 * Context compressor result
 */
export interface CompressionResult {
  compressed: boolean;
  newMessages: AgentMessage[];
  summary?: string;
  tokensBefore?: number;
  tokensAfter?: number;
  error?: string;
}

/**
 * Compress conversation context if needed
 */
export async function compressContext(
  messages: AgentMessage[],
  config: ContextCompressorConfig,
  agentRole: 'builder' | 'researcher',
  onProgress?: (status: string) => void,
  options?: { extraTokens?: number }
): Promise<CompressionResult> {
  // Check if compression is enabled
  if (!config.autoCompression) {
    return { compressed: false, newMessages: messages };
  }

  // Estimate current token usage
  const modelLimit = getModelContextLimit(config.mainModel, { override: config.contextLimitOverride });
  const extraTokens = options?.extraTokens ?? 0;
  const estimatedTokens = estimateConversationTokens(messages) + extraTokens;

  // Check if compression is needed
  if (!needsCompression(estimatedTokens, modelLimit, config.contextThreshold)) {
    return { compressed: false, newMessages: messages };
  }

  onProgress?.(`Context at ${Math.round((estimatedTokens / modelLimit) * 100)}% - compressing...`);

  // Split messages for compression
  const { toSummarize, toKeep } = splitMessagesForCompression(messages);

  if (toSummarize.length === 0) {
    return { compressed: false, newMessages: messages };
  }

  // Generate summary using summarizer model
  const summaryPrompt = buildSummarizationPrompt(toSummarize, agentRole);

  try {
    // Create a provider for summarization
    // Use the same provider type as main model so it works for local providers too
    const summarizerProvider = createProvider(config.llmProvider, {
      apiKey: config.llmApiKey,
      baseUrl: config.llmBaseUrl,
      model: config.summarizerModel,
    });

    // Get summary
    const stream = summarizerProvider.chat([
      { id: uuid(), role: 'user', content: summaryPrompt, timestamp: Date.now() }
    ], { maxTokens: 800, temperature: 0.3 });

    let summary = '';
    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.text) {
        summary += chunk.text;
      }
    }

    // Build new message list with summary
    const summaryMessage = createSummaryMessage(summary);

    // Find existing summaries and replace them (don't accumulate)
    const messagesWithoutOldSummaries = toKeep.filter(
      m => {
        if (m.role !== 'system') return true;
        const contentStr = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return !contentStr.includes('[CONVERSATION SUMMARY');
      }
    );

    // Insert summary after system messages
    const systemMsgs = messagesWithoutOldSummaries.filter(m => m.role === 'system');
    const nonSystemMsgs = messagesWithoutOldSummaries.filter(m => m.role !== 'system');
    const newMessages = [...systemMsgs, summaryMessage, ...nonSystemMsgs];

    const tokensAfter = estimateConversationTokens(newMessages) + extraTokens;

    onProgress?.(`Compressed ${toSummarize.length} messages (${estimatedTokens} → ${tokensAfter} tokens)`);

    return {
      compressed: true,
      newMessages,
      summary,
      tokensBefore: estimatedTokens,
      tokensAfter,
    };
  } catch (error) {
    onProgress?.(`Compression failed: ${String(error)}`);
    return {
      compressed: false,
      newMessages: messages,
      error: String(error),
    };
  }
}
