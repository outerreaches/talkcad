/**
 * LLM (OpenRouter) IPC handlers
 */
import { ipcMain } from 'electron';

function buildAuthHeaders(kind: string, apiKey?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const key = (apiKey || '').trim();
    if (!key) return headers;

    switch ((kind || '').toLowerCase()) {
        case 'gemini':
            // Gemini OpenAI-compatible endpoint uses x-goog-api-key
            headers['x-goog-api-key'] = key;
            return headers;
        case 'azure':
            // Azure OpenAI commonly uses api-key header
            headers['api-key'] = key;
            return headers;
        default:
            headers.Authorization = `Bearer ${key}`;
            return headers;
    }
}

export function registerLlmHandlers() {
    ipcMain.handle('llm:openrouterChat', async (_, args: { apiKey: string; body: Record<string, unknown> }) => {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${args.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://talkcad.app',
                    'X-Title': 'TalkCAD',
                },
                body: JSON.stringify(args.body),
            });

            const text = await response.text();
            if (!response.ok) return { ok: false as const, error: text };

            try {
                return { ok: true as const, data: JSON.parse(text) };
            } catch {
                return { ok: false as const, error: text };
            }
        } catch (e) {
            return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
    });

    ipcMain.handle('llm:openrouterModels', async (_, apiKey: string) => {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: { Authorization: `Bearer ${apiKey}` },
            });

            const text = await response.text();
            if (!response.ok) return { ok: false as const, error: text };

            try {
                return { ok: true as const, data: JSON.parse(text) };
            } catch {
                return { ok: false as const, error: text };
            }
        } catch (e) {
            return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
    });

    // Generic OpenAI-compatible proxy (avoids CORS by running in main process)
    ipcMain.handle('llm:openaiCompatChat', async (_, args: { kind: string; apiKey?: string; baseUrl: string; body: Record<string, unknown> }) => {
        try {
            const baseUrl = (args.baseUrl || '').trim().replace(/\/+$/, '');
            if (!baseUrl) return { ok: false as const, error: 'Missing baseUrl' };

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...buildAuthHeaders(args.kind, args.apiKey),
                },
                body: JSON.stringify(args.body),
            });

            const text = await response.text();
            if (!response.ok) return { ok: false as const, error: text };

            try {
                return { ok: true as const, data: JSON.parse(text) };
            } catch {
                return { ok: false as const, error: text };
            }
        } catch (e) {
            return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
    });

    ipcMain.handle('llm:openaiCompatModels', async (_, args: { kind: string; apiKey?: string; baseUrl: string }) => {
        try {
            const baseUrl = (args.baseUrl || '').trim().replace(/\/+$/, '');
            if (!baseUrl) return { ok: false as const, error: 'Missing baseUrl' };

            const response = await fetch(`${baseUrl}/models`, {
                headers: buildAuthHeaders(args.kind, args.apiKey),
            });

            const text = await response.text();
            if (!response.ok) return { ok: false as const, error: text };

            try {
                return { ok: true as const, data: JSON.parse(text) };
            } catch {
                return { ok: false as const, error: text };
            }
        } catch (e) {
            return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
    });
}
