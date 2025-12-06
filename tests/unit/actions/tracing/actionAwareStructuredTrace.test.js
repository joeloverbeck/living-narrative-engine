import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';

describe('ActionAwareStructuredTrace - Core Functionality', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Construction and Initialization', () => {
    it('should create instance with valid dependencies', async () => {
      const trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        verbosity: 'standard',
      });

      expect(trace).toBeDefined();
      expect(trace.getTracingSummary().tracedActionCount).toBe(0);
      expect(trace.getActorId()).toBe('test-actor');
    });

    it('should extend StructuredTrace functionality', async () => {
      const trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
      });

      // Should have inherited StructuredTrace methods
      expect(typeof trace.info).toBe('function');
      expect(typeof trace.step).toBe('function');
      expect(typeof trace.startSpan).toBe('function');
      expect(typeof trace.getPerformanceSummary).toBe('function');

      // Should have new action tracing methods
      expect(typeof trace.captureActionData).toBe('function');
      expect(typeof trace.getTracedActions).toBe('function');
      expect(typeof trace.getActionTrace).toBe('function');
    });

    it('should require actionTraceFilter dependency', () => {
      expect(() => {
        new ActionAwareStructuredTrace({
          actionTraceFilter: null,
          actorId: 'test-actor',
          logger: testBed.mockLogger,
        });
      }).toThrow('ActionTraceFilter is required');
    });

    it('should require actorId parameter', () => {
      const mockFilter = testBed.createMockActionTraceFilter();

      expect(() => {
        new ActionAwareStructuredTrace({
          actionTraceFilter: mockFilter,
          actorId: '',
          logger: testBed.mockLogger,
        });
      }).toThrow('must be a non-blank string');
    });

    it('should handle optional context and logger parameters', async () => {
      const mockFilter = testBed.createMockActionTraceFilter();

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId: 'test-actor',
        // No context or logger provided
      });

      expect(trace).toBeDefined();
      expect(trace.getActorId()).toBe('test-actor');
    });
  });

  describe('Action Data Capture', () => {
    it('should capture action data for traced actions', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      const testData = {
        actorComponents: ['core:position'],
        requiredComponents: ['core:position'],
        passed: true,
      };

      trace.captureActionData('component_filtering', 'movement:go', testData);

      const actionTrace = trace.getActionTrace('movement:go');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.actionId).toBe('movement:go');
      expect(actionTrace.actorId).toBe('test-actor');
      expect(actionTrace.stages.component_filtering).toBeDefined();
      expect(actionTrace.stages.component_filtering.data.passed).toBe(true);
      expect(typeof actionTrace.startTime).toBe('number');
    });

    it('should not capture data for non-traced actions', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:look'], // Only trace 'look', not 'go'
        verbosity: 'standard',
      });

      trace.captureActionData('component_filtering', 'movement:go', {
        test: 'data',
      });

      expect(trace.getActionTrace('movement:go')).toBeNull();
      expect(trace.getTracingSummary().tracedActionCount).toBe(0);
    });

    it('should handle multiple stages for same action', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      trace.captureActionData('component_filtering', 'movement:go', {
        stage1: 'data',
      });
      trace.captureActionData('prerequisite_evaluation', 'movement:go', {
        stage2: 'data',
      });
      trace.captureActionData('target_resolution', 'movement:go', {
        stage3: 'data',
      });

      const actionTrace = trace.getActionTrace('movement:go');
      expect(Object.keys(actionTrace.stages)).toEqual([
        'component_filtering',
        'prerequisite_evaluation',
        'target_resolution',
      ]);

      // Each stage should have timestamp and completed timestamp
      expect(typeof actionTrace.stages.component_filtering.timestamp).toBe(
        'number'
      );
      expect(
        typeof actionTrace.stages.component_filtering.stageCompletedAt
      ).toBe('number');
    });

    it('should handle multiple different actions', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:*', 'core:*'],
        verbosity: 'standard',
      });

      trace.captureActionData('component_filtering', 'movement:go', {
        action: 'go',
      });
      trace.captureActionData('component_filtering', 'core:look', {
        action: 'look',
      });

      expect(trace.isActionTraced('movement:go')).toBe(true);
      expect(trace.isActionTraced('core:look')).toBe(true);
      expect(trace.getTracingSummary().tracedActionCount).toBe(2);
    });

    it('should validate parameters and handle errors gracefully', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      // Should not throw even with invalid data - just log error
      expect(() => {
        trace.captureActionData('', 'movement:go', { test: 'data' });
      }).not.toThrow();

      expect(() => {
        trace.captureActionData('test_stage', '', { test: 'data' });
      }).not.toThrow();

      expect(() => {
        trace.captureActionData('test_stage', 'movement:go', null);
      }).not.toThrow();

      // Should have logged errors but not captured invalid data
      expect(trace.getActionTrace('movement:go')).toBeNull();
    });

    it('should log and recover when verbosity filtering fails', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'minimal',
      });

      testBed.mockLogger.error.mockClear();

      const problematicData = {};
      Object.defineProperty(problematicData, 'passed', {
        get() {
          throw new Error('Cannot access passed flag');
        },
      });

      expect(() =>
        trace.captureActionData(
          'diagnostic_stage',
          'movement:go',
          problematicData
        )
      ).not.toThrow();

      const actionTrace = trace.getActionTrace('movement:go');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages.diagnostic_stage).toBeDefined();
      expect(actionTrace.stages.diagnostic_stage.data.error).toBe(
        'Data filtering failed'
      );

      expect(testBed.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error filtering data for verbosity'),
        expect.any(Error)
      );
    });
  });

  describe('Verbosity Filtering', () => {
    it('should apply minimal verbosity filtering correctly', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'minimal',
      });

      const fullData = {
        actorComponents: ['core:position', 'core:movement'],
        requiredComponents: ['core:position'],
        passed: true,
        success: true,
        error: 'Some error message',
        detailedInfo: { complex: 'object' },
        extraData: 'should be filtered out',
      };

      trace.captureActionData('component_filtering', 'movement:go', fullData);

      const capturedData =
        trace.getActionTrace('movement:go').stages.component_filtering.data;

      // Should include basic success/failure data
      expect(capturedData.passed).toBe(true);
      expect(capturedData.success).toBe(true);
      expect(capturedData.error).toBe('Some error message');
      expect(capturedData.timestamp).toBeDefined();
      expect(capturedData.stage).toBe('component_filtering');

      // Should exclude detailed data
      expect(capturedData.actorComponents).toBeUndefined();
      expect(capturedData.detailedInfo).toBeUndefined();
      expect(capturedData.extraData).toBeUndefined();
    });

    it('should apply standard verbosity filtering correctly', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
        includeComponentData: true,
        includePrerequisites: true,
      });

      const fullData = {
        actorComponents: ['core:position', 'core:movement'],
        requiredComponents: ['core:position'],
        prerequisites: [{ condition: 'test1' }, { condition: 'test2' }],
        passed: true,
        actorId: 'actor123',
        detailedInfo: { complex: 'object' },
        targetCount: 5,
        targetKeys: ['key1', 'key2'],
      };

      trace.captureActionData('component_filtering', 'movement:go', fullData);

      const capturedData =
        trace.getActionTrace('movement:go').stages.component_filtering.data;

      // Should include minimal data
      expect(capturedData.passed).toBe(true);

      // Should include standard data
      expect(capturedData.actorId).toBe('actor123');
      expect(capturedData.actorComponents).toEqual([
        'core:position',
        'core:movement',
      ]);
      expect(capturedData.requiredComponents).toEqual(['core:position']);
      expect(capturedData.prerequisiteCount).toBe(2);

      // Should exclude detailed info (not in standard level)
      expect(capturedData.detailedInfo).toBeUndefined();

      // Should include prerequisite count but not full data in standard
      expect(capturedData.prerequisites).toBeUndefined();
    });

    it('should apply detailed verbosity filtering correctly', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'detailed',
        includeComponentData: true,
        includePrerequisites: true,
        includeTargets: true,
      });

      const fullData = {
        actorComponents: ['core:position'],
        prerequisites: [{ condition: 'test' }],
        resolvedTargets: Array.from({ length: 15 }, (_, i) => ({
          target: `target${i}`,
        })),
        passed: true,
        duration: 5.2,
        formattedCommand: 'formatted command text',
        template: 'action template',
        sensitiveData: 'should not be included',
      };

      trace.captureActionData(
        'prerequisite_evaluation',
        'movement:go',
        fullData
      );

      const capturedData =
        trace.getActionTrace('movement:go').stages.prerequisite_evaluation.data;

      // Should include standard level data
      expect(capturedData.passed).toBe(true);
      expect(capturedData.actorComponents).toEqual(['core:position']);

      // Should include detailed level data
      expect(capturedData.prerequisites).toEqual([{ condition: 'test' }]);
      expect(capturedData.duration).toBe(5.2);
      expect(capturedData.formattedCommand).toBe('formatted command text');
      expect(capturedData.template).toBe('action template');

      // Should limit array size (15 items should be truncated to 10)
      expect(capturedData.resolvedTargets).toBeDefined();
      expect(capturedData.resolvedTargets.length).toBe(10); // 9 items + 1 truncation marker
      expect(capturedData.resolvedTargets[9]).toEqual({
        truncated: true,
        originalLength: 15,
        showing: 9,
      });
    });

    it('should apply verbose verbosity filtering correctly', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'verbose',
      });

      const fullData = {
        everything: 'should be included',
        unless: 'explicitly filtered',
        duration: 10.5,
        complexObject: { nested: { data: 'value' } },
        // These should be filtered out
        sensitiveData: 'should be removed',
        rawTokens: 'should be removed',
        internalState: 'should be removed',
      };

      trace.captureActionData('test_stage', 'movement:go', fullData);

      const capturedData =
        trace.getActionTrace('movement:go').stages.test_stage.data;

      // Should include most data
      expect(capturedData.everything).toBe('should be included');
      expect(capturedData.unless).toBe('explicitly filtered');
      expect(capturedData.duration).toBe(10.5);
      expect(capturedData.complexObject).toEqual({ nested: { data: 'value' } });

      // Should exclude sensitive fields
      expect(capturedData.sensitiveData).toBeUndefined();
      expect(capturedData.rawTokens).toBeUndefined();
      expect(capturedData.internalState).toBeUndefined();
    });

    it('should handle unknown verbosity level gracefully', async () => {
      const mockFilter = testBed.createMockActionTraceFilter({
        tracedActions: ['movement:go'],
        verbosity: 'unknown_level',
      });

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });

      trace.captureActionData('test_stage', 'movement:go', { test: 'data' });

      // Should fallback to standard verbosity and log warning
      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown verbosity level: unknown_level')
      );
    });

    it('should handle circular references safely', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'verbose',
      });

      const circularData = { name: 'test' };
      circularData.self = circularData; // Create circular reference

      expect(() => {
        trace.captureActionData('test_stage', 'movement:go', circularData);
      }).not.toThrow();

      const capturedData =
        trace.getActionTrace('movement:go').stages.test_stage.data;
      expect(capturedData).toBeDefined();
      expect(capturedData.name).toBe('test');
      expect(capturedData.self).toBe('[Circular Reference]');
    });

    it('should handle very long strings by truncating', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'verbose',
      });

      const longString = 'A'.repeat(1500); // > 1000 characters
      const testData = {
        longText: longString,
        shortText: 'normal',
      };

      trace.captureActionData('test_stage', 'movement:go', testData);

      const capturedData =
        trace.getActionTrace('movement:go').stages.test_stage.data;
      expect(capturedData.shortText).toBe('normal');
      expect(capturedData.longText).toBe('A'.repeat(1000) + '... [truncated]');
    });

    it('should handle array size limiting edge cases', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'detailed',
        includeTargets: true,
      });

      // Test exactly at the limit
      const exactLimitData = {
        resolvedTargets: Array.from({ length: 10 }, (_, i) => ({ id: i })),
      };

      trace.captureActionData(
        'exact_limit_stage',
        'movement:go',
        exactLimitData
      );

      const exactLimitCaptured =
        trace.getActionTrace('movement:go').stages.exact_limit_stage.data;
      expect(exactLimitCaptured.resolvedTargets).toHaveLength(10);
      expect(exactLimitCaptured.resolvedTargets[9]).not.toHaveProperty(
        'truncated'
      );

      // Test just over the limit
      const overLimitData = {
        resolvedTargets: Array.from({ length: 11 }, (_, i) => ({ id: i })),
      };

      trace.captureActionData('over_limit_stage', 'movement:go', overLimitData);

      const overLimitCaptured =
        trace.getActionTrace('movement:go').stages.over_limit_stage.data;
      expect(overLimitCaptured.resolvedTargets).toHaveLength(10);
      expect(overLimitCaptured.resolvedTargets[9]).toEqual({
        truncated: true,
        originalLength: 11,
        showing: 9,
      });

      // Test non-array input
      const nonArrayData = {
        resolvedTargets: 'not an array',
      };

      trace.captureActionData('non_array_stage', 'movement:go', nonArrayData);

      const nonArrayCaptured =
        trace.getActionTrace('movement:go').stages.non_array_stage.data;
      expect(nonArrayCaptured.resolvedTargets).toBe('not an array');
    });

    it('should handle standard verbosity target filtering edge cases', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
        includeTargets: true,
      });

      // Test targetKeys specifically (line 762)
      const targetKeysData = {
        targetKeys: ['key1', 'key2', 'key3'],
        targetCount: 3,
        passed: true,
      };

      trace.captureActionData(
        'target_keys_stage',
        'movement:go',
        targetKeysData
      );

      const capturedData =
        trace.getActionTrace('movement:go').stages.target_keys_stage.data;
      expect(capturedData.targetKeys).toEqual(['key1', 'key2', 'key3']);
      expect(capturedData.targetCount).toBe(3);
      expect(capturedData.passed).toBe(true);

      // Test with no targetKeys but with targetCount (line 759)
      const targetCountOnlyData = {
        targetCount: 5,
        passed: true,
      };

      trace.captureActionData(
        'target_count_stage',
        'movement:go',
        targetCountOnlyData
      );

      const targetCountCaptured =
        trace.getActionTrace('movement:go').stages.target_count_stage.data;
      expect(targetCountCaptured.targetCount).toBe(5);
      expect(targetCountCaptured.targetKeys).toBeUndefined();
    });
  });

  describe('Data Management', () => {
    it('should provide accurate tracing summary', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go', 'core:look'],
        verbosity: 'standard',
      });

      // Add data for multiple actions and stages
      trace.captureActionData('stage1', 'movement:go', { data: 'test1' });
      trace.captureActionData('stage2', 'movement:go', { data: 'test2' });
      trace.captureActionData('stage1', 'core:look', { data: 'test3' });

      const summary = trace.getTracingSummary();
      expect(summary.tracedActionCount).toBe(2);
      expect(summary.totalStagesTracked).toBe(3);
      expect(summary.averageStagesPerAction).toBe(1.5);
      expect(summary.sessionDuration).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty summary correctly', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      const summary = trace.getTracingSummary();
      expect(summary.tracedActionCount).toBe(0);
      expect(summary.totalStagesTracked).toBe(0);
      expect(summary.sessionDuration).toBe(0);
      expect(summary.averageStagesPerAction).toBe(0);
    });

    it('should return isolated copies of traced data', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      trace.captureActionData('test_stage', 'movement:go', {
        original: 'data',
      });

      const tracedActions1 = trace.getTracedActions();
      const tracedActions2 = trace.getTracedActions();

      // Should be different Map instances
      expect(tracedActions1).not.toBe(tracedActions2);

      // But contain the same data
      expect(tracedActions1.get('movement:go')).toEqual(
        tracedActions2.get('movement:go')
      );

      // Modifying one shouldn't affect the other
      tracedActions1.set('core:new', { test: 'data' });
      expect(tracedActions2.has('core:new')).toBe(false);
    });

    it('should handle large data sets without memory issues', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:*', 'core:*'],
        verbosity: 'verbose',
      });

      // Test with moderately large data
      const largeData = {
        largeArray: new Array(100).fill({ data: 'item' }),
        complexObject: {
          level1: {
            level2: {
              level3: new Array(50).fill('nested data'),
            },
          },
        },
        manyProperties: {},
      };

      // Add many properties
      for (let i = 0; i < 100; i++) {
        largeData.manyProperties[`prop${i}`] = `value${i}`;
      }

      expect(() => {
        trace.captureActionData('test_stage', 'movement:go', largeData);
      }).not.toThrow();

      const capturedData =
        trace.getActionTrace('movement:go').stages.test_stage.data;
      expect(capturedData).toBeDefined();
      expect(capturedData.largeArray).toBeDefined();
      expect(capturedData.complexObject).toBeDefined();
    });

    it('should clear all traced action data', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:*', 'core:*'],
        verbosity: 'standard',
      });

      // Add some data
      trace.captureActionData('stage1', 'movement:go', { data: '1' });
      trace.captureActionData('stage1', 'core:look', { data: '2' });

      expect(trace.getTracingSummary().tracedActionCount).toBe(2);

      // Clear data
      trace.clearActionData();

      expect(trace.getTracingSummary().tracedActionCount).toBe(0);
      expect(trace.getActionTrace('movement:go')).toBeNull();
      expect(trace.getActionTrace('core:look')).toBeNull();
    });

    it('should provide access to action trace filter', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'detailed',
      });

      const filter = trace.getActionTraceFilter();
      expect(filter).toBeDefined();
      expect(filter.getVerbosityLevel()).toBe('detailed');
      expect(filter.shouldTrace('movement:go')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle data serialization errors gracefully', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'verbose',
      });

      // Create data that might cause serialization issues
      const problematicData = {
        normal: 'data',
        fn: function () {
          return 'test';
        }, // Functions don't serialize
        symbol: Symbol('test'), // Symbols don't serialize
        undefined: undefined, // Undefined values
      };

      expect(() => {
        trace.captureActionData('test_stage', 'movement:go', problematicData);
      }).not.toThrow();

      const capturedData =
        trace.getActionTrace('movement:go').stages.test_stage.data;
      expect(capturedData).toBeDefined();
      expect(capturedData.normal).toBe('data');
      // Function, symbol, and undefined should be handled by JSON.stringify
    });

    it('should handle filter errors during data capture', async () => {
      const mockFilter = testBed.createMockActionTraceFilter({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      // Make getVerbosityLevel throw an error
      mockFilter.getVerbosityLevel.mockImplementation(() => {
        throw new Error('Filter error');
      });

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });

      expect(() => {
        trace.captureActionData('test_stage', 'movement:go', { test: 'data' });
      }).not.toThrow();

      // Should have logged the error
      expect(testBed.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error capturing action data'),
        expect.any(Error)
      );
    });

    it('should continue working after capture errors', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      // Try to capture with invalid data - should not throw but should log error
      trace.captureActionData('test_stage', 'movement:go', null);

      // Should still work with valid data after the error
      trace.captureActionData('valid_stage', 'movement:go', { valid: 'data' });

      const actionTrace = trace.getActionTrace('movement:go');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages.valid_stage).toBeDefined();

      // Check that the valid data was captured correctly in standard verbosity
      const validStageData = actionTrace.stages.valid_stage.data;
      expect(validStageData.timestamp).toBeDefined();
      expect(validStageData.stage).toBe('valid_stage');

      // The 'valid' field should not be captured in standard verbosity unless it matches
      // a standard field pattern - let's check what was actually captured
      expect(Object.keys(validStageData)).toContain('timestamp');
      expect(Object.keys(validStageData)).toContain('stage');
    });

    it('should handle filtering errors gracefully', async () => {
      const mockFilter = testBed.createMockActionTraceFilter({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      // Make getInclusionConfig throw an error
      mockFilter.getInclusionConfig.mockImplementation(() => {
        throw new Error('Config access error');
      });

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });

      trace.captureActionData('test_stage', 'movement:go', { test: 'data' });

      // Should have logged the error from captureActionData, not the filtering error
      expect(testBed.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error capturing action data'),
        expect.any(Error)
      );

      // The action trace might not exist if error occurred early in capture
      const actionTrace = trace.getActionTrace('movement:go');
      if (actionTrace && actionTrace.stages.test_stage) {
        expect(actionTrace.stages.test_stage.data.error).toBe(
          'Data filtering failed'
        );
      }
    });

    it('should handle safe data copy fallback when JSON serialization fails', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'verbose',
      });

      // Create data that will cause JSON.stringify to throw
      const problematicData = {};
      Object.defineProperty(problematicData, 'badProperty', {
        get() {
          throw new Error('Property access error');
        },
        enumerable: true,
      });

      trace.captureActionData('test_stage', 'movement:go', problematicData);

      const actionTrace = trace.getActionTrace('movement:go');
      const capturedData = actionTrace.stages.test_stage.data;

      // Should have used fallback due to serialization error
      expect(capturedData.dataError).toBe('Failed to serialize data safely');
      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        'Failed to create safe data copy, using fallback',
        expect.any(Error)
      );
    });
  });

  describe('Integration with StructuredTrace', () => {
    it('should maintain all StructuredTrace functionality', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
      });

      // Test TraceContext methods
      trace.info('Test info', 'test-source');
      trace.step('Test step', 'test-source');
      trace.success('Test success', 'test-source');
      trace.failure('Test failure', 'test-source');
      trace.error('Test error', 'test-source');

      expect(trace.logs).toBeDefined();
      expect(trace.logs.length).toBe(5);

      // Test span methods
      const span = trace.startSpan('test-operation');
      expect(span).toBeDefined();

      span.setAttributes({ test: 'attribute' });
      trace.endSpan(span);

      const performance = trace.getPerformanceSummary();
      expect(performance).toBeDefined();
      expect(performance.operationCount).toBe(1);
    });

    it('should work with span-based tracing alongside action tracing', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      // Use both span and action tracing
      const span = trace.startSpan('action-processing');
      const hasActiveSpan = !!trace.getActiveSpan();
      trace.captureActionData('component_filtering', 'movement:go', {
        passed: true,
        spanActive: hasActiveSpan,
      });
      trace.endSpan(span);

      // Both should work
      const actionTrace = trace.getActionTrace('movement:go');
      expect(actionTrace).toBeTruthy();
      expect(actionTrace.stages.component_filtering).toBeDefined();
      expect(actionTrace.stages.component_filtering.data.passed).toBe(true);

      const performance = trace.getPerformanceSummary();
      expect(performance.operationCount).toBe(1);
    });
  });

  describe('Property Getters', () => {
    it('should provide actorId getter for compatibility', async () => {
      const trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor-123',
        tracedActions: ['movement:go'],
      });

      // Test the getter (lines 346-348)
      expect(trace.actorId).toBe('test-actor-123');
      expect(trace.getActorId()).toBe('test-actor-123');
    });

    it('should provide actionId getter for single action traces', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
      });

      // Before any actions are traced (lines 357-367)
      expect(trace.actionId).toBe('discovery');

      // After tracing a single action
      trace.captureActionData('test_stage', 'movement:go', { data: 'test' });
      expect(trace.actionId).toBe('movement:go');
    });

    it('should return discovery for multi-action traces', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:*', 'core:*'],
      });

      // Trace multiple actions
      trace.captureActionData('stage1', 'movement:go', { data: 'test1' });
      trace.captureActionData('stage1', 'core:look', { data: 'test2' });

      // Should return 'discovery' for multi-action traces (line 364)
      expect(trace.actionId).toBe('discovery');
    });
  });

  describe('Operator Evaluation Capture', () => {
    it('should capture operator evaluation data', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['_current_scope_evaluation'],
        verbosity: 'standard',
      });

      // Test captureOperatorEvaluation (lines 380-441)
      const operatorData = {
        operator: 'isSocketCovered',
        entityId: 'entity-123',
        result: true,
        reason: 'Socket is covered',
        details: { coveringEntity: 'entity-456' },
      };

      trace.captureOperatorEvaluation(operatorData);

      const scopeTrace = trace.getActionTrace('_current_scope_evaluation');
      expect(scopeTrace).toBeDefined();
      expect(scopeTrace.stages.operator_evaluations).toBeDefined();

      const evaluations =
        scopeTrace.stages.operator_evaluations.data.evaluations;
      expect(evaluations).toHaveLength(1);
      expect(evaluations[0].operator).toBe('isSocketCovered');
      expect(evaluations[0].entityId).toBe('entity-123');
      expect(evaluations[0].result).toBe(true);
      expect(evaluations[0].reason).toBe('Socket is covered');
      expect(evaluations[0].details).toEqual({ coveringEntity: 'entity-456' });
    });

    it('should handle multiple operator evaluations', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['_current_scope_evaluation'],
      });

      // Capture multiple evaluations
      trace.captureOperatorEvaluation({
        operator: 'isValidTarget',
        entityId: 'entity-1',
        result: true,
      });

      trace.captureOperatorEvaluation({
        operator: 'hasPermission',
        entityId: 'entity-2',
        result: false,
        reason: 'No permission granted',
      });

      const scopeTrace = trace.getActionTrace('_current_scope_evaluation');
      const evaluations =
        scopeTrace.stages.operator_evaluations.data.evaluations;
      expect(evaluations).toHaveLength(2);
      expect(evaluations[0].operator).toBe('isValidTarget');
      expect(evaluations[1].operator).toBe('hasPermission');
    });

    it('should handle operator evaluation errors gracefully', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['_current_scope_evaluation'],
      });

      // Should not throw on error (lines 435-440)
      expect(() => {
        trace.captureOperatorEvaluation(null);
      }).not.toThrow();

      expect(testBed.mockLogger.error).toHaveBeenCalledWith(
        'ActionAwareStructuredTrace: Error capturing operator evaluation',
        expect.any(Error)
      );
    });
  });

  describe('Enhanced Scope Evaluation', () => {
    it('should capture enhanced scope evaluation data', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      // Test captureEnhancedScopeEvaluation (lines 668-711)
      const traceLogs = [
        {
          source: 'ScopeEngine.entityDiscovery',
          data: {
            componentId: 'core:position',
            totalEntities: 10,
            foundEntities: 5,
            entityDetails: ['entity1', 'entity2'],
            resultIds: ['id1', 'id2'],
          },
        },
        {
          source: 'ScopeEngine.filterEvaluation',
          data: {
            itemId: 'item-123',
            filterPassed: true,
            evaluationResult: 'passed',
            hasPositionComponent: true,
            hasAllowsSittingComponent: true,
            actorLocationId: 'loc-1',
            entityLocationId: 'loc-1',
            allowsSittingSpots: 3,
            locationMismatch: false,
            spotAvailability: 'available',
            filterAnalysis: 'all checks passed',
          },
        },
      ];

      trace.captureEnhancedScopeEvaluation(
        'movement:go',
        'actor.furniture',
        traceLogs
      );

      const actionTrace = trace.getActionTrace('movement:go');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages.enhanced_scope_evaluation).toBeDefined();

      const enhancedData = actionTrace.stages.enhanced_scope_evaluation.data;
      expect(enhancedData).toBeDefined();
      // Based on the implementation, check the actual structure of the captured data
      expect(enhancedData.timestamp).toBeDefined();
      expect(enhancedData.entityDiscovery).toBeDefined();
      expect(enhancedData.entityDiscovery).toHaveLength(1);
      expect(enhancedData.entityDiscovery[0].componentId).toBe('core:position');
      expect(enhancedData.entityDiscovery[0].totalEntities).toBe(10);
      expect(enhancedData.filterEvaluations).toBeDefined();
      expect(enhancedData.filterEvaluations).toHaveLength(1);
      expect(enhancedData.filterEvaluations[0].itemId).toBe('item-123');
      expect(enhancedData.filterEvaluations[0].filterPassed).toBe(true);
    });

    it('should handle empty trace logs', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
      });

      // Should handle empty or null trace logs
      trace.captureEnhancedScopeEvaluation('movement:go', 'test.scope', []);

      const actionTrace = trace.getActionTrace('movement:go');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages.enhanced_scope_evaluation).toBeDefined();
      expect(
        actionTrace.stages.enhanced_scope_evaluation.data.entityDiscovery
      ).toEqual([]);
      expect(
        actionTrace.stages.enhanced_scope_evaluation.data.filterEvaluations
      ).toEqual([]);
    });

    it('should not capture if action is not traced', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:look'], // Different action
      });

      trace.captureEnhancedScopeEvaluation('movement:go', 'test.scope', []);

      expect(trace.getActionTrace('movement:go')).toBeNull();
    });
  });

  describe('Enhanced Action Data Capture', () => {
    it('should capture enhanced action data with options', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'detailed',
      });

      // Test captureEnhancedActionData (lines 1093-1175)
      const data = {
        field1: 'value1',
        field2: 'value2',
        performance: { metric: 100 },
      };

      trace.captureEnhancedActionData('test_stage', 'movement:go', data, {
        category: 'performance',
        summarize: false,
      });

      const actionTrace = trace.getActionTrace('movement:go');
      expect(actionTrace.stages.test_stage).toBeDefined();

      const capturedData = actionTrace.stages.test_stage.data;
      expect(capturedData._enhanced).toBeDefined();
      expect(capturedData._enhanced.category).toBe('performance');
      expect(capturedData._enhanced.verbosityLevel).toBe('detailed');
    });

    it('should handle enhanced filter not available', async () => {
      const mockFilter = testBed.createMockActionTraceFilter({
        tracedActions: ['movement:go'],
      });

      // Don't add shouldCaptureEnhanced method to test fallback (line 1117)
      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });

      trace.captureEnhancedActionData('test_stage', 'movement:go', {
        test: 'data',
      });

      // Should fall back to regular shouldTrace
      expect(mockFilter.shouldTrace).toHaveBeenCalledWith('movement:go');
    });

    it('should apply data summarization when requested', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'minimal',
      });

      const data = {
        important: 'keep',
        performance: { metric: 100 },
        timing: { duration: 50 },
        largeArray: Array(10).fill('item'),
        diagnostic: 'remove',
        debug: 'remove',
        internal: 'remove',
      };

      trace.captureEnhancedActionData('test_stage', 'movement:go', data, {
        summarize: true,
        targetVerbosity: 'minimal',
      });

      const actionTrace = trace.getActionTrace('movement:go');
      const capturedData = actionTrace.stages.test_stage.data;

      // Should remove performance, diagnostic, debug based on minimal verbosity
      expect(capturedData.important).toBe('keep');
      expect(capturedData.performance).toBeUndefined();
      expect(capturedData.diagnostic).toBeUndefined();
      expect(capturedData.debug).toBeUndefined();
      expect(capturedData.largeArray).toHaveLength(3); // Truncated
      expect(capturedData.largeArray_truncated).toBe(true);
    });
  });

  describe('Filtered Trace Export', () => {
    it('should export filtered trace data by verbosity', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:*', 'core:*'],
        verbosity: 'verbose',
      });

      // Add various data with different verbosity levels
      trace.captureActionData('stage1', 'movement:go', { data: 'test1' });
      trace.captureEnhancedActionData(
        'stage2',
        'movement:go',
        { data: 'test2' },
        {
          category: 'performance',
        }
      );

      // Test exportFilteredTraceData (lines 1280-1319)
      const exported = trace.exportFilteredTraceData('standard');

      expect(exported).toBeDefined();
      expect(exported['movement:go']).toBeDefined();
      expect(exported['movement:go'].stages).toBeDefined();
    });

    it('should filter by categories', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
      });

      // Add data with different categories - need to explicitly set verbosity to see all data
      trace.captureActionData('component_filtering', 'movement:go', {
        data: 'business',
      });
      trace.captureActionData('timing_data', 'movement:go', { data: 'perf' });
      trace.captureActionData('error_details', 'movement:go', { data: 'diag' });

      // Export only specific categories (line 1290, 1329-1354)
      const exported = trace.exportFilteredTraceData('verbose', [
        'business_logic',
        'performance',
        'diagnostic',
      ]);

      expect(exported['movement:go']).toBeDefined();
      expect(exported['movement:go'].stages).toBeDefined();
      const stages = exported['movement:go'].stages;
      // All stages should be included since we're including all the categories
      expect(stages.component_filtering).toBeDefined();
      expect(stages.timing_data).toBeDefined();
      expect(stages.error_details).toBeDefined();
    });

    it('should skip data above target verbosity', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
      });

      // Add enhanced data with verbosity level
      trace.captureEnhancedActionData(
        'stage1',
        'movement:go',
        { data: 'test' },
        {
          category: 'core',
        }
      );

      const mockEnhancedData = {
        data: 'test',
        _enhanced: { verbosityLevel: 'verbose' },
      };

      // Manually set enhanced data to test verbosity filtering (line 1300)
      const actionTrace = trace.getActionTrace('movement:go');
      actionTrace.stages.stage2 = {
        timestamp: Date.now(),
        data: mockEnhancedData,
        stageCompletedAt: Date.now(),
      };

      const exported = trace.exportFilteredTraceData('minimal');

      // Should skip verbose data when exporting at minimal level
      expect(exported['movement:go'].stages.stage2).toBeUndefined();
    });

    it('should omit stages outside the requested categories', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      trace.captureActionData('component_filtering', 'movement:go', {
        detail: 'business',
      });
      trace.captureActionData('timing_data', 'movement:go', { detail: 'perf' });

      const exported = trace.exportFilteredTraceData('verbose', [
        'performance',
      ]);
      const stages = exported['movement:go'].stages;

      expect(stages.timing_data).toBeDefined();
      expect(stages.component_filtering).toBeUndefined();
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize trace data to JSON format', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:*', 'core:*'],
        actorId: 'actor-123',
      });

      // Add test data
      trace.captureActionData('stage1', 'movement:go', { data: 'test1' });
      trace.captureActionData('stage2', 'movement:go', { data: 'test2' });
      trace.captureActionData('stage1', 'core:look', { data: 'test3' });

      // Test toJSON method (lines 1398-1422)
      const json = trace.toJSON();

      expect(json.timestamp).toBeDefined();
      expect(json.traceType).toBe('action_aware_structured');
      expect(json.actorId).toBe('actor-123');
      expect(json.summary).toBeDefined();
      expect(json.summary.tracedActionCount).toBe(2);
      expect(json.actions).toBeDefined();
      expect(json.actions['movement:go']).toBeDefined();
      expect(json.actions['movement:go'].stageOrder).toEqual([
        'stage1',
        'stage2',
      ]);
      expect(json.actions['movement:go'].totalDuration).toBeGreaterThanOrEqual(
        0
      );
    });

    it('should calculate total duration correctly', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
      });

      // Add stages with time gaps to test duration calculation (lines 1432-1441)
      const now = Date.now();
      trace.captureActionData('stage1', 'movement:go', { data: 'test1' });

      // Manually update timestamp to simulate time passing
      const actionTrace = trace.getActionTrace('movement:go');
      actionTrace.stages.stage1.timestamp = now;

      // Add second stage with later timestamp
      setTimeout(() => {
        trace.captureActionData('stage2', 'movement:go', { data: 'test2' });
      }, 10);

      // Wait and then check
      await new Promise((resolve) => setTimeout(resolve, 20));

      const json = trace.toJSON();
      expect(json.actions['movement:go'].totalDuration).toBeGreaterThan(0);
    });

    it('should handle empty trace data in JSON serialization', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        actorId: 'test-actor',
      });

      // Don't add any data - test with empty trace
      const json = trace.toJSON();

      expect(json.timestamp).toBeDefined();
      expect(json.traceType).toBe('action_aware_structured');
      expect(json.actorId).toBe('test-actor');
      expect(json.summary.tracedActionCount).toBe(0);
      expect(json.actions).toEqual({});
    });

    it('should handle traces without stages in duration calculation', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
      });

      // Create action trace without stages to test edge case
      trace.captureActionData('test', 'movement:go', { test: 'data' });
      const actionTrace = trace.getActionTrace('movement:go');

      // Clear stages to simulate edge case
      actionTrace.stages = {};

      const json = trace.toJSON();
      expect(json.actions['movement:go'].totalDuration).toBe(0);
    });
  });

  describe('Error Handling in Verbosity Filtering', () => {
    it('should handle errors during verbosity filtering', async () => {
      const mockFilter = testBed.createMockActionTraceFilter({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      // Make getInclusionConfig throw to trigger the error path
      mockFilter.getInclusionConfig.mockImplementation(() => {
        throw new Error('Config access error');
      });

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });

      // This will trigger the error in #filterDataByVerbosity (lines 857-861)
      trace.captureActionData('test_stage', 'movement:go', { test: 'data' });

      // Should log error about capturing action data
      expect(testBed.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error capturing action data'),
        expect.any(Error)
      );
    });
  });
});
