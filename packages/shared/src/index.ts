// ============================================
// TalkCAD Shared Types
// ============================================

// === Autonomy Modes ===

export type AutonomyMode = 'guided' | 'researched' | 'verified' | 'ralph';

export type NegotiationLevel = 'agreeable' | 'helpful' | 'opinionated' | 'strict' | 'cranky';

export interface AutonomyConfig {
  mode: AutonomyMode;
  maxIterations: number;
  bailOnRepeatedError: number;
  pauseForAmbiguity: boolean;
  updateMemoryOnSuccess: boolean;
}

export interface NegotiationConfig {
  level: NegotiationLevel;
  warnOnSuboptimal: boolean;
  suggestAlternatives: boolean;
  pushBackOnBadSpecs: boolean;
  requireConfirmation: boolean;
  insistCount: number;
  snark: boolean;
}

// === Spec System ===

export type SpecConfidence = 'explicit' | 'inferred' | 'default';
export type SpecSource = 'user' | 'agent' | 'skill';
export type VerificationMethod = 'code' | 'visual' | 'render_stats' | 'none';

export interface Spec {
  id: string;
  key: string;
  value: unknown;
  unit?: string;
  confidence: SpecConfidence;
  source: SpecSource;
  verifyBy: VerificationMethod[];

  // Tracking
  setAt: number;
  messageRef: string;
  supersedes?: string;

  // Verification
  verified: boolean;
  verifiedAt?: number;
  verifiedValue?: unknown;
  tolerance?: number;

  // Visual verification priority
  critical?: boolean;  // If true, must pass visual verification

  // Builder's explanation for this spec (shown to verifier)
  note?: string;
}

export interface SpecRegistry {
  specs: Record<string, Spec>;
  history: Spec[];
}

export interface VerificationResult {
  spec: Spec;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  deviation?: number;
  method: VerificationMethod;
  details?: string;
}

// === Agent Types ===

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool_result';
  content: string | MessageContent[];
  timestamp: number;
  toolCalls?: ToolCall[];
  toolCallId?: string; // Required for tool_result messages
}

export interface MessageContent {
  type: 'text' | 'image' | 'asset_ref';
  text?: string;
  data?: string; // base64 for images (only on first turn, then replaced with asset_ref)
  // Asset reference (replaces base64 after first processing)
  assetPath?: string; // relative path like "assets/user-image-1.png"
  assetType?: 'image' | 'svg' | 'pdf';
  description?: string; // AI-generated description of the asset for context
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

// === Agent Tools ===

export interface Skill {
  title: string;
  content: string;
  source: 'builtin' | 'user';
  path: string;
}

export interface RenderResult {
  success: boolean;
  format?: 'stl';
  output?: string; // base64
  stats?: RenderStats;
  errors?: string[];
  warnings?: string[];
}

export interface RenderStats {
  dimensions: { x: number; y: number; z: number };
  volume: number;
  surfaceArea: number;
  manifold: boolean;
  triangles: number;
  renderTime: number;
}

export interface PrintabilityResult {
  overhangs: boolean;
  thinWalls: boolean;
  supportsNeeded: boolean;
  issues: string[];
}

// === Session & Memory ===

export interface SessionIteration {
  number: number;
  action: string;
  result: 'success' | 'error' | 'warning';
  details: string;
  issues?: string[];
  learnings?: string[];
  specsChanged?: string[];
}

export interface SessionState {
  id: string;
  startedAt: number;
  goal: string;
  mode: AutonomyMode;
  currentIteration: number;
  maxIterations: number;
  iterations: SessionIteration[];
  specs: SpecRegistry;
  status: 'active' | 'completed' | 'failed' | 'paused';
}

export interface PermanentMemory {
  materials: Record<string, MaterialMemory>;
  patterns: DesignPattern[];
  mistakes: string[];
  userPreferences: Record<string, unknown>;
  lastUpdated: number;
}

export interface MaterialMemory {
  tolerances: Record<string, number>;
  notes: string[];
}

export interface DesignPattern {
  name: string;
  description: string;
  learnedFrom: string;
  code?: string;
}

// === File System ===

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export interface FileChangeEvent {
  type: 'create' | 'update' | 'delete';
  path: string;
}

// === LLM Provider ===

export type LLMProvider =
  // Cloud providers
  | 'openrouter'   // Meta-router for any model
  | 'openai'       // Direct OpenAI API
  | 'anthropic'    // Direct Anthropic API
  | 'gemini'       // Google Gemini API
  | 'groq'         // Groq (fast inference)
  | 'azure'        // Azure OpenAI
  // Local providers
  | 'ollama'       // Ollama (local)
  | 'lmstudio'     // LM Studio (local)
  | 'llamacpp'     // llama.cpp (local)
  // Custom
  | 'custom';      // Any OpenAI-compatible endpoint

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  supportsVision: boolean;
  supportsTools: boolean;
}

export interface LLMChunk {
  type: 'text' | 'tool_call' | 'done' | 'error';
  text?: string;
  toolCall?: ToolCall;
  error?: string;
}

// === UI State ===

export type ViewMode = 'code' | 'preview' | 'split';

export interface LayoutConfig {
  viewMode: ViewMode;
  filesCollapsed: boolean;
  specsCollapsed: boolean;
  chatHeight: number;
}

export interface AppSettings {
  autonomy: AutonomyConfig;
  negotiation: NegotiationConfig;
  llm: LLMConfig;
  layout: LayoutConfig;
  openscadPath?: string;
}

// === IPC API Types (Electron) ===

export interface FileSystemAPI {
  openFolder(): Promise<string | null>;
  readDirectory(path: string): Promise<FileNode[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  watchDirectory(path: string): void;
  unwatchDirectory(path: string): void;
  createFile(path: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  renameFile(oldPath: string, newPath: string): Promise<void>;
}

export interface OpenSCADAPI {
  detectPath(): Promise<string | null>;
  setPath(path: string): void;
  render(
    code: string,
    format: 'stl',
    options?: {
      mode?: 'preview' | 'final';
    }
  ): Promise<RenderResult>;
  validate(
    code: string,
    options?: { mode?: 'preview' | 'final' }
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }>;
  getVersion(): Promise<string | null>;
  renderImage(
    code: string,
    angle: VerificationAngle,
    options?: { width?: number; height?: number }
  ): Promise<{ success: boolean; image?: string; error?: string }>;
}

export interface LLMAPI {
  chat(messages: AgentMessage[], config: LLMConfig): AsyncIterable<LLMChunk>;
  listModels(provider: LLMProvider, baseUrl?: string): Promise<string[]>;
}

export interface SettingsAPI {
  load(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
}

// === Utility Types ===

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// === Verification System ===

export type VerificationAngle = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'iso';

export interface VerificationTolerances {
  code: number;         // ±0.1mm for code verification
  render_stats: number; // ±1mm for render stats
  visual: number;       // ±2mm for visual (less precise)
}

export const DEFAULT_TOLERANCES: VerificationTolerances = {
  code: 0.1,
  render_stats: 1.0,
  visual: 2.0,
};

// === Shared Config (persisted to disk, shared between GUI and CLI) ===

export interface TalkCADConfig {
  version: 1;
  llm: {
    provider: LLMProvider;
    model: string;
    apiKey?: string;
    baseUrl?: string;
  };
  researcher?: {
    provider: 'openrouter';
    model: string;
  };
  autonomy: {
    mode: AutonomyMode;
    maxIterations: number;
    maxResearchRoundTrips: number;
    maxBuilderAttempts: number;
    maxRepairAttempts: number;
  };
  webToolsEnabled: boolean;
  verification: {
    codeVerifierModel: string;
    visualVerifierModel: string;
    visualEnabled: boolean;
    enabledAngles: VerificationAngle[];
    tolerance: number;
  };
  openscadPath?: string;
  // Context management
  context?: {
    autoCompression: boolean;
    summarizerModel: string;
    threshold: number;
  };
}

export const DEFAULT_CONFIG: TalkCADConfig = {
  version: 1,
  llm: {
    provider: 'openrouter',
    model: 'google/gemini-3-flash-preview',
    apiKey: '',
    baseUrl: '',
  },
  autonomy: {
    mode: 'verified',
    maxIterations: 3,
    maxResearchRoundTrips: 3,
    maxBuilderAttempts: 10,
    maxRepairAttempts: 10,
  },
  webToolsEnabled: true,
  verification: {
    codeVerifierModel: 'google/gemini-3-flash-preview',
    visualVerifierModel: 'google/gemini-3-flash-preview',
    visualEnabled: true,
    enabledAngles: ['front', 'right', 'top', 'iso'],
    tolerance: 0.1,
  },
  context: {
    autoCompression: true,
    summarizerModel: 'google/gemini-3-flash-preview',
    threshold: 80,
  },
};
