/**
 * useOrchestrator - Hook for multi-agent orchestration mode
 * 
 * This is the primary hook for the multi-agent architecture.
 * It replaces useAgent with a more structured approach using
 * Orchestrator, Builder, and Researcher agents.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import {
  useSettingsStore,
  useEditorStore,
  useChatStore,
  useSpecsStore,
  useRenderStore,
  useHistoryStore,
  useDebugStore,
  type AgentContextKey,
} from '../store';
import type { Spec, SessionIteration, AgentMessage } from '@talkcad/shared';
import {
  OrchestratorLoop,
  type OrchestratorConfig,
  type OrchestratorState,
  type OrchestratorDeps,
  debugLogger,
} from '../lib/agent';
import { hydrateOpenRouterModelContextLimits } from '../lib/agent/context';
import { useSession } from './useSession';

export interface OrchestratorHookState {
  isRunning: boolean;
  status: OrchestratorState['status'];
  researchRoundTripsUsed: number;
  builderAttemptsUsed: number;
  iterations: SessionIteration[];
  pendingQuestion: string | null;
  pendingQuestionOptions: string[] | null;
}

export interface OrchestratorHookActions {
  sendMessage: (message: string, images?: string[]) => Promise<void>;
  answerQuestion: (answer: string) => void;
  stop: () => void;
  clearSession: () => void;
  revertTo: (userMessageId: string) => Promise<void>;
}

export function useOrchestrator(): [OrchestratorHookState, OrchestratorHookActions] {
  const orchestratorRef = useRef<OrchestratorLoop | null>(null);
  const tokenRef = useRef(0); // Session token for callback invalidation

  const [state, setState] = useState<OrchestratorHookState>({
    isRunning: false,
    status: 'idle',
    researchRoundTripsUsed: 0,
    builderAttemptsUsed: 0,
    iterations: [],
    pendingQuestion: null,
    pendingQuestionOptions: null,
  });

  // Settings
  const llmProvider = useSettingsStore((s) => s.llmProvider);
  const llmModel = useSettingsStore((s) => s.llmModel);
  const llmApiKey = useSettingsStore((s) => s.llmApiKey);
  const llmBaseUrl = useSettingsStore((s) => s.llmBaseUrl);
  const webToolsEnabled = useSettingsStore((s) => s.webToolsEnabled);
  const debugMode = useSettingsStore((s) => s.debugMode);
  const maxIterations = useSettingsStore((s) => s.maxIterations);
  const maxBuilderAttempts = useSettingsStore((s) => s.maxBuilderAttempts);

  const maxResearchRoundTrips = useSettingsStore((s) => s.maxResearchRoundTrips);
  const maxRepairAttempts = useSettingsStore((s) => s.maxRepairAttempts);
  const autonomyMode = useSettingsStore((s) => s.autonomyMode);
  const negotiationLevel = useSettingsStore((s) => s.negotiationLevel);

  // Verification settings
  const codeVerifierModel = useSettingsStore((s) => s.codeVerifierModel);
  const visualVerifierModel = useSettingsStore((s) => s.visualVerifierModel);
  const visualVerificationEnabled = useSettingsStore((s) => s.visualVerificationEnabled);
  const verificationAngles = useSettingsStore((s) => s.verificationAngles);
  const verificationTolerance = useSettingsStore((s) => s.verificationTolerance);

  // Context compression settings
  const autoCompression = useSettingsStore((s) => s.autoCompression);
  const summarizerModel = useSettingsStore((s) => s.summarizerModel);
  const contextThreshold = useSettingsStore((s) => s.contextThreshold);
  const contextLimit = useSettingsStore((s) => s.contextLimit);

  // Session id (used for asset storage / schematics)
  const { currentSessionId } = useSession();

  // Hydrate model metadata (context windows) for OpenRouter so new model ids "just work".
  useEffect(() => {
    if (llmProvider !== 'openrouter') return;
    const key = (llmApiKey || '').trim();
    if (!key) return;
    hydrateOpenRouterModelContextLimits(key).catch(() => {
      // Non-fatal; we fall back to static defaults.
    });
  }, [llmProvider, llmApiKey]);

  // Editor store
  const code = useEditorStore((s) => s.code);
  const savedCode = useEditorStore((s) => s.savedCode);
  const setCode = useEditorStore((s) => s.setCode);
  const setSavedCode = useEditorStore((s) => s.setSavedCode);

  // Chat store
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setIteration = useChatStore((s) => s.setIteration);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const setAgentActivity = useChatStore((s) => s.setAgentActivity);
  const setVerificationStatus = useChatStore((s) => s.setVerificationStatus);
  const setAgentContext = useChatStore((s) => s.setAgentContext);

  // Specs store
  const specsById = useSpecsStore((s) => s.specs);
  const specsHistory = useSpecsStore((s) => s.history);
  const setSpec = useSpecsStore((s) => s.setSpec);
  const updateSpec = useSpecsStore((s) => s.updateSpec);
  const clearSpecs = useSpecsStore((s) => s.clearSpecs);

  // Render store
  const setRenderResult = useRenderStore((s) => s.setRenderResult);
  const setRendering = useRenderStore((s) => s.setRendering);
  const clearRender = useRenderStore((s) => s.clearRender);

  // History store
  const addCheckpoint = useHistoryStore((s) => s.addCheckpoint);
  const clearHistory = useHistoryStore((s) => s.clearHistory);

  // Debug store
  const addDebugEntry = useDebugStore((s) => s.addEntry);
  const clearDebugLog = useDebugStore((s) => s.clear);

  // Sync debug mode changes to logger dynamically
  useEffect(() => {
    debugLogger.configure({
      logToConsole: debugMode,
    });
  }, [debugMode]);

  // Reset on session change
  useEffect(() => {
    const handler = () => {
      tokenRef.current += 1;
      orchestratorRef.current?.stop();
      orchestratorRef.current = null;
      setState((prev) => ({ ...prev, isRunning: false, pendingQuestion: null }));
      setStreaming(false);
      setAgentActivity(null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('talkcad:session-changed', handler as EventListener);
      return () => window.removeEventListener('talkcad:session-changed', handler as EventListener);
    }
  }, [setStreaming, setAgentActivity]);

  // Create orchestrator on demand
  const getOrCreateOrchestrator = useCallback(() => {
    if (orchestratorRef.current) return orchestratorRef.current;

    tokenRef.current += 1;
    const token = tokenRef.current;

    // Configure debug logger
    // Configure debug logger (always enabled for background capture)
    debugLogger.configure({
      enabled: true,
      logToConsole: debugMode,
    });

    // Connect debug logger to UI store for persistent log display
    // Always connect so we capture history even if debug window is closed initially
    debugLogger.setStoreCallback((entry) => {
      addDebugEntry(entry);
    });

    const normalizedProvider: OrchestratorConfig['llmProvider'] = (
      llmProvider === 'openrouter' ||
      llmProvider === 'openai' ||
      llmProvider === 'gemini' ||
      llmProvider === 'groq' ||
      llmProvider === 'custom' ||
      llmProvider === 'ollama' ||
      llmProvider === 'lmstudio' ||
      llmProvider === 'llamacpp'
    ) ? llmProvider : 'openrouter';

    const webToolsEnabledEffective = webToolsEnabled && normalizedProvider === 'openrouter';

    const config: OrchestratorConfig = {
      sessionId: currentSessionId || undefined,
      llmProvider: normalizedProvider,
      llmModel,
      llmApiKey,
      llmBaseUrl,
      researcherModel: llmModel,
      researcherProvider: webToolsEnabledEffective ? 'openrouter' : undefined,
      webToolsEnabled: webToolsEnabledEffective,
      maxResearchRoundTrips: autonomyMode === 'guided' ? 0 : maxResearchRoundTrips,
      maxBuilderAttempts: autonomyMode === 'guided' ? Number.MAX_SAFE_INTEGER : maxBuilderAttempts,
      maxIterations, // For Ralph logic
      maxRepairAttempts,
      maxAgentToolCalls: 30, // Safety limit for agent thinking (tool calls per turn)
      autonomyMode,
      negotiationLevel,
      debugMode,
      // Verification configuration
      verification: {
        codeVerifierModel,
        visualVerifierModel,
        visualEnabled: visualVerificationEnabled,
        enabledAngles: verificationAngles,
        tolerance: verificationTolerance,
      },
      // Context compression configuration
      contextCompression: {
        autoCompression,
        summarizerModel,
        contextThreshold,
        contextLimit,
      },
    };

    // Connect to actual services via window.api
    const deps: OrchestratorDeps = {
      skills: {
        search: async (query, category) => {
          if (typeof window !== 'undefined' && window.api?.skills?.search) {
            return await window.api.skills.search(query, category);
          }
          return [];
        },
        getFull: async (path, sessionId) => {
          if (typeof window !== 'undefined' && window.api?.skills?.getFull) {
            return await window.api.skills.getFull(path, sessionId);
          }
          return null;
        },
        create: async (args) => {
          if (typeof window !== 'undefined' && window.api?.skills?.create) {
            return await window.api.skills.create(args);
          }
          return { success: true, path: `learned/${args.title.toLowerCase().replace(/\s+/g, '-')}.md` };
        },
      },
      openscad: {
        validate: async (codeToValidate, options) => {
          if (typeof window !== 'undefined' && window.api?.openscad?.validate) {
            const mode = options?.mode === 'preview' || options?.mode === 'final' ? options.mode : 'preview';
            const geometry = options?.geometry ?? false;
            return await window.api.openscad.validate(codeToValidate, { mode, geometry });
          }
          return { valid: true, errors: [], warnings: [] };
        },
        render: async (codeToRender, format, options) => {
          if (typeof window !== 'undefined' && window.api?.openscad?.render) {
            return await window.api.openscad.render(codeToRender, format, options);
          }
          return { success: false, errors: ['Render not available'] };
        },
        renderImage: async (code, angle, options) => {
          if (typeof window !== 'undefined' && window.api?.openscad?.renderImage) {
            return await window.api.openscad.renderImage(code, angle, options);
          }
          return { success: false, error: 'Render image not available' };
        },
      },
      // Fetch capabilities for schematics
      fetch: {
        image: async (url, options) => {
          if (typeof window !== 'undefined' && window.api?.fetch?.image) {
            return await window.api.fetch.image(url, options);
          }
          return { success: false, error: 'Image fetch not available' };
        },
        html: async (url) => {
          if (typeof window !== 'undefined' && window.api?.fetch?.html) {
            return await window.api.fetch.html(url);
          }
          return { success: false, error: 'HTML fetch not available' };
        },
      },
      vectorize: {
        image: async (args) => {
          if (typeof window !== 'undefined' && window.api?.vectorize?.image) {
            return await window.api.vectorize.image(args);
          }
          return { success: false, error: 'Vectorization not available' };
        },
      },
      pdf: {
        extractImages: async (args) => {
          if (typeof window !== 'undefined' && window.api?.pdf?.extractImages) {
            return await window.api.pdf.extractImages(args);
          }
          return { success: false, error: 'PDF extraction not available' };
        },
      },
    };

    const orchestrator = new OrchestratorLoop(
      config,
      {
        onStateChange: (orchState) => {
          if (token !== tokenRef.current) return;
          setState((prev) => ({
            ...prev,
            status: orchState.status,
            researchRoundTripsUsed: orchState.researchRoundTripsUsed,
            builderAttemptsUsed: orchState.builderAttemptsUsed,
            iterations: orchState.iterations,
          }));
          setIteration(orchState.builderAttemptsUsed);
        },
        onCodeChange: (newCode) => {
          if (token !== tokenRef.current) return;
          setCode(newCode);

          // Auto-render the new code
          if (typeof window !== 'undefined' && window.api?.openscad?.render) {
            setRendering(true);
            window.api.openscad.render(newCode, 'stl', { mode: 'preview' })
              .then((result) => {
                if (token !== tokenRef.current) return;
                setRendering(false);
                if (result.success && result.output) {
                  setRenderResult(result.output, result.stats || null, result.errors, result.warnings);
                } else {
                  setRenderResult(null, null, result.errors, result.warnings);
                }
              })
              .catch((err) => {
                if (token !== tokenRef.current) return;
                setRendering(false);
                setRenderResult(null, null, [String(err)], []);
              });
          }
        },
        onSpecSet: (spec: Spec) => {
          if (token !== tokenRef.current) return;
          setSpec(spec);
        },
        onSpecVerified: (spec: Spec) => {
          if (token !== tokenRef.current) return;
          // Update the spec in the store with verification results
          updateSpec(spec.id, {
            verified: spec.verified,
            verifiedAt: spec.verifiedAt,
            verifiedValue: spec.verifiedValue,
          });
          if (debugMode) {
            console.log(`[VERIFICATION] Spec ${spec.key}: ${spec.verified ? '✓' : '✗'} (expected: ${spec.value}, actual: ${spec.verifiedValue})`);
          }
        },
        onVerificationProgress: (phase, current, total, detail) => {
          if (token !== tokenRef.current) return;
          setVerificationStatus({
            phase,
            current,
            total,
            detail: detail || `Verifying ${phase}...`,
          });
          if (debugMode) {
            console.log(`[VERIFICATION] ${phase} ${current}/${total}: ${detail || ''}`);
          }
        },
        onVerificationComplete: () => {
          if (token !== tokenRef.current) return;
          setVerificationStatus(null);
        },
        onAskUser: (question, options) => {
          if (token !== tokenRef.current) return;
          setState((prev) => ({
            ...prev,
            pendingQuestion: question,
            pendingQuestionOptions: options || null,
          }));
          setStreaming(false);
        },
        onMessage: (message, agent) => {
          if (token !== tokenRef.current) return;
          // Don't show researcher messages in chat - they're internal
          // Researcher communicates via temp KB and debug logs only
          if (agent === 'researcher') return;

          // Don't show builder's structured JSON output (internal status messages)
          // These are the completion messages with status, code_updated, etc.
          const trimmed = message.trim();
          if (trimmed.startsWith('{') && trimmed.includes('"status"')) {
            return;
          }
          // Also filter out JSON wrapped in markdown code blocks
          if (trimmed.startsWith('```json') && trimmed.includes('"status"')) {
            return;
          }

          const agentLabel = agent.charAt(0).toUpperCase() + agent.slice(1);
          const emoji = agent === 'orchestrator' ? '🎯' : '🔨';
          addMessage({
            id: `${Date.now()}-${agent}-${Math.random().toString(36).slice(2, 7)}`,
            role: 'assistant',
            content: `${emoji} **${agentLabel}**: ${message}`,
            timestamp: Date.now(),
          });
        },
        onComplete: (success, summary) => {
          if (token !== tokenRef.current) return;
          setState((prev) => ({
            ...prev,
            isRunning: false,
          }));
          setStreaming(false);
          setAgentActivity(null);
          setVerificationStatus(null); // Clear verification status on complete

          // Save the code on success
          if (success) {
            const currentCode = useEditorStore.getState().code;
            if (currentCode.trim()) {
              setSavedCode(currentCode);
            }
          }

          addMessage({
            id: `${Date.now()}-complete`,
            role: 'assistant',
            content: success ? `✅ **Complete**: ${summary}` : `❌ **Failed**: ${summary}`,
            timestamp: Date.now(),
          });
        },
        // Multi-agent activity callbacks
        onAgentChange: (agent) => {
          if (token !== tokenRef.current) return;
          setAgentActivity(agent ? { agent, status: 'thinking' } : null);
        },
        onAgentActivity: (activity) => {
          if (token !== tokenRef.current) return;
          setAgentActivity(activity);
        },
        onToolCall: (agent, toolName, args) => {
          if (token !== tokenRef.current) return;
          setAgentActivity({
            agent,
            status: 'tool_call',
            currentTool: toolName,
            toolArgs: args,
          });
          if (debugMode) {
            console.log(`[${agent?.toUpperCase()}] 🔧 ${toolName}`, args);
          }
        },
        onToolResult: (agent, toolName, success) => {
          if (token !== tokenRef.current) return;
          setAgentActivity({
            agent,
            status: 'thinking',
          });
          if (debugMode) {
            console.log(`[${agent?.toUpperCase()}] ${success ? '✓' : '✗'} ${toolName}`);
          }
        },
        onHandoff: (from, to, reason) => {
          if (token !== tokenRef.current) return;
          if (debugMode) {
            console.log(`[HANDOFF] ${from} → ${to}: ${reason}`);
          }
          // Add a system message for handoffs
          addMessage({
            id: `${Date.now()}-handoff`,
            role: 'assistant',
            content: `↪️ *Handing off from ${from} to ${to}*`,
            timestamp: Date.now(),
          });
        },
        // Context management callbacks
        onContextUpdate: (agent, tokens, limit) => {
          if (token !== tokenRef.current) return;
          // Update per-agent context in store
          if (agent) {
            setAgentContext(agent as AgentContextKey, tokens, limit);
          }
          if (debugMode) {
            const percent = Math.round((tokens / limit) * 100);
            console.log(`[${agent?.toUpperCase()}] Context: ${tokens}/${limit} tokens (${percent}%)`);
          }
        },
        onContextCompressed: (agent, tokensBefore, tokensAfter) => {
          if (token !== tokenRef.current) return;
          const saved = tokensBefore - tokensAfter;
          const percent = Math.round((saved / tokensBefore) * 100);
          console.log(`[${agent?.toUpperCase()}] Context compressed: ${tokensBefore} → ${tokensAfter} tokens (saved ${percent}%)`);
          // Update per-agent context with new token count (keep same limit)
          if (agent) {
            const agentKey = agent as AgentContextKey;
            // Fetch current limit from store to preserve it
            const currentContext = useChatStore.getState().agentContexts[agentKey];
            if (currentContext) {
              setAgentContext(agentKey, tokensAfter, currentContext.limit);
            }
          }
          // Add a system message so user knows compression happened
          addMessage({
            id: `${Date.now()}-compression`,
            role: 'assistant',
            content: `📦 *${agent} context compressed (${percent}% saved)*`,
            timestamp: Date.now(),
          });
        },
      },
      deps
    );

    orchestratorRef.current = orchestrator;
    return orchestrator;
  }, [
    llmProvider, llmModel, llmApiKey, llmBaseUrl, webToolsEnabled, debugMode, maxIterations,
    maxRepairAttempts, autonomyMode, maxResearchRoundTrips, maxBuilderAttempts,
    negotiationLevel,
    codeVerifierModel, visualVerifierModel, visualVerificationEnabled, verificationAngles, verificationTolerance,
    autoCompression, summarizerModel, contextThreshold,
    contextLimit,
    currentSessionId,
    setCode, setSpec, updateSpec, addMessage, setStreaming, setIteration, setAgentActivity,
    setRendering, setRenderResult, setSavedCode, addDebugEntry, setVerificationStatus,
    setAgentContext,
  ]);

  const inferImageMimeFromBase64 = (base64: string): string => {
    const b = base64.trim();
    if (b.startsWith('iVBORw0KGgo')) return 'image/png';
    if (b.startsWith('/9j/')) return 'image/jpeg';
    if (b.startsWith('R0lGOD')) return 'image/gif';
    if (b.startsWith('UklGR')) return 'image/webp';
    return 'image/png';
  };

  // Send a message
  const sendMessage = useCallback(async (message: string, images?: string[]) => {
    if (!message.trim()) return;

    const orchestrator = getOrCreateOrchestrator();
    const tokenAtStart = tokenRef.current;

    const inlineImages =
      images?.filter((x) => typeof x === 'string' && x.trim().length > 0) || [];

    // Create user message
    const userMessageId = uuid();
    const ts = Date.now();

    // Build message content for chat history:
    // - store images to session assets (if session exists)
    // - keep only lightweight asset_ref in persisted chat
    let content: AgentMessage['content'] = message;

    if (inlineImages.length > 0) {
      if (currentSessionId && typeof window !== 'undefined' && window.api?.session?.storeUserAsset) {
        const refs: Array<{ path: string; contentType?: string }> = [];
        for (let i = 0; i < inlineImages.length; i++) {
          const img = inlineImages[i];
          try {
            const mimeType = inferImageMimeFromBase64(img);
            const stored = await window.api.session.storeUserAsset({
              sessionId: currentSessionId,
              base64: img,
              name: `user-image-${Date.now()}-${i}`,
              mimeType,
            });
            if (stored.success && stored.path) {
              refs.push({ path: stored.path, contentType: mimeType });
            }
          } catch {
            // non-fatal: fall back to inline below
          }
        }

        // If we successfully stored at least one image, use asset_ref for chat history
        if (refs.length > 0) {
          content = [
            { type: 'text' as const, text: message },
            ...refs.map((r) => ({
              type: 'asset_ref' as const,
              assetType: 'image' as const,
              assetPath: r.path,
              description: '[Attached image]',
            })),
          ];
        } else {
          // Fallback: inline base64 (will still be passed to LLM)
          content = [
            { type: 'text' as const, text: message },
            ...inlineImages.map((img) => ({ type: 'image' as const, data: img })),
          ];
        }
      } else {
        // No session yet: keep inline base64
        content = [
          { type: 'text' as const, text: message },
          ...inlineImages.map((img) => ({ type: 'image' as const, data: img })),
        ];
      }
    }

    const userMessage: AgentMessage = {
      id: userMessageId,
      role: 'user',
      content,
      timestamp: ts,
    };
    addMessage(userMessage);

    // Create checkpoint
    addCheckpoint({
      userMessageId,
      createdAt: ts,
      prompt: message,
      code,
      savedCode,
      specs: JSON.parse(JSON.stringify(specsById)) as Record<string, Spec>,
      specHistory: JSON.parse(JSON.stringify(specsHistory)) as Spec[],
    });

    setState((prev) => ({
      ...prev,
      isRunning: true,
      pendingQuestion: null,
      pendingQuestionOptions: null,
    }));
    setStreaming(true);

    try {
      await orchestrator.processRequest(message, inlineImages.length > 0 ? { images: inlineImages } : undefined);
      if (tokenAtStart !== tokenRef.current) return;
    } catch (error) {
      if (tokenAtStart !== tokenRef.current) return;
      console.error('Orchestrator error:', error);
      setState((prev) => ({
        ...prev,
        isRunning: false,
      }));
      setStreaming(false);
      setAgentActivity(null);
      setVerificationStatus(null);
      addMessage({
        id: `${Date.now()}-error`,
        role: 'assistant',
        content: `❌ **Error**: ${String(error)}`,
        timestamp: Date.now(),
      });
    }
  }, [
    getOrCreateOrchestrator, addMessage, addCheckpoint, code, savedCode, specsById, specsHistory,
    setStreaming, setAgentActivity, setVerificationStatus,
    currentSessionId,
  ]);

  // Answer a question
  const answerQuestion = useCallback((answer: string) => {
    if (!orchestratorRef.current) return;

    setState((prev) => ({
      ...prev,
      pendingQuestion: null,
      pendingQuestionOptions: null,
    }));

    // Add user's answer as a message
    addMessage({
      id: `${Date.now()}-answer`,
      role: 'user',
      content: answer,
      timestamp: Date.now(),
    });

    // provideUserInput is async - set streaming state and handle errors
    setStreaming(true);
    orchestratorRef.current.provideUserInput(answer)
      .catch((error) => {
        console.error('[ORCHESTRATOR] Error resuming after user input:', error);
        setStreaming(false);
      });
  }, [addMessage, setStreaming]);

  // Stop
  const stop = useCallback(() => {
    tokenRef.current += 1;
    orchestratorRef.current?.stop();
    setState((prev) => ({
      ...prev,
      isRunning: false,
      pendingQuestion: null,
    }));
    setStreaming(false);
    setAgentActivity(null);
    setVerificationStatus(null);
  }, [setStreaming, setAgentActivity, setVerificationStatus]);

  // Clear session
  const clearSession = useCallback(() => {
    tokenRef.current += 1;
    orchestratorRef.current?.clearSession();
    orchestratorRef.current = null;

    clearMessages();
    clearSpecs();
    clearRender();
    clearHistory();
    clearDebugLog();
    setCode('');
    setSavedCode('');
    setAgentActivity(null);
    setVerificationStatus(null);

    setState({
      isRunning: false,
      status: 'idle',
      researchRoundTripsUsed: 0,
      builderAttemptsUsed: 0,
      iterations: [],
      pendingQuestion: null,
      pendingQuestionOptions: null,
    });
  }, [clearMessages, clearSpecs, clearRender, clearHistory, clearDebugLog, setCode, setSavedCode, setAgentActivity, setVerificationStatus]);

  // Revert to a previous message state
  const revertTo = useCallback(async (userMessageId: string) => {
    // 1. Get the checkpoint
    const checkpoint = useHistoryStore.getState().getCheckpoint(userMessageId);
    if (!checkpoint) {
      console.error('Checkpoint not found for message', userMessageId);
      return;
    }

    const orchestrator = getOrCreateOrchestrator();
    const tokenAtStart = tokenRef.current;

    // 2. Stop current execution if any
    orchestrator.stop();
    setStreaming(false);

    // 3. Prune chat messages
    const messages = useChatStore.getState().messages;
    const userMsgIndex = messages.findIndex((m) => m.id === userMessageId);

    // Special Case: Reverting the very first message
    // This effectively means "Start Over", so we want a clean slate (empty code, empty history).
    // Restoring the checkpoint would restore the 'stale' state that existed before the first message, 
    // which users perceive as "loading code from another session".
    if (userMsgIndex === 0) {
      clearSession();
      // Add a system message to indicate reset
      addMessage({
        id: `${Date.now()}-reset`,
        role: 'assistant',
        content: `Session reset to initial state.`,
        timestamp: Date.now(),
      });
      return;
    }

    if (userMsgIndex !== -1) {
      // Keep messages UP TO (but not including) the user message
      const pruned = messages.slice(0, userMsgIndex);
      useChatStore.getState().replaceMessages(pruned);
    }

    // 4. Restore Stores
    setCode(checkpoint.code);
    setSavedCode(checkpoint.savedCode);
    useSpecsStore.getState().replaceSpecs(checkpoint.specs, checkpoint.specHistory);

    // 5. Prune history (remove checkpoints after this one)
    // We want to keep checkpoints for the messages we kept.
    // The checkpoint we are loading is associated with `userMessageId`.
    // Since we are creating a state *before* `userMessageId` was processed,
    // we should keep checkpoints for messages *before* `userMessageId`.
    const messagesToKeep = useChatStore.getState().messages.map(m => m.id);
    useHistoryStore.getState().pruneToUserMessageIds(messagesToKeep);

    // 6. Restore Orchestrator State
    orchestrator.restoreState({
      code: checkpoint.code,
      specs: checkpoint.specs,
      userRequest: checkpoint.prompt, // This is roughly correct, though technically it's the prompt that *created* the state being overwritten? 
      // Actually, wait. The checkpoint is created AT THE START of processing `userMessageId`.
      // It captures the state existing BEFORE `userMessageId` had any effect.
      // But `request` in checkpoint is the `message` content itself.
      // If we restore state, the "userRequest" in orchestrator should probably be the *previous* one, or empty?
      // For now, let's assume we want to restore internal state to be ready to accept a NEW prompt.
      // So request could be empty or the last successful one.
      // Let's use the checkpoint prompt as a placeholder for "what we were about to do".
    });

    // 7. Trigger Render
    if (typeof window !== 'undefined' && window.api?.openscad?.render) {
      setRendering(true);
      try {
        const result = await window.api.openscad.render(checkpoint.code, 'stl', { mode: 'preview' });

        if (tokenRef.current !== tokenAtStart) return;
        setRendering(false);

        if (result.success && result.output) {
          setRenderResult(result.output, result.stats || null, result.errors, result.warnings);
        } else {
          setRenderResult(null, null, result.errors, result.warnings);
        }
      } catch (err) {
        if (tokenRef.current !== tokenAtStart) return;
        setRendering(false);
        setRenderResult(null, null, [String(err)], []);
      }
    }

    // 8. Update local state
    setState((prev) => ({
      ...prev,
      status: 'idle', // Ready for new input
      pendingQuestion: null,
      pendingQuestionOptions: null,
    }));

    // Add a system message indicating revert
    addMessage({
      id: `${Date.now()}-revert`,
      role: 'assistant',
      content: `Create a new request to continue from this point. (Restored from checkpoint)`,
      timestamp: Date.now(),
    });

  }, [getOrCreateOrchestrator, clearSession, setCode, setSavedCode, addMessage, setStreaming, setRendering, setRenderResult]);

  return [state, { sendMessage, answerQuestion, stop, clearSession, revertTo }];
}
