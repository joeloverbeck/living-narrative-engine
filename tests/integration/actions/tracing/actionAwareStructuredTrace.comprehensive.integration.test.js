import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import EnhancedActionTraceFilter from '../../../../src/actions/tracing/enhancedActionTraceFilter.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('ActionAwareStructuredTrace comprehensive integration', () => {
  let logger;

  beforeEach(() => {
    logger = createLogger();
  });

  it('captures pipeline data across verbosity levels and produces rich summaries', () => {
    const filter = new ActionTraceFilter({
      tracedActions: ['core:move'],
      verbosityLevel: 'minimal',
      inclusionConfig: {
        componentData: true,
        prerequisites: true,
        targets: true,
      },
      logger,
    });

    const performanceMonitor = {
      trackOperation: jest.fn().mockImplementation(() => {
        throw new Error('monitor failure');
      }),
    };

    const trace = new ActionAwareStructuredTrace({
      actionTraceFilter: filter,
      actorId: 'actor-1',
      context: { scenario: 'integration' },
      logger,
      traceConfig: { enablePerformanceTracking: true },
      performanceMonitor,
    });

    trace.captureActionData('component_filtering', 'core:move', {
      passed: true,
      actorComponents: ['core:position'],
    });

    const minimalStage =
      trace.getActionTrace('core:move').stages.component_filtering.data;
    expect(minimalStage.passed).toBe(true);
    expect(minimalStage.actorComponents).toBeUndefined();
    expect(performanceMonitor.trackOperation).toHaveBeenCalledWith(
      'stage_component_filtering',
      expect.any(Number)
    );

    filter.setVerbosityLevel('standard');
    trace.captureActionData('prerequisite_evaluation', 'core:move', {
      passed: true,
      actorId: 'actor-1',
      actorComponents: ['core:position'],
      requiredComponents: ['core:movement'],
      prerequisites: [
        { type: 'component', component: 'core:position', passed: true },
        { type: 'condition', condition: 'canMove', passed: true },
      ],
      targetCount: 2,
      targetKeys: ['primary', 'secondary'],
    });
    const standardStage =
      trace.getActionTrace('core:move').stages.prerequisite_evaluation.data;
    expect(standardStage.actorComponents).toEqual(['core:position']);
    expect(standardStage.prerequisiteCount).toBe(2);
    expect(standardStage.targetKeys).toEqual(['primary', 'secondary']);

    filter.setVerbosityLevel('detailed');
    const resolvedTargets = Array.from({ length: 12 }, (_, index) => ({
      id: `target-${index}`,
    }));
    trace.captureActionData('target_resolution', 'core:move', {
      success: true,
      resolvedTargets,
      duration: 42,
    });
    const detailedStage =
      trace.getActionTrace('core:move').stages.target_resolution.data;
    expect(detailedStage.resolvedTargets).toHaveLength(10);
    expect(detailedStage.resolvedTargets.at(-1)).toEqual({
      truncated: true,
      originalLength: 12,
      showing: 9,
    });
    expect(detailedStage.duration).toBe(42);

    filter.setVerbosityLevel('verbose');
    const verboseData = { debug: { detail: 'rich diagnostics' } };
    verboseData.longText = 'x'.repeat(1200);
    verboseData.self = verboseData;
    trace.captureActionData('formatting', 'core:move', verboseData);
    const verboseStage =
      trace.getActionTrace('core:move').stages.formatting.data;
    expect(verboseStage.longText.endsWith('... [truncated]')).toBe(true);
    expect(verboseStage.self).toBe('[Circular Reference]');
    expect(verboseStage.debug).toEqual({ detail: 'rich diagnostics' });

    const summary = trace.getTracingSummary();
    expect(summary.tracedActionCount).toBe(1);
    expect(summary.totalStagesTracked).toBeGreaterThanOrEqual(4);
    expect(trace.isActionTraced('core:move')).toBe(true);
    expect(trace.getActionTrace('missing')).toBeNull();

    const performance = trace.calculateStagePerformance('core:move');
    expect(Object.keys(performance)).toEqual(
      expect.arrayContaining(['component_filtering', 'prerequisite_evaluation'])
    );

    const tracedActionsCopy = trace.getTracedActions();
    tracedActionsCopy.set('spoofed', {});
    expect(trace.getActionTrace('spoofed')).toBeNull();
    expect(trace.getActionTraceFilter()).toBe(filter);
    expect(trace.getActorId()).toBe('actor-1');
    expect(trace.actorId).toBe('actor-1');
    expect(trace.actionId).toBe('core:move');

    const originalGetVerbosityLevel = filter.getVerbosityLevel.bind(filter);
    const originalGetInclusionConfig = filter.getInclusionConfig.bind(filter);
    const badConfig = {};
    Object.defineProperty(badConfig, 'componentData', {
      get() {
        throw new Error('bad config');
      },
    });
    Object.defineProperty(badConfig, 'prerequisites', {
      get() {
        return false;
      },
    });
    Object.defineProperty(badConfig, 'targets', {
      get() {
        return false;
      },
    });
    filter.getVerbosityLevel = () => 'standard';
    filter.getInclusionConfig = () => badConfig;
    trace.captureActionData('error_stage', 'core:move', { passed: false });
    const errorStage =
      trace.getActionTrace('core:move').stages.error_stage.data;
    expect(errorStage.error).toBe('Data filtering failed');
    filter.getVerbosityLevel = originalGetVerbosityLevel;
    filter.getInclusionConfig = originalGetInclusionConfig;

    trace.captureActionData('diagnostic_stage', 'core:move', {
      metric: 1,
      value: BigInt(10),
    });
    const diagnosticStage =
      trace.getActionTrace('core:move').stages.diagnostic_stage.data;
    expect(diagnosticStage.dataError).toBe('Failed to serialize data safely');

    trace.captureActionData('', 'core:move', null);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'ActionAwareStructuredTrace: Error capturing action data'
      ),
      expect.any(Error)
    );

    trace.captureActionData('component_filtering', 'core:idle', {
      passed: true,
    });
    expect(trace.isActionTraced('core:idle')).toBe(false);

    const json = trace.toJSON();
    expect(json.actions['core:move'].stageOrder).toEqual(
      expect.arrayContaining([
        'component_filtering',
        'prerequisite_evaluation',
        'target_resolution',
        'formatting',
        'error_stage',
        'diagnostic_stage',
      ])
    );
  });

  it('captures advanced tracing domains like legacy processing, operators, and multi-target flows', () => {
    const filter = new ActionTraceFilter({
      tracedActions: ['legacy:*', 'multi:resolve', 'operator'],
      verbosityLevel: 'detailed',
      inclusionConfig: {
        componentData: true,
        prerequisites: true,
        targets: true,
      },
      logger,
    });

    const trace = new ActionAwareStructuredTrace({
      actionTraceFilter: filter,
      actorId: 'actor-legacy',
      context: { pipeline: 'legacy' },
      logger,
    });

    trace.captureLegacyDetection('legacy:convert', {
      hasStringTargets: true,
      hasScopeOnly: false,
      hasLegacyFields: true,
      detectedFormat: 'legacy_string',
      requiresConversion: true,
    });

    trace.captureLegacyConversion('legacy:convert', {
      isLegacy: true,
      originalAction: { targets: 'core:chair' },
      targetDefinitions: { normalized: true },
      processingTime: 12,
      error: null,
      migrationSuggestion: 'use multi-target',
    });

    trace.captureLegacyConversion('legacy:convert-fail', {
      isLegacy: true,
      originalAction: { scope: 'global' },
      targetDefinitions: null,
      processingTime: 8,
      error: new Error('conversion failed'),
    });

    trace.captureOperatorEvaluation({
      operator: 'isSocketCovered',
      entityId: 'entity-1',
      result: true,
      reason: 'matched requirements',
      details: { sockets: 2 },
    });

    trace.captureOperatorEvaluation({
      operator: 'hasPower',
      entityId: 'entity-2',
      result: false,
      reason: 'missing generator',
    });

    trace.captureMultiTargetResolution('multi:resolve', {
      targetKeys: ['primary', 'secondary'],
      resolvedCounts: { primary: 2 },
      totalTargets: 2,
      resolutionOrder: ['primary', 'secondary'],
      hasContextDependencies: true,
      resolutionTimeMs: 15,
    });

    trace.captureScopeEvaluation(
      'multi:resolve',
      'primary',
      {
        scope: 'scope.primary',
        context: { query: 'chairs' },
        resultCount: 2,
        evaluationTimeMs: 5,
        cacheHit: true,
      },
      {
        entityDiscovery: [
          { componentId: 'core:seat', totalEntities: 5, foundEntities: 2 },
        ],
        filterEvaluations: [
          { itemId: 'entity-1', filterPassed: true, evaluationResult: 'ok' },
        ],
      }
    );

    trace.captureEnhancedScopeEvaluation('multi:resolve', 'primary', [
      {
        source: 'ScopeEngine.entityDiscovery',
        data: {
          componentId: 'core:seat',
          totalEntities: 5,
          foundEntities: 2,
          resultIds: ['entity-1', 'entity-2'],
        },
      },
      {
        source: 'ScopeEngine.filterEvaluation',
        data: {
          itemId: 'entity-1',
          filterPassed: true,
          evaluationResult: 'ok',
          hasPositionComponent: true,
          hasAllowsSittingComponent: true,
          actorLocationId: 'loc:1',
          entityLocationId: 'loc:1',
          allowsSittingSpots: true,
        },
      },
    ]);

    trace.captureTargetRelationships('multi:resolve', {
      totalTargets: 2,
      relationships: [{ from: 'primary', to: 'secondary' }],
      patterns: ['chain'],
      analysisTimeMs: 7,
    });

    const legacySummary = trace.getLegacyProcessingSummary();
    expect(legacySummary.totalLegacyActions).toBe(2);
    expect(legacySummary.conversionsByFormat.string_targets).toBe(1);
    expect(legacySummary.conversionsByFormat.scope_property).toBe(1);
    expect(legacySummary.failedConversions).toBe(1);

    const multiSummary = trace.getMultiTargetSummary('multi:resolve');
    expect(multiSummary.isMultiTarget).toBe(true);
    expect(multiSummary.scopeEvaluations).toHaveLength(1);
    expect(multiSummary.hasRelationships).toBe(true);
    expect(multiSummary.targetKeys).toEqual(['primary', 'secondary']);

    const operatorTrace = trace.getActionTrace('_current_scope_evaluation');
    expect(
      operatorTrace.stages.operator_evaluations.data.evaluations
    ).toHaveLength(2);

    expect(trace.isMultiTargetAction({ targets: { key: 'value' } })).toBe(true);
    expect(trace.isMultiTargetAction({ name: 'single-action' })).toBe(false);

    const summary = trace.getTracingSummary();
    expect(summary.tracedActionCount).toBeGreaterThanOrEqual(2);

    trace.clearActionData();
    expect(trace.getTracingSummary().tracedActionCount).toBe(0);
  });

  it('integrates with enhanced filtering for dynamic capture, exports, and cache management', () => {
    const enhancedFilter = new EnhancedActionTraceFilter({
      tracedActions: ['*'],
      verbosityLevel: 'verbose',
      inclusionConfig: {
        componentData: true,
        prerequisites: true,
        targets: true,
      },
      logger,
    });

    const trace = new ActionAwareStructuredTrace({
      actionTraceFilter: enhancedFilter,
      actorId: 'actor-enhanced',
      context: { env: 'test' },
      logger,
    });

    trace.captureEnhancedActionData(
      'timing_data',
      'core:enhanced',
      {
        metrics: [1, 2, 3, 4],
        performance: { slowest: 50 },
        debug: { verbose: true },
      },
      {
        category: 'performance',
        summarize: true,
        targetVerbosity: 'minimal',
        context: { actionId: 'core:enhanced' },
      }
    );

    const enhancedTimingStage =
      trace.getActionTrace('core:enhanced').stages.timing_data.data;
    expect(enhancedTimingStage._enhanced.category).toBe('performance');
    expect(enhancedTimingStage.metrics).toBeUndefined();
    expect(enhancedTimingStage.performance).toBeUndefined();

    trace.addDynamicTraceRule('skip-diagnostics', ({ category }) =>
      category === 'diagnostic' ? false : true
    );

    trace.captureEnhancedActionData(
      'debug_info',
      'core:enhanced',
      { message: 'should skip' },
      { category: 'diagnostic', context: { actionId: 'core:enhanced' } }
    );
    expect(
      trace.getActionTrace('core:enhanced').stages.debug_info
    ).toBeUndefined();

    trace.removeDynamicTraceRule('skip-diagnostics');
    trace.captureEnhancedActionData(
      'debug_info',
      'core:enhanced',
      { message: 'captured' },
      { category: 'diagnostic', context: { actionId: 'core:enhanced' } }
    );
    expect(
      trace.getActionTrace('core:enhanced').stages.debug_info.data.message
    ).toBe('captured');

    trace.captureActionData('performance_metrics', 'core:enhanced', {
      metric: 1,
    });
    trace.captureActionData('component_filtering', 'core:secondary', {
      passed: true,
    });

    const stats = trace.getEnhancedTraceStats();
    expect(stats.totalChecks).toBeGreaterThan(0);

    trace.resetEnhancedStats();
    expect(trace.getEnhancedTraceStats()).toEqual({
      totalChecks: 0,
      filteredOut: 0,
      cacheHits: 0,
      dynamicRuleApplications: 0,
      filterRate: 0,
      cacheHitRate: 0,
    });

    trace.clearEnhancedCache();
    trace.optimizeEnhancedCache(-1);

    const standardExport = trace.exportFilteredTraceData('standard', [
      'performance',
    ]);
    expect(Object.keys(standardExport)).toContain('core:enhanced');
    expect(standardExport['core:enhanced'].stages).not.toHaveProperty(
      'timing_data'
    );
    expect(standardExport['core:enhanced'].stages).toHaveProperty(
      'performance_metrics'
    );
    const verboseExport = trace.exportFilteredTraceData('verbose', [
      'performance',
    ]);
    expect(verboseExport['core:enhanced'].stages).toHaveProperty('timing_data');
    expect(verboseExport['core:enhanced'].stages).not.toHaveProperty(
      'debug_info'
    );

    expect(trace.actionId).toBe('discovery');

    const freshTrace = new ActionAwareStructuredTrace({
      actionTraceFilter: enhancedFilter,
      actorId: 'actor-empty',
      context: {},
      logger,
    });
    expect(freshTrace.actionId).toBe('discovery');
  });
});
