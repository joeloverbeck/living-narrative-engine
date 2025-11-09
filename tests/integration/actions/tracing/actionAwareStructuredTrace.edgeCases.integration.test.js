import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';

const createLogger = (overrides = {}) => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  ...overrides,
});

describe('ActionAwareStructuredTrace edge case integration', () => {
  let logger;

  beforeEach(() => {
    logger = createLogger();
  });

  it('handles operator failures and legacy format detection edge cases', () => {
    const throwingLogger = createLogger({
      debug: jest.fn((message) => {
        if (
          typeof message === 'string' &&
          message.includes('Captured operator evaluation')
        ) {
          throw new Error('debug failure');
        }
      }),
    });

    const filter = new ActionTraceFilter({
      tracedActions: ['legacy:*'],
      logger: throwingLogger,
    });

    const trace = new ActionAwareStructuredTrace({
      actionTraceFilter: filter,
      actorId: 'actor-edge',
      logger: throwingLogger,
    });

    trace.captureOperatorEvaluation({
      operator: 'unstableOperator',
      entityId: 'entity-A',
      result: false,
    });

    expect(throwingLogger.error).toHaveBeenCalledWith(
      'ActionAwareStructuredTrace: Error capturing operator evaluation',
      expect.any(Error),
    );

    trace.captureLegacyConversion('legacy:none', {
      isLegacy: true,
      originalAction: null,
      targetDefinitions: null,
      processingTime: 0,
      error: null,
    });

    trace.captureLegacyConversion('legacy:type', {
      isLegacy: true,
      originalAction: { targetType: 'npc' },
      targetDefinitions: { normalized: true },
      processingTime: 4,
      error: null,
    });

    trace.captureLegacyConversion('legacy:misc', {
      isLegacy: true,
      originalAction: { description: 'no legacy markers' },
      targetDefinitions: {},
      processingTime: 6,
      error: new Error('conversion warning'),
    });

    const noneStage = trace
      .getActionTrace('legacy:none')
      .stages.legacy_processing.data;
    const typeStage = trace
      .getActionTrace('legacy:type')
      .stages.legacy_processing.data;
    const miscStage = trace
      .getActionTrace('legacy:misc')
      .stages.legacy_processing.data;

    expect(noneStage.originalFormat).toBe('unknown');
    expect(typeStage.originalFormat).toBe('legacy_target_type');
    expect(miscStage.originalFormat).toBe('unknown');

    expect(trace.isMultiTargetAction({ scope: 'world' })).toBe(true);
    expect(trace.isMultiTargetAction({ targetQuery: { type: 'ally' } })).toBe(true);
  });

  it('respects guard clauses, fallback verbosity, and summarization shortcuts', () => {
    const filter = new ActionTraceFilter({
      tracedActions: ['allowed:action'],
      verbosityLevel: 'minimal',
      inclusionConfig: {
        componentData: true,
        prerequisites: true,
        targets: true,
      },
      logger,
    });

    const trace = new ActionAwareStructuredTrace({
      actionTraceFilter: filter,
      actorId: 'actor-guards',
      logger,
    });

    trace.captureMultiTargetResolution('blocked:action', {
      targetKeys: ['primary'],
      totalTargets: 1,
    });
    trace.captureScopeEvaluation('blocked:action', 'primary', {
      scope: 'scope.blocked',
      context: {},
      resultCount: 0,
      evaluationTimeMs: 0,
    });
    trace.captureEnhancedScopeEvaluation('blocked:action', 'primary', [
      { source: 'ScopeEngine.entityDiscovery', data: { totalEntities: 0 } },
    ]);
    trace.captureTargetRelationships('blocked:action', {
      totalTargets: 1,
      relationships: [{ from: 'primary', to: 'secondary' }],
    });
    trace.captureEnhancedActionData('guard_stage', 'blocked:action', { foo: 'bar' });
    expect(trace.getActionTrace('blocked:action')).toBeNull();

    trace.captureEnhancedScopeEvaluation('allowed:action', 'primary', null);
    expect(trace.getActionTrace('allowed:action')).toBeNull();

    trace.captureActionData('component_filtering', 'allowed:action', {
      passed: false,
      error: 'failed stage',
    });

    let actionTrace = trace.getActionTrace('allowed:action');
    expect(actionTrace.stages.component_filtering.data).toMatchObject({
      passed: false,
      error: 'failed stage',
    });

    filter.getVerbosityLevel = () => 'mystery';
    filter.getInclusionConfig = () => ({
      componentData: true,
      prerequisites: true,
      targets: true,
    });

    trace.captureActionData('component_filtering_unknown', 'allowed:action', {
      passed: true,
      error: 'mystery stage',
      actorId: 'actor-guards',
      targetKeys: ['primary'],
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Unknown verbosity level"),
    );

    filter.getVerbosityLevel = () => 'detailed';
    trace.captureActionData('target_resolution', 'allowed:action', {
      resolvedTargets: 'not-array',
      template: 'literal',
    });

    actionTrace = trace.getActionTrace('allowed:action');
    expect(actionTrace.stages.target_resolution.data.resolvedTargets).toBe(
      'not-array',
    );

    trace.captureActionData('target_resolution', 'allowed:action', {
      resolvedTargets: [
        { id: 'target-1' },
        { id: 'target-2' },
      ],
      duration: 5,
    });

    expect(actionTrace.stages.target_resolution.data.resolvedTargets).toEqual([
      { id: 'target-1' },
      { id: 'target-2' },
    ]);

    trace.captureScopeEvaluation('allowed:action', 'primary', {
      scope: 'scope.primary',
      context: { location: 'test' },
      resultCount: 0,
      evaluationTimeMs: 3,
      cacheHit: false,
      error: new Error('resolution failed'),
    });

    trace.captureMultiTargetResolution('allowed:action', {
      targetKeys: ['primary'],
      totalTargets: 1,
      resolutionTimeMs: 9,
    });

    trace.captureTargetRelationships('allowed:action', {
      totalTargets: 1,
      relationships: [{ from: 'primary', to: 'primary' }],
      analysisTimeMs: 4,
    });

    const summary = trace.getMultiTargetSummary('allowed:action');
    expect(summary.scopeEvaluations[0].error).toBeInstanceOf(Error);
    expect(summary.hasRelationships).toBe(true);
    expect(trace.getMultiTargetSummary('missing')).toBeNull();

    expect(trace.isMultiTargetAction({ scope: 'global' })).toBe(true);
    expect(trace.isMultiTargetAction({ targetQuery: {} })).toBe(true);

    trace.captureEnhancedActionData('string_stage', 'allowed:action', 'payload', {
      summarize: true,
      targetVerbosity: 'minimal',
      category: 'diagnostic',
    });

    const stringStage = trace.getActionTrace('allowed:action').stages.string_stage;
    expect(stringStage.data._enhanced.category).toBe('diagnostic');

    trace.addDynamicTraceRule('non-enhanced', () => true);
    expect(logger.warn).toHaveBeenCalledWith(
      'Dynamic rules require EnhancedActionTraceFilter',
    );
  });
});
