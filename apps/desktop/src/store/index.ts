import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ViewMode,
  AutonomyMode,
  NegotiationLevel,
  FileNode,
  AgentMessage,
  Spec,
  RenderStats,
  LLMProvider,
  VerificationAngle,
} from '@talkcad/shared';

// === Files Store ===

interface FilesState {
  rootPath: string | null;
  files: FileNode[];
  activeFile: string | null;
  openFiles: string[];

  setRootPath: (path: string | null) => void;
  setFiles: (files: FileNode[]) => void;
  setActiveFile: (path: string | null) => void;
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
}

export const useFilesStore = create<FilesState>((set) => ({
  rootPath: null,
  files: [],
  activeFile: null,
  openFiles: [],

  setRootPath: (path) => set({ rootPath: path }),
  setFiles: (files) => set({ files }),
  setActiveFile: (path) => set({ activeFile: path }),
  openFile: (path) =>
    set((state) => ({
      openFiles: state.openFiles.includes(path)
        ? state.openFiles
        : [...state.openFiles, path],
      activeFile: path,
    })),
  closeFile: (path) =>
    set((state) => {
      const openFiles = state.openFiles.filter((f) => f !== path);
      return {
        openFiles,
        activeFile:
          state.activeFile === path
            ? openFiles[openFiles.length - 1] || null
            : state.activeFile,
      };
    }),
}));

// === Editor Store ===

interface EditorState {
  code: string;
  savedCode: string;
  isDirty: boolean;

  setCode: (code: string) => void;
  setSavedCode: (code: string) => void;
  markSaved: () => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      code: '',
      savedCode: '',
      isDirty: false,

      setCode: (code) => set({ code, isDirty: code !== get().savedCode }),
      setSavedCode: (code) => set({ savedCode: code, code, isDirty: false }),
      markSaved: () => set((state) => ({ savedCode: state.code, isDirty: false })),
    }),
    { name: 'talkcad-editor' }
  )
);

// === Chat Store ===

export interface VerificationStatus {
  phase: 'code' | 'visual';
  current: number;
  total: number;
  detail?: string;
}

export type ActiveAgent = 'orchestrator' | 'builder' | 'researcher' | null;

export interface AgentActivityState {
  agent: ActiveAgent;
  status: 'idle' | 'thinking' | 'tool_call' | 'waiting';
  currentTool?: string;
  toolArgs?: Record<string, unknown>;
  message?: string;
}

// Per-agent context tracking
export type AgentContextKey = 'orchestrator' | 'builder' | 'researcher';
export interface AgentContextInfo {
  tokens: number;
  limit: number;
  percentage: number;
}

interface ChatState {
  messages: AgentMessage[];
  isStreaming: boolean;
  currentIteration: number;

  // Per-agent context tracking
  agentContexts: Partial<Record<AgentContextKey, AgentContextInfo>>;
  conversationSummary: string | null;  // Compressed summary of older messages

  // Verification progress (transient)
  verificationStatus: VerificationStatus | null;

  // Multi-agent activity tracking (transient)
  agentActivity: AgentActivityState | null;

  addMessage: (message: AgentMessage) => void;
  updateLastMessage: (content: string) => void;
  setStreaming: (streaming: boolean) => void;
  setIteration: (current: number) => void;
  clearMessages: () => void;
  setAgentContext: (agent: AgentContextKey, tokens: number, limit: number) => void;
  clearAgentContext: (agent: AgentContextKey) => void;
  clearAllAgentContexts: () => void;
  setConversationSummary: (summary: string | null) => void;
  replaceMessages: (messages: AgentMessage[]) => void;
  setVerificationStatus: (status: VerificationStatus | null) => void;
  setAgentActivity: (activity: AgentActivityState | null) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isStreaming: false,
      currentIteration: 0,
      agentContexts: {},
      conversationSummary: null,
      verificationStatus: null,
      agentActivity: null,

      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      updateLastMessage: (content) =>
        set((state) => {
          const messages = [...state.messages];
          if (messages.length > 0) {
            // IMPORTANT: mutate the existing message object so references held by the AgentLoop
            // remain valid (it attaches toolCalls after streaming completes).
            (messages[messages.length - 1] as AgentMessage).content = content;
          }
          return { messages };
        }),
      setStreaming: (isStreaming) => set({ isStreaming }),
      setIteration: (current) =>
        set({ currentIteration: current }),
      clearMessages: () => set({ messages: [], currentIteration: 0, conversationSummary: null, agentContexts: {}, verificationStatus: null, agentActivity: null }),
      setAgentContext: (agent, tokens, limit) =>
        set((state) => ({
          agentContexts: {
            ...state.agentContexts,
            [agent]: { tokens, limit, percentage: limit > 0 ? Math.round((tokens / limit) * 100) : 0 },
          },
        })),
      clearAgentContext: (agent) =>
        set((state) => {
          const { [agent]: _, ...rest } = state.agentContexts;
          return { agentContexts: rest };
        }),
      clearAllAgentContexts: () => set({ agentContexts: {} }),
      setConversationSummary: (conversationSummary) => set({ conversationSummary }),
      replaceMessages: (messages) => set({ messages }),
      setVerificationStatus: (verificationStatus) => set({ verificationStatus }),
      setAgentActivity: (agentActivity) => set({ agentActivity }),
    }),
    {
      name: 'talkcad-chat',
      partialize: (state) => ({
        messages: state.messages,
        conversationSummary: state.conversationSummary,
      }),
    }
  )
);

// === History/Checkpoint Store (NOT persisted) ===

export interface ChatCheckpoint {
  // The user message id this checkpoint is associated with (snapshot is taken BEFORE that message is processed)
  userMessageId: string;
  createdAt: number;
  prompt: string;

  // State snapshot (chat truncation can be reconstructed from session chat by userMessageId)
  code: string;
  savedCode: string;
  specs: Record<string, Spec>;
  specHistory: Spec[];
}

interface HistoryState {
  checkpoints: Record<string, ChatCheckpoint>;
  order: string[];

  addCheckpoint: (checkpoint: ChatCheckpoint) => void;
  hasCheckpoint: (userMessageId: string) => boolean;
  getCheckpoint: (userMessageId: string) => ChatCheckpoint | null;
  replaceHistory: (state: { checkpoints: Record<string, ChatCheckpoint>; order: string[] }) => void;
  pruneToUserMessageIds: (userMessageIdsToKeep: string[]) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  checkpoints: {},
  order: [],

  addCheckpoint: (checkpoint) =>
    set((state) => ({
      checkpoints: { ...state.checkpoints, [checkpoint.userMessageId]: checkpoint },
      order: state.order.includes(checkpoint.userMessageId)
        ? state.order
        : [...state.order, checkpoint.userMessageId],
    })),

  hasCheckpoint: (userMessageId) => Boolean(get().checkpoints[userMessageId]),

  getCheckpoint: (userMessageId) => get().checkpoints[userMessageId] ?? null,

  replaceHistory: (state) =>
    set({
      checkpoints: state.checkpoints ?? {},
      order: Array.isArray(state.order) ? state.order : Object.keys(state.checkpoints ?? {}),
    }),

  pruneToUserMessageIds: (userMessageIdsToKeep) => {
    const keep = new Set(userMessageIdsToKeep);
    set((state) => {
      const nextCheckpoints: Record<string, ChatCheckpoint> = {};
      for (const id of state.order) {
        if (keep.has(id) && state.checkpoints[id]) {
          nextCheckpoints[id] = state.checkpoints[id];
        }
      }
      return {
        checkpoints: nextCheckpoints,
        order: state.order.filter((id) => keep.has(id)),
      };
    });
  },

  clearHistory: () => set({ checkpoints: {}, order: [] }),
}));

// === Specs Store ===

interface SpecsState {
  specs: Record<string, Spec>;
  history: Spec[];

  setSpec: (spec: Spec) => void;
  updateSpec: (id: string, updates: Partial<Spec>) => void;
  clearSpecs: () => void;
  replaceSpecs: (specs: Record<string, Spec>, history?: Spec[]) => void;
}

export const useSpecsStore = create<SpecsState>()(
  persist(
    (set) => ({
      specs: {},
      history: [],

      setSpec: (spec) =>
        set((state) => ({
          specs: { ...state.specs, [spec.id]: spec },
          history: [...state.history, spec],
        })),
      updateSpec: (id, updates) =>
        set((state) => ({
          specs: {
            ...state.specs,
            [id]: { ...state.specs[id], ...updates },
          },
        })),
      clearSpecs: () => set({ specs: {}, history: [] }),
      replaceSpecs: (specs, history) => set({ specs, history: history ?? Object.values(specs) }),
    }),
    { name: 'talkcad-specs' }
  )
);

// === Render Store ===

interface RenderState {
  stlData: string | null;
  stats: RenderStats | null;
  isRendering: boolean;
  errors: string[];
  warnings: string[];

  // Viewport capture callback (registered by Viewport component)
  captureViewport: (() => string | null) | null;

  setRenderResult: (
    output: string | null,
    stats: RenderStats | null,
    errors?: string[],
    warnings?: string[]
  ) => void;
  setRendering: (rendering: boolean) => void;
  clearRender: () => void;
  setCaptureViewport: (capture: (() => string | null) | null) => void;
}

export const useRenderStore = create<RenderState>((set) => ({
  stlData: null,
  stats: null,
  isRendering: false,
  errors: [],
  warnings: [],
  captureViewport: null,

  setRenderResult: (output, stats, errors = [], warnings = []) =>
    set({
      stlData: output,
      stats,
      errors,
      warnings,
      isRendering: false,
    }),
  setRendering: (isRendering) => set({ isRendering }),
  clearRender: () =>
    set({ stlData: null, stats: null, errors: [], warnings: [] }),
  setCaptureViewport: (captureViewport) => set({ captureViewport }),
}));

// === Layout Store (persisted) ===

interface LayoutState {
  viewMode: ViewMode;
  filesCollapsed: boolean;
  specsCollapsed: boolean;
  chatHeight: number;

  setViewMode: (mode: ViewMode) => void;
  toggleFiles: () => void;
  toggleSpecs: () => void;
  setChatHeight: (height: number) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      viewMode: 'code',
      filesCollapsed: false,
      specsCollapsed: false,
      chatHeight: 200,

      setViewMode: (viewMode) => set({ viewMode }),
      toggleFiles: () => set((state) => ({ filesCollapsed: !state.filesCollapsed })),
      toggleSpecs: () => set((state) => ({ specsCollapsed: !state.specsCollapsed })),
      setChatHeight: (chatHeight) => set({ chatHeight }),
    }),
    { name: 'talkcad-layout' }
  )
);

// === Settings Store (persisted) ===

interface SettingsState {
  // Autonomy
  autonomyMode: AutonomyMode;
  maxIterations: number;
  maxResearchRoundTrips: number;
  maxBuilderAttempts: number;
  maxRepairAttempts: number;

  // Negotiation
  negotiationLevel: NegotiationLevel;

  // LLM
  llmProvider: LLMProvider;
  llmModel: string;
  llmApiKey: string;
  llmBaseUrl: string;

  // Tool / network controls
  webToolsEnabled: boolean; // disables tools that fetch/search remote URLs when false

  // Context Management
  autoCompression: boolean;
  summarizerModel: string;
  contextThreshold: number;  // percentage (0-100) at which to compress
  contextVisibilityThreshold: number;  // percentage (0-100) at which to show indicator in non-debug mode
  contextLimit: number;  // user-configurable context limit in tokens (0 = use model default)

  // Verification
  codeVerifierModel: string;
  visualVerifierModel: string;
  visualVerificationEnabled: boolean;
  verificationAngles: VerificationAngle[];
  verificationTolerance: number;  // mm tolerance for code verification

  // OpenSCAD
  openscadPath: string | null;

  // Preview
  meshDisplayMode: 'solid' | 'wireframe';
  meshColor: string;
  showAxisGizmo: boolean;
  cameraMode: 'perspective' | 'orthographic';

  // Debug
  debugMode: boolean;

  // Actions
  setAutonomyMode: (mode: AutonomyMode) => void;
  setNegotiationLevel: (level: NegotiationLevel) => void;
  setLLMConfig: (config: Partial<{
    provider: LLMProvider;
    model: string;
    apiKey: string;
    baseUrl: string;
  }>) => void;
  setWebToolsEnabled: (enabled: boolean) => void;
  setOpenSCADPath: (path: string | null) => void;

  setMaxIterations: (n: number) => void;
  setMaxResearchRoundTrips: (n: number) => void;
  setMaxBuilderAttempts: (n: number) => void;
  setMaxRepairAttempts: (n: number) => void;
  setDebugMode: (enabled: boolean) => void;
  setAutoCompression: (enabled: boolean) => void;
  setSummarizerModel: (model: string) => void;
  setContextThreshold: (threshold: number) => void;
  setContextVisibilityThreshold: (threshold: number) => void;
  setContextLimit: (limit: number) => void;
  setCodeVerifierModel: (model: string) => void;
  setVisualVerifierModel: (model: string) => void;
  setVisualVerificationEnabled: (enabled: boolean) => void;
  setVerificationAngles: (angles: VerificationAngle[]) => void;
  setVerificationTolerance: (tolerance: number) => void;
  setMeshDisplayMode: (mode: 'solid' | 'wireframe') => void;
  setMeshColor: (color: string) => void;
  setShowAxisGizmo: (show: boolean) => void;
  setCameraMode: (mode: 'perspective' | 'orthographic') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Autonomy defaults
      autonomyMode: 'verified',
      maxIterations: 3, // Ralph loop limit
      maxResearchRoundTrips: 3,
      maxBuilderAttempts: 10,
      maxRepairAttempts: 10,

      // Negotiation defaults
      negotiationLevel: 'opinionated',

      // LLM defaults
      llmProvider: 'openrouter',
      llmModel: 'google/gemini-3-flash-preview',
      llmApiKey: '',
      llmBaseUrl: '',
      webToolsEnabled: true,

      // Context Management defaults
      autoCompression: true,
      summarizerModel: 'google/gemini-3-flash-preview',
      contextThreshold: 80,
      contextVisibilityThreshold: 70,
      contextLimit: 0,  // 0 = use model default

      // Verification defaults
      codeVerifierModel: 'google/gemini-3-flash-preview',
      visualVerifierModel: 'google/gemini-3-flash-preview',
      visualVerificationEnabled: true,
      verificationAngles: ['front', 'right', 'top', 'iso'] as VerificationAngle[],
      verificationTolerance: 0.1,

      // OpenSCAD
      openscadPath: null,

      // Preview defaults
      meshDisplayMode: 'solid',
      meshColor: '#60a5fa',
      showAxisGizmo: true,
      cameraMode: 'perspective',

      // Debug
      debugMode: false,

      // Actions
      setAutonomyMode: (autonomyMode) => set({ autonomyMode }),
      setNegotiationLevel: (negotiationLevel) => set({ negotiationLevel }),
      setLLMConfig: (config) => set((state) => ({
        llmProvider: config.provider ?? state.llmProvider,
        llmModel: config.model ?? state.llmModel,
        llmApiKey: config.apiKey ?? state.llmApiKey,
        llmBaseUrl: config.baseUrl ?? state.llmBaseUrl,
      })),
      setWebToolsEnabled: (webToolsEnabled) => set({ webToolsEnabled }),
      setOpenSCADPath: (openscadPath) => set({ openscadPath }),
      setMaxIterations: (maxIterations) => set({ maxIterations }),
      setMaxResearchRoundTrips: (maxResearchRoundTrips) => set({ maxResearchRoundTrips }),
      setMaxBuilderAttempts: (maxBuilderAttempts) => set({ maxBuilderAttempts }),
      setMaxRepairAttempts: (maxRepairAttempts) => set({ maxRepairAttempts }),
      setDebugMode: (debugMode) => set({ debugMode }),
      setAutoCompression: (autoCompression) => set({ autoCompression }),
      setSummarizerModel: (summarizerModel) => set({ summarizerModel }),
      setContextThreshold: (contextThreshold) => set({ contextThreshold }),
      setContextVisibilityThreshold: (contextVisibilityThreshold) => set({ contextVisibilityThreshold }),
      setContextLimit: (contextLimit) => set({ contextLimit }),
      setCodeVerifierModel: (codeVerifierModel) => set({ codeVerifierModel }),
      setVisualVerifierModel: (visualVerifierModel) => set({ visualVerifierModel }),
      setVisualVerificationEnabled: (visualVerificationEnabled) => set({ visualVerificationEnabled }),
      setVerificationAngles: (verificationAngles) => set({ verificationAngles }),
      setVerificationTolerance: (verificationTolerance) => set({ verificationTolerance }),
      setMeshDisplayMode: (meshDisplayMode) => set({ meshDisplayMode }),
      setMeshColor: (meshColor) => set({ meshColor }),
      setShowAxisGizmo: (showAxisGizmo) => set({ showAxisGizmo }),
      setCameraMode: (cameraMode) => set({ cameraMode }),
    }),
    { name: 'talkcad-settings' }
  )
);

// === Debug Store (NOT persisted) ===
// Holds persistent debug logs for the current session

export interface DebugLogEntry {
  id: string;
  timestamp: number;
  agent: 'orchestrator' | 'builder' | 'researcher';
  level: 'info' | 'warn' | 'error' | 'debug';
  action: string;
  details?: Record<string, unknown>;
  toolCall?: { name: string; args?: Record<string, unknown> };
  toolResult?: { name: string; success: boolean; preview?: string };
}

interface DebugState {
  entries: DebugLogEntry[];
  maxEntries: number;

  addEntry: (entry: Omit<DebugLogEntry, 'id' | 'timestamp'>) => void;
  clear: () => void;
}

export const useDebugStore = create<DebugState>((set) => ({
  entries: [],
  maxEntries: 500,

  addEntry: (entry) => set((state) => {
    const newEntry: DebugLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    const entries = [...state.entries, newEntry];
    // Trim if too many
    if (entries.length > state.maxEntries) {
      entries.splice(0, entries.length - state.maxEntries);
    }
    return { entries };
  }),

  clear: () => set({ entries: [] }),
}));
