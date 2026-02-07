import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';
import { clsx } from 'clsx';
import { useChatStore, useSettingsStore, useLayoutStore, useHistoryStore, useRenderStore, type AgentContextKey, type AgentContextInfo } from '../store';
import { useOrchestrator, useSession } from '../hooks';
import { DebugPanel } from './DebugPanel';
import type { AutonomyMode, NegotiationLevel } from '@talkcad/shared';

const AUTONOMY_LABELS: Record<AutonomyMode, string> = {
  guided: 'Guided',
  researched: 'Researched',
  verified: 'Verified',
  ralph: 'Ralph',
};

const NEGOTIATION_LABELS: Record<NegotiationLevel, string> = {
  agreeable: 'Agreeable',
  helpful: 'Helpful',
  opinionated: 'Opinionated',
  strict: 'Strict',
  cranky: 'Cranky',
};

function inferImageMimeFromBase64(base64: string): string {
  const b = base64.trim();
  if (b.startsWith('iVBORw0KGgo')) return 'image/png';
  if (b.startsWith('/9j/')) return 'image/jpeg';
  if (b.startsWith('R0lGOD')) return 'image/gif';
  if (b.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

function getMessageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((p: any) => p && p.type === 'text')
      .map((p: any) => p.text)
      .filter((t: any): t is string => typeof t === 'string')
      .join('\n');
  }
  return '';
}

type ImageRef =
  | { kind: 'inline'; base64: string }
  | { kind: 'asset'; assetPath: string };

function getMessageImages(content: unknown): ImageRef[] {
  if (!Array.isArray(content)) return [];
  const out: ImageRef[] = [];
  for (const p of content as any[]) {
    if (!p || typeof p !== 'object') continue;
    if (p.type === 'image' && typeof p.data === 'string' && p.data.length > 0) {
      out.push({ kind: 'inline', base64: p.data });
      continue;
    }
    if (p.type === 'asset_ref' && p.assetType === 'image' && typeof p.assetPath === 'string' && p.assetPath.length > 0) {
      out.push({ kind: 'asset', assetPath: p.assetPath });
      continue;
    }
  }
  return out;
}

function AssetImage({ sessionId, assetPath }: { sessionId: string | null; assetPath: string }) {
  const [data, setData] = useState<{ base64?: string; contentType?: string; error?: string }>({});

  useEffect(() => {
    let cancelled = false;
    if (!sessionId || !assetPath) return;
    if (typeof window === 'undefined' || !window.api?.session?.readAsset) return;

    window.api.session.readAsset({ sessionId, assetPath })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.base64) {
          setData({ base64: res.base64, contentType: res.contentType || 'image/png' });
        } else {
          setData({ error: res.error || 'Failed to load asset' });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setData({ error: String(e) });
      });

    return () => { cancelled = true; };
  }, [assetPath, sessionId]);

  if (data.error) {
    return (
      <div className="w-24 h-24 flex items-center justify-center rounded border border-zinc-600 text-[10px] text-zinc-500">
        asset
      </div>
    );
  }
  if (!data.base64) {
    return (
      <div className="w-24 h-24 flex items-center justify-center rounded border border-zinc-600 text-[10px] text-zinc-500">
        loading…
      </div>
    );
  }
  return (
    <img
      src={`data:${data.contentType || 'image/png'};base64,${data.base64}`}
      alt="Attachment"
      className="w-24 h-24 object-cover rounded border border-zinc-600"
    />
  );
}

// Agent label mappings for UI
const AGENT_LABELS: Record<AgentContextKey, string> = {
  orchestrator: 'Orch',
  builder: 'Build',
  researcher: 'Research',
};

export function ChatPanel() {
  const { messages, isStreaming, currentIteration, agentContexts, verificationStatus, agentActivity } = useChatStore();
  const checkpoints = useHistoryStore((s) => s.checkpoints);
  const { autonomyMode, negotiationLevel, debugMode, maxIterations, contextVisibilityThreshold, setAutonomyMode, setNegotiationLevel, setDebugMode } = useSettingsStore();
  const chatHeight = useLayoutStore((s) => s.chatHeight);
  const setChatHeight = useLayoutStore((s) => s.setChatHeight);
  const captureViewport = useRenderStore((s) => s.captureViewport);
  const stlData = useRenderStore((s) => s.stlData);
  const { currentSessionId } = useSession();

  // Filter contexts to show based on debug mode and visibility threshold
  const visibleContexts = Object.entries(agentContexts).filter(([, info]) => {
    if (!info) return false;
    // In debug mode, show all contexts with data
    if (debugMode) return info.tokens > 0;
    // In normal mode, only show if above visibility threshold
    return info.percentage >= contextVisibilityThreshold;
  }) as [AgentContextKey, AgentContextInfo][];

  // Multi-agent orchestrator
  const [orchState, orchActions] = useOrchestrator();
  const { sendMessage, answerQuestion, stop: stopAgent, revertTo: revertToMessage } = orchActions;
  const { pendingQuestion } = orchState;

  // Adapt for existing UI (pendingQuestions was array, now single question)
  const hasPendingQuestion = Boolean(pendingQuestion);
  const answerQuestions = answerQuestion;

  const [input, setInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [showAutonomyMenu, setShowAutonomyMenu] = useState(false);
  const [showNegotiationMenu, setShowNegotiationMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on Cmd+/
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isStreaming) return;

      if (hasPendingQuestion) {
        answerQuestions(input.trim());
      } else {
        sendMessage(input.trim(), attachedImages.length > 0 ? attachedImages : undefined);
      }
      setInput('');
      setAttachedImages([]);
    },
    [answerQuestions, attachedImages, hasPendingQuestion, input, isStreaming, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as FormEvent);
      }
    },
    [handleSubmit]
  );

  // Handle image file selection
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = (ev.target?.result as string)?.split(',')[1];
          if (base64) {
            setAttachedImages((prev) => [...prev, base64]);
          }
        };
        reader.readAsDataURL(file);
      });
      // Reset file input
      e.target.value = '';
    },
    []
  );

  const removeImage = useCallback((index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Capture current viewport and attach as image
  const handleCaptureViewport = useCallback(async () => {
    if (!captureViewport) return;

    const base64 = captureViewport();
    if (!base64) {
      console.error('Failed to capture viewport');
      return;
    }

    // Add to attached images for the message.
    // (The send pipeline stores attachments to session assets and writes `asset_ref` into chat history.)
    setAttachedImages((prev) => [...prev, base64]);
  }, [captureViewport]);

  return (
    <div
      className="border-t border-zinc-700 bg-zinc-800/50 flex flex-col"
      style={{ height: chatHeight }}
    >
      {/* Resize handle */}
      <div
        className="h-1 cursor-ns-resize hover:bg-blue-500/50 transition-colors"
        onMouseDown={(e) => {
          e.preventDefault();
          const startY = e.clientY;
          const startHeight = chatHeight;

          const onMouseMove = (e: MouseEvent) => {
            const delta = startY - e.clientY;
            setChatHeight(Math.max(100, Math.min(500, startHeight + delta)));
          };

          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          };

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }}
      />

      {/* Debug toggle and Context indicators */}
      <div className="flex items-center justify-between px-4 py-1 border-b border-zinc-700/50">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Chat</span>
          {/* Per-agent context indicators */}
          {visibleContexts.length > 0 && (
            <div className="flex items-center gap-2">
              {visibleContexts.map(([agent, info]) => (
                <div key={agent} className="flex items-center gap-1" title={`${AGENT_LABELS[agent]}: ${info.tokens.toLocaleString()} / ${info.limit.toLocaleString()} tokens`}>
                  <span className={clsx(
                    'text-[10px] font-medium px-1 rounded',
                    agent === 'builder' ? 'bg-blue-500/20 text-blue-400' :
                      agent === 'researcher' ? 'bg-cyan-500/20 text-cyan-400' :
                        'bg-purple-500/20 text-purple-400'
                  )}>
                    {AGENT_LABELS[agent]}
                  </span>
                  <div className="w-12 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        info.percentage < 50 ? 'bg-green-500' :
                          info.percentage < 80 ? 'bg-yellow-500' :
                            'bg-red-500'
                      )}
                      style={{ width: `${Math.min(info.percentage, 100)}%` }}
                    />
                  </div>
                  <span className={clsx(
                    'text-[10px] w-7 text-right',
                    info.percentage < 50 ? 'text-green-400' :
                      info.percentage < 80 ? 'text-yellow-400' :
                        'text-red-400'
                  )}>
                    {info.percentage}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDebugMode(!debugMode)}
          className={clsx(
            'px-2 py-0.5 text-xs rounded transition-colors',
            debugMode
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
          )}
        >
          {debugMode ? '🔧 Debug ON' : '🔧 Debug'}
        </button>
      </div>

      {/* Debug Log Panel - only shown when debug mode is ON */}
      {debugMode && <DebugPanel />}

      {/* Messages */}
      <div className="flex-1 overflow-auto px-4 py-2 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
            Start a conversation to design your model
          </div>
        ) : (
          messages
            .filter((msg) => {
              // Hide system and tool_result messages when debug is off
              if (!debugMode && (msg.role === 'system' || msg.role === 'tool_result')) {
                return false;
              }
              return true;
            })
            .map((msg) => (
              <div key={msg.id} className="space-y-1 group">
                <div
                  className={clsx(
                    'flex gap-2',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-xs font-bold shrink-0">
                      T
                    </div>
                  )}
                  {msg.role === 'user' && Boolean(checkpoints[msg.id]) && (
                    <button
                      type="button"
                      title="Revert to before this prompt (and edit/resend)"
                      onClick={async () => {
                        const prompt = getMessageText(msg.content);
                        const ok = window.confirm(
                          'Revert to the state before this prompt?\n\nThis will discard later chat messages and restore the code/specs/preview.'
                        );
                        if (!ok) return;
                        setInput(prompt);
                        await revertToMessage(msg.id);
                        inputRef.current?.focus();
                      }}
                      className={clsx(
                        'px-2 py-1 text-xs rounded border border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors',
                        // Only show on hover to keep the UI clean
                        'opacity-0 group-hover:opacity-100'
                      )}
                    >
                      Revert
                    </button>
                  )}
                  <div
                    className={clsx(
                      'max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : msg.role === 'tool_result'
                          ? 'bg-purple-900/50 text-purple-200 font-mono text-xs'
                          : 'bg-zinc-700 text-zinc-100'
                    )}
                  >
                    {msg.role === 'tool_result' && debugMode ? (
                      <>
                        <span className="text-purple-400">Tool Result:</span>
                        <pre className="mt-1 whitespace-pre-wrap break-all max-h-96 overflow-auto">
                          {typeof msg.content === 'string'
                            ? msg.content
                            : JSON.stringify(msg.content, null, 2)}
                        </pre>
                      </>
                    ) : msg.role === 'assistant' ? (
                      // Handle assistant messages - show content or "using tools" if empty with tool calls
                      typeof msg.content === 'string' && msg.content.trim() ? (
                        msg.content
                      ) : msg.toolCalls && msg.toolCalls.length > 0 ? (
                        <span className="text-zinc-400 italic">
                          Using tools: {msg.toolCalls.map(tc => tc.name).join(', ')}
                        </span>
                      ) : (
                        <span className="text-zinc-500">...</span>
                      )
                    ) : msg.role !== 'tool_result' ? (
                      (() => {
                        const text = getMessageText(msg.content);
                        const imgs = getMessageImages(msg.content);
                        return (
                          <div className="space-y-2">
                            {text.trim().length > 0 ? (
                              <div>{text}</div>
                            ) : null}
                            {imgs.length > 0 ? (
                              <div className="flex gap-2 flex-wrap">
                                {imgs.map((img, i) => {
                                  if (img.kind === 'inline') {
                                    const mime = inferImageMimeFromBase64(img.base64);
                                    return (
                                      <img
                                        key={i}
                                        src={`data:${mime};base64,${img.base64}`}
                                        alt={`Attachment ${i + 1}`}
                                        className="w-24 h-24 object-cover rounded border border-zinc-600"
                                      />
                                    );
                                  }
                                  return <AssetImage key={`${img.assetPath}-${i}`} sessionId={currentSessionId} assetPath={img.assetPath} />;
                                })}
                              </div>
                            ) : null}
                            {text.trim().length === 0 && imgs.length === 0 ? '[Empty message]' : null}
                          </div>
                        );
                      })()
                    ) : null}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded bg-zinc-600 flex items-center justify-center text-xs shrink-0">
                      👤
                    </div>
                  )}
                </div>
                {/* Debug: Tool calls */}
                {debugMode && msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="ml-8 space-y-1">
                    {msg.toolCalls.map((tc, i) => (
                      <div
                        key={tc.id || i}
                        className="bg-emerald-900/30 border border-emerald-700/50 rounded px-2 py-1 text-xs font-mono"
                      >
                        <span className="text-emerald-400">🔧 {tc.name}</span>
                        <pre className="text-zinc-500 ml-2 whitespace-pre-wrap max-h-48 overflow-auto">
                          {JSON.stringify(tc.arguments, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
        )}

        {/* Iteration indicator */}
        {isStreaming && autonomyMode === 'ralph' && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>
              Ralph Mode · Iteration {currentIteration}/{maxIterations}
            </span>
          </div>
        )}

        {/* Multi-agent activity indicator */}
        {agentActivity && agentActivity.agent && (
          <div className={clsx(
            'rounded-lg px-3 py-2 text-sm border',
            agentActivity.agent === 'orchestrator' && 'bg-purple-900/30 border-purple-700/50',
            agentActivity.agent === 'builder' && 'bg-emerald-900/30 border-emerald-700/50',
            agentActivity.agent === 'researcher' && 'bg-blue-900/30 border-blue-700/50',
          )}>
            <div className="flex items-center gap-2">
              <div className={clsx(
                'w-4 h-4 border-2 border-t-transparent rounded-full animate-spin',
                agentActivity.agent === 'orchestrator' && 'border-purple-500',
                agentActivity.agent === 'builder' && 'border-emerald-500',
                agentActivity.agent === 'researcher' && 'border-blue-500',
              )} />
              <span className={clsx(
                agentActivity.agent === 'orchestrator' && 'text-purple-300',
                agentActivity.agent === 'builder' && 'text-emerald-300',
                agentActivity.agent === 'researcher' && 'text-blue-300',
              )}>
                {agentActivity.agent === 'orchestrator' && '🎯 Orchestrator'}
                {agentActivity.agent === 'builder' && '🔨 Builder'}
                {agentActivity.agent === 'researcher' && '🔍 Researcher'}
                {agentActivity.status === 'tool_call' && agentActivity.currentTool && (
                  <span className="ml-2 font-mono text-xs opacity-80">
                    → {agentActivity.currentTool}
                  </span>
                )}
                {agentActivity.status === 'thinking' && (
                  <span className="ml-2 opacity-60">thinking...</span>
                )}
              </span>
            </div>
            {debugMode && agentActivity.status === 'tool_call' && agentActivity.toolArgs && (
              <div className="text-xs opacity-60 mt-1 ml-6 font-mono max-h-20 overflow-auto">
                {JSON.stringify(agentActivity.toolArgs, null, 2).slice(0, 200)}
              </div>
            )}
          </div>
        )}

        {/* Verification status indicator */}
        {verificationStatus && (
          <div className="bg-cyan-900/30 border border-cyan-700/50 rounded px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-cyan-300">
                {verificationStatus.phase === 'code' ? '🔍' : '👁️'}
                {' '}Verifying {verificationStatus.phase === 'code' ? 'Code' : 'Visual'}...
                {verificationStatus.total > 0 && (
                  <span className="text-cyan-400 ml-1">
                    {verificationStatus.current}/{verificationStatus.total}
                  </span>
                )}
              </span>
            </div>
            {verificationStatus.detail && (
              <div className="text-xs text-cyan-400/70 mt-1 ml-6">
                {verificationStatus.detail}
              </div>
            )}
          </div>
        )}

        {/* Pending question from agent */}
        {pendingQuestion && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
            <div className="text-sm text-amber-400 font-medium">Agent needs clarification:</div>
            <ul className="text-sm text-zinc-300 list-disc list-inside space-y-1">
              <li>{pendingQuestion}</li>
            </ul>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 pt-0">
        {/* Image attachments preview */}
        {attachedImages.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {attachedImages.map((img, i) => (
              <div key={i} className="relative group">
                {(() => {
                  const mime = inferImageMimeFromBase64(img);
                  return (
                    <img
                      src={`data:${mime};base64,${img}`}
                      alt={`Attachment ${i + 1}`}
                      className="w-16 h-16 object-cover rounded border border-zinc-600"
                    />
                  );
                })()}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className="p-2 text-zinc-400 hover:text-zinc-200 disabled:opacity-50 transition-colors"
            title="Attach image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          {/* Capture viewport button */}
          <button
            type="button"
            onClick={handleCaptureViewport}
            disabled={isStreaming || !stlData || !captureViewport}
            className="p-2 text-zinc-400 hover:text-zinc-200 disabled:opacity-50 transition-colors"
            title="Capture current view"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to create..."
              disabled={isStreaming}
              rows={1}
              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 pr-24 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
              style={{ minHeight: 40, maxHeight: 120 }}
            />

            {/* Mode selectors */}
            <div className="absolute right-2 bottom-1.5 flex items-center gap-1">
              {/* Negotiation dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNegotiationMenu(!showNegotiationMenu)}
                  className="px-2 py-0.5 text-xs rounded bg-zinc-600 text-zinc-300 hover:bg-zinc-500 transition-colors"
                >
                  {NEGOTIATION_LABELS[negotiationLevel]}
                </button>
                {showNegotiationMenu && (
                  <div className="absolute bottom-full right-0 mb-1 bg-zinc-700 border border-zinc-600 rounded shadow-lg py-1 min-w-[120px]">
                    {(Object.keys(NEGOTIATION_LABELS) as NegotiationLevel[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => {
                          setNegotiationLevel(level);
                          setShowNegotiationMenu(false);
                        }}
                        className={clsx(
                          'w-full px-3 py-1 text-xs text-left hover:bg-zinc-600 transition-colors',
                          negotiationLevel === level ? 'text-blue-400' : 'text-zinc-300'
                        )}
                      >
                        {NEGOTIATION_LABELS[level]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Autonomy dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAutonomyMenu(!showAutonomyMenu)}
                  className="px-2 py-0.5 text-xs rounded bg-zinc-600 text-zinc-300 hover:bg-zinc-500 transition-colors"
                >
                  {AUTONOMY_LABELS[autonomyMode]}
                </button>
                {showAutonomyMenu && (
                  <div className="absolute bottom-full right-0 mb-1 bg-zinc-700 border border-zinc-600 rounded shadow-lg py-1 min-w-[120px]">
                    {(Object.keys(AUTONOMY_LABELS) as AutonomyMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setAutonomyMode(mode);
                          setShowAutonomyMenu(false);
                        }}
                        className={clsx(
                          'w-full px-3 py-1 text-xs text-left hover:bg-zinc-600 transition-colors',
                          autonomyMode === mode ? 'text-blue-400' : 'text-zinc-300'
                        )}
                      >
                        {AUTONOMY_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Send/Stop button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={stopAgent}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-500 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
