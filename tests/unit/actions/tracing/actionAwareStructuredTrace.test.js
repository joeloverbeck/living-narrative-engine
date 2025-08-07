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
        tracedActions: ['core:go'],
        verbosity: 'standard',
      });

      const testData = {
        actorComponents: ['core:position'],
        requiredComponents: ['core:position'],
        passed: true,
      };

      trace.captureActionData('component_filtering', 'core:go', testData);

      const actionTrace = trace.getActionTrace('core:go');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.actionId).toBe('core:go');
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

      trace.captureActionData('component_filtering', 'core:go', {
        test: 'data',
      });

      expect(trace.getActionTrace('core:go')).toBeNull();
      expect(trace.getTracingSummary().tracedActionCount).toBe(0);
    });

    it('should handle multiple stages for same action', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
        verbosity: 'standard',
      });

      trace.captureActionData('component_filtering', 'core:go', {
        stage1: 'data',
      });
      trace.captureActionData('prerequisite_evaluation', 'core:go', {
        stage2: 'data',
      });
      trace.captureActionData('target_resolution', 'core:go', {
        stage3: 'data',
      });

      const actionTrace = trace.getActionTrace('core:go');
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
        tracedActions: ['core:*'],
        verbosity: 'standard',
      });

      trace.captureActionData('component_filtering', 'core:go', {
        action: 'go',
      });
      trace.captureActionData('component_filtering', 'core:look', {
        action: 'look',
      });

      expect(trace.isActionTraced('core:go')).toBe(true);
      expect(trace.isActionTraced('core:look')).toBe(true);
      expect(trace.getTracingSummary().tracedActionCount).toBe(2);
    });

    it('should validate parameters and handle errors gracefully', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
        verbosity: 'standard',
      });

      // Should not throw even with invalid data - just log error
      expect(() => {
        trace.captureActionData('', 'core:go', { test: 'data' });
      }).not.toThrow();

      expect(() => {
        trace.captureActionData('test_stage', '', { test: 'data' });
      }).not.toThrow();

      expect(() => {
        trace.captureActionData('test_stage', 'core:go', null);
      }).not.toThrow();

      // Should have logged errors but not captured invalid data
      expect(trace.getActionTrace('core:go')).toBeNull();
    });
  });

  describe('Verbosity Filtering', () => {
    it('should apply minimal verbosity filtering correctly', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
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

      trace.captureActionData('component_filtering', 'core:go', fullData);

      const capturedData =
        trace.getActionTrace('core:go').stages.component_filtering.data;

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
        tracedActions: ['core:go'],
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

      trace.captureActionData('component_filtering', 'core:go', fullData);

      const capturedData =
        trace.getActionTrace('core:go').stages.component_filtering.data;

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
        tracedActions: ['core:go'],
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

      trace.captureActionData('prerequisite_evaluation', 'core:go', fullData);

      const capturedData =
        trace.getActionTrace('core:go').stages.prerequisite_evaluation.data;

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
        tracedActions: ['core:go'],
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

      trace.captureActionData('test_stage', 'core:go', fullData);

      const capturedData =
        trace.getActionTrace('core:go').stages.test_stage.data;

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
        tracedActions: ['core:go'],
        verbosity: 'unknown_level',
      });

      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: mockFilter,
        actorId: 'test-actor',
        logger: testBed.mockLogger,
      });

      trace.captureActionData('test_stage', 'core:go', { test: 'data' });

      // Should fallback to standard verbosity and log warning
      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown verbosity level: unknown_level')
      );
    });

    it('should handle circular references safely', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
        verbosity: 'verbose',
      });

      const circularData = { name: 'test' };
      circularData.self = circularData; // Create circular reference

      expect(() => {
        trace.captureActionData('test_stage', 'core:go', circularData);
      }).not.toThrow();

      const capturedData =
        trace.getActionTrace('core:go').stages.test_stage.data;
      expect(capturedData).toBeDefined();
      expect(capturedData.name).toBe('test');
      expect(capturedData.self).toBe('[Circular Reference]');
    });

    it('should handle very long strings by truncating', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
        verbosity: 'verbose',
      });

      const longString = 'A'.repeat(1500); // > 1000 characters
      const testData = {
        longText: longString,
        shortText: 'normal',
      };

      trace.captureActionData('test_stage', 'core:go', testData);

      const capturedData =
        trace.getActionTrace('core:go').stages.test_stage.data;
      expect(capturedData.shortText).toBe('normal');
      expect(capturedData.longText).toBe('A'.repeat(1000) + '... [truncated]');
    });
  });

  describe('Data Management', () => {
    it('should provide accurate tracing summary', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:go', 'core:look'],
        verbosity: 'standard',
      });

      // Add data for multiple actions and stages
      trace.captureActionData('stage1', 'core:go', { data: 'test1' });
      trace.captureActionData('stage2', 'core:go', { data: 'test2' });
      trace.captureActionData('stage1', 'core:look', { data: 'test3' });

      const summary = trace.getTracingSummary();
      expect(summary.tracedActionCount).toBe(2);
      expect(summary.totalStagesTracked).toBe(3);
      expect(summary.averageStagesPerAction).toBe(1.5);
      expect(summary.sessionDuration).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty summary correctly', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
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
        tracedActions: ['core:go'],
        verbosity: 'standard',
      });

      trace.captureActionData('test_stage', 'core:go', { original: 'data' });

      const tracedActions1 = trace.getTracedActions();
      const tracedActions2 = trace.getTracedActions();

      // Should be different Map instances
      expect(tracedActions1).not.toBe(tracedActions2);

      // But contain the same data
      expect(tracedActions1.get('core:go')).toEqual(
        tracedActions2.get('core:go')
      );

      // Modifying one shouldn't affect the other
      tracedActions1.set('core:new', { test: 'data' });
      expect(tracedActions2.has('core:new')).toBe(false);
    });

    it('should handle large data sets without memory issues', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:*'],
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
        trace.captureActionData('test_stage', 'core:go', largeData);
      }).not.toThrow();

      const capturedData =
        trace.getActionTrace('core:go').stages.test_stage.data;
      expect(capturedData).toBeDefined();
      expect(capturedData.largeArray).toBeDefined();
      expect(capturedData.complexObject).toBeDefined();
    });

    it('should clear all traced action data', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:*'],
        verbosity: 'standard',
      });

      // Add some data
      trace.captureActionData('stage1', 'core:go', { data: '1' });
      trace.captureActionData('stage1', 'core:look', { data: '2' });

      expect(trace.getTracingSummary().tracedActionCount).toBe(2);

      // Clear data
      trace.clearActionData();

      expect(trace.getTracingSummary().tracedActionCount).toBe(0);
      expect(trace.getActionTrace('core:go')).toBeNull();
      expect(trace.getActionTrace('core:look')).toBeNull();
    });

    it('should provide access to action trace filter', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
        verbosity: 'detailed',
      });

      const filter = trace.getActionTraceFilter();
      expect(filter).toBeDefined();
      expect(filter.getVerbosityLevel()).toBe('detailed');
      expect(filter.shouldTrace('core:go')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle data serialization errors gracefully', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
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
        trace.captureActionData('test_stage', 'core:go', problematicData);
      }).not.toThrow();

      const capturedData =
        trace.getActionTrace('core:go').stages.test_stage.data;
      expect(capturedData).toBeDefined();
      expect(capturedData.normal).toBe('data');
      // Function, symbol, and undefined should be handled by JSON.stringify
    });

    it('should handle filter errors during data capture', async () => {
      const mockFilter = testBed.createMockActionTraceFilter({
        tracedActions: ['core:go'],
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
        trace.captureActionData('test_stage', 'core:go', { test: 'data' });
      }).not.toThrow();

      // Should have logged the error
      expect(testBed.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error capturing action data'),
        expect.any(Error)
      );
    });

    it('should continue working after capture errors', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
        verbosity: 'standard',
      });

      // Try to capture with invalid data - should not throw but should log error
      trace.captureActionData('test_stage', 'core:go', null);

      // Should still work with valid data after the error
      trace.captureActionData('valid_stage', 'core:go', { valid: 'data' });

      const actionTrace = trace.getActionTrace('core:go');
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
  });

  describe('Integration with StructuredTrace', () => {
    it('should maintain all StructuredTrace functionality', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
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
        tracedActions: ['core:go'],
        verbosity: 'standard',
      });

      // Use both span and action tracing
      const span = trace.startSpan('action-processing');
      const hasActiveSpan = !!trace.getActiveSpan();
      trace.captureActionData('component_filtering', 'core:go', {
        passed: true,
        spanActive: hasActiveSpan,
      });
      trace.endSpan(span);

      // Both should work
      const actionTrace = trace.getActionTrace('core:go');
      expect(actionTrace).toBeTruthy();
      expect(actionTrace.stages.component_filtering).toBeDefined();
      expect(actionTrace.stages.component_filtering.data.passed).toBe(true);

      const performance = trace.getPerformanceSummary();
      expect(performance.operationCount).toBe(1);
    });
  });
});
