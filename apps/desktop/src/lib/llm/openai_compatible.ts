import type { AgentMessage, LLMChunk } from '@talkcad/shared';
import type { LLMProvider, LLMProviderConfig, Tool } from './types';

// Providers that use OpenAI-compatible API format
type OpenAICompatKind = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'azure' | 'lmstudio' | 'llamacpp' | 'custom';

function inferImageMimeFromBase64(base64: string): string {
  const b = base64.trim();
  if (b.startsWith('iVBORw0KGgo')) return 'image/png';
  if (b.startsWith('/9j/')) return 'image/jpeg';
  if (b.startsWith('R0lGOD')) return 'image/gif';
  if (b.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

function normalizeOpenAIBaseUrl(url: string): string {
  let u = (url || '').trim();
  if (!u) u = 'http://localhost:1234';
  u = u.replace(/\/+$/, '');
  // Accept either http://host:port or http://host:port/v1
  if (!u.endsWith('/v1')) u = `${u}/v1`;
  return u;
}

export class OpenAICompatibleProvider implements LLMProvider {
  name: OpenAICompatKind;
  supportsVision = true;
  supportsTools = true;

  private baseUrl: string;
  private apiKey?: string;
  private model: string;

  constructor(kind: OpenAICompatKind, config: LLMProviderConfig) {
    this.name = kind;
    this.baseUrl = normalizeOpenAIBaseUrl(config.baseUrl || '');
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  async *chat(
    messages: AgentMessage[],
    options?: {
      tools?: Tool[];
      maxTokens?: number;
      temperature?: number;
      toolChoice?: 'auto' | 'required';
    }
  ): AsyncGenerator<LLMChunk> {
    const formattedMessages = messages.map((msg) => {
      if (msg.role === 'tool_result') {
        return {
          role: 'tool' as const,
          tool_call_id: msg.toolCallId,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        };
      }

      if (msg.role === 'assistant' && msg.toolCalls?.length) {
        return {
          role: 'assistant' as const,
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }

      // Multimodal content support (OpenAI-style, including asset_ref for pruned images)
      if (Array.isArray(msg.content)) {
        // Collect text parts including asset_ref descriptions
        const textParts: string[] = [];
        for (const p of msg.content) {
          if (p.type === 'text' && typeof p.text === 'string' && p.text.trim().length > 0) {
            textParts.push(p.text);
          }
          // Convert asset_ref to text description (image was pruned from context)
          if (p.type === 'asset_ref') {
            const desc = p.description || `[Previously attached ${p.assetType || 'file'}: ${p.assetPath || 'unknown'}]`;
            textParts.push(desc);
          }
        }

        const text = textParts.join('\n');
        const wrappedText =
          msg.role === 'user' ? `<user_input>\n${text}\n</user_input>` : text;

        const content: Array<Record<string, unknown>> = [];
        if (wrappedText.trim().length > 0) {
          content.push({ type: 'text' as const, text: wrappedText });
        }

        // Include actual images (only present on first turn before pruning)
        for (const part of msg.content) {
          if (part.type !== 'image' || !part.data) continue;
          const mime = inferImageMimeFromBase64(part.data);
          content.push({
            type: 'image_url' as const,
            image_url: {
              url: `data:${mime};base64,${part.data}`,
            },
          });
        }

        return { role: msg.role, content };
      }

      return {
        role: msg.role,
        content: msg.role === 'user' ? `<user_input>\n${msg.content}\n</user_input>` : msg.content,
      };
    });

    const body: Record<string, unknown> = {
      model: this.model,
      messages: formattedMessages,
      stream: false,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
    };

    if (options?.tools?.length) {
      body.tools = options.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      body.tool_choice = options.toolChoice ?? 'auto';
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey && this.apiKey.trim().length > 0) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    try {
      // In Electron renderer, direct fetch can fail due to CORS; prefer IPC via preload if available.
      const ipcOpenAICompatChat =
        typeof window !== 'undefined' ? (window as any).api?.llm?.openaiCompatChat : undefined;

      if (typeof ipcOpenAICompatChat === 'function') {
        const result = await ipcOpenAICompatChat({
          kind: this.name,
          apiKey: this.apiKey,
          baseUrl: this.baseUrl,
          body,
        });

        if (!result?.ok) {
          yield { type: 'error', error: `${this.name} error: ${result?.error || 'Unknown error'}` };
          return;
        }

        const msg = (result.data as any)?.choices?.[0]?.message;
        const content = msg?.content;

        if (typeof content === 'string' && content.length > 0) {
          yield { type: 'text', text: content };
        }

        const toolCalls = msg?.tool_calls;
        if (Array.isArray(toolCalls)) {
          for (const tc of toolCalls) {
            const name: string = tc?.function?.name || '';
            const argsStr: string = tc?.function?.arguments || '';
            let args: Record<string, unknown> = {};
            if (typeof argsStr === 'string' && argsStr.trim().length > 0) {
              try {
                args = JSON.parse(argsStr) as Record<string, unknown>;
              } catch {
                yield { type: 'error', error: `Failed to parse tool call arguments for "${name}"` };
                continue;
              }
            }

            yield {
              type: 'tool_call',
              toolCall: {
                id: tc?.id || `tool_${Date.now()}`,
                name,
                arguments: args,
              },
            };
          }
        }

        yield { type: 'done' };
        return;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const text = await response.text();
      if (!response.ok) {
        yield { type: 'error', error: `${this.name} error: ${text}` };
        return;
      }

      const json = JSON.parse(text);
      const msg = json?.choices?.[0]?.message;
      const content = msg?.content;

      if (typeof content === 'string' && content.length > 0) {
        yield { type: 'text', text: content };
      }

      const toolCalls = msg?.tool_calls;
      if (Array.isArray(toolCalls)) {
        for (const tc of toolCalls) {
          const name: string = tc?.function?.name || '';
          const argsStr: string = tc?.function?.arguments || '';
          let args: Record<string, unknown> = {};
          if (typeof argsStr === 'string' && argsStr.trim().length > 0) {
            try {
              args = JSON.parse(argsStr) as Record<string, unknown>;
            } catch {
              yield { type: 'error', error: `Failed to parse tool call arguments for "${name}"` };
              continue;
            }
          }

          yield {
            type: 'tool_call',
            toolCall: {
              id: tc?.id || `tool_${Date.now()}`,
              name,
              arguments: args,
            },
          };
        }
      }

      yield { type: 'done' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      yield { type: 'error', error: `${this.name} error: ${msg}` };
    }
  }

  async listModels(): Promise<string[]> {
    const ipcOpenAICompatModels =
      typeof window !== 'undefined' ? (window as any).api?.llm?.openaiCompatModels : undefined;
    if (typeof ipcOpenAICompatModels === 'function') {
      const result = await ipcOpenAICompatModels({
        kind: this.name,
        apiKey: this.apiKey,
        baseUrl: this.baseUrl,
      });
      if (!result?.ok) return [];
      const data = result.data as any;
      const ids = Array.isArray(data?.data)
        ? data.data
          .map((m: { id?: unknown }) => (typeof m?.id === 'string' ? m.id : null))
          .filter((x: string | null): x is string => Boolean(x))
        : [];
      return ids;
    }

    const headers: Record<string, string> = {};
    if (this.apiKey && this.apiKey.trim().length > 0) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, { headers });
      if (!response.ok) return [];
      const data = await response.json();
      const ids = Array.isArray(data?.data)
        ? data.data
          .map((m: { id?: unknown }) => (typeof m?.id === 'string' ? m.id : null))
          .filter((x: string | null): x is string => Boolean(x))
        : [];
      return ids;
    } catch {
      return [];
    }
  }
}

