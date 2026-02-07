/**
 * SubAgentRunner - Isolated execution context for specialized agents
 * 
 * Each agent (Researcher, Builder) runs in isolation with:
 * - Its own message history (cleared between handoffs)
 * - Restricted tool set (only tools it's allowed to use)
 * - Focused system prompt (role-specific)
 * - Budget constraints
 */

import { v4 as uuid } from 'uuid';
import type { AgentMessage } from '@talkcad/shared';
import type { LLMProvider } from '../llm';
import { executeTool, type ToolContext, type Tool } from './tools';
import {
  compressContext,
  estimateConversationTokens,
  estimateTokens,
  getModelContextLimit,
  type ContextCompressorConfig,
} from './context';

export type AgentRole = 'researcher' | 'builder';

export interface SubAgentConfig {
  role: AgentRole;
  systemPrompt: string;
  tools: Tool[];
  maxIterations: number;
  budget: AgentBudget;
  contextCompression?: ContextCompressorConfig;
}

export interface AgentBudget {
  maxSearches: number;
  maxFetches: number;
  maxCodegenAttempts: number;
  maxToolCalls: number;
}

/**
 * Strip OpenSCAD code blocks from text to reduce context size.
 * Code is already saved to state, no need to keep it in message history.
 */
function stripCodeBlocks(content: string): string {
  // Replace ```openscad ... ``` blocks with placeholder
  // return content.replace(/```openscad[\s\S]*?```/g, '[code block stored in state]');
  return content;
}

export interface SubAgentResult {
  status: 'complete' | 'need_research' | 'need_clarification' | 'failed' | 'budget_exhausted';
  output?: unknown;
  researchQuestion?: string;
  clarificationRequest?: ClarificationRequest;
  error?: string;
  toolCallCount: number;
  iterationCount: number;
}

export interface ClarificationRequest {
  question: string;
  context?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface HandoffPayload {
  instruction: string;
  context: Record<string, unknown>;
  attachments?: { images?: string[] };
  renderStats?: {
    dimensions: { x: number; y: number; z: number };
    volume: number;
    triangles: number;
    manifold: boolean;
  };
  availableResearch?: string[];
  researchFailed?: boolean;
  previousAttempts?: string[];
}

export class SubAgentRunner {
  private role: AgentRole;
  private systemPrompt: string;
  private tools: Tool[];
  private maxIterations: number;
  private budget: AgentBudget;
  private contextCompression?: ContextCompressorConfig;
  private messages: AgentMessage[] = [];
  private toolCallCount = 0;
  private iterationCount = 0;
  private shouldStop = false;

  constructor(config: SubAgentConfig) {
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
    this.tools = config.tools;
    this.maxIterations = config.maxIterations;
    this.budget = { ...config.budget };
    this.contextCompression = config.contextCompression;
  }

  /**
   * Update context compression config (e.g., when settings change)
   */
  setContextCompression(config: ContextCompressorConfig | undefined): void {
    this.contextCompression = config;
  }

  /**
   * Run the agent with a handoff payload from Orchestrator
   * @param options.clearContext - If true, clears message history before running.
   *                               Default: false (keep context for continuity)
   */
  async run(
    provider: LLMProvider,
    payload: HandoffPayload,
    toolContext: ToolContext,
    callbacks: {
      onMessage?: (content: string) => void;
      onToolCall?: (name: string, args: unknown) => void;
      onToolResult?: (name: string, result: unknown) => void;
      onContextUpdate?: (estimatedTokens: number, modelLimit: number) => void;
      onContextCompressed?: (tokensBefore: number, tokensAfter: number) => void;
    } = {},
    options: { clearContext?: boolean } = {}
  ): Promise<SubAgentResult> {
    // Only clear context if explicitly requested (new session, Ralph fresh iteration)
    if (options.clearContext) {
      this.reset();
    } else {
      // Reset counters but keep message history for continuity
      this.toolCallCount = 0;
      this.iterationCount = 0;
      this.shouldStop = false;
    }

    // Build and append user message from handoff payload
    const userMessage = this.buildHandoffMessage(payload);
    const images =
      payload.attachments?.images?.filter((x) => typeof x === 'string' && x.trim().length > 0) || [];

    const content: AgentMessage['content'] =
      images.length > 0
        ? [
          { type: 'text' as const, text: userMessage },
          ...images.map((img) => ({ type: 'image' as const, data: img })),
        ]
        : userMessage;

    this.messages.push({
      id: uuid(),
      role: 'user',
      content,
      timestamp: Date.now(),
    });

    let imagesPruned = false;

    // Run agent loop
    while (!this.shouldStop && this.iterationCount < this.maxIterations) {
      this.iterationCount++;

      // Check budget
      if (this.toolCallCount >= this.budget.maxToolCalls) {
        return {
          status: 'budget_exhausted',
          error: `Tool call budget exhausted (${this.toolCallCount}/${this.budget.maxToolCalls})`,
          toolCallCount: this.toolCallCount,
          iterationCount: this.iterationCount,
        };
      }

      // Check context usage and compress if needed
      await this.checkAndCompressContext(callbacks);

      // Get LLM response
      const response = await this.getLLMResponse(provider);

      if (response.error) {
        return {
          status: 'failed',
          error: response.error,
          toolCallCount: this.toolCallCount,
          iterationCount: this.iterationCount,
        };
      }

      // Handle text response
      if (response.content) {
        callbacks.onMessage?.(response.content);
      }

      // After the first model call, prune any base64 images from stored context so we don't resend them.
      if (!imagesPruned) {
        this.pruneImagesFromHistory();
        imagesPruned = true;
      }

      // No tool calls = agent is done for this turn
      if (!response.toolCalls || response.toolCalls.length === 0) {
        // IMPORTANT: Add assistant response to history so next request sees complete conversation
        // Strip code blocks to reduce context size
        if (response.content) {
          this.messages.push({
            id: uuid(),
            role: 'assistant',
            content: stripCodeBlocks(response.content),
            timestamp: Date.now(),
          });
        }

        // Parse the response for structured output
        const result = this.parseAgentOutput(response.content);
        return {
          ...result,
          toolCallCount: this.toolCallCount,
          iterationCount: this.iterationCount,
        };
      }

      // Execute tool calls
      const toolResults: Array<{ name: string; result: unknown }> = [];

      for (const toolCall of response.toolCalls) {
        // Validate tool is allowed
        if (!this.isToolAllowed(toolCall.name)) {
          toolResults.push({
            name: toolCall.name,
            result: { error: `Tool "${toolCall.name}" is not allowed for ${this.role} agent` },
          });
          continue;
        }

        callbacks.onToolCall?.(toolCall.name, toolCall.arguments);
        this.toolCallCount++;

        // Check for special control tools
        const controlResult = this.handleControlTool(toolCall.name, toolCall.arguments);
        if (controlResult) {
          return {
            ...controlResult,
            toolCallCount: this.toolCallCount,
            iterationCount: this.iterationCount,
          };
        }

        // Execute tool
        try {
          const result = await executeTool(toolCall.name, toolCall.arguments, toolContext);
          toolResults.push({ name: toolCall.name, result });
          callbacks.onToolResult?.(toolCall.name, result);
        } catch (error) {
          toolResults.push({ name: toolCall.name, result: { error: String(error) } });
        }
      }

      // Strip large payloads from tool calls before storing in context
      // Code is already saved to state, no need to keep it in history
      const strippedToolCalls = response.toolCalls; // Disable stripping for now
      // const strippedToolCalls = response.toolCalls.map(tc => {
      //   if (tc.name === 'generate_openscad' && tc.arguments?.code) {
      //     return { ...tc, arguments: { ...tc.arguments, code: '[code stored in state]' } };
      //   }
      //   return tc;
      // });

      // Add assistant message with tool calls (stripped of large payloads)
      this.messages.push({
        id: uuid(),
        role: 'assistant',
        content: stripCodeBlocks(response.content || ''),
        toolCalls: strippedToolCalls,
        timestamp: Date.now(),
      });

      // Add tool results (strip code from generate_openscad results too)
      for (const tr of toolResults) {
        const resultContent = tr.result;
        // if (tr.name === 'generate_openscad' && typeof tr.result === 'object' && tr.result !== null) {
        //   const { code, ...rest } = tr.result as Record<string, unknown>;
        //   resultContent = code ? { ...rest, code: '[stored in state]' } : tr.result;
        // }
        this.messages.push({
          id: uuid(),
          role: 'tool_result',
          content: JSON.stringify(resultContent),
          toolCallId: response.toolCalls.find(tc => tc.name === tr.name)?.id,
          timestamp: Date.now(),
        });
      }
    }

    // Max iterations reached
    return {
      status: 'failed',
      error: `Max iterations reached (${this.iterationCount})`,
      toolCallCount: this.toolCallCount,
      iterationCount: this.iterationCount,
    };
  }

  /**
   * Reset agent state for new handoff
   */
  private reset(): void {
    this.messages = [];
    this.toolCallCount = 0;
    this.iterationCount = 0;
    this.shouldStop = false;
  }

  /**
   * Public method to reset context (for fresh iterations in Ralph mode)
   */
  resetContext(): void {
    this.reset();
  }

  /**
   * Build user message from handoff payload
   */
  private buildHandoffMessage(payload: HandoffPayload): string {
    let message = payload.instruction;

    if (payload.availableResearch && payload.availableResearch.length > 0) {
      message += `\n\nAvailable research topics in temp KB: ${payload.availableResearch.join(', ')}`;
      message += '\nUse get_research_finding(topic) to retrieve research data.';
    }

    if (payload.researchFailed) {
      message += '\n\nNote: Previous research attempt failed. You may need to ask user for information.';
    }

    if (payload.previousAttempts && payload.previousAttempts.length > 0) {
      message += `\n\nPrevious attempts that failed:\n- ${payload.previousAttempts.join('\n- ')}`;
    }

    if (Object.keys(payload.context).length > 0) {
      message += `\n\nContext:\n${JSON.stringify(payload.context, null, 2)}`;
    }

    return message;
  }

  /**
   * Prune base64 images out of message history after first send.
   * Keeps a lightweight `asset_ref` placeholder so the model has continuity.
   */
  private pruneImagesFromHistory(): void {
    this.messages = this.messages.map((m) => {
      if (!Array.isArray(m.content)) return m;
      const next = m.content.map((p) => {
        if (!p || p.type !== 'image') return p;
        return {
          type: 'asset_ref' as const,
          assetType: 'image' as const,
          description: '[Previously attached image]',
        };
      });
      return { ...m, content: next };
    });
  }

  /**
   * Get LLM response with tool calling
   */
  private async getLLMResponse(provider: LLMProvider): Promise<{
    content: string;
    toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
    error?: string;
  }> {
    try {
      // Build messages with system prompt
      const systemMessage: AgentMessage = {
        id: 'system',
        role: 'system',
        content: this.systemPrompt,
        timestamp: Date.now(),
      };

      // ---- Token budgeting (best-effort, provider-agnostic) ----
      // Count system prompt + tool schema roughly, since both contribute to prompt size.
      const toolSchemaTokens = this.tools.length > 0 ? estimateTokens(JSON.stringify(this.tools)) : 0;
      const systemTokens = estimateTokens(this.systemPrompt);
      const messageTokens = estimateConversationTokens(this.messages);
      const estimatedPromptTokens = systemTokens + toolSchemaTokens + messageTokens;

      const modelLimit = this.contextCompression
        ? getModelContextLimit(this.contextCompression.mainModel, {
          override: this.contextCompression.contextLimitOverride,
        })
        : getModelContextLimit('default');

      const SAFETY_MARGIN_TOKENS = 512;
      const desiredMaxOutputTokens = 4096;
      const maxAllowed =
        Math.floor(modelLimit - estimatedPromptTokens - SAFETY_MARGIN_TOKENS);
      const maxTokens = Math.max(1, Math.min(desiredMaxOutputTokens, maxAllowed));

      const stream = provider.chat([systemMessage, ...this.messages], {
        tools: this.tools,
        maxTokens,
        temperature: 0.7,
        toolChoice: 'auto',
      });

      let content = '';
      const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];

      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'text':
            content += chunk.text || '';
            break;
          case 'tool_call':
            if (chunk.toolCall) {
              toolCalls.push(chunk.toolCall);
            }
            break;
          case 'error':
            return { content: '', error: chunk.error };
        }
      }

      return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
    } catch (error) {
      return { content: '', error: String(error) };
    }
  }

  /**
   * Check if a tool is in the allowed list
   */
  private isToolAllowed(toolName: string): boolean {
    return this.tools.some(t => t.name === toolName);
  }

  /**
   * Handle control tools that affect agent flow
   */
  private handleControlTool(
    name: string,
    args: Record<string, unknown>
  ): Omit<SubAgentResult, 'toolCallCount' | 'iterationCount'> | null {
    switch (name) {
      case 'request_research':
        return {
          status: 'need_research',
          researchQuestion: args.question as string,
        };

      case 'request_clarification':
        return {
          status: 'need_clarification',
          clarificationRequest: {
            question: args.question as string,
            context: args.context as string | undefined,
            priority: (args.priority as 'low' | 'medium' | 'high') || 'medium',
          },
        };

      // complete_task is no longer a control tool - agent runs until no more tool calls
      // The orchestrator handles session completion based on mode (verification, etc.)

      default:
        return null;
    }
  }

  /**
   * Parse agent output for structured result
   */
  private parseAgentOutput(content: string): Omit<SubAgentResult, 'toolCallCount' | 'iterationCount'> {
    // Try to parse JSON output
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.status) {
          return parsed as SubAgentResult;
        }
      }
    } catch {
      // Not JSON, treat as complete with text output
    }

    return {
      status: 'complete',
      output: content,
    };
  }

  /**
   * Check context usage and compress if needed
   */
  private async checkAndCompressContext(callbacks: {
    onContextUpdate?: (estimatedTokens: number, modelLimit: number) => void;
    onContextCompressed?: (tokensBefore: number, tokensAfter: number) => void;
  }): Promise<void> {
    // Skip if no compression config
    if (!this.contextCompression) {
      return;
    }

    // Report current context usage
    const modelLimit = getModelContextLimit(this.contextCompression.mainModel, {
      override: this.contextCompression.contextLimitOverride,
    });

    // Include system prompt + tool schema in the estimate (they count toward context too).
    const extraTokens =
      estimateTokens(this.systemPrompt) +
      (this.tools.length > 0 ? estimateTokens(JSON.stringify(this.tools)) : 0);
    const estimatedTokens = estimateConversationTokens(this.messages) + extraTokens;
    callbacks.onContextUpdate?.(estimatedTokens, modelLimit);

    // Attempt compression
    const result = await compressContext(
      this.messages,
      this.contextCompression,
      this.role,
      (status) => console.log(`[${this.role}] ${status}`),
      { extraTokens }
    );

    if (result.compressed && result.tokensBefore && result.tokensAfter) {
      this.messages = result.newMessages;
      callbacks.onContextCompressed?.(result.tokensBefore, result.tokensAfter);
      console.log(`[${this.role}] Context compressed: ${result.tokensBefore} → ${result.tokensAfter} tokens`);
    }
  }

  /**
   * Stop the agent
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Get current stats
   */
  getStats(): { toolCallCount: number; iterationCount: number; messageCount: number } {
    return {
      toolCallCount: this.toolCallCount,
      iterationCount: this.iterationCount,
      messageCount: this.messages.length,
    };
  }
}
