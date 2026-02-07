/**
 * Handoff Contracts and Validation
 * 
 * Ensures type-safe communication between Orchestrator and agents.
 * Validates payloads before handoffs and results after execution.
 */

export interface OrchestratorToBuilderHandoff {
  type: 'orchestrator_to_builder';
  instruction: string;
  context: BuilderContext;
  availableResearch: string[];
  researchFailed: boolean;
  previousAttempts: string[];
}

export interface BuilderContext {
  sessionId: string;
  userRequest: string;
  hasAttachments: boolean;
  currentCode?: string;
  specs: Record<string, SpecSummary>;
  webToolsEnabled?: boolean;
}

export interface SpecSummary {
  value: unknown;
  unit?: string;
  verified: boolean;
}

export interface OrchestratorToResearcherHandoff {
  type: 'orchestrator_to_researcher';
  question: string;
  context: ResearcherContext;
  dataTypes: DataType[];
  failedAttempts: string[];
}

export interface ResearcherContext {
  sessionId: string;
  userRequest: string;
  relatedSkills: string[];
}

export type DataType = 'dimensions' | 'specifications' | 'schematic' | 'material' | 'technique';

// Results

export interface BuilderResult {
  type: 'builder_result';
  status: 'complete' | 'need_research' | 'need_clarification' | 'failed' | 'budget_exhausted';
  codeUpdated: boolean;
  specsUpdated: string[];
  skillsCreated: string[];
  researchQuestion?: string;
  clarificationRequest?: ClarificationPayload;
  error?: string;
}

export interface ResearcherResult {
  type: 'researcher_result';
  status: 'complete' | 'partial' | 'failed' | 'budget_exhausted';
  findingsSubmitted: string[];
  failedQueries: string[];
  notes?: string;
  error?: string;
}

export interface ClarificationPayload {
  question: string;
  context?: string;
  priority: 'low' | 'medium' | 'high';
  options?: string[];
  default?: string;
}

// Validation

export class HandoffValidationError extends Error {
  constructor(
    public handoffType: string,
    public field: string,
    public reason: string
  ) {
    super(`Invalid ${handoffType} handoff: ${field} - ${reason}`);
    this.name = 'HandoffValidationError';
  }
}

export function validateBuilderHandoff(handoff: OrchestratorToBuilderHandoff): void {
  if (!handoff.instruction || handoff.instruction.trim().length === 0) {
    throw new HandoffValidationError('orchestrator_to_builder', 'instruction', 'Cannot be empty');
  }

  if (!handoff.context.sessionId) {
    throw new HandoffValidationError('orchestrator_to_builder', 'context.sessionId', 'Required');
  }

  if (!Array.isArray(handoff.availableResearch)) {
    throw new HandoffValidationError('orchestrator_to_builder', 'availableResearch', 'Must be array');
  }
}

export function validateResearcherHandoff(handoff: OrchestratorToResearcherHandoff): void {
  if (!handoff.question || handoff.question.trim().length === 0) {
    throw new HandoffValidationError('orchestrator_to_researcher', 'question', 'Cannot be empty');
  }

  if (!handoff.context.sessionId) {
    throw new HandoffValidationError('orchestrator_to_researcher', 'context.sessionId', 'Required');
  }

  if (!Array.isArray(handoff.dataTypes) || handoff.dataTypes.length === 0) {
    throw new HandoffValidationError('orchestrator_to_researcher', 'dataTypes', 'Must specify at least one data type');
  }
}

export function validateBuilderResult(result: BuilderResult): void {
  const validStatuses = ['complete', 'need_research', 'need_clarification', 'failed', 'budget_exhausted'];

  if (!validStatuses.includes(result.status)) {
    throw new HandoffValidationError('builder_result', 'status', `Invalid status: ${result.status}`);
  }

  if (result.status === 'need_research' && !result.researchQuestion) {
    throw new HandoffValidationError('builder_result', 'researchQuestion', 'Required when status is need_research');
  }

  if (result.status === 'need_clarification' && !result.clarificationRequest) {
    throw new HandoffValidationError('builder_result', 'clarificationRequest', 'Required when status is need_clarification');
  }
}

export function validateResearcherResult(result: ResearcherResult): void {
  const validStatuses = ['complete', 'partial', 'failed', 'budget_exhausted'];

  if (!validStatuses.includes(result.status)) {
    throw new HandoffValidationError('researcher_result', 'status', `Invalid status: ${result.status}`);
  }

  if (!Array.isArray(result.findingsSubmitted)) {
    throw new HandoffValidationError('researcher_result', 'findingsSubmitted', 'Must be array');
  }
}

// Factory functions

export function createBuilderHandoff(
  instruction: string,
  context: Partial<BuilderContext>,
  options?: {
    availableResearch?: string[];
    researchFailed?: boolean;
    previousAttempts?: string[];
  }
): OrchestratorToBuilderHandoff {
  const handoff: OrchestratorToBuilderHandoff = {
    type: 'orchestrator_to_builder',
    instruction,
    context: {
      sessionId: context.sessionId || '',
      userRequest: context.userRequest || instruction,
      hasAttachments: context.hasAttachments || false,
      currentCode: context.currentCode,
      specs: context.specs || {},
    },
    availableResearch: options?.availableResearch || [],
    researchFailed: options?.researchFailed || false,
    previousAttempts: options?.previousAttempts || [],
  };

  validateBuilderHandoff(handoff);
  return handoff;
}

export function createResearcherHandoff(
  question: string,
  context: Partial<ResearcherContext>,
  dataTypes: DataType[],
  failedAttempts?: string[]
): OrchestratorToResearcherHandoff {
  const handoff: OrchestratorToResearcherHandoff = {
    type: 'orchestrator_to_researcher',
    question,
    context: {
      sessionId: context.sessionId || '',
      userRequest: context.userRequest || question,
      relatedSkills: context.relatedSkills || [],
    },
    dataTypes: dataTypes.length > 0 ? dataTypes : ['dimensions'],
    failedAttempts: failedAttempts || [],
  };

  validateResearcherHandoff(handoff);
  return handoff;
}

// Utilities for converting SubAgentResult to typed results

import type { SubAgentResult } from './sub-agent';

export function parseBuilderResult(result: SubAgentResult): BuilderResult {
  const output = result.output as Record<string, unknown> | undefined;

  return {
    type: 'builder_result',
    status: result.status === 'complete' ? 'complete' :
      result.status === 'need_research' ? 'need_research' :
        result.status === 'need_clarification' ? 'need_clarification' :
          result.status === 'budget_exhausted' ? 'budget_exhausted' : 'failed',
    codeUpdated: (output?.code_updated as boolean) || false,
    specsUpdated: (output?.specs_updated as string[]) || [],
    skillsCreated: (output?.skills_created as string[]) || [],
    researchQuestion: result.researchQuestion,
    clarificationRequest: result.clarificationRequest ? {
      question: result.clarificationRequest.question,
      context: result.clarificationRequest.context,
      priority: result.clarificationRequest.priority,
    } : undefined,
    error: result.error,
  };
}

export function parseResearcherResult(result: SubAgentResult): ResearcherResult {
  const output = result.output as Record<string, unknown> | undefined;

  return {
    type: 'researcher_result',
    status: result.status === 'complete' ? 'complete' :
      result.status === 'budget_exhausted' ? 'budget_exhausted' :
        result.status === 'failed' ? 'failed' : 'partial',
    findingsSubmitted: (output?.findings_submitted as string[]) || [],
    failedQueries: (output?.failed_queries as string[]) || [],
    notes: output?.notes as string | undefined,
    error: result.error,
  };
}
