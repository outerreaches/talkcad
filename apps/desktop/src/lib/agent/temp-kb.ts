/**
 * TemporaryResearchKB - Session-scoped storage for research findings
 * 
 * Allows Researcher to submit structured data that Builder can pull on-demand.
 * Cleared at session end. Findings that prove useful can be persisted to
 * permanent skills after verification.
 * 
 * Lifecycle:
 * 1. Session start → Temp KB empty
 * 2. Research phase → Researcher submits findings
 * 3. Build phase → Builder pulls and uses findings
 * 4. Verification passes → Builder persists to permanent skills
 * 5. Session end → Temp KB cleared
 */

import { v4 as uuid } from 'uuid';

export interface ResearchFinding {
  id: string;
  topic: string;
  type: 'dimensions' | 'specifications' | 'schematic' | 'material' | 'technique' | 'other';
  data: unknown;
  sourceUrl?: string;
  sourceDescription?: string;
  confidence: 'high' | 'medium' | 'low';
  createdAt: number;
  usedBy?: string; // Tool call ID that consumed this finding
  verified?: boolean; // Set to true if build using this data succeeded
}

export interface FindingSummary {
  id: string;
  topic: string;
  type: ResearchFinding['type'];
  confidence: ResearchFinding['confidence'];
  hasSource: boolean;
  used: boolean;
  verified: boolean;
}

export class TemporaryResearchKB {
  private findings: Map<string, ResearchFinding> = new Map();
  private topicIndex: Map<string, string[]> = new Map(); // topic -> finding IDs

  /**
   * Submit a new research finding
   */
  submit(finding: Omit<ResearchFinding, 'id' | 'createdAt'>): string {
    const id = uuid();
    const entry: ResearchFinding = {
      ...finding,
      id,
      createdAt: Date.now(),
    };

    this.findings.set(id, entry);

    // Index by topic for lookup
    const normalizedTopic = this.normalizeTopic(finding.topic);
    const existing = this.topicIndex.get(normalizedTopic) || [];
    existing.push(id);
    this.topicIndex.set(normalizedTopic, existing);

    return id;
  }

  /**
   * Get a finding by exact topic match
   */
  get(topic: string): ResearchFinding | null {
    const normalizedTopic = this.normalizeTopic(topic);
    const ids = this.topicIndex.get(normalizedTopic);
    if (!ids || ids.length === 0) return null;

    // Return most recent finding for this topic
    const mostRecent = ids
      .map(id => this.findings.get(id))
      .filter((f): f is ResearchFinding => f !== undefined)
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    return mostRecent || null;
  }

  /**
   * Get a finding by ID
   */
  getById(id: string): ResearchFinding | null {
    return this.findings.get(id) || null;
  }

  /**
   * Search for findings matching a query
   */
  search(query: string): ResearchFinding[] {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const results: Array<{ finding: ResearchFinding; score: number }> = [];

    for (const finding of this.findings.values()) {
      let score = 0;
      const topicLower = finding.topic.toLowerCase();
      const dataStr = JSON.stringify(finding.data).toLowerCase();

      for (const kw of keywords) {
        if (topicLower.includes(kw)) score += 10;
        if (dataStr.includes(kw)) score += 5;
      }

      if (score > 0) {
        results.push({ finding, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .map(r => r.finding);
  }

  /**
   * List all findings (summaries only)
   */
  list(): FindingSummary[] {
    return Array.from(this.findings.values()).map(f => ({
      id: f.id,
      topic: f.topic,
      type: f.type,
      confidence: f.confidence,
      hasSource: !!f.sourceUrl,
      used: !!f.usedBy,
      verified: !!f.verified,
    }));
  }

  /**
   * List findings by type
   */
  listByType(type: ResearchFinding['type']): FindingSummary[] {
    return this.list().filter(f => f.type === type);
  }

  /**
   * Mark a finding as used by a tool call
   */
  markUsed(id: string, toolCallId: string): void {
    const finding = this.findings.get(id);
    if (finding) {
      finding.usedBy = toolCallId;
    }
  }

  /**
   * Mark a finding as verified (build succeeded)
   */
  markVerified(id: string): void {
    const finding = this.findings.get(id);
    if (finding) {
      finding.verified = true;
    }
  }

  /**
   * Get all verified findings (candidates for permanent skill creation)
   */
  getVerified(): ResearchFinding[] {
    return Array.from(this.findings.values()).filter(f => f.verified);
  }

  /**
   * Get all used but unverified findings
   */
  getUsedUnverified(): ResearchFinding[] {
    return Array.from(this.findings.values()).filter(f => f.usedBy && !f.verified);
  }

  /**
   * Check if we have any findings for a topic
   */
  hasTopic(topic: string): boolean {
    const normalizedTopic = this.normalizeTopic(topic);
    const ids = this.topicIndex.get(normalizedTopic);
    return !!ids && ids.length > 0;
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    byType: Record<ResearchFinding['type'], number>;
    used: number;
    verified: number;
    highConfidence: number;
  } {
    const findings = Array.from(this.findings.values());
    const byType: Record<ResearchFinding['type'], number> = {
      dimensions: 0,
      specifications: 0,
      schematic: 0,
      material: 0,
      technique: 0,
      other: 0,
    };

    for (const f of findings) {
      byType[f.type]++;
    }

    return {
      total: findings.length,
      byType,
      used: findings.filter(f => f.usedBy).length,
      verified: findings.filter(f => f.verified).length,
      highConfidence: findings.filter(f => f.confidence === 'high').length,
    };
  }

  /**
   * Clear all findings (session end)
   */
  clear(): void {
    this.findings.clear();
    this.topicIndex.clear();
  }

  /**
   * Normalize topic for indexing
   */
  private normalizeTopic(topic: string): string {
    return topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Export findings for debugging/logging
   */
  export(): ResearchFinding[] {
    return Array.from(this.findings.values());
  }
}

/**
 * Create tool definitions for temp KB interaction
 */
export const TEMP_KB_TOOLS = {
  // For Researcher
  submit_research_finding: {
    name: 'submit_research_finding',
    description:
      'Submit a research finding to the temporary knowledge base. Builder will use this data. Include source URL for traceability.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Topic identifier, e.g., "esp32-wroom-32-dimensions" or "nema17-mounting-pattern"',
        },
        type: {
          type: 'string',
          enum: ['dimensions', 'specifications', 'schematic', 'material', 'technique', 'other'],
          description: 'Type of finding',
        },
        data: {
          type: 'object',
          description: 'Structured data for the finding. For dimensions, use { width: 25.5, height: 18.0, unit: "mm" }',
        },
        sourceUrl: {
          type: 'string',
          description: 'URL where this information was found',
        },
        sourceDescription: {
          type: 'string',
          description: 'Brief description of the source (e.g., "Official Espressif datasheet")',
        },
        confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Confidence level: high=official source, medium=reliable third-party, low=uncertain',
        },
      },
      required: ['topic', 'type', 'data', 'confidence'],
    },
  },

  // For Builder
  get_research_finding: {
    name: 'get_research_finding',
    description:
      'Get a research finding from the temporary knowledge base by topic. Returns the data submitted by Researcher.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Topic to retrieve, e.g., "esp32-wroom-32-dimensions"',
        },
      },
      required: ['topic'],
    },
  },

  list_research_findings: {
    name: 'list_research_findings',
    description:
      'List all research findings available in the temporary knowledge base. Returns topic summaries.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['dimensions', 'specifications', 'schematic', 'material', 'technique', 'other'],
          description: 'Optional: filter by type',
        },
      },
      required: [],
    },
  },
};
