/**
 * Debug Logger for Multi-Agent System
 * 
 * Provides structured logging for orchestrator, agents, and tool calls.
 * Only logs when debug mode is enabled.
 */

export type AgentName = 'orchestrator' | 'builder' | 'researcher';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface AgentLogEntry {
  timestamp: number;
  agent: AgentName;
  level: LogLevel;
  action: string;
  details?: Record<string, unknown>;
  toolCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
  toolResult?: {
    name: string;
    success: boolean;
    preview?: string;
  };
}

export interface DebugLoggerConfig {
  enabled: boolean;
  logToConsole: boolean;
  onLogEntry?: (entry: AgentLogEntry) => void;
  storeCallback?: (entry: Omit<AgentLogEntry, 'timestamp'>) => void;
}

class DebugLoggerImpl {
  private config: DebugLoggerConfig = {
    enabled: false,
    logToConsole: true,
  };

  private history: AgentLogEntry[] = [];
  private maxHistory = 1000;

  configure(config: Partial<DebugLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set the store callback for pushing entries to UI
   */
  setStoreCallback(callback: (entry: Omit<AgentLogEntry, 'timestamp'>) => void): void {
    this.config.storeCallback = callback;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  log(agent: AgentName, action: string, details?: Record<string, unknown>): void {
    this.addEntry({ agent, level: 'info', action, details });
  }

  warn(agent: AgentName, action: string, details?: Record<string, unknown>): void {
    this.addEntry({ agent, level: 'warn', action, details });
  }

  error(agent: AgentName, action: string, details?: Record<string, unknown>): void {
    this.addEntry({ agent, level: 'error', action, details });
  }

  debug(agent: AgentName, action: string, details?: Record<string, unknown>): void {
    this.addEntry({ agent, level: 'debug', action, details });
  }

  toolCall(agent: AgentName, toolName: string, args?: Record<string, unknown>): void {
    this.addEntry({
      agent,
      level: 'info',
      action: `Calling tool: ${toolName}`,
      toolCall: { name: toolName, args },
    });
  }

  toolResult(agent: AgentName, toolName: string, success: boolean, preview?: string): void {
    this.addEntry({
      agent,
      level: success ? 'info' : 'warn',
      action: `Tool result: ${toolName} ${success ? '✓' : '✗'}`,
      toolResult: { name: toolName, success, preview },
    });
  }

  handoff(from: AgentName, to: AgentName, reason: string): void {
    this.addEntry({
      agent: 'orchestrator',
      level: 'info',
      action: `Handoff: ${from} → ${to}`,
      details: { from, to, reason },
    });
  }

  budget(agent: AgentName, budgetType: string, used: number, max: number): void {
    const remaining = max - used;
    this.addEntry({
      agent,
      level: remaining <= 1 ? 'warn' : 'debug',
      action: `Budget: ${budgetType}`,
      details: { used, max, remaining },
    });
  }

  private addEntry(partial: Omit<AgentLogEntry, 'timestamp'>): void {
    if (!this.config.enabled) return;

    const entry: AgentLogEntry = {
      ...partial,
      timestamp: Date.now(),
    };

    // Add to history
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Console output
    if (this.config.logToConsole) {
      this.logToConsole(entry);
    }

    // Legacy callback
    this.config.onLogEntry?.(entry);

    // Push to UI store
    this.config.storeCallback?.(partial);
  }

  private logToConsole(entry: AgentLogEntry): void {
    const time = new Date(entry.timestamp).toISOString().slice(11, 23);
    const agentTag = this.getAgentTag(entry.agent);
    const levelIcon = this.getLevelIcon(entry.level);

    const prefix = `${time} ${levelIcon} ${agentTag}`;

    if (entry.toolCall) {
      console.log(
        `${prefix} 🔧 ${entry.toolCall.name}`,
        entry.toolCall.args ? entry.toolCall.args : ''
      );
    } else if (entry.toolResult) {
      console.log(
        `${prefix} ${entry.toolResult.success ? '✅' : '❌'} ${entry.toolResult.name}`,
        entry.toolResult.preview ? `→ ${entry.toolResult.preview.slice(0, 100)}` : ''
      );
    } else {
      console.log(`${prefix} ${entry.action}`, entry.details || '');
    }
  }

  private getAgentTag(agent: AgentName): string {
    switch (agent) {
      case 'orchestrator': return '[ORCH]';
      case 'builder': return '[BUILD]';
      case 'researcher': return '[RESEARCH]';
    }
  }

  private getLevelIcon(level: LogLevel): string {
    switch (level) {
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '🔴';
      case 'debug': return '🔍';
    }
  }

  getHistory(): AgentLogEntry[] {
    return [...this.history];
  }

  getRecentHistory(count: number): AgentLogEntry[] {
    return this.history.slice(-count);
  }

  clear(): void {
    this.history = [];
  }

  /**
   * Format history as readable string (for scratchpad/UI)
   */
  formatHistory(count?: number): string {
    const entries = count ? this.getRecentHistory(count) : this.history;
    return entries.map(e => {
      const time = new Date(e.timestamp).toISOString().slice(11, 19);
      const agent = e.agent.toUpperCase().padEnd(10);
      if (e.toolCall) {
        return `${time} ${agent} 🔧 ${e.toolCall.name}`;
      } else if (e.toolResult) {
        return `${time} ${agent} ${e.toolResult.success ? '✓' : '✗'} ${e.toolResult.name}`;
      }
      return `${time} ${agent} ${e.action}`;
    }).join('\n');
  }
}

// Singleton instance
export const debugLogger = new DebugLoggerImpl();

/**
 * Helper to create a scoped logger for a specific agent
 */
export function createAgentLogger(agent: AgentName) {
  return {
    log: (action: string, details?: Record<string, unknown>) => debugLogger.log(agent, action, details),
    warn: (action: string, details?: Record<string, unknown>) => debugLogger.warn(agent, action, details),
    error: (action: string, details?: Record<string, unknown>) => debugLogger.error(agent, action, details),
    debug: (action: string, details?: Record<string, unknown>) => debugLogger.debug(agent, action, details),
    toolCall: (name: string, args?: Record<string, unknown>) => debugLogger.toolCall(agent, name, args),
    toolResult: (name: string, success: boolean, preview?: string) => debugLogger.toolResult(agent, name, success, preview),
  };
}
