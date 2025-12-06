/**
 * @file Unit tests for scope tracing helper utilities
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createTracedScopeResolver,
  formatScopeEvaluationSummary,
  traceScopeEvaluation,
} from '../../../common/scopeDsl/scopeTracingHelpers.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';

describe('scopeTracingHelpers - createTracedScopeResolver', () => {
  let mockScopeResolver;
  let traceContext;

  beforeEach(() => {
    mockScopeResolver = {
      resolve: jest.fn().mockReturnValue(['entity1', 'entity2']),
      someOtherProperty: 'value',
    };
    traceContext = new TraceContext();
  });

  it('should wrap scope resolver without modifying original', () => {
    const tracedResolver = createTracedScopeResolver(
      mockScopeResolver,
      traceContext
    );

    expect(tracedResolver).not.toBe(mockScopeResolver);
    expect(tracedResolver.someOtherProperty).toBe('value');
    expect(typeof tracedResolver.resolve).toBe('function');
  });

  it('should capture successful resolution', () => {
    const tracedResolver = createTracedScopeResolver(
      mockScopeResolver,
      traceContext
    );
    const context = {
      actor: { id: 'actor1' },
      candidates: ['entity1', 'entity2', 'entity3'],
    };

    const result = tracedResolver.resolve('test:scope', context);

    expect(result).toEqual(['entity1', 'entity2']);
    expect(mockScopeResolver.resolve).toHaveBeenCalledWith(
      'test:scope',
      context
    );

    const scopeEvals = traceContext.getScopeEvaluations();
    expect(scopeEvals).toHaveLength(1);
    expect(scopeEvals[0]).toMatchObject({
      scopeId: 'test:scope',
      actorId: 'actor1',
      candidateEntities: ['entity1', 'entity2', 'entity3'],
      resolvedEntities: ['entity1', 'entity2'],
      success: true,
    });
  });

  it('should capture failed resolution', () => {
    const error = new Error('Resolution failed');
    mockScopeResolver.resolve.mockImplementation(() => {
      throw error;
    });

    const tracedResolver = createTracedScopeResolver(
      mockScopeResolver,
      traceContext
    );
    const context = { actor: { id: 'actor1' } };

    expect(() => {
      tracedResolver.resolve('test:scope', context);
    }).toThrow('Resolution failed');

    const scopeEvals = traceContext.getScopeEvaluations();
    expect(scopeEvals).toHaveLength(1);
    expect(scopeEvals[0]).toMatchObject({
      scopeId: 'test:scope',
      actorId: 'actor1',
      success: false,
      error: 'Resolution failed',
    });
  });

  it('should add trace logs for resolution steps', () => {
    const tracedResolver = createTracedScopeResolver(
      mockScopeResolver,
      traceContext
    );
    const context = { actor: { id: 'actor1' } };

    tracedResolver.resolve('test:scope', context);

    const logs = traceContext.logs;
    expect(
      logs.some((log) => log.message.includes('Resolving scope: test:scope'))
    ).toBe(true);
    expect(
      logs.some((log) => log.message.includes('Resolved 2 entities'))
    ).toBe(true);
  });

  it('should call original resolver with correct arguments', () => {
    const tracedResolver = createTracedScopeResolver(
      mockScopeResolver,
      traceContext
    );
    const context = {
      actor: { id: 'actor1' },
      filters: [{ test: true }],
      candidates: ['entity1'],
    };

    tracedResolver.resolve('test:scope', context);

    expect(mockScopeResolver.resolve).toHaveBeenCalledWith(
      'test:scope',
      context
    );
    expect(mockScopeResolver.resolve).toHaveBeenCalledTimes(1);
  });

  it('should handle missing actor in context', () => {
    const tracedResolver = createTracedScopeResolver(
      mockScopeResolver,
      traceContext
    );
    const context = { candidates: ['entity1'] };

    const result = tracedResolver.resolve('test:scope', context);

    expect(result).toEqual(['entity1', 'entity2']);
    const scopeEvals = traceContext.getScopeEvaluations();
    expect(scopeEvals[0].actorId).toBeUndefined();
  });

  it('should handle empty result', () => {
    mockScopeResolver.resolve.mockReturnValue([]);
    const tracedResolver = createTracedScopeResolver(
      mockScopeResolver,
      traceContext
    );
    const context = { actor: { id: 'actor1' } };

    const result = tracedResolver.resolve('test:scope', context);

    expect(result).toEqual([]);
    const scopeEvals = traceContext.getScopeEvaluations();
    expect(scopeEvals[0].resolvedEntities).toEqual([]);
  });
});

describe('scopeTracingHelpers - formatScopeEvaluationSummary', () => {
  let traceContext;

  beforeEach(() => {
    traceContext = new TraceContext();
  });

  it('should handle empty evaluations', () => {
    const summary = formatScopeEvaluationSummary(traceContext);

    expect(summary).toBe('No scope evaluations captured');
  });

  it('should format successful evaluation', () => {
    traceContext.captureScopeEvaluation({
      scopeId: 'test:scope',
      actorId: 'actor1',
      candidateEntities: ['entity1', 'entity2', 'entity3'],
      resolvedEntities: ['entity1', 'entity2'],
      success: true,
    });

    const summary = formatScopeEvaluationSummary(traceContext);

    expect(summary).toContain('=== Scope Evaluation Summary ===');
    expect(summary).toContain('Scope: test:scope');
    expect(summary).toContain('Actor: actor1');
    expect(summary).toContain('Candidates: 3');
    expect(summary).toContain('Resolved: 2');
    expect(summary).toContain('Filtered out: 1');
    expect(summary).toContain('Resolved entities: entity1, entity2');
  });

  it('should format failed evaluation', () => {
    traceContext.captureScopeEvaluation({
      scopeId: 'test:scope',
      actorId: 'actor1',
      success: false,
      error: 'Scope not found',
    });

    const summary = formatScopeEvaluationSummary(traceContext);

    expect(summary).toContain('Scope: test:scope');
    expect(summary).toContain('Actor: actor1');
    expect(summary).toContain('❌ Failed: Scope not found');
  });

  it('should show candidate/resolved/filtered counts', () => {
    traceContext.captureScopeEvaluation({
      scopeId: 'test:scope',
      actorId: 'actor1',
      candidateEntities: ['e1', 'e2', 'e3', 'e4', 'e5'],
      resolvedEntities: ['e1', 'e3'],
      success: true,
    });

    const summary = formatScopeEvaluationSummary(traceContext);

    expect(summary).toContain('Candidates: 5');
    expect(summary).toContain('Resolved: 2');
    expect(summary).toContain('Filtered out: 3');
  });

  it('should list resolved entities', () => {
    traceContext.captureScopeEvaluation({
      scopeId: 'test:scope',
      actorId: 'actor1',
      candidateEntities: ['entity1', 'entity2'],
      resolvedEntities: ['entity1'],
      success: true,
    });

    const summary = formatScopeEvaluationSummary(traceContext);

    expect(summary).toContain('Resolved entities: entity1');
  });

  it('should handle unknown actor', () => {
    traceContext.captureScopeEvaluation({
      scopeId: 'test:scope',
      candidateEntities: [],
      resolvedEntities: [],
      success: true,
    });

    const summary = formatScopeEvaluationSummary(traceContext);

    expect(summary).toContain('Actor: unknown');
  });

  it('should not show filtered count when zero', () => {
    traceContext.captureScopeEvaluation({
      scopeId: 'test:scope',
      actorId: 'actor1',
      candidateEntities: ['entity1'],
      resolvedEntities: ['entity1'],
      success: true,
    });

    const summary = formatScopeEvaluationSummary(traceContext);

    expect(summary).not.toContain('Filtered out:');
  });

  it('should handle multiple evaluations', () => {
    traceContext.captureScopeEvaluation({
      scopeId: 'test:scope1',
      actorId: 'actor1',
      candidateEntities: ['entity1'],
      resolvedEntities: ['entity1'],
      success: true,
    });

    traceContext.captureScopeEvaluation({
      scopeId: 'test:scope2',
      actorId: 'actor2',
      candidateEntities: [],
      resolvedEntities: [],
      success: true,
    });

    const summary = formatScopeEvaluationSummary(traceContext);

    expect(summary).toContain('Scope: test:scope1');
    expect(summary).toContain('Scope: test:scope2');
    expect(summary).toContain('Actor: actor1');
    expect(summary).toContain('Actor: actor2');
  });
});

describe('scopeTracingHelpers - traceScopeEvaluation', () => {
  let mockScopeResolver;

  beforeEach(() => {
    mockScopeResolver = {
      resolve: jest.fn().mockReturnValue(['entity1', 'entity2']),
    };
  });

  it('should create trace context automatically', () => {
    const result = traceScopeEvaluation({
      scopeId: 'test:scope',
      actor: { id: 'actor1' },
      scopeResolver: mockScopeResolver,
    });

    expect(result.trace).toBeInstanceOf(TraceContext);
    expect(result.trace.getScopeEvaluations()).toHaveLength(1);
  });

  it('should return success result with entities', () => {
    const result = traceScopeEvaluation({
      scopeId: 'test:scope',
      actor: { id: 'actor1' },
      scopeResolver: mockScopeResolver,
    });

    expect(result.success).toBe(true);
    expect(result.resolvedEntities).toEqual(['entity1', 'entity2']);
    expect(result.error).toBeUndefined();
  });

  it('should return failure result with error', () => {
    mockScopeResolver.resolve.mockImplementation(() => {
      throw new Error('Scope not found');
    });

    const result = traceScopeEvaluation({
      scopeId: 'test:scope',
      actor: { id: 'actor1' },
      scopeResolver: mockScopeResolver,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Scope not found');
    expect(result.resolvedEntities).toBeUndefined();
  });

  it('should include formatted summary', () => {
    const result = traceScopeEvaluation({
      scopeId: 'test:scope',
      actor: { id: 'actor1' },
      scopeResolver: mockScopeResolver,
    });

    expect(result.summary).toBeDefined();
    expect(typeof result.summary).toBe('string');
    expect(result.summary).toContain('=== Scope Evaluation Summary ===');
    expect(result.summary).toContain('Scope: test:scope');
  });

  it('should provide trace context for inspection', () => {
    const result = traceScopeEvaluation({
      scopeId: 'test:scope',
      actor: { id: 'actor1' },
      scopeResolver: mockScopeResolver,
    });

    expect(result.trace).toBeDefined();
    const scopeEvals = result.trace.getScopeEvaluations();
    expect(scopeEvals).toHaveLength(1);
    expect(scopeEvals[0].scopeId).toBe('test:scope');
  });

  it('should merge additional context', () => {
    const additionalContext = {
      filters: [{ test: true }],
      candidates: ['entity1', 'entity2'],
    };

    traceScopeEvaluation({
      scopeId: 'test:scope',
      actor: { id: 'actor1' },
      scopeResolver: mockScopeResolver,
      context: additionalContext,
    });

    expect(mockScopeResolver.resolve).toHaveBeenCalledWith('test:scope', {
      actor: { id: 'actor1' },
      ...additionalContext,
    });
  });

  it('should handle empty context', () => {
    const result = traceScopeEvaluation({
      scopeId: 'test:scope',
      actor: { id: 'actor1' },
      scopeResolver: mockScopeResolver,
      // No context provided
    });

    expect(result.success).toBe(true);
    expect(mockScopeResolver.resolve).toHaveBeenCalledWith('test:scope', {
      actor: { id: 'actor1' },
    });
  });
});
