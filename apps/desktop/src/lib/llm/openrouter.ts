import type { AgentMessage, LLMChunk } from '@talkcad/shared';
import type { LLMProvider, LLMProviderConfig, Tool } from './types';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

function inferImageMimeFromBase64(base64: string): string {
  // Very small “magic number” sniffing from base64 prefixes.
  // PNG: 89 50 4E 47 0D 0A 1A 0A → iVBORw0KGgo
  // JPEG: FF D8 FF → /9j/
  // GIF: 47 49 46 38 → R0lGOD
  // WEBP: RIFF....WEBP → UklGR
  const b = base64.trim();
  if (b.startsWith('iVBORw0KGgo')) return 'image/png';
  if (b.startsWith('/9j/')) return 'image/jpeg';
  if (b.startsWith('R0lGOD')) return 'image/gif';
  if (b.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

export class OpenRouterProvider implements LLMProvider {
  name = 'openrouter';
  supportsVision = true;
  supportsTools = true;

  private apiKey: string;
  private model: string;

  constructor(config: LLMProviderConfig) {
    if (!config.apiKey) {
      throw new Error('OpenRouter API key is required');
    }
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
        // Tool results need special formatting
        return {
          role: 'tool' as const,
          tool_call_id: msg.toolCallId,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        };
      }
      if (msg.role === 'assistant' && msg.toolCalls?.length) {
        // Assistant messages with tool calls need proper formatting
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

      // Handle multimodal content (arrays with image/text/asset_ref parts)
      if (Array.isArray(msg.content)) {
        // Collect text parts
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

        const formattedContent: Array<Record<string, unknown>> = [];
        if (wrappedText.trim().length > 0) {
          formattedContent.push({ type: 'text' as const, text: wrappedText });
        }

        // Include actual images (only present on first turn before pruning)
        for (const part of msg.content) {
          if (part.type !== 'image' || !part.data) continue;
          const mime = inferImageMimeFromBase64(part.data);
          formattedContent.push({
            type: 'image_url' as const,
            image_url: {
              url: `data:${mime};base64,${part.data}`,
            },
          });
        }

        return {
          role: msg.role,
          content: formattedContent,
        };
      }

      return {
        role: msg.role,
        content: msg.role === 'user' ? `<user_input>\n${msg.content}\n</user_input>` : msg.content,
      };
    });

    const body: Record<string, unknown> = {
      model: this.model,
      messages: formattedMessages,
      stream: true,
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

    // Debug logging
    if (typeof process !== 'undefined' && process.env?.DEBUG_LLM) {
      console.log('[DEBUG] Request body:', JSON.stringify(body, null, 2));
    }

    // In Electron renderer, direct fetch can fail due to CORS; prefer IPC via preload if available.
    const ipcOpenRouterChat =
      typeof window !== 'undefined' ? (window as any).api?.llm?.openrouterChat : undefined;

    if (typeof ipcOpenRouterChat === 'function') {
      const nonStreamingBody = { ...body, stream: false };
      const result = await ipcOpenRouterChat({ apiKey: this.apiKey, body: nonStreamingBody });

      if (!result?.ok) {
        yield { type: 'error', error: `OpenRouter error: ${result?.error || 'Unknown error'}` };
        return;
      }

      const content: string | null | undefined = result.data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.length > 0) {
        yield { type: 'text', text: content };
      }

      const toolCalls = result.data?.choices?.[0]?.message?.tool_calls;
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

    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://talkcad.app',
        'X-Title': 'TalkCAD',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      yield { type: 'error', error: `OpenRouter error: ${error}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    type PendingToolCall = { id: string; name: string; arguments: string };
    const pendingToolCalls = new Map<number, PendingToolCall>();

    const flushPendingToolCalls = (): { chunks: LLMChunk[]; ok: boolean } => {
      if (pendingToolCalls.size === 0) return { chunks: [], ok: true };

      const toolCalls = Array.from(pendingToolCalls.entries()).sort(([a], [b]) => a - b);
      pendingToolCalls.clear();

      const chunks: LLMChunk[] = [];
      for (const [index, tc] of toolCalls) {
        if (!tc.name) {
          return { chunks: [{ type: 'error', error: 'Tool call missing function name' }], ok: false };
        }

        try {
          const args =
            typeof tc.arguments === 'string' && tc.arguments.trim().length > 0
              ? (JSON.parse(tc.arguments) as Record<string, unknown>)
              : {};

          chunks.push({
            type: 'tool_call',
            toolCall: {
              id: tc.id || `tool_${Date.now()}_${index}`,
              name: tc.name,
              arguments: args,
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            chunks: [{ type: 'error', error: `Failed to parse tool call arguments for "${tc.name}": ${msg}` }],
            ok: false,
          };
        }
      }

      return { chunks, ok: true };
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') {
          // Some providers may not send finish_reason reliably; flush any pending tool calls.
          const { chunks, ok } = flushPendingToolCalls();
          for (const chunk of chunks) yield chunk;
          if (!ok) return;
          yield { type: 'done' };
          return;
        }

        try {
          const json = JSON.parse(data);
          const choice = json.choices?.[0];
          const delta = choice?.delta;
          const finishReason: string | undefined = choice?.finish_reason;

          if (typeof delta?.content === 'string' && delta.content.length > 0) {
            yield { type: 'text', text: delta.content };
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index: number =
                typeof tc.index === 'number' ? tc.index : pendingToolCalls.size;

              const existing = pendingToolCalls.get(index) || { id: '', name: '', arguments: '' };
              if (typeof tc.id === 'string' && tc.id) existing.id = tc.id;

              const fn = tc.function;
              if (typeof fn?.name === 'string' && fn.name) existing.name = fn.name;

              const argChunk = fn?.arguments;
              if (typeof argChunk === 'string' && argChunk.length > 0) {
                existing.arguments += argChunk;
              } else if (argChunk != null && typeof argChunk !== 'string') {
                existing.arguments += JSON.stringify(argChunk);
              }

              pendingToolCalls.set(index, existing);
            }
          }

          if (finishReason === 'tool_calls') {
            const { chunks, ok } = flushPendingToolCalls();
            for (const chunk of chunks) yield chunk;
            if (!ok) return;
          }
        } catch {
          // Ignore parse errors in stream
        }
      }
    }

    // Emit any remaining tool calls if the stream ended without finish_reason="tool_calls"
    const { chunks, ok } = flushPendingToolCalls();
    for (const chunk of chunks) yield chunk;
    if (!ok) return;

    yield { type: 'done' };
  }

  async listModels(): Promise<string[]> {
    const ipcOpenRouterModels =
      typeof window !== 'undefined' ? (window as any).api?.llm?.openrouterModels : undefined;
    if (typeof ipcOpenRouterModels === 'function') {
      const result = await ipcOpenRouterModels(this.apiKey);
      if (!result?.ok) return [];
      return result.data?.data?.map((m: { id: string }) => m.id) || [];
    }

    const response = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data?.map((m: { id: string }) => m.id) || [];
  }
}
