import type { AgentMessage, LLMChunk } from '@talkcad/shared';
import type { LLMProvider, LLMProviderConfig, Tool } from './types';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  supportsVision = true; // Depends on model (llava, etc.)
  supportsTools = true; // Ollama 0.4+ supports tools

  private baseUrl: string;
  private model: string;

  constructor(config: LLMProviderConfig) {
    this.baseUrl = config.baseUrl || DEFAULT_OLLAMA_URL;
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
      // Ollama's /api/chat is *similar* to OpenAI's message schema, but not identical.
      // We include tool metadata so the model can correctly connect tool calls to tool results.
      const formatted: Record<string, unknown> = {};

      if (msg.role === 'tool_result') {
        formatted.role = 'tool';
        formatted.content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        if (msg.toolCallId) {
          formatted.tool_call_id = msg.toolCallId;
        }
        return formatted;
      }

      if (msg.role === 'assistant' && msg.toolCalls?.length) {
        formatted.role = 'assistant';
        formatted.content = typeof msg.content === 'string' ? msg.content : '';
        formatted.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            // Ollama tool call args are usually an object already; keep as-is.
            arguments: tc.arguments,
          },
        }));
        return formatted;
      }

      formatted.role = msg.role;
      const rawContent = typeof msg.content === 'string' ? msg.content : '';
      formatted.content = msg.role === 'user' ? `<user_input>\n${rawContent}\n</user_input>` : rawContent;

      // Handle images for vision models (including asset_ref for pruned images)
      if (Array.isArray(msg.content)) {
        const textParts: string[] = [];
        const images: (string | undefined)[] = [];
        
        for (const c of msg.content) {
          if (c.type === 'text' && typeof c.text === 'string' && c.text.trim().length > 0) {
            textParts.push(c.text);
          }
          if (c.type === 'image' && c.data) {
            images.push(c.data);
          }
          // Convert asset_ref to text description (image was pruned from context)
          if (c.type === 'asset_ref') {
            const desc = c.description || `[Previously attached ${c.assetType || 'file'}: ${c.assetPath || 'unknown'}]`;
            textParts.push(desc);
          }
        }

        const text = textParts.join('\n');
        formatted.content = msg.role === 'user' ? `<user_input>\n${text}\n</user_input>` : text;
        if (images.length > 0) {
          formatted.images = images;
        }
      }

      return formatted;
    });

    const body: Record<string, unknown> = {
      model: this.model,
      messages: formattedMessages,
      stream: true,
      options: {
        num_predict: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
      },
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
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      yield { type: 'error', error: `Ollama error: ${error}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const json = JSON.parse(line);

          if (json.message?.content) {
            yield { type: 'text', text: json.message.content };
          }

          if (json.message?.tool_calls) {
            for (const tc of json.message.tool_calls) {
              const rawArgs = tc.function?.arguments;
              let args: Record<string, unknown> = {};
              if (rawArgs && typeof rawArgs === 'object') {
                args = rawArgs as Record<string, unknown>;
              } else if (typeof rawArgs === 'string' && rawArgs.trim().length > 0) {
                try {
                  args = JSON.parse(rawArgs) as Record<string, unknown>;
                } catch {
                  yield { type: 'error', error: `Failed to parse tool call arguments for "${tc.function?.name}"` };
                  continue;
                }
              }

              yield {
                type: 'tool_call',
                toolCall: {
                  id: tc.id || `tool_${Date.now()}`,
                  name: tc.function.name,
                  arguments: args,
                },
              };
            }
          }

          if (json.done) {
            yield { type: 'done' };
            return;
          }
        } catch {
          // Ignore parse errors in stream
        }
      }
    }

    yield { type: 'done' };
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];

      const data = await response.json();
      return data.models?.map((m: { name: string }) => m.name) || [];
    } catch {
      return [];
    }
  }
}
