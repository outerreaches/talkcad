import { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '../store';
import { useSession } from '../hooks';
import { SettingsModal } from './SettingsModal';

// Providers that require an API key (matches SettingsModal.tsx)
const PROVIDERS_REQUIRING_API_KEY = new Set([
  'openrouter', 'openai', 'gemini', 'groq', 'custom'
]);

export function TitleBar() {
  const llmModel = useSettingsStore((s) => s.llmModel);
  const llmProvider = useSettingsStore((s) => s.llmProvider);
  const llmApiKey = useSettingsStore((s) => s.llmApiKey);
  const [showSettings, setShowSettings] = useState(false);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    currentSessionName,
    sessions,
    createSession,
    loadSession,
    deleteSession,
    renameSession,
    startFresh,
    initialize,
    refreshSessions,
  } = useSession();

  const needsApiKey = PROVIDERS_REQUIRING_API_KEY.has(llmProvider) && !llmApiKey;

  // Initialize session on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSessionMenu(false);
      }
    };
    if (showSessionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSessionMenu]);

  // Focus input when editing
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const handleStartEditing = () => {
    setEditName(currentSessionName);
    setIsEditingName(true);
  };

  const handleSaveEdit = async () => {
    if (editName.trim() && editName !== currentSessionName) {
      await renameSession(editName.trim());
    }
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
    }
  };

  const handleNewSession = async () => {
    await createSession();
    setShowSessionMenu(false);
  };

  const handleLoadSession = async (sessionId: string) => {
    await loadSession(sessionId);
    setShowSessionMenu(false);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this session?')) {
      await deleteSession(sessionId);
      await refreshSessions();
    }
  };

  const handleStartFresh = async () => {
    await startFresh();
    setShowSessionMenu(false);
  };

  return (
    <>
      <div className="flex items-center justify-between h-10 px-4 bg-zinc-800 border-b border-zinc-700 draggable">
        {/* Left spacer for macOS window controls */}
        <div className="w-20" />

        {/* Center - Session name with dropdown */}
        <div className="flex items-center gap-2 relative" ref={menuRef}>
          <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-xs font-bold">
            T
          </div>

          {isEditingName ? (
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              className="bg-zinc-700 text-sm font-medium text-zinc-100 px-2 py-0.5 rounded border border-blue-500 outline-none w-48"
            />
          ) : (
            <button
              onClick={() => setShowSessionMenu(!showSessionMenu)}
              onDoubleClick={handleStartEditing}
              className="flex items-center gap-1 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-colors"
            >
              <span className="max-w-48 truncate">{currentSessionName}</span>
              <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {/* Session dropdown */}
          {showSessionMenu && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50">
              {/* New Session */}
              <button
                onClick={handleNewSession}
                className="w-full px-3 py-2 text-sm text-left text-blue-400 hover:bg-zinc-700/50 flex items-center gap-2 border-b border-zinc-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Session
              </button>

              {/* Start Fresh */}
              <button
                onClick={handleStartFresh}
                className="w-full px-3 py-2 text-sm text-left text-amber-400 hover:bg-zinc-700/50 flex items-center gap-2 border-b border-zinc-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Start Fresh (keep code & specs)
              </button>

              {/* Session list */}
              <div className="max-h-64 overflow-y-auto">
                {sessions.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-zinc-500 text-center">
                    No saved sessions
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => handleLoadSession(session.id)}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-zinc-700/50 flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-zinc-200 truncate">{session.name}</div>
                        <div className="text-xs text-zinc-500">
                          {new Date(session.modified).toLocaleDateString()}{' '}
                          {new Date(session.modified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right - Controls */}
        <div className="flex items-center gap-2 justify-end">
          {/* API key warning - only show if provider requires key */}
          {needsApiKey && (
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
            >
              ⚠ Set API Key
            </button>
          )}

          {/* Model indicator */}
          <span className="text-xs text-zinc-500 px-2 py-0.5 rounded bg-zinc-700/50 whitespace-nowrap">
            {llmModel.split('/').pop()}
          </span>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
