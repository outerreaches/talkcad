import { useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useChatStore, useEditorStore, useSpecsStore, useRenderStore, useHistoryStore } from '../store';
import type { AgentMessage, Spec } from '@talkcad/shared';

interface SessionMeta {
    id: string;
    path: string;
    name: string;
    created: string;
    modified: string;
}

interface SessionState {
    currentSessionId: string | null;
    currentSessionName: string;
    sessions: SessionMeta[];
    isLoading: boolean;
}

// Session state store with subscription support
let sessionState: SessionState = {
    currentSessionId: null,
    currentSessionName: 'Untitled Design',
    sessions: [],
    isLoading: false,
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot() {
    return sessionState;
}

function updateState(updates: Partial<SessionState>) {
    sessionState = { ...sessionState, ...updates };
    listeners.forEach((l) => l());
}

export function useSession() {
    // Subscribe to session state changes
    const state = useSyncExternalStore(subscribe, getSnapshot);

    const messages = useChatStore((s) => s.messages);
    const addMessage = useChatStore((s) => s.addMessage);
    const clearMessages = useChatStore((s) => s.clearMessages);
    const clearHistory = useHistoryStore((s) => s.clearHistory);
    const replaceHistory = useHistoryStore((s) => s.replaceHistory);
    const historyState = useHistoryStore((s) => ({ checkpoints: s.checkpoints, order: s.order }));

    const code = useEditorStore((s) => s.code);
    const setCode = useEditorStore((s) => s.setCode);

    const specs = useSpecsStore((s) => s.specs);
    const setSpec = useSpecsStore((s) => s.setSpec);
    const clearSpecs = useSpecsStore((s) => s.clearSpecs);

    const stlData = useRenderStore((s) => s.stlData);
    const setRenderResult = useRenderStore((s) => s.setRenderResult);
    const clearRender = useRenderStore((s) => s.clearRender);

    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isInitializedRef = useRef(false);

    // Auto-save debounced
    const sanitizeMessagesForSave = useCallback((msgs: AgentMessage[]): AgentMessage[] => {
        const maxChars = 8000;
        return msgs.map((m) => {
            // Never persist raw base64 image data inside chat history.
            // Images should be stored as session assets and referenced via `asset_ref`.
            if (Array.isArray(m.content)) {
                const next = (m.content as any[]).map((p) => {
                    if (p?.type === 'image') {
                        return {
                            type: 'asset_ref' as const,
                            assetType: 'image' as const,
                            assetPath: p.assetPath,
                            description: p.description || '[image omitted from save]',
                        };
                    }
                    return p;
                });
                m = { ...m, content: next as any };
            }

            if (m.role === 'tool_result' && typeof m.content === 'string' && m.content.length > maxChars) {
                const head = m.content.slice(0, Math.floor(maxChars * 0.6));
                const tail = m.content.slice(-Math.floor(maxChars * 0.4));
                return {
                    ...m,
                    content: `${head}\n...[${m.content.length - maxChars} chars truncated]...\n${tail}`,
                };
            }
            return m;
        });
    }, []);

    const autoSave = useCallback(async () => {
        if (!state.currentSessionId) return;

        try {
            await window.api.session.save(state.currentSessionId, {
                chat: sanitizeMessagesForSave(messages),
                specs: specs,
                code: code,
                stlData: stlData || undefined,
                history: historyState,
            });
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }, [state.currentSessionId, sanitizeMessagesForSave, messages, specs, code, stlData, historyState]);

    // Debounced save on changes (skip initial load)
    useEffect(() => {
        if (!state.currentSessionId || !isInitializedRef.current) return;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            autoSave();
        }, 1000);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [messages, specs, code, stlData, historyState, autoSave, state.currentSessionId]);

    // Create new session
    const createSession = useCallback(async (name?: string) => {
        // Clear all stores
        clearMessages();
        clearHistory();
        clearSpecs();
        clearRender();
        setCode('');

        // Create on disk
        const newSession = await window.api.session.create(name);
        updateState({
            currentSessionId: newSession.id,
            currentSessionName: newSession.name,
        });

        // Reset agent state (AgentLoop keeps its own internal message history)
        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('talkcad:session-changed', {
                    detail: { sessionId: newSession.id, action: 'create' },
                })
            );
        }

        // Refresh list
        const sessions = await window.api.session.list();
        updateState({ sessions });

        return newSession;
    }, [clearMessages, clearHistory, clearSpecs, clearRender, setCode]);

    // Load session
    const loadSession = useCallback(async (sessionId: string) => {
        const sessionData = await window.api.session.load(sessionId);
        if (!sessionData) return null;

        // Clear current state
        clearMessages();
        clearHistory();
        clearSpecs();
        clearRender();

        // Populate stores
        const loadedChat = (sessionData.chat as AgentMessage[]).map((m) => {
            if (m.role === 'tool_result' && typeof m.content === 'string') {
                const maxChars = 8000;
                if (m.content.length > maxChars) {
                    const head = m.content.slice(0, Math.floor(maxChars * 0.6));
                    const tail = m.content.slice(-Math.floor(maxChars * 0.4));
                    return {
                        ...m,
                        content: `${head}\n...[${m.content.length - maxChars} chars truncated]...\n${tail}`,
                    };
                }
            }
            return m;
        });

        loadedChat.forEach((msg) => addMessage(msg as AgentMessage));
        Object.values(sessionData.specs).forEach((spec) => setSpec(spec as Spec));
        setCode(sessionData.code);
        const loadedHistory = (sessionData as any).history as { checkpoints?: unknown; order?: unknown } | undefined;
        replaceHistory({
            checkpoints: (loadedHistory?.checkpoints as any) || {},
            order: (loadedHistory?.order as any) || [],
        });

        // Update session state
        updateState({
            currentSessionId: sessionId,
            currentSessionName: sessionData.meta.name,
        });

        // Restore STL if exists (will trigger re-render in preview)
        if (sessionData.stlData) {
            // Parse stats from the saved STL data
            const stats = await window.api.openscad.parseStlStats(sessionData.stlData);
            setRenderResult(sessionData.stlData, stats, [], []);
        }

        // Reset agent so the next message uses the loaded chat history as context
        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('talkcad:session-changed', {
                    detail: { sessionId, action: 'load' },
                })
            );
        }

        return sessionData;
    }, [clearMessages, clearHistory, clearSpecs, clearRender, addMessage, setSpec, setCode, setRenderResult, replaceHistory]);

    // Clear chat but keep specs/code (Start Fresh)
    const startFresh = useCallback(async () => {
        clearMessages();
        clearHistory();

        if (state.currentSessionId) {
            await window.api.session.save(state.currentSessionId, {
                chat: [],
            });
        }

        // Reset agent so it doesn't keep old conversation context
        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('talkcad:session-changed', {
                    detail: { sessionId: state.currentSessionId, action: 'startFresh' },
                })
            );
        }
    }, [clearMessages, clearHistory, state.currentSessionId]);

    // Rename session
    const renameSession = useCallback(async (newName: string) => {
        if (!state.currentSessionId) return;

        await window.api.session.rename(state.currentSessionId, newName);
        updateState({ currentSessionName: newName });

        // Refresh list
        const sessions = await window.api.session.list();
        updateState({ sessions });
    }, [state.currentSessionId]);

    // Delete session
    const deleteSession = useCallback(async (sessionId: string) => {
        await window.api.session.delete(sessionId);

        const wasActive = state.currentSessionId === sessionId;

        if (wasActive) {
            // Stop any running agent immediately (before clearing stores) so it can't stream into a new session.
            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new CustomEvent('talkcad:session-changed', {
                        detail: { sessionId: null, action: 'delete' },
                    })
                );
            }

            // Clear all UI stores
            clearMessages();
            clearHistory();
            clearSpecs();
            clearRender();
            setCode('');

            updateState({
                currentSessionId: null,
                currentSessionName: 'Untitled Design',
            });

            // (agent already stopped above)
        }

        // Refresh list
        const sessions = await window.api.session.list();
        updateState({ sessions });
    }, [state.currentSessionId, clearMessages, clearHistory, clearSpecs, clearRender, setCode]);

    // Refresh session list
    const refreshSessions = useCallback(async () => {
        const sessions = await window.api.session.list();
        updateState({ sessions });
    }, []);

    // Initialize: load sessions list and check for active session
    const initialize = useCallback(async () => {
        if (isInitializedRef.current) return;

        updateState({ isLoading: true });

        try {
            const sessions = await window.api.session.list();
            updateState({ sessions });

            // If sessions exist, load the most recent
            if (sessions.length > 0) {
                await loadSession(sessions[0].id);
            } else {
                // Create a new session if none exist
                await createSession();
            }

            isInitializedRef.current = true;
        } finally {
            updateState({ isLoading: false });
        }
    }, [loadSession, createSession]);

    return {
        currentSessionId: state.currentSessionId,
        currentSessionName: state.currentSessionName,
        sessions: state.sessions,
        isLoading: state.isLoading,
        createSession,
        loadSession,
        startFresh,
        renameSession,
        deleteSession,
        refreshSessions,
        initialize,
    };
}
