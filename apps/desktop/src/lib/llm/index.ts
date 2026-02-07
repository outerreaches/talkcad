import type { LLMProvider as LLMProviderType } from '@talkcad/shared';
import type { LLMProvider, LLMProviderConfig } from './types';
import { OpenRouterProvider } from './openrouter';
import { OllamaProvider } from './ollama';
import { OpenAICompatibleProvider } from './openai_compatible';

export type { LLMProvider, LLMProviderConfig, Tool } from './types';

export function createProvider(
  type: LLMProviderType,
  config: LLMProviderConfig
): LLMProvider {
  switch (type) {
    case 'openrouter':
      return new OpenRouterProvider(config);
    case 'openai':
      // Direct OpenAI API
      return new OpenAICompatibleProvider('openai', {
        ...config,
        baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      });
    case 'anthropic':
      // Anthropic is NOT OpenAI-compatible. Use OpenRouter with an Anthropic model id instead.
      // (Native Anthropic provider can be implemented later.)
      throw new Error('Anthropic direct provider is not supported. Use OpenRouter with an Anthropic model (e.g. "anthropic/claude-sonnet-4").');
    case 'gemini':
      // Google Gemini uses OpenAI-compatible API
      return new OpenAICompatibleProvider('gemini', {
        ...config,
        baseUrl: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai',
      });
    case 'groq':
      // Groq uses OpenAI-compatible API
      return new OpenAICompatibleProvider('groq', {
        ...config,
        baseUrl: config.baseUrl || 'https://api.groq.com/openai/v1',
      });
    case 'azure':
      // Azure OpenAI requires custom base URL from user
      return new OpenAICompatibleProvider('azure', {
        ...config,
        baseUrl: config.baseUrl || '', // User must provide
      });
    case 'ollama':
      return new OllamaProvider(config);
    case 'lmstudio':
      // LM Studio uses an OpenAI-compatible API (default: http://localhost:1234/v1)
      return new OpenAICompatibleProvider('lmstudio', {
        ...config,
        baseUrl: config.baseUrl || 'http://localhost:1234',
      });
    case 'llamacpp':
      // llama.cpp servers often expose an OpenAI-compatible API (commonly http://localhost:8080/v1)
      return new OpenAICompatibleProvider('llamacpp', {
        ...config,
        baseUrl: config.baseUrl || 'http://localhost:8080',
      });
    case 'custom':
      // Custom OpenAI-compatible endpoint
      return new OpenAICompatibleProvider('custom', {
        ...config,
        baseUrl: config.baseUrl || '',
      });
    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}
