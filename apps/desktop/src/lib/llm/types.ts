import type { AgentMessage, LLMChunk } from '@talkcad/shared';

export interface LLMProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type?: string;
      description?: string;
      enum?: string[];
      items?: { type: string; enum?: string[] };  // For array types
    }>;
    required?: string[];
  };
}

export interface LLMProvider {
  name: string;
  supportsVision: boolean;
  supportsTools: boolean;

  chat(
    messages: AgentMessage[],
    options?: {
      tools?: Tool[];
      maxTokens?: number;
      temperature?: number;
      toolChoice?: 'auto' | 'required';
    }
  ): AsyncGenerator<LLMChunk>;

  listModels(): Promise<string[]>;
}
