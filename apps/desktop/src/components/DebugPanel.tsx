/**
 * DebugPanel - Displays persistent debug logs for the current session
 */

import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { useDebugStore, type DebugLogEntry } from '../store';

function formatTime(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(11, 23);
}

function getAgentColor(agent: string): string {
    switch (agent) {
        case 'orchestrator': return 'text-purple-400';
        case 'builder': return 'text-emerald-400';
        case 'researcher': return 'text-blue-400';
        default: return 'text-zinc-400';
    }
}

function getLevelIcon(level: string): string {
    switch (level) {
        case 'info': return 'ℹ️';
        case 'warn': return '⚠️';
        case 'error': return '🔴';
        case 'debug': return '🔍';
        default: return '•';
    }
}

function formatEntry(entry: DebugLogEntry): string {
    if (entry.toolCall) {
        return `🔧 ${entry.toolCall.name}`;
    }
    if (entry.toolResult) {
        return `${entry.toolResult.success ? '✅' : '❌'} ${entry.toolResult.name}`;
    }
    return entry.action;
}

export function DebugPanel() {
    const entries = useDebugStore((s) => s.entries);
    const clear = useDebugStore((s) => s.clear);
    const endRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new entries
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [entries]);

    return (
        <div className="bg-zinc-900 border-t border-zinc-700 flex flex-col h-48">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1 border-b border-zinc-700/50 bg-zinc-800/50">
                <span className="text-xs text-zinc-400 font-medium">🔧 Debug Log ({entries.length} entries)</span>
                <button
                    type="button"
                    onClick={() => clear()}
                    className="px-2 py-0.5 text-xs rounded bg-zinc-700 text-zinc-400 hover:bg-zinc-600 transition-colors"
                >
                    Clear
                </button>
            </div>

            {/* Log entries - overflow-x-auto allows horizontal scroll for long lines */}
            <div className="flex-1 overflow-auto font-mono text-xs p-2 space-y-0.5">
                {entries.length === 0 ? (
                    <div className="text-zinc-500 text-center py-4">
                        No debug logs yet. Logs will appear here as agents work.
                    </div>
                ) : (
                    entries.map((entry) => (
                        <div key={entry.id} className="flex gap-2 hover:bg-zinc-800/50 rounded px-1 whitespace-nowrap">
                            {/* Timestamp */}
                            <span className="text-zinc-500 shrink-0">{formatTime(entry.timestamp)}</span>

                            {/* Level icon */}
                            <span className="shrink-0">{getLevelIcon(entry.level)}</span>

                            {/* Agent */}
                            <span className={clsx('shrink-0 w-12 uppercase text-[10px]', getAgentColor(entry.agent))}>
                                {entry.agent.slice(0, 6)}
                            </span>

                            {/* Content (Action + Details) - no truncation, allow horizontal scroll */}
                            <div className="flex gap-2 items-center">
                                <span className={clsx(
                                    entry.level === 'error' ? 'text-red-400' :
                                        entry.level === 'warn' ? 'text-yellow-400' :
                                            'text-zinc-300'
                                )}>
                                    {formatEntry(entry)}
                                </span>

                                {/* Details - full content */}
                                {entry.details && (
                                    <span className="text-zinc-500">
                                        {JSON.stringify(entry.details)}
                                    </span>
                                )}

                                {/* Tool args - full content */}
                                {entry.toolCall?.args && (
                                    <span className="text-zinc-500">
                                        {JSON.stringify(entry.toolCall.args)}
                                    </span>
                                )}

                                {/* Tool result preview */}
                                {entry.toolResult?.preview && (
                                    <span className="text-zinc-500">
                                        → {entry.toolResult.preview}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
                <div ref={endRef} />
            </div>
        </div>
    );
}
