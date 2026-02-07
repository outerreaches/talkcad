/**
 * OrchestratorLoop - Coordinates Builder and Researcher agents
 * 
 * The Orchestrator:
 * - Receives user requests
 * - Routes to Builder first (always)
 * - Routes to Researcher when Builder needs data
 * - Mediates clarifications
 * - Tracks budgets and session state
 * - Persists verified findings to skills
 */

import { v4 as uuid } from 'uuid';
import type { Spec, SessionIteration, NegotiationLevel } from '@talkcad/shared';
import type { LLMProvider } from '../llm';
import { createProvider } from '../llm';
import { SubAgentRunner, type HandoffPayload, type SubAgentResult, type ClarificationRequest } from './sub-agent';
import type { ContextCompressorConfig } from './context';
import { TemporaryResearchKB } from './temp-kb';
import { ResearchSession } from './research-session';
import {
  RESEARCHER_SYSTEM_PROMPT,
  RESEARCHER_TOOLS,
  RESEARCHER_BUDGET,
  BUILDER_SYSTEM_PROMPT,
  BUILDER_TOOLS,
  BUILDER_BUDGET,
  NEGOTIATION_PROMPTS,
} from './agent-definitions';
import type { ToolContext } from './tools';
import { debugLogger, createAgentLogger } from './debug-logger';
import {
  createBuilderHandoff,
  createResearcherHandoff,
  type SpecSummary,
} from './handoff';
import { runFullVerification, type VerificationConfig, type VerificationReport } from './verification';

export interface OrchestratorConfig {
  // UI session id (used for storing assets/schematics under the user's session folder)
  sessionId?: string;

  // LLM Configuration
  llmProvider: 'openrouter' | 'openai' | 'gemini' | 'groq' | 'custom' | 'ollama' | 'lmstudio' | 'llamacpp';
  llmModel: string;
  llmApiKey?: string;
  llmBaseUrl?: string;

  // Research model (can be different, typically cloud)
  researcherModel?: string;
  researcherProvider?: 'openrouter';

  // Web tools
  webToolsEnabled: boolean;

  // Budgets
  maxResearchRoundTrips: number;
  maxBuilderAttempts: number;
  maxRepairAttempts: number;

  // Autonomy
  autonomyMode: 'guided' | 'researched' | 'verified' | 'ralph';
  negotiationLevel: NegotiationLevel;
  maxIterations?: number; // For Ralph mode loop limit
  maxAgentToolCalls?: number; // Safety limit for single agent run

  // Debug
  debugMode?: boolean;

  // Context management
  contextCompression?: {
    autoCompression: boolean;
    summarizerModel: string;
    contextThreshold: number; // percentage (0-100)
    contextLimit?: number; // tokens (0/undefined = use inferred/default)
  };

  // Verification
  verification?: {
    codeVerifierModel: string;
    visualVerifierModel: string;
    visualEnabled: boolean;
    enabledAngles: ('front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'iso')[];
    tolerance: number;
  };
}

export interface OrchestratorState {
  // Session tracking
  sessionId: string;
  userRequest: string;
  requestCount: number;  // Track number of requests to identify follow-ups

  // Specs and code
  specs: Map<string, Spec>;
  code: string;

  // Progress tracking
  researchRoundTripsUsed: number;
  builderAttemptsUsed: number;
  failedAttempts: string[];

  // Iterations for scratchpad
  iterations: SessionIteration[];

  // Clarification queue
  pendingClarifications: ClarificationRequest[];

  // Current question awaiting user response (set when status is 'waiting_user')
  pendingUserQuestion?: string;

  // Verification hint from Builder (for repair attempts)
  verificationHint?: string;

  // Status
  status: 'idle' | 'running' | 'waiting_user' | 'complete' | 'failed';
}

export type ActiveAgent = 'orchestrator' | 'builder' | 'researcher' | null;

export interface AgentActivity {
  agent: ActiveAgent;
  status: 'idle' | 'thinking' | 'tool_call' | 'waiting';
  currentTool?: string;
  toolArgs?: Record<string, unknown>;
  message?: string;
}

export interface OrchestratorCallbacks {
  onStateChange: (state: OrchestratorState) => void;
  onCodeChange: (code: string) => void;
  onSpecSet: (spec: Spec) => void;
  onSpecVerified?: (spec: Spec) => void;
  onAskUser: (question: string, options?: string[]) => void;
  onMessage: (message: string, agent: 'orchestrator' | 'builder' | 'researcher') => void;
  onComplete: (success: boolean, summary: string) => void;
  // Enhanced callbacks for UI
  onAgentChange?: (agent: ActiveAgent) => void;
  onAgentActivity?: (activity: AgentActivity) => void;
  onToolCall?: (agent: ActiveAgent, toolName: string, args?: Record<string, unknown>) => void;
  onToolResult?: (agent: ActiveAgent, toolName: string, success: boolean, preview?: string) => void;
  onHandoff?: (from: ActiveAgent, to: ActiveAgent, reason: string) => void;
  onVerificationProgress?: (phase: 'code' | 'visual', current: number, total: number, detail?: string) => void;
  onVerificationComplete?: () => void;
  // Context management callbacks
  onContextUpdate?: (agent: ActiveAgent, estimatedTokens: number, modelLimit: number) => void;
  onContextCompressed?: (agent: ActiveAgent, tokensBefore: number, tokensAfter: number) => void;
}

export interface RenderStats {
  dimensions: { x: number; y: number; z: number };
  volume: number;
  surfaceArea: number;
  manifold: boolean;
  triangles: number;
  renderTime: number;
}

export interface RenderResult {
  success: boolean;
  format?: 'stl';
  output?: string;
  stats?: RenderStats;
  errors?: string[];
  warnings?: string[];
}

export interface OrchestratorDeps {
  skills: {
    search: (query: string, category?: string) => Promise<Array<{ title: string; tags: string[]; preview: string; path: string; source: string }>>;
    getFull: (path: string, sessionId?: string) => Promise<{ title: string; tags: string[]; content: string; path: string; source: string; schematic?: { type: 'svg' | 'png'; path: string } } | null>;
    create: (args: { title: string; tags: string[]; content: string; update?: boolean }) => Promise<{ success: boolean; path?: string; error?: string }>;
  };
  openscad: {
    validate: (code: string, options?: { mode?: string; geometry?: boolean }) => Promise<{ valid: boolean; errors: string[]; warnings: string[] }>;
    render?: (code: string, format: 'stl', options?: { mode?: 'preview' | 'final' }) => Promise<RenderResult>;
    renderImage?: (code: string, angle: string, options?: { width?: number; height?: number }) => Promise<{ success: boolean; image?: string; error?: string }>;
  };
  // Optional: fetch capabilities for schematics
  fetch?: {
    image: (url: string, options?: { sessionId?: string; name?: string }) => Promise<{ success: boolean; base64?: string; path?: string; error?: string }>;
    html: (url: string) => Promise<{ success: boolean; html?: string; error?: string }>;
  };
  vectorize?: {
    image: (args: { base64?: string; imagePath?: string; sessionId: string; name?: string; threshold?: number }) => Promise<{ success: boolean; path?: string; svg?: string; error?: string }>;
  };
  pdf?: {
    extractImages: (args: { url?: string; base64?: string; sessionId?: string; name?: string }) => Promise<{
      success: boolean;
      pageCount?: number;
      text?: string;
      metadata?: unknown;
      images?: { base64?: string; path?: string; index: number; width: number; height: number; sizeBytes: number }[];
      imageCount?: number;
      stored?: boolean;
      error?: string;
    }>;
  };
  session?: {
    storeUserAsset: (args: { sessionId: string; base64: string; name?: string; mimeType?: string }) => Promise<{
      success: boolean;
      path?: string;
      absolutePath?: string;
      error?: string;
    }>;
  };
}

export class OrchestratorLoop {
  private config: OrchestratorConfig;
  private callbacks: OrchestratorCallbacks;
  private deps: OrchestratorDeps;
  private state: OrchestratorState;

  // Components
  private tempKB: TemporaryResearchKB;
  private researchSession: ResearchSession;

  // Agents
  private builderAgent: SubAgentRunner;
  private researcherAgent: SubAgentRunner;

  // Providers
  private builderProvider: LLMProvider;
  private researcherProvider: LLMProvider | null = null;

  private shouldStop = false;
  private activeAgent: ActiveAgent = null;

  // Loggers
  private orchLog = createAgentLogger('orchestrator');
  private builderLog = createAgentLogger('builder');
  private researcherLog = createAgentLogger('researcher');

  constructor(
    config: OrchestratorConfig,
    callbacks: OrchestratorCallbacks,
    deps: OrchestratorDeps
  ) {
    this.config = config;
    this.callbacks = callbacks;
    this.deps = deps;

    // Initialize state
    this.state = {
      sessionId: config.sessionId || uuid(),
      userRequest: '',
      requestCount: 0,
      specs: new Map(),
      code: '',
      researchRoundTripsUsed: 0,
      builderAttemptsUsed: 0,
      failedAttempts: [],
      iterations: [],
      pendingClarifications: [],
      verificationHint: undefined,
      status: 'idle',
    };

    // Initialize components
    this.tempKB = new TemporaryResearchKB();
    this.researchSession = new ResearchSession();

    // Build context config (used for both compression and token budgeting).
    const contextCompressionConfig: ContextCompressorConfig | undefined = config.contextCompression
      ? {
        autoCompression: config.contextCompression.autoCompression,
        contextThreshold: config.contextCompression.contextThreshold,
        summarizerModel: config.contextCompression.summarizerModel,
        llmProvider: config.llmProvider,
        llmApiKey: config.llmApiKey,
        llmBaseUrl: config.llmBaseUrl,
        mainModel: config.llmModel,
        contextLimitOverride:
          typeof config.contextCompression.contextLimit === 'number' && config.contextCompression.contextLimit > 0
            ? config.contextCompression.contextLimit
            : undefined,
      }
      : undefined;

    // Initialize agents
    // Filter out verification-only tools when not in verified/ralph mode
    const verificationEnabled = config.autonomyMode === 'verified' || config.autonomyMode === 'ralph';
    const builderTools = verificationEnabled
      ? BUILDER_TOOLS
      : BUILDER_TOOLS.filter(t => t.name !== 'set_verification_hint');

    // Build system prompt with negotiation style
    const builderSystemPrompt = `${BUILDER_SYSTEM_PROMPT}\n\n## Interaction Style\n${NEGOTIATION_PROMPTS[config.negotiationLevel]}`;

    this.builderAgent = new SubAgentRunner({
      role: 'builder',
      systemPrompt: builderSystemPrompt,
      tools: builderTools,
      maxIterations: config.maxAgentToolCalls ?? 30,
      budget: BUILDER_BUDGET,
      contextCompression: contextCompressionConfig,
    });

    this.researcherAgent = new SubAgentRunner({
      role: 'researcher',
      systemPrompt: RESEARCHER_SYSTEM_PROMPT,
      tools: RESEARCHER_TOOLS,
      maxIterations: config.maxAgentToolCalls ?? 25,
      budget: RESEARCHER_BUDGET,
      contextCompression: config.researcherModel
        // Researcher may use a different model, update main model
        ? contextCompressionConfig && {
          ...contextCompressionConfig,
          mainModel: config.researcherModel,
        }
        : contextCompressionConfig,
    });

    // Initialize providers
    this.builderProvider = createProvider(config.llmProvider, {
      apiKey: config.llmApiKey,
      baseUrl: config.llmBaseUrl,
      model: config.llmModel,
    });

    // Configure debug logger
    // Configure debug logger
    // Always enabled to capture history even if console output is off
    debugLogger.configure({
      enabled: true,
      logToConsole: config.debugMode ?? false,
      onLogEntry: (entry) => {
        // Forward to UI callback if available
        if (entry.toolCall && this.callbacks.onToolCall) {
          this.callbacks.onToolCall(entry.agent, entry.toolCall.name, entry.toolCall.args);
        }
        if (entry.toolResult && this.callbacks.onToolResult) {
          this.callbacks.onToolResult(entry.agent, entry.toolResult.name, entry.toolResult.success, entry.toolResult.preview);
        }
      },
    });

    // Research provider (cloud if available)
    if (config.webToolsEnabled && config.researcherProvider === 'openrouter' && config.llmApiKey) {
      this.researcherProvider = createProvider('openrouter', {
        apiKey: config.llmApiKey,
        model: config.researcherModel || config.llmModel,
      });
    }
  }

  /**
   * Process a user request through the multi-agent system
   */
  async processRequest(userRequest: string, attachments?: { images?: string[] }): Promise<void> {
    this.shouldStop = false;
    this.state.userRequest = userRequest;
    this.state.status = 'running';

    // Track request count to identify first vs follow-up messages
    const isFirstRequest = this.state.requestCount === 0;
    this.state.requestCount++;

    this.updateState();

    this.orchLog.log('Session started', { sessionId: this.state.sessionId, isFirstRequest });
    this.orchLog.log('Received user request', { preview: userRequest.slice(0, 100) });
    this.addIteration('Received request', 'success', `User: ${userRequest.slice(0, 100)}...`);

    try {
      // Step 1: Always try Builder first
      // Only clear context on first request; follow-ups keep conversation history
      this.orchLog.log('Routing to Builder first (skills-first strategy)');
      await this.runBuilderFirst(userRequest, attachments, { isFirstRequest });

      // Step 2: Handle research loops if needed
      while (
        this.state.status === 'running' &&
        !this.shouldStop &&
        this.state.researchRoundTripsUsed < this.config.maxResearchRoundTrips
      ) {
        // Check if Builder requested research
        const pendingResearch = this.consumePendingResearchRequest();
        if (!pendingResearch) break;

        this.orchLog.log('Builder requested research', { question: pendingResearch });
        debugLogger.handoff('builder', 'researcher', pendingResearch);

        // Run Researcher
        const researchResult = await this.runResearcher(pendingResearch);

        if (researchResult.status === 'failed') {
          this.state.failedAttempts.push(pendingResearch);
          this.orchLog.warn('Research failed', { question: pendingResearch });
        }

        debugLogger.handoff('researcher', 'builder', `Research ${researchResult.status}`);

        // Route back to Builder with research results
        await this.runBuilderWithResearch(researchResult);

        this.state.researchRoundTripsUsed++;
        debugLogger.budget('orchestrator', 'researchRoundTrips', this.state.researchRoundTripsUsed, this.config.maxResearchRoundTrips);
      }




      // Check final status and ensure onComplete is called for all terminal states
      if (this.state.status === 'running' || this.state.status === 'complete') {
        // Run verification before completing
        // Skip verification for guided and researched modes (manual verification only)
        let verification: { success: boolean; failures: string[]; report?: VerificationReport; renderStats?: RenderStats } = { success: true, failures: [] };

        if (this.config.autonomyMode === 'verified' || this.config.autonomyMode === 'ralph') {
          verification = await this.runVerification();
        }
        let repairAttempts = 0;
        const maxRepairAttempts = this.config.maxRepairAttempts;

        // Track repair history for fresh iteration summary
        const repairHistory: Array<{ attempt: number; failures: string[]; }> = [];

        // Repair loop: if verification fails and we have budget, attempt repairs
        while (
          !verification.success &&
          verification.failures.length > 0 &&
          repairAttempts < maxRepairAttempts &&
          this.state.builderAttemptsUsed < this.config.maxBuilderAttempts &&
          !this.shouldStop
        ) {
          repairAttempts++;

          // Track this repair attempt
          repairHistory.push({
            attempt: repairAttempts,
            failures: [...verification.failures],
          });

          this.orchLog.warn('Verification failed, attempting repair', {
            attempt: repairAttempts,
            failures: verification.failures,
          });
          this.addIteration('Verification failed', 'warning', `Repair ${repairAttempts}/${maxRepairAttempts}: ${verification.failures.slice(0, 2).join('; ')}`);
          this.callbacks.onMessage(`Verification issues found, attempting repair (${repairAttempts}/${maxRepairAttempts})...`, 'orchestrator');

          // Route back to builder with verification failures
          await this.runBuilderRepair(verification.failures, verification.renderStats);

          // Re-run verification
          verification = await this.runVerification();
        }

        // If repairs exhausted and in Ralph mode, start fresh iteration with comprehensive summary
        if (
          !verification.success &&
          verification.failures.length > 0 &&
          this.config.autonomyMode === 'ralph' &&
          (this.config.maxIterations ? this.state.iterations.filter(i => i.action === 'Fresh iteration').length < this.config.maxIterations : true) &&
          !this.shouldStop
        ) {
          this.orchLog.log('Ralph mode: Starting fresh iteration after repair failures', {
            repairAttempts,
            totalBuilderAttempts: this.state.builderAttemptsUsed,
          });
          this.addIteration('Fresh iteration', 'warning', `${repairAttempts} repairs failed, starting fresh`);
          this.callbacks.onMessage(`${repairAttempts} repair attempts failed. Starting fresh iteration with cleared context...`, 'orchestrator');

          // Clear builder agent context and start fresh with comprehensive summary
          await this.runBuilderFreshIteration(verification.failures, repairHistory);

          // Re-run verification after fresh attempt
          verification = await this.runVerification();
        }

        if (!verification.success && verification.failures.length > 0) {
          this.orchLog.warn('Verification failed after all attempts', { failures: verification.failures });
          this.addIteration('Verification', 'warning', `Final: ${verification.failures.join('; ')}`);
          // Complete with partial success - code exists but verification failed
          this.state.status = 'complete';
          this.orchLog.log('Session completed with verification issues');
          this.callbacks.onComplete(true, `Completed with ${verification.failures.length} unresolved issue(s)`);
        } else {
          // Either implicit completion (loop exited naturally) or explicit (complete_task tool)
          this.state.status = 'complete';
          this.orchLog.log('Session completed successfully');
          // Only say 'verified' if we're in a mode that actually runs verification
          const verificationEnabled = this.config.autonomyMode === 'verified' || this.config.autonomyMode === 'ralph';
          const message = verificationEnabled && verification.success
            ? 'Task completed and verified'
            : 'Task completed';
          this.callbacks.onComplete(true, message);
        }
      } else if (this.state.status === 'failed') {
        // Builder failed after max attempts - ensure UI is notified
        this.orchLog.log('Session failed');
        this.callbacks.onComplete(false, 'Build failed after max attempts');
      }
      // Note: 'waiting_user' status means we're paused for user input, don't call onComplete

    } catch (error) {
      this.state.status = 'failed';
      this.orchLog.error('Session failed', { error: String(error) });
      this.addIteration('Error', 'error', String(error));
      this.callbacks.onComplete(false, String(error));
    }

    this.setActiveAgent(null);
    this.updateState();
  }

  /**
   * Set active agent and notify callbacks
   */
  private setActiveAgent(agent: ActiveAgent): void {
    this.activeAgent = agent;
    this.callbacks.onAgentChange?.(agent);
    this.callbacks.onAgentActivity?.({
      agent,
      status: agent ? 'thinking' : 'idle',
    });
  }

  /**
   * Run Builder agent first (skills + temp KB only)
   */
  private async runBuilderFirst(
    userRequest: string,
    attachments?: { images?: string[] },
    options: { isFirstRequest?: boolean } = {}
  ): Promise<void> {
    const clearContext = options.isFirstRequest ?? true;  // Default to clearing for safety

    this.setActiveAgent('builder');
    this.builderLog.log('Starting build phase', { isFirstRequest: options.isFirstRequest, clearContext });

    // Only show "Starting build" on first request, not on follow-ups
    if (options.isFirstRequest) {
      this.addIteration('Routing to Builder', 'success', 'Checking skills and temp KB first');
      this.callbacks.onMessage('Starting build...', 'orchestrator');
    }

    // Build instruction with autonomy guidance
    const autonomyGuidance = this.getAutonomyGuidance();
    const instruction = autonomyGuidance + userRequest;

    // Use typed handoff with validation
    const typedHandoff = createBuilderHandoff(
      instruction,
      {
        sessionId: this.state.sessionId,
        userRequest,
        hasAttachments: !!attachments?.images?.length,
        currentCode: this.state.code,
        specs: this.specsToRecord(),
        webToolsEnabled: this.config.webToolsEnabled,
      },
      {
        availableResearch: this.tempKB.list().map(f => f.topic),
        researchFailed: false,
        previousAttempts: [],
      }
    );

    // Convert to SubAgentRunner's HandoffPayload format
    const payload: HandoffPayload = {
      instruction: typedHandoff.instruction,
      context: {
        ...typedHandoff.context,
      },
      attachments: attachments?.images?.length ? { images: attachments.images } : undefined,
      availableResearch: typedHandoff.availableResearch,
      researchFailed: typedHandoff.researchFailed,
      previousAttempts: typedHandoff.previousAttempts,
    };

    const toolContext = this.createToolContext('builder');

    const result = await this.builderAgent.run(
      this.builderProvider,
      payload,
      toolContext,
      {
        onMessage: (msg) => {
          this.builderLog.debug('Message', { preview: msg.slice(0, 100) });
          this.callbacks.onMessage(msg, 'builder');
        },
        onToolCall: (name, args) => {
          this.builderLog.toolCall(name, args as Record<string, unknown>);
          this.callbacks.onAgentActivity?.({
            agent: 'builder',
            status: 'tool_call',
            currentTool: name,
            toolArgs: args as Record<string, unknown>,
          });
          this.addIteration(`Builder: ${name}`, 'success', JSON.stringify(args).slice(0, 200));
        },
        onToolResult: (name, result) => {
          const success = !(result as { error?: unknown })?.error;
          const typedResult = result as { valid?: boolean; errors?: string[]; warnings?: string[] };

          // Better preview for validation results
          let preview = JSON.stringify(result).slice(0, 100);
          if (typedResult.errors?.length) {
            preview = `Errors: ${typedResult.errors.join('; ')}`;
            this.builderLog.warn('Tool execution warnings/errors', { errors: typedResult.errors });
          } else if (typedResult.warnings?.length) {
            preview = `Warnings: ${typedResult.warnings.join('; ')}`;
            this.builderLog.warn('Tool execution warnings', { warnings: typedResult.warnings });
          }

          this.builderLog.toolResult(name, success, preview);
          this.callbacks.onAgentActivity?.({
            agent: 'builder',
            status: 'thinking',
          });
        },
        onContextUpdate: (tokens, limit) => {
          this.callbacks.onContextUpdate?.('builder', tokens, limit);
        },
        onContextCompressed: (before, after) => {
          this.builderLog.log('Context compressed', { before, after });
          this.callbacks.onContextCompressed?.('builder', before, after);
        },
      },
      { clearContext }  // Clear on first request, keep context for follow-ups
    );

    this.builderLog.log('Build phase complete', { status: result.status, toolCalls: result.toolCallCount });
    await this.handleBuilderResult(result);
  }

  /**
   * Run Builder agent with research results
   */
  private async runBuilderWithResearch(researchResult: SubAgentResult): Promise<void> {
    this.setActiveAgent('builder');
    this.builderLog.log('Continuing with research data', { researchStatus: researchResult.status });
    this.addIteration('Routing to Builder', 'success', 'With research data');
    this.callbacks.onMessage('Continuing build with research data...', 'orchestrator');

    const availableTopics = this.tempKB.list().map(f => f.topic);
    this.builderLog.debug('Available research topics', { topics: availableTopics });

    // Build instruction with autonomy guidance
    const autonomyGuidance = this.getAutonomyGuidance();

    // Use typed handoff with validation
    const typedHandoff = createBuilderHandoff(
      autonomyGuidance + `Continue with the original request. Research has been completed.`,
      {
        sessionId: this.state.sessionId,
        userRequest: this.state.userRequest,
        hasAttachments: false,
        currentCode: this.state.code,
        specs: this.specsToRecord(),
        webToolsEnabled: this.config.webToolsEnabled,
      },
      {
        availableResearch: availableTopics,
        researchFailed: researchResult.status === 'failed',
        previousAttempts: this.state.failedAttempts,
      }
    );

    // Convert to SubAgentRunner's HandoffPayload format
    const payload: HandoffPayload = {
      instruction: typedHandoff.instruction,
      context: {
        ...typedHandoff.context,
        researchStatus: researchResult.status,
      },
      availableResearch: typedHandoff.availableResearch,
      researchFailed: typedHandoff.researchFailed,
      previousAttempts: typedHandoff.previousAttempts,
    };

    const toolContext = this.createToolContext('builder');

    const result = await this.builderAgent.run(
      this.builderProvider,
      payload,
      toolContext,
      {
        onMessage: (msg) => {
          this.builderLog.debug('Message', { preview: msg.slice(0, 100) });
          this.callbacks.onMessage(msg, 'builder');
        },
        onToolCall: (name, args) => {
          this.builderLog.toolCall(name, args as Record<string, unknown>);
          this.callbacks.onAgentActivity?.({
            agent: 'builder',
            status: 'tool_call',
            currentTool: name,
            toolArgs: args as Record<string, unknown>,
          });
          this.addIteration(`Builder: ${name}`, 'success', JSON.stringify(args).slice(0, 200));
        },
        onToolResult: (name, result) => {
          const success = !(result as { error?: unknown })?.error;
          this.builderLog.toolResult(name, success);
        },
        onContextUpdate: (tokens, limit) => {
          this.callbacks.onContextUpdate?.('builder', tokens, limit);
        },
        onContextCompressed: (before, after) => {
          this.builderLog.log('Context compressed', { before, after });
          this.callbacks.onContextCompressed?.('builder', before, after);
        },
      },
      { clearContext: true }  // After research - builder starts fresh with research data
    );

    this.builderLog.log('Build phase complete', { status: result.status });
    await this.handleBuilderResult(result);
  }

  /**
   * Run Builder agent with an answered clarification
   */
  private async runBuilderWithClarification(question: string, answer: string): Promise<void> {
    this.setActiveAgent('builder');
    this.builderLog.log('Resuming with clarification answer', { question: question.slice(0, 50) });
    this.addIteration('Routing to Builder', 'success', 'With clarification answer');
    this.callbacks.onMessage('Resuming with clarification...', 'orchestrator');

    // Build instruction with autonomy guidance
    const autonomyGuidance = this.getAutonomyGuidance();

    const payload: HandoffPayload = {
      instruction: autonomyGuidance + `Continue with the original request. Your question has been answered:

**Question:** ${question}
**Answer:** ${answer}

Use this information to proceed with generating/editing the OpenSCAD code. If you have the dimensions and specifications needed, generate the code now.`,
      context: {
        sessionId: this.state.sessionId,
        userRequest: this.state.userRequest,
        currentCode: this.state.code,
        specs: this.specsToRecord(),
        clarificationAnswer: { question, answer },
      },
      availableResearch: this.tempKB.list().map(f => f.topic),
    };

    const toolContext = this.createToolContext('builder');

    const result = await this.builderAgent.run(
      this.builderProvider,
      payload,
      toolContext,
      {
        onMessage: (msg) => {
          this.builderLog.debug('Message', { preview: msg.slice(0, 100) });
          this.callbacks.onMessage(msg, 'builder');
        },
        onToolCall: (name, args) => {
          this.builderLog.toolCall(name, args as Record<string, unknown>);
          this.callbacks.onAgentActivity?.({
            agent: 'builder',
            status: 'tool_call',
            currentTool: name,
            toolArgs: args as Record<string, unknown>,
          });
          this.addIteration(`Builder: ${name}`, 'success', JSON.stringify(args).slice(0, 200));
        },
        onToolResult: (name, result) => {
          const success = !(result as { error?: unknown })?.error;
          this.builderLog.toolResult(name, success);
        },
        onContextUpdate: (tokens, limit) => {
          this.callbacks.onContextUpdate?.('builder', tokens, limit);
        },
        onContextCompressed: (before, after) => {
          this.builderLog.log('Context compressed', { before, after });
          this.callbacks.onContextCompressed?.('builder', before, after);
        },
      },
      { clearContext: false }  // Keep context - continuing conversation with clarification
    );

    this.builderLog.log('Build with clarification complete', { status: result.status });
    await this.handleBuilderResult(result);
  }

  /**
   * Run Builder agent to repair verification failures
   */
  private async runBuilderRepair(failures: string[], renderStats?: RenderStats): Promise<void> {
    this.setActiveAgent('builder');
    this.builderLog.log('Starting repair phase', { failureCount: failures.length });
    this.addIteration('Routing to Builder', 'success', 'Repairing verification failures');

    // Format failures for the builder
    const failureList = failures.map((f, i) => `${i + 1}. ${f}`).join('\n');

    // Build instruction with autonomy guidance
    const autonomyGuidance = this.getAutonomyGuidance();

    let instruction = autonomyGuidance + `VERIFICATION FAILED - Fix these issues in the OpenSCAD code:

${failureList}`;

    if (renderStats) {
      instruction += `\n\nCurrent Render Stats:
- Dimensions: ${renderStats.dimensions.x.toFixed(1)} x ${renderStats.dimensions.y.toFixed(1)} x ${renderStats.dimensions.z.toFixed(1)} mm
- Volume: ${renderStats.volume.toFixed(1)} mm³
- Manifold: ${renderStats.manifold ? 'Yes' : 'No'}`;
    }

    instruction += `\n\nRead the current code, identify the problems, and use edit_openscad to fix them. Focus on:
- Missing features (cutouts, holes, etc.) - add them
- Incorrect dimensions - adjust the values
- Structural issues - redesign the affected parts`;

    const payload: HandoffPayload = {
      instruction,
      context: {
        sessionId: this.state.sessionId,
        userRequest: this.state.userRequest,
        currentCode: this.state.code,
        specs: this.specsToRecord(),
        repairMode: true,
        verificationFailures: failures,
        renderStats,
      },
      renderStats,
      previousAttempts: this.state.failedAttempts,
    };

    const toolContext = this.createToolContext('builder');

    const result = await this.builderAgent.run(
      this.builderProvider,
      payload,
      toolContext,
      {
        onMessage: (msg) => {
          this.builderLog.debug('Message', { preview: msg.slice(0, 100) });
          this.callbacks.onMessage(msg, 'builder');
        },
        onToolCall: (name, args) => {
          this.builderLog.toolCall(name, args as Record<string, unknown>);
          this.callbacks.onAgentActivity?.({
            agent: 'builder',
            status: 'tool_call',
            currentTool: name,
            toolArgs: args as Record<string, unknown>,
          });
          this.addIteration(`Builder (repair): ${name}`, 'success', JSON.stringify(args).slice(0, 200));
        },
        onToolResult: (name, result) => {
          const success = !(result as { error?: unknown })?.error;
          this.builderLog.toolResult(name, success);
        },
        onContextUpdate: (tokens, limit) => {
          this.callbacks.onContextUpdate?.('builder', tokens, limit);
        },
        onContextCompressed: (before, after) => {
          this.builderLog.log('Context compressed', { before, after });
          this.callbacks.onContextCompressed?.('builder', before, after);
        },
      },
      { clearContext: false }  // Keep context - repair is continuation of same conversation
    );

    this.builderLog.log('Repair phase complete', { status: result.status });
    // Don't call handleBuilderResult here - we'll re-verify after repair
    this.state.builderAttemptsUsed++;
    this.updateState(); // Update UI with new iteration count
  }

  /**
   * Run Builder with fresh context (Ralph mode - after repair failures)
   * Clears conversation history and provides a comprehensive summary of project state and what was tried
   */
  private async runBuilderFreshIteration(
    currentFailures: string[],
    repairHistory: Array<{ attempt: number; failures: string[] }>
  ): Promise<void> {
    this.setActiveAgent('builder');
    this.builderLog.log('Starting fresh iteration', {
      currentFailures: currentFailures.length,
      repairAttempts: repairHistory.length,
    });
    this.addIteration('Fresh iteration', 'success', 'Builder starting with cleared context');

    // Reset builder agent's internal state for fresh context
    this.builderAgent.resetContext();

    // Build a comprehensive project summary
    const specsSummary = Array.from(this.state.specs.values())
      .map((s) => `- ${s.key}: ${s.value}${s.unit ? ` ${s.unit}` : ''}${s.verified ? ' ✓ verified' : ' ⚠ unverified'}`)
      .join('\n');

    const codeLines = this.state.code.split('\n').length;

    // Build repair history summary
    const repairSummary = repairHistory.map((r) => {
      const failuresStr = r.failures.slice(0, 3).join(', ');
      return `- Attempt ${r.attempt}: Tried to fix: ${failuresStr}${r.failures.length > 3 ? ` (+${r.failures.length - 3} more)` : ''}`;
    }).join('\n');

    // Identify persistent issues (failures that appeared in multiple attempts)
    const failureCounts = new Map<string, number>();
    for (const r of repairHistory) {
      for (const f of r.failures) {
        failureCounts.set(f, (failureCounts.get(f) || 0) + 1);
      }
    }
    const persistentIssues = Array.from(failureCounts.entries())
      .filter(([_, count]) => count >= 2)
      .map(([issue, count]) => `- "${issue}" (failed ${count}x)`);

    const currentFailuresList = currentFailures.map((f, i) => `${i + 1}. ${f}`).join('\n');

    // Build instruction with autonomy guidance
    const autonomyGuidance = this.getAutonomyGuidance();

    const projectSummary = autonomyGuidance + `
## Fresh Iteration - Project Summary

**Original User Request:**
${this.state.userRequest}

**Current Specifications:**
${specsSummary || '(none set)'}

**Current Code:** ${codeLines} lines of OpenSCAD code
Use \`read_code\` to examine the existing implementation.

---

## What Was Tried (${repairHistory.length} repair attempts failed)

${repairSummary || '(no repairs attempted)'}

${persistentIssues.length > 0 ? `**Persistent Issues (keep reappearing):**\n${persistentIssues.join('\n')}` : ''}

---

## Current Verification Failures (MUST be fixed)

${currentFailuresList}

---

## Your Approach for This Fresh Iteration

The previous repair attempts kept the same context and made incremental fixes that didn't work.
Now with cleared context, you should:

1. **Read the current code** with \`read_code\` to understand what exists
2. **Analyze the pattern** - why do these issues persist?
3. **Consider a different approach** if the same fixes aren't working:
   - Maybe the geometry needs restructuring
   - Maybe the feature placement logic is flawed
   - Maybe coordinates need to be recalculated from scratch
4. **Make the necessary changes** with \`edit_openscad\` or \`generate_openscad\`
`;

    const payload: HandoffPayload = {
      instruction: `FRESH ITERATION - ${repairHistory.length} repair attempts exhausted. Starting with clean context.
${projectSummary}`,
      context: {
        sessionId: this.state.sessionId,
        userRequest: this.state.userRequest,
        specs: this.specsToRecord(),
        freshIteration: true,
        iterationNumber: this.state.builderAttemptsUsed + 1,
        repairAttemptsMade: repairHistory.length,
        persistentIssues: persistentIssues.map(i => i.replace(/^- /, '')),
        currentFailures,
      },
      previousAttempts: currentFailures,
    };

    const toolContext = this.createToolContext('builder');

    const result = await this.builderAgent.run(
      this.builderProvider,
      payload,
      toolContext,
      {
        onMessage: (msg) => {
          this.builderLog.debug('Message', { preview: msg.slice(0, 100) });
          this.callbacks.onMessage(msg, 'builder');
        },
        onToolCall: (name, args) => {
          this.builderLog.toolCall(name, args as Record<string, unknown>);
          this.callbacks.onAgentActivity?.({
            agent: 'builder',
            status: 'tool_call',
            currentTool: name,
            toolArgs: args as Record<string, unknown>,
          });
          this.addIteration(`Builder (fresh): ${name}`, 'success', JSON.stringify(args).slice(0, 200));
        },
        onToolResult: (name, result) => {
          const success = !(result as { error?: unknown })?.error;
          this.builderLog.toolResult(name, success);
        },
        onContextUpdate: (tokens, limit) => {
          this.callbacks.onContextUpdate?.('builder', tokens, limit);
        },
        onContextCompressed: (before, after) => {
          this.builderLog.log('Context compressed', { before, after });
          this.callbacks.onContextCompressed?.('builder', before, after);
        },
      },
      { clearContext: true }  // Ralph fresh iteration - start over with clean context
    );

    this.builderLog.log('Fresh iteration complete', { status: result.status });
    this.state.builderAttemptsUsed++;
    this.updateState(); // Update UI with new iteration count
  }

  /**
   * Run Researcher agent
   */
  private async runResearcher(question: string): Promise<SubAgentResult> {
    if (!this.researcherProvider) {
      this.researcherLog.error('Research not available (no cloud provider)');
      return {
        status: 'failed',
        error: 'Research not available (no cloud provider configured)',
        toolCallCount: 0,
        iterationCount: 0,
      };
    }

    this.setActiveAgent('researcher');
    this.researcherLog.log('Starting research phase', { question });
    this.addIteration('Routing to Researcher', 'success', question);
    this.callbacks.onMessage(`Researching: ${question}`, 'orchestrator');

    // Clear research session for new research round
    this.researchSession.clear();

    // Use typed handoff with validation
    const typedHandoff = createResearcherHandoff(
      question,
      {
        sessionId: this.state.sessionId,
        userRequest: this.state.userRequest,
        relatedSkills: [], // Could be populated from skills search
      },
      ['dimensions', 'specifications'], // Default data types to look for
      this.state.failedAttempts
    );

    // Convert to SubAgentRunner's HandoffPayload format
    const payload: HandoffPayload = {
      instruction: `Find technical specifications for: ${typedHandoff.question}`,
      context: {
        ...typedHandoff.context,
        dataTypes: typedHandoff.dataTypes,
      },
      previousAttempts: typedHandoff.failedAttempts,
    };

    const toolContext = this.createToolContext('researcher');

    const result = await this.researcherAgent.run(
      this.researcherProvider,
      payload,
      toolContext,
      {
        onMessage: (msg) => {
          this.researcherLog.debug('Message', { preview: msg.slice(0, 100) });
          this.callbacks.onMessage(msg, 'researcher');
        },
        onToolCall: (name, args) => {
          this.researcherLog.toolCall(name, args as Record<string, unknown>);
          this.callbacks.onAgentActivity?.({
            agent: 'researcher',
            status: 'tool_call',
            currentTool: name,
            toolArgs: args as Record<string, unknown>,
          });
          this.addIteration(`Researcher: ${name}`, 'success', JSON.stringify(args).slice(0, 200));
        },
        onToolResult: (name, result) => {
          const success = !(result as { error?: unknown })?.error;
          const preview = JSON.stringify(result).slice(0, 100);
          this.researcherLog.toolResult(name, success, preview);
        },
        onContextUpdate: (tokens, limit) => {
          this.callbacks.onContextUpdate?.('researcher', tokens, limit);
        },
        onContextCompressed: (before, after) => {
          this.researcherLog.log('Context compressed', { before, after });
          this.callbacks.onContextCompressed?.('researcher', before, after);
        },
      }
    );

    this.researcherLog.log('Research complete', { status: result.status, toolCalls: result.toolCallCount });
    this.addIteration(
      'Research complete',
      result.status === 'complete' ? 'success' : 'warning',
      `Status: ${result.status}, Tools: ${result.toolCallCount}`
    );

    return result;
  }
  /**
   * Handle Builder result
   * Returns true if builder was resumed with answered clarification
   */
  private async handleBuilderResult(result: SubAgentResult): Promise<boolean> {
    this.state.builderAttemptsUsed++;
    this.updateState(); // Update UI with new iteration count

    switch (result.status) {
      case 'complete':
        this.state.status = 'complete';
        this.addIteration('Build complete', 'success', 'Task finished');
        return false;

      case 'need_research':
        if (this.state.researchRoundTripsUsed >= this.config.maxResearchRoundTrips) {
          // Budget exhausted, ask user instead
          const clarification = await this.handleClarificationRequest({
            question: result.researchQuestion || 'Missing information',
            priority: 'high',
          });
          if (clarification.answered) {
            // Resume builder with the answer
            await this.runBuilderWithClarification(result.researchQuestion || '', clarification.answer!);
            return true;
          }
        } else {
          this.addIteration('Research needed', 'warning', result.researchQuestion || '');
          // Will be picked up by main loop
          this.state.pendingClarifications.push({
            question: result.researchQuestion || '',
            priority: 'high',
            context: 'research_request',
          });
        }
        return false;

      case 'need_clarification': {
        const clarification = await this.handleClarificationRequest(result.clarificationRequest!);
        if (clarification.answered) {
          // Resume builder with the answer
          await this.runBuilderWithClarification(
            result.clarificationRequest!.question,
            clarification.answer!
          );
          return true;
        }
        return false;
      }

      case 'failed':
      case 'budget_exhausted':
        if (this.state.builderAttemptsUsed >= this.config.maxBuilderAttempts) {
          this.state.status = 'failed';
          this.addIteration('Build failed', 'error', result.error || 'Max attempts reached');
        }
        return false;
    }
    return false;
  }

  /**
   * Handle clarification request from worker
   * Returns true if clarification was answered and builder should be resumed
   */
  private async handleClarificationRequest(request: ClarificationRequest): Promise<{ answered: boolean; answer?: string }> {
    // In guided mode: ALWAYS ask user, never auto-answer or use defaults
    if (this.config.autonomyMode === 'guided') {
      this.orchLog.log('Guided mode: forwarding clarification to user', { question: request.question });
      this.state.status = 'waiting_user';
      this.state.pendingUserQuestion = request.question;
      this.callbacks.onAskUser(request.question, request.context ? [request.context] : undefined);
      return { answered: false };
    }

    // For other modes: try to answer from existing context first
    const answer = await this.tryAnswerFromContext(request.question);

    if (answer) {
      this.addIteration('Clarification answered', 'success', `${request.question} → ${answer}`);
      return { answered: true, answer };
    } else if (request.priority === 'high') {
      // Must ask user
      this.state.status = 'waiting_user';
      this.state.pendingUserQuestion = request.question;
      this.callbacks.onAskUser(request.question);
      return { answered: false };
    } else {
      // Use default
      this.addIteration('Using default', 'warning', request.question);
      return { answered: false };
    }
  }

  /**
   * Try to answer clarification from existing context
   * Order: specs → temp KB → permanent skills → reasonable defaults
   */
  private async tryAnswerFromContext(question: string): Promise<string | null> {
    const questionLower = question.toLowerCase();

    // 1. Check specs
    for (const [key, spec] of this.state.specs) {
      if (questionLower.includes(key.toLowerCase())) {
        this.orchLog.debug('Found answer in specs', { key });
        return `${spec.value} ${spec.unit || ''}`;
      }
    }

    // 2. Check temp KB
    const findings = this.tempKB.search(question);
    if (findings.length > 0) {
      this.orchLog.debug('Found answer in temp KB', { topic: findings[0].topic });
      return JSON.stringify(findings[0].data);
    }

    // 3. Check permanent skills
    try {
      const skillMatches = await this.deps.skills.search(question);
      if (skillMatches.length > 0) {
        const skill = await this.deps.skills.getFull(skillMatches[0].path);
        if (skill) {
          this.orchLog.debug('Found answer in skills', { skill: skillMatches[0].title });
          // Extract a concise answer from skill content (first paragraph or 200 chars)
          const content = skill.content;
          const firstParagraph = content.split('\n\n')[0];
          return firstParagraph.length > 200 ? firstParagraph.slice(0, 200) + '...' : firstParagraph;
        }
      }
    } catch (error) {
      this.orchLog.warn('Skills lookup failed', { error: String(error) });
    }

    // 4. Check for reasonable defaults (wall thickness, tolerances, etc.)
    const defaultAnswer = this.getReasonableDefault(question);
    if (defaultAnswer) {
      this.orchLog.debug('Using reasonable default', { question, answer: defaultAnswer });
      return defaultAnswer;
    }

    return null;
  }

  /**
   * Consume pending research request
   */
  private consumePendingResearchRequest(): string | null {
    const researchRequest = this.state.pendingClarifications.find(
      c => c.context === 'research_request'
    );

    if (researchRequest) {
      this.state.pendingClarifications = this.state.pendingClarifications.filter(
        c => c !== researchRequest
      );
      return researchRequest.question;
    }

    return null;
  }

  /**
   * Create tool context for an agent
   */
  private createToolContext(agent: 'builder' | 'researcher'): ToolContext {
    return {
      code: this.state.code,
      setCode: (code) => {
        this.state.code = code;
        this.callbacks.onCodeChange(code);
      },
      validate: async () => {
        // Use geometry validation to catch 2D/3D mixing and other geometry errors
        // that echo-only syntax validation misses
        return await this.deps.openscad.validate(this.state.code, { mode: 'preview', geometry: true });
      },
      searchSkills: async (query, category) => {
        return await this.deps.skills.search(query, category);
      },
      getSkillFull: async (path, sessionId) => {
        return await this.deps.skills.getFull(path, sessionId);
      },
      createSkill: async (args) => {
        return await this.deps.skills.create(args);
      },
      webSearch: async (query) => {
        // Only available for researcher
        if (agent !== 'researcher') {
          return 'Web search not available for this agent';
        }
        // Implemented via OpenRouter :online
        if (!this.researcherProvider) {
          return 'No research provider configured';
        }

        const onlineModel = `${this.config.researcherModel || this.config.llmModel}:online`;
        const onlineProvider = createProvider('openrouter', {
          apiKey: this.config.llmApiKey,
          model: onlineModel,
        });

        const searchPrompt = `Search the web for: ${query}\nReturn JSON with results array containing { title, url, type, notes }.`;

        let results = '';
        const stream = onlineProvider.chat(
          [{ id: uuid(), role: 'user', content: searchPrompt, timestamp: Date.now() }],
          { maxTokens: 1024, temperature: 0.2 }
        );

        for await (const chunk of stream) {
          if (chunk.type === 'text' && chunk.text) {
            results += chunk.text;
          }
        }

        return results || 'No results found';
      },
      askUser: (questions, context) => {
        this.callbacks.onAskUser(questions.join('\n'), context ? [context] : undefined);
      },
      setSpec: (key, value, unit, critical, note) => {
        // Determine verification methods based on the spec type
        // Dimension specs can be verified by code and visually
        // Boolean/feature specs are primarily visual
        const isNumericSpec = typeof value === 'number' || !isNaN(parseFloat(String(value)));
        const verifyBy: ('code' | 'visual' | 'render_stats' | 'none')[] = isNumericSpec
          ? ['code', 'visual']
          : ['visual'];

        const spec: Spec = {
          id: uuid(),
          key,
          value,
          unit,
          confidence: 'explicit',
          source: 'agent',
          verifyBy,
          tolerance: isNumericSpec ? (this.config.verification?.tolerance ?? 0.1) : undefined,
          setAt: this.state.iterations.length,
          messageRef: '',
          verified: false,
          critical: critical ?? false,
          note,  // Builder's explanation for this spec
        };
        this.state.specs.set(key, spec);
        this.callbacks.onSpecSet(spec);
        return { isUpdate: false };
      },
      updateScratchpad: (entry) => {
        this.addIteration(entry.action, entry.result, entry.details);
      },
      fetchRasterImage: async (url: string, name: string) => {
        if (!this.deps.fetch?.image) {
          return { success: false, error: 'Image fetch not available' };
        }
        return await this.deps.fetch.image(url, { sessionId: this.state.sessionId, name });
      },
      fetchSvgSchematic: async (url: string, name: string) => {
        // SVGs are fetched as regular images and stored
        if (!this.deps.fetch?.image) {
          return { success: false, error: 'SVG fetch not available' };
        }
        return await this.deps.fetch.image(url, { sessionId: this.state.sessionId, name });
      },
      webFetch: async (url: string) => {
        if (!this.deps.fetch?.html) {
          return { success: false, error: 'HTML fetch not available' };
        }
        return await this.deps.fetch.html(url);
      },
      vectorizeSchematic: async (args: { imageBase64?: string; storedImagePath?: string; name: string; threshold?: number }) => {
        if (!this.deps.vectorize?.image) {
          return { success: false, error: 'Vectorization not available' };
        }
        return await this.deps.vectorize.image({
          base64: args.imageBase64,
          imagePath: args.storedImagePath,
          sessionId: this.state.sessionId,
          name: args.name,
          threshold: args.threshold,
        });
      },
      fetchPdfSchematic: async (url: string) => {
        if (!this.deps.pdf?.extractImages) {
          return { success: false, error: 'PDF extraction not available' };
        }
        return await this.deps.pdf.extractImages({ url, sessionId: this.state.sessionId });
      },
      sessionId: this.state.sessionId,
      setVerificationHint: (hint: string) => {
        this.state.verificationHint = hint;
        this.orchLog.log('Verification hint set', { hint: hint.slice(0, 100) });
      },
      researchSession: this.researchSession,
      tempKB: this.tempKB,
    };
  }

  /**
   * Add iteration to scratchpad
   */
  private addIteration(action: string, result: 'success' | 'error' | 'warning', details?: string): void {
    this.state.iterations.push({
      number: this.state.iterations.length + 1,
      action,
      result,
      details: details || '',
    });
  }

  /**
   * Update state and notify
   */
  private updateState(): void {
    this.callbacks.onStateChange({ ...this.state });
  }

  /**
   * Provide user input (after ask_user)
   * Resumes the builder with the user's answer to the pending clarification
   */
  async provideUserInput(input: string): Promise<void> {
    if (this.state.status !== 'waiting_user') {
      this.orchLog.warn('provideUserInput called but not waiting for user', { status: this.state.status });
      return;
    }

    const pendingQuestion = this.state.pendingUserQuestion;
    if (!pendingQuestion) {
      this.orchLog.warn('No pending question to answer');
      return;
    }

    this.orchLog.log('User provided input', { question: pendingQuestion.slice(0, 50), answer: input.slice(0, 50) });
    this.state.status = 'running';
    this.state.pendingUserQuestion = undefined;
    this.addIteration('User input received', 'success', input);
    this.updateState();

    // Resume builder with the user's answer
    try {
      await this.runBuilderWithClarification(pendingQuestion, input);

      // After builder completes, check status
      // Note: builder might have set 'waiting_user' again if it asked another question
      // Use a helper to avoid TypeScript narrowing issues
      const shouldComplete = () => {
        const s = this.state.status;
        return s === 'running' || s === 'complete';
      };

      if (shouldComplete()) {
        // Run verification if in verified/ralph mode
        if (this.config.autonomyMode === 'verified' || this.config.autonomyMode === 'ralph') {
          const verification = await this.runVerification();
          if (!verification.success && verification.failures.length > 0) {
            this.orchLog.warn('Verification failed after clarification', { failures: verification.failures });
            // Could trigger repair loop here if needed
          }
        }

        // Only mark complete if builder didn't ask another question (re-check status)
        if (shouldComplete()) {
          this.state.status = 'complete';
          this.callbacks.onComplete(true, 'Task completed');
        }
      }
    } catch (error) {
      this.orchLog.error('Failed to resume after user input', { error: String(error) });
      this.state.status = 'failed';
      this.callbacks.onComplete(false, String(error));
    }

    this.setActiveAgent(null);
    this.updateState();
  }

  /**
   * Stop the orchestrator - halts activities but preserves context for continuation
   */
  stop(): void {
    this.shouldStop = true;
    this.builderAgent.stop();
    this.researcherAgent.stop();
    // Keep context intact so user can provide additional input
    // Reset status to idle so new requests can proceed
    this.state.status = 'idle';
    this.updateState();
  }

  /**
   * Run verification on all specs after build completes using the full verification pipeline
   * Returns the verification report
   */
  private async runVerification(): Promise<{ success: boolean; failures: string[]; report?: VerificationReport; renderStats?: RenderStats }> {
    // Skip if no verification config
    if (!this.config.verification) {
      this.orchLog.log('Verification skipped - no verification config');
      return { success: true, failures: [] };
    }

    // Skip if no render capability
    if (!this.deps.openscad.render || !this.deps.openscad.renderImage) {
      this.orchLog.log('Verification skipped - no render capability');
      return { success: true, failures: [] };
    }

    // Skip if no code
    if (!this.state.code.trim()) {
      return { success: true, failures: [] };
    }

    // Convert specs Map to array
    const specs = Array.from(this.state.specs.values());
    if (specs.length === 0) {
      this.orchLog.log('Verification skipped - no specs to verify');
      return { success: true, failures: [] };
    }

    // Check if stopped before starting verification
    if (this.shouldStop) {
      this.orchLog.log('Verification aborted - stop requested');
      return { success: false, failures: ['Verification aborted by user'] };
    }

    // Render to get stats first
    this.orchLog.log('Running verification render...');
    const renderResult = await this.deps.openscad.render(this.state.code, 'stl', { mode: 'preview' });

    if (!renderResult.success) {
      const failures = [`Render failed: ${renderResult.errors?.join(', ') || 'Unknown error'}`];
      return { success: false, failures };
    }

    const renderStats = renderResult.stats || null;
    this.orchLog.log('Starting full verification pipeline...', {
      specsCount: specs.length,
      renderStats: renderStats ? { dimensions: renderStats.dimensions, triangles: renderStats.triangles } : null
    });

    // Build verification config
    const verificationConfig: VerificationConfig = {
      codeVerifierModel: this.config.verification.codeVerifierModel,
      visualVerifierModel: this.config.verification.visualVerifierModel,
      visualEnabled: this.config.verification.visualEnabled,
      enabledAngles: this.config.verification.enabledAngles,
      tolerances: {
        code: this.config.verification.tolerance,
        render_stats: 1.0,
        visual: 2.0,
      },
      llmProvider: this.config.llmProvider,
      llmApiKey: this.config.llmApiKey,
      llmBaseUrl: this.config.llmBaseUrl,
      builderHint: this.state.verificationHint,
      debug: this.config.debugMode,
    };

    // Build verification deps
    const verificationDeps = {
      renderImage: async (angle: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'iso'): Promise<string> => {
        const result = await this.deps.openscad.renderImage!(this.state.code, angle, { width: 800, height: 600 });
        if (!result.success || !result.image) {
          throw new Error(result.error || 'Failed to render image');
        }
        return result.image;
      },
      onProgress: (phase: 'code' | 'visual', current: number, total: number, detail?: string) => {
        this.orchLog.log(`Verification progress: ${phase} ${current}/${total}${detail ? ` - ${detail}` : ''}`);
        this.callbacks.onVerificationProgress?.(phase, current, total, detail);
      },
    };

    try {
      const report = await runFullVerification(
        this.state.code,
        specs,
        renderStats,
        verificationConfig,
        verificationDeps
      );

      // Update spec verification status based on results
      for (const codeResult of report.codeResults) {
        const spec = this.state.specs.get(codeResult.specKey);
        if (spec) {
          spec.verified = codeResult.passed;
          spec.verifiedAt = Date.now();
          spec.verifiedValue = codeResult.actual;
          // Notify UI of verification
          this.callbacks.onSpecVerified?.(spec);
        }
      }

      this.orchLog.log('Verification complete', {
        allPassed: report.allPassed,
        codeResults: report.codeResults.length,
        visualResults: report.visualResults.length,
        failedSpecs: report.failedSpecs
      });

      // Signal verification is done (clears UI status)
      this.callbacks.onVerificationComplete?.();

      return {
        success: report.allPassed,
        failures: report.failedSpecs.concat(
          report.visualResults.filter(r => !r.passed).flatMap(r => r.issues)
        ),
        report,
        renderStats: renderStats || undefined,
      };
    } catch (error) {
      this.orchLog.error('Verification pipeline failed', { error: String(error) });
      // Signal verification is done even on error
      this.callbacks.onVerificationComplete?.();
      return { success: false, failures: [`Verification error: ${String(error)}`] };
    }
  }

  /**
   * Get current state
   */
  getState(): OrchestratorState {
    return { ...this.state };
  }

  /**
   * Get current active agent
   */
  getActiveAgent(): ActiveAgent {
    return this.activeAgent;
  }

  /**
   * Restore state from a checkpoint
   */
  restoreState(snapshot: {
    code: string;
    specs: Record<string, Spec>;
    userRequest: string;
    iteration?: number;
  }): void {
    this.state.code = snapshot.code;
    this.state.userRequest = snapshot.userRequest;

    // Rehydrate specs
    this.state.specs.clear();
    for (const [key, val] of Object.entries(snapshot.specs)) {
      this.state.specs.set(key, val);
    }

    // Reset status to complete (since we're restoring a valid past state)
    this.state.status = 'complete';

    // Reset transient lists
    this.state.pendingClarifications = [];
    this.state.verificationHint = undefined;

    // Reset/Estimate counters
    // We don't have exact counts in checkpoint, so we reset to safe defaults for a "completed" state
    // If user continues, new counts will increment from here
    this.state.builderAttemptsUsed = snapshot.iteration || 1;
    this.state.researchRoundTripsUsed = 0;

    // Add iteration entry for the restore
    this.addIteration('Restored state', 'success', `Reverted to request: ${snapshot.userRequest.slice(0, 50)}...`);

    this.orchLog.log('State restored from checkpoint', {
      request: snapshot.userRequest,
      specsCount: this.state.specs.size,
      codeLines: snapshot.code.split('\n').length
    });

    this.updateState();
  }

  /**
   * Clear session (start fresh)
   */
  clearSession(): void {
    this.tempKB.clear();
    this.researchSession.clear();
    this.state = {
      sessionId: this.config.sessionId || uuid(),
      userRequest: '',
      requestCount: 0,
      specs: new Map(),
      code: '',
      researchRoundTripsUsed: 0,
      builderAttemptsUsed: 0,
      failedAttempts: [],
      iterations: [],
      pendingClarifications: [],
      verificationHint: undefined,
      status: 'idle',
    };
  }

  /**
   * Convert specs Map to Record for handoff
   */
  private specsToRecord(): Record<string, SpecSummary> {
    const result: Record<string, SpecSummary> = {};
    for (const [key, spec] of this.state.specs) {
      result[key] = {
        value: spec.value,
        unit: spec.unit,
        verified: spec.verified,
      };
    }
    return result;
  }

  /**
   * Get autonomy-specific guidance to prepend to builder instructions
   */
  private getAutonomyGuidance(): string {
    switch (this.config.autonomyMode) {
      case 'guided':
        return `**AUTONOMY MODE: GUIDED**
You MUST use request_clarification (priority: high) to ask the user before:
- Using any default values (wall thickness, tolerances, clearances)
- Making any design decisions not explicitly specified
- Choosing between alternative approaches

IMPORTANT: If the user's answer defers to you (e.g., "what would you suggest?", "what's appropriate?", "you decide", "whatever works"), then YOU should provide a recommendation with your reasoning. For example:
- For tolerances: suggest 0.3mm for FDM/PLA, explain it's standard for sliding fits
- For wall thickness: suggest 2mm for FDM, explain it's strong enough and prints reliably
- For component dimensions you don't know: suggest the user measure it or provide a datasheet

Do NOT call request_research in guided mode - the user wants manual control. Instead, ask the user for the specific information or suggest reasonable defaults with explanation.

`;
      case 'researched':
        return `**AUTONOMY MODE: RESEARCHED**
Use request_research for missing component data. Use reasonable defaults for standard parameters (wall thickness, tolerances) without asking.

`;
      case 'verified':
        return `**AUTONOMY MODE: VERIFIED**
Use reasonable defaults for standard parameters. Verify results after build.

`;
      case 'ralph':
        return `**AUTONOMY MODE: RALPH (Autonomous)**
Proceed autonomously. Use defaults, research as needed. Only ask user for genuine ambiguities.

`;
      default:
        return '';
    }
  }

  /**
   * Get reasonable default for common design questions
   */
  private getReasonableDefault(question: string): string | null {
    const q = question.toLowerCase();

    // Wall thickness
    if (q.includes('wall thickness') || q.includes('wall thick')) {
      return '2mm (default for FDM)';
    }

    // Tolerances
    if (q.includes('tolerance') || q.includes('clearance') || q.includes('gap')) {
      return '0.3mm (default for PLA)';
    }

    // Fillet radius
    if (q.includes('fillet') || q.includes('corner radius')) {
      return '1mm (default for corners)';
    }

    // Layer height
    if (q.includes('layer height') || q.includes('layer thick')) {
      return '0.2mm (default)';
    }

    // Infill
    if (q.includes('infill')) {
      return '20% (default)';
    }

    return null;
  }
}
