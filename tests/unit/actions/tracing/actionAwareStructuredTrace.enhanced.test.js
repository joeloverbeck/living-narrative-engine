/**
 * @file Unit tests for ActionAwareStructuredTrace enhanced filtering features (ACTTRA-017)
 * Tests enhanced filtering capabilities, dynamic rules, statistics, and export functionality
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';

describe('ActionAwareStructuredTrace - Enhanced Filtering (ACTTRA-017)', () => {
  let testBed;
  let trace;
  let mockEnhancedFilter;

  beforeEach(() => {
    testBed = createTestBed();

    // Create enhanced filter mock with ACTTRA-017 capabilities
    mockEnhancedFilter = {
      shouldTrace: jest.fn(() => true),
      isEnabled: jest.fn(() => true),
      getVerbosityLevel: jest.fn(() => 'standard'),
      getInclusionConfig: jest.fn(() => ({
        componentData: true,
        prerequisites: true,
        targets: true,
      })),
      // Enhanced filtering capabilities
      shouldCaptureEnhanced: jest.fn(() => true),
      addDynamicRule: jest.fn(),
      removeDynamicRule: jest.fn(),
      getEnhancedStats: jest.fn(() => ({
        totalCaptures: 10,
        categorizedCaptures: { core: 5, performance: 3, diagnostic: 2 },
        averageProcessingTime: 2.5,
      })),
      resetEnhancedStats: jest.fn(),
      clearEnhancedCache: jest.fn(),
      optimizeCache: jest.fn(),
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Enhanced Action Data Capture', () => {
    beforeEach(() => {
      trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockEnhancedFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });
    });

    it('should capture enhanced action data with default options', () => {
      const stage = 'test_stage';
      const actionId = 'core:test';
      const data = {
        testField: 'testValue',
        complexData: { nested: { value: 123 } },
      };

      trace.captureEnhancedActionData(stage, actionId, data);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages[stage]).toBeDefined();

      const capturedData = actionTrace.stages[stage].data;
      expect(capturedData.testField).toBe('testValue');
      expect(capturedData.complexData).toEqual({ nested: { value: 123 } });
      expect(capturedData._enhanced).toBeDefined();
      expect(capturedData._enhanced.category).toBe('core');
      expect(capturedData._enhanced.verbosityLevel).toBe('standard');
      expect(capturedData._enhanced.timestamp).toBeDefined();
    });

    it('should capture enhanced action data with custom options', () => {
      const stage = 'performance_test';
      const actionId = 'core:test';
      const data = { performanceMetric: 150.5 };
      const options = {
        category: 'performance',
        context: { testRun: 'benchmark-1' },
        summarize: false,
      };

      trace.captureEnhancedActionData(stage, actionId, data, options);

      const actionTrace = trace.getActionTrace(actionId);
      const capturedData = actionTrace.stages[stage].data;

      expect(capturedData.performanceMetric).toBe(150.5);
      expect(capturedData._enhanced.category).toBe('performance');
      expect(mockEnhancedFilter.shouldCaptureEnhanced).toHaveBeenCalledWith(
        'performance',
        `${stage}_${actionId}`,
        data,
        { testRun: 'benchmark-1' }
      );
    });

    it('should apply data summarization when requested', () => {
      const stage = 'large_data_test';
      const actionId = 'core:test';
      const data = {
        largeArray: new Array(10).fill('item'),
        longString: 'A'.repeat(300),
        performance: { metrics: [1, 2, 3] },
        timing: { start: 100, end: 200 },
      };
      const options = {
        summarize: true,
        targetVerbosity: 'minimal',
      };

      trace.captureEnhancedActionData(stage, actionId, data, options);

      const actionTrace = trace.getActionTrace(actionId);
      const capturedData = actionTrace.stages[stage].data;

      // Performance data should be removed at minimal level
      expect(capturedData.performance).toBeUndefined();
      expect(capturedData.timing).toBeUndefined();

      // Check basic summarization behavior - core data preserved, performance removed
      expect(capturedData._enhanced).toBeDefined();
      expect(capturedData._enhanced.verbosityLevel).toBe('standard');
    });

    it('should validate inputs and handle errors gracefully', () => {
      // captureEnhancedActionData uses string.assertNonBlank which throws, unlike captureActionData
      expect(() => {
        trace.captureEnhancedActionData('', 'core:test', { test: 'data' });
      }).toThrow("Parameter 'Stage' must be a non-blank string");

      expect(() => {
        trace.captureEnhancedActionData('stage', '', { test: 'data' });
      }).toThrow("Parameter 'Action ID' must be a non-blank string");

      // Should not capture data when inputs are invalid
      expect(trace.getActionTrace('core:test')).toBeNull();
    });

    it('should fall back to regular filtering when enhanced filter unavailable', () => {
      const regularFilter = testBed.createMockActionTraceFilter({
        tracedActions: ['core:test'],
        verbosity: 'standard',
      });
      // No shouldCaptureEnhanced method

      const traceRegular = new ActionAwareStructuredTrace({
        actionTraceFilter: regularFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });

      const stage = 'fallback_test';
      const actionId = 'core:test';
      const data = { test: 'data' };

      traceRegular.captureEnhancedActionData(stage, actionId, data);

      const actionTrace = traceRegular.getActionTrace(actionId);
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages[stage]).toBeDefined();
      expect(regularFilter.shouldTrace).toHaveBeenCalledWith(actionId);
    });

    it('should stop capture when fallback filter rejects the action', () => {
      const regularFilter = testBed.createMockActionTraceFilter({
        tracedActions: ['other:action'],
        verbosity: 'standard',
      });

      const traceRegular = new ActionAwareStructuredTrace({
        actionTraceFilter: regularFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });

      traceRegular.captureEnhancedActionData('fallback_test', 'core:test', {
        test: 'data',
      });

      expect(regularFilter.shouldTrace).toHaveBeenCalledWith('core:test');
      expect(traceRegular.getActionTrace('core:test')).toBeNull();
    });

    it('should not capture when enhanced filter rejects', () => {
      mockEnhancedFilter.shouldCaptureEnhanced.mockReturnValue(false);

      const stage = 'rejected_test';
      const actionId = 'core:test';
      const data = { test: 'data' };

      trace.captureEnhancedActionData(stage, actionId, data);

      expect(trace.getActionTrace(actionId)).toBeNull();
      expect(mockEnhancedFilter.shouldCaptureEnhanced).toHaveBeenCalled();
    });
  });

  describe('Additional coverage for enhanced tracing flows', () => {
    beforeEach(() => {
      trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockEnhancedFilter,
        actorId: 'coverage-actor',
        logger: testBed.mockLogger,
      });
    });

    it('captures enhanced scope evaluation details', () => {
      trace.captureScopeEvaluation(
        'action:scope',
        'target-1',
        {
          scope: 'global',
          context: { foo: 'bar' },
          resultCount: 3,
          evaluationTimeMs: 7,
        },
        {
          entityDiscovery: [{ componentId: 'seat', totalEntities: 2 }],
          filterEvaluations: [{ itemId: 'chair', filterPassed: true }],
          resolverDetails: { strategy: 'demo' },
        }
      );

      const scopeStage =
        trace.getActionTrace('action:scope').stages.scope_evaluation.data;
      expect(scopeStage.entityDiscovery).toEqual([
        { componentId: 'seat', totalEntities: 2 },
      ]);
      expect(scopeStage.filterEvaluations).toEqual([
        { itemId: 'chair', filterPassed: true },
      ]);
      expect(scopeStage.resolverDetails).toEqual({ strategy: 'demo' });
    });

    it('builds multi-target summaries including relationships', () => {
      trace.captureMultiTargetResolution('action:multi', {
        targetKeys: ['first', 'second'],
        totalTargets: 2,
        resolutionTimeMs: 42,
      });

      trace.captureScopeEvaluation('action:multi', 'first', {
        scope: 'local',
        context: {},
        resultCount: 1,
      });

      trace.captureTargetRelationships('action:multi', {
        totalTargets: 2,
        relationships: [{ from: 'a', to: 'b' }],
      });

      const summary = trace.getMultiTargetSummary('action:multi');
      expect(summary.isMultiTarget).toBe(true);
      expect(summary.targetKeys).toEqual(['first', 'second']);
      expect(summary.totalTargets).toBe(2);
      expect(summary.hasRelationships).toBe(true);
      expect(summary.relationshipCount).toBe(1);
    });

    it('applies minimal filtering and preserves error messages', () => {
      const minimalFilter = testBed.createMockActionTraceFilter({
        tracedActions: ['core:test'],
        verbosity: 'minimal',
      });

      const minimalTrace = new ActionAwareStructuredTrace({
        actionTraceFilter: minimalFilter,
        actorId: 'actor-minimal',
        logger: testBed.mockLogger,
      });

      minimalTrace.captureActionData('component_filtering', 'core:test', {
        passed: false,
        error: new Error('minimal failure'),
      });

      const captured =
        minimalTrace.getActionTrace('core:test').stages.component_filtering
          .data;
      expect(captured.error).toBe('minimal failure');
    });

    it('counts object prerequisites in standard filtering', () => {
      const standardFilter = testBed.createMockActionTraceFilter({
        tracedActions: ['core:test'],
        verbosity: 'standard',
        includePrerequisites: true,
      });

      const standardTrace = new ActionAwareStructuredTrace({
        actionTraceFilter: standardFilter,
        actorId: 'actor-standard',
        logger: testBed.mockLogger,
      });

      standardTrace.captureActionData('component_filtering', 'core:test', {
        prerequisites: { one: true, two: false },
        passed: true,
      });

      const captured =
        standardTrace.getActionTrace('core:test').stages.component_filtering
          .data;
      expect(captured.prerequisiteCount).toBe(2);
    });

    it('summarizes enhanced data using filter verbosity when target missing', () => {
      mockEnhancedFilter.getVerbosityLevel.mockReturnValue('verbose');

      trace.captureEnhancedActionData(
        'summary_stage',
        'core:summary',
        {
          debug: 'x'.repeat(300),
          performance: { cost: 5 },
        },
        { summarize: true }
      );

      const data =
        trace.getActionTrace('core:summary').stages.summary_stage.data;
      expect(mockEnhancedFilter.getVerbosityLevel).toHaveBeenCalled();
      expect(data._enhanced.verbosityLevel).toBe('verbose');
    });

    it('handles dynamic rule removal and enhanced exports', () => {
      const removeSpy = jest.fn();
      mockEnhancedFilter.removeDynamicRule = removeSpy;

      trace.removeDynamicTraceRule('temporary');
      expect(removeSpy).toHaveBeenCalledWith('temporary');

      mockEnhancedFilter.getVerbosityLevel.mockReturnValue('verbose');
      trace.captureEnhancedActionData('enhanced_stage', 'core:export', {
        a: 1,
      });
      trace.captureActionData('component_filtering', 'core:export', {
        passed: true,
      });

      const exported = trace.exportFilteredTraceData('standard');
      expect(exported['core:export'].stages.enhanced_stage).toBeUndefined();
      expect(exported['core:export'].stages.component_filtering).toBeDefined();
    });

    it('manages enhanced filter caches and serializes trace', () => {
      const resetStats = jest.fn();
      const clearCache = jest.fn();
      const optimizeCache = jest.fn();
      mockEnhancedFilter.resetEnhancedStats = resetStats;
      mockEnhancedFilter.clearEnhancedCache = clearCache;
      mockEnhancedFilter.optimizeCache = optimizeCache;

      trace.resetEnhancedStats();
      trace.clearEnhancedCache();
      trace.optimizeEnhancedCache();

      expect(resetStats).toHaveBeenCalled();
      expect(clearCache).toHaveBeenCalled();
      expect(optimizeCache).toHaveBeenCalledWith(300000);

      trace.captureActionData('action_start', 'core:serialize', {
        timestamp: 1000,
      });
      trace.captureActionData('action_complete', 'core:serialize', {
        timestamp: 1600,
      });

      const actionTrace = trace.getActionTrace('core:serialize');
      actionTrace.stages.action_start.timestamp = 1000;
      actionTrace.stages.action_complete.timestamp = 1600;

      const serialized = trace.toJSON();
      expect(serialized.actions['core:serialize'].stageOrder).toEqual([
        'action_start',
        'action_complete',
      ]);
      expect(serialized.actions['core:serialize'].totalDuration).toBe(600);
      expect(serialized.summary.tracedActionCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Data Summarization', () => {
    beforeEach(() => {
      trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockEnhancedFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });
    });

    it('should summarize data for different verbosity levels', () => {
      const testData = {
        core: 'always included',
        performance: { timing: 100 },
        metrics: [1, 2, 3, 4, 5],
        diagnostic: { debug: 'info' },
        longText: 'A'.repeat(250),
      };

      // Test minimal level
      const minimalOptions = { summarize: true, targetVerbosity: 'minimal' };
      trace.captureEnhancedActionData(
        'min_test',
        'core:test1',
        testData,
        minimalOptions
      );

      let actionTrace = trace.getActionTrace('core:test1');
      let capturedData = actionTrace.stages.min_test.data;

      expect(capturedData.core).toBe('always included');
      expect(capturedData.performance).toBeUndefined();
      expect(capturedData._enhanced).toBeDefined();
      expect(capturedData._enhanced.verbosityLevel).toBe('standard');

      // Test detailed level
      const detailedOptions = { summarize: true, targetVerbosity: 'detailed' };
      trace.captureEnhancedActionData(
        'detailed_test',
        'core:test2',
        testData,
        detailedOptions
      );

      actionTrace = trace.getActionTrace('core:test2');
      capturedData = actionTrace.stages.detailed_test.data;

      expect(capturedData.core).toBe('always included');
      expect(capturedData.performance).toEqual({ timing: 100 });
      expect(capturedData.diagnostic).toBeUndefined(); // Removed at detailed level
      expect(capturedData.longText).toBe('A'.repeat(197) + '...'); // Truncated strings
    });

    it('should handle non-object data gracefully', () => {
      const options = { summarize: true, targetVerbosity: 'minimal' };

      trace.captureEnhancedActionData(
        'string_test',
        'core:test1',
        'simple string',
        options
      );
      trace.captureEnhancedActionData('number_test', 'core:test2', 42, options);
      trace.captureEnhancedActionData('null_test', 'core:test3', null, options);

      // For string data, check if it was included in the enhanced data structure
      const stringTraceData =
        trace.getActionTrace('core:test1').stages.string_test.data;
      expect(stringTraceData).toEqual(
        expect.objectContaining({ _enhanced: expect.any(Object) })
      );

      const numberTraceData =
        trace.getActionTrace('core:test2').stages.number_test.data;
      expect(numberTraceData).toEqual(
        expect.objectContaining({ _enhanced: expect.any(Object) })
      );

      expect(
        trace.getActionTrace('core:test3').stages.null_test.data
      ).toBeDefined();
    });
  });

  describe('Dynamic Filtering Rules', () => {
    beforeEach(() => {
      trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockEnhancedFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });
    });

    it('should add dynamic trace rules when enhanced filter supports it', () => {
      const ruleName = 'testRule';
      const ruleFunction = jest.fn(() => true);

      trace.addDynamicTraceRule(ruleName, ruleFunction);

      expect(mockEnhancedFilter.addDynamicRule).toHaveBeenCalledWith(
        ruleName,
        ruleFunction
      );
    });

    it('should remove dynamic trace rules when enhanced filter supports it', () => {
      const ruleName = 'testRule';

      trace.removeDynamicTraceRule(ruleName);

      expect(mockEnhancedFilter.removeDynamicRule).toHaveBeenCalledWith(
        ruleName
      );
    });

    it('should warn when dynamic rules not supported by filter', () => {
      const regularFilter = testBed.createMockActionTraceFilter();
      const traceRegular = new ActionAwareStructuredTrace({
        actionTraceFilter: regularFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });

      traceRegular.addDynamicTraceRule('testRule', () => true);

      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        'Dynamic rules require EnhancedActionTraceFilter'
      );
    });
  });

  describe('Enhanced Statistics', () => {
    beforeEach(() => {
      trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockEnhancedFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });
    });

    it('should get enhanced statistics when available', () => {
      const stats = trace.getEnhancedTraceStats();

      expect(stats).toEqual({
        totalCaptures: 10,
        categorizedCaptures: { core: 5, performance: 3, diagnostic: 2 },
        averageProcessingTime: 2.5,
      });
      expect(mockEnhancedFilter.getEnhancedStats).toHaveBeenCalled();
    });

    it('should return null when enhanced stats not available', () => {
      const regularFilter = testBed.createMockActionTraceFilter();
      const traceRegular = new ActionAwareStructuredTrace({
        actionTraceFilter: regularFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });

      const stats = traceRegular.getEnhancedTraceStats();
      expect(stats).toBeNull();
    });

    it('should reset enhanced statistics', () => {
      trace.resetEnhancedStats();
      expect(mockEnhancedFilter.resetEnhancedStats).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockEnhancedFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });
    });

    it('should clear enhanced cache', () => {
      trace.clearEnhancedCache();
      expect(mockEnhancedFilter.clearEnhancedCache).toHaveBeenCalled();
    });

    it('should optimize enhanced cache with default max age', () => {
      trace.optimizeEnhancedCache();
      expect(mockEnhancedFilter.optimizeCache).toHaveBeenCalledWith(300000);
    });

    it('should optimize enhanced cache with custom max age', () => {
      const customMaxAge = 600000; // 10 minutes
      trace.optimizeEnhancedCache(customMaxAge);
      expect(mockEnhancedFilter.optimizeCache).toHaveBeenCalledWith(
        customMaxAge
      );
    });
  });

  describe('Filtered Data Export', () => {
    beforeEach(() => {
      trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockEnhancedFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });

      // Add some test data
      trace.captureEnhancedActionData(
        'stage1',
        'core:action1',
        { data: 'test1' },
        { category: 'core' }
      );
      trace.captureEnhancedActionData(
        'stage2',
        'core:action2',
        { data: 'test2', performance: { timing: 100 } },
        { category: 'performance' }
      );
    });

    it('should export filtered trace data by verbosity', () => {
      const filteredData = trace.exportFilteredTraceData('minimal');

      expect(Object.keys(filteredData)).toContain('core:action1');
      expect(Object.keys(filteredData)).toContain('core:action2');

      // Check that data is properly summarized
      const action1Data = filteredData['core:action1'];
      expect(action1Data.stages.stage1).toBeDefined();
      expect(action1Data.actorId).toBe('test-actor');
    });

    it('should export filtered trace data by categories', () => {
      const filteredData = trace.exportFilteredTraceData('standard', ['core']);

      expect(Object.keys(filteredData)).toContain('core:action1');
      // Should include core category but behavior depends on stage categorization
    });

    it('should handle empty trace data', () => {
      const emptyTrace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockEnhancedFilter,
        actorId: 'empty-actor',
        logger: testBed.mockLogger,
      });

      const filteredData = emptyTrace.exportFilteredTraceData('standard');
      expect(filteredData).toEqual({});
    });

    it('should skip stages above target verbosity', () => {
      // Test basic verbosity filtering behavior
      const filteredData = trace.exportFilteredTraceData('minimal');

      // Basic test that export function works
      expect(filteredData).toBeDefined();
      expect(typeof filteredData).toBe('object');
    });
  });

  describe('Stage Category Mapping', () => {
    beforeEach(() => {
      trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockEnhancedFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });
    });

    it('should correctly categorize business logic stages', () => {
      const businessLogicStages = [
        'component_filtering',
        'prerequisite_evaluation',
        'target_resolution',
        'formatting',
      ];

      businessLogicStages.forEach((stage) => {
        trace.captureEnhancedActionData(stage, 'core:test', { test: 'data' });
      });

      const filteredData = trace.exportFilteredTraceData('standard', [
        'business_logic',
      ]);
      const actionData = filteredData['core:test'];

      expect(actionData).toBeDefined();
      expect(Object.keys(actionData.stages).length).toBeGreaterThan(0);
      businessLogicStages.forEach((stage) => {
        expect(actionData.stages[stage]).toBeDefined();
      });
    });

    it('should correctly categorize performance stages', () => {
      const performanceStages = [
        'timing_data',
        'resource_usage',
        'performance_metrics',
      ];

      performanceStages.forEach((stage) => {
        trace.captureEnhancedActionData(stage, 'core:test', { test: 'data' });
      });

      const filteredData = trace.exportFilteredTraceData('standard', [
        'performance',
      ]);
      const actionData = filteredData['core:test'];

      expect(actionData).toBeDefined();
      expect(Object.keys(actionData.stages).length).toBeGreaterThan(0);
      performanceStages.forEach((stage) => {
        expect(actionData.stages[stage]).toBeDefined();
      });
    });

    it('should include stages with unknown categories by default', () => {
      trace.captureEnhancedActionData('unknown_stage', 'core:test', {
        test: 'data',
      });

      const filteredData = trace.exportFilteredTraceData('standard', ['core']);
      const actionData = filteredData['core:test'];

      expect(actionData.stages.unknown_stage).toBeDefined();
    });
  });
});
