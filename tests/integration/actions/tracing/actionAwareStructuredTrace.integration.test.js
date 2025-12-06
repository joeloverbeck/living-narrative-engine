import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import { createTestBed } from '../../../common/testBed.js';

describe('ActionAwareStructuredTrace - Integration Tests', () => {
  let testBed;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Integration with StructuredTrace System', () => {
    it('should integrate seamlessly with existing StructuredTrace system', async () => {
      // Create a regular StructuredTrace
      const baseTrace = new StructuredTrace();

      // Create ActionTraceFilter
      const actionFilter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['movement:go'],
        verbosityLevel: 'standard',
        logger: mockLogger,
      });

      // Create ActionAwareStructuredTrace that extends the base functionality
      const actionTrace = new ActionAwareStructuredTrace({
        actionTraceFilter: actionFilter,
        actorId: 'test-actor',
        context: { integration: 'test' },
        logger: mockLogger,
        traceContext: baseTrace.logs ? null : new TraceContext(), // Use base trace context if available
        traceConfig: null,
      });

      // Test that it maintains all StructuredTrace functionality
      expect(typeof actionTrace.info).toBe('function');
      expect(typeof actionTrace.step).toBe('function');
      expect(typeof actionTrace.startSpan).toBe('function');
      expect(typeof actionTrace.getPerformanceSummary).toBe('function');

      // Test that it adds action-aware functionality
      expect(typeof actionTrace.captureActionData).toBe('function');
      expect(typeof actionTrace.getTracedActions).toBe('function');
      expect(typeof actionTrace.getActionTrace).toBe('function');

      // Test that both systems work together
      actionTrace.step('Starting action processing', 'integration-test');

      const span = actionTrace.startSpan('action-evaluation');
      actionTrace.captureActionData('component_filtering', 'movement:go', {
        actorComponents: ['core:position'],
        passed: true,
      });
      actionTrace.endSpan(span);

      actionTrace.success('Action processing completed', 'integration-test');

      // Verify both tracing systems captured data
      expect(actionTrace.logs.length).toBe(2); // step and success
      expect(actionTrace.getActionTrace('movement:go')).toBeTruthy();
      expect(actionTrace.getPerformanceSummary().operationCount).toBe(1);
    });

    it('should work with TraceContext factory patterns', () => {
      const traceContextFactory = () => new TraceContext();

      const actionFilter = new ActionTraceFilter({
        tracedActions: ['core:*'],
        verbosityLevel: 'detailed',
        logger: mockLogger,
      });

      // Simulate factory creating enhanced trace
      const createEnhancedTrace = (options = {}) => {
        const baseTrace = traceContextFactory();

        if (options.enableActionTracing && options.actorId) {
          return new ActionAwareStructuredTrace({
            actionTraceFilter: actionFilter,
            actorId: options.actorId,
            context: options.context || {},
            logger: mockLogger,
            traceContext: baseTrace,
          });
        }

        return new StructuredTrace(baseTrace);
      };

      // Test factory with action tracing disabled
      const regularTrace = createEnhancedTrace();
      expect(regularTrace).toBeInstanceOf(StructuredTrace);
      expect(regularTrace.captureActionData).toBeUndefined();

      // Test factory with action tracing enabled
      const actionTrace = createEnhancedTrace({
        enableActionTracing: true,
        actorId: 'factory-actor',
        context: { source: 'factory' },
      });
      expect(actionTrace).toBeInstanceOf(ActionAwareStructuredTrace);
      expect(typeof actionTrace.captureActionData).toBe('function');
      expect(actionTrace.getActorId()).toBe('factory-actor');
    });

    it('should maintain backward compatibility with existing trace consumers', async () => {
      const actionTrace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      // Simulate how existing code might use traces
      const simulateExistingTraceUsage = (trace) => {
        // Common existing patterns
        trace.info('Processing started', 'simulation');
        trace.step('Evaluating conditions', 'simulation');

        const span = trace.startSpan('complex-operation');
        span.setAttributes({ complexity: 'high' });

        // Simulate some processing time
        setTimeout(() => span.setStatus('success'), 1);
        trace.endSpan(span);

        trace.success('Processing completed', 'simulation');

        return {
          logCount: trace.logs.length,
          hasSpans: trace.getSpans().length > 0,
          performance: trace.getPerformanceSummary(),
        };
      };

      const result = simulateExistingTraceUsage(actionTrace);

      expect(result.logCount).toBe(3);
      expect(result.hasSpans).toBe(true);
      expect(result.performance).toBeDefined();
      expect(result.performance.operationCount).toBe(1);

      // Verify action tracing still works
      actionTrace.captureActionData('simulation_stage', 'movement:go', {
        test: true,
      });
      expect(actionTrace.isActionTraced('movement:go')).toBe(true);
    });
  });

  describe('End-to-End Action Pipeline Integration', () => {
    it('should work in simulated action discovery pipeline', async () => {
      const actionTrace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go', 'core:look'],
        verbosity: 'detailed',
        includeComponentData: true,
        includePrerequisites: true,
      });

      // Simulate action discovery pipeline stages
      const simulateActionPipeline = async (trace, actionId) => {
        trace.step(`Starting discovery for ${actionId}`, 'pipeline');

        const discoverySpan = trace.startSpan('action-discovery');

        // Stage 1: Component Filtering
        trace.captureActionData('component_filtering', actionId, {
          actorComponents: ['core:position', 'core:movement', 'core:inventory'],
          requiredComponents: ['core:position'],
          passed: true,
          timestamp: Date.now(),
        });

        // Stage 2: Prerequisite Evaluation
        trace.captureActionData('prerequisite_evaluation', actionId, {
          prerequisites: [
            { type: 'component', component: 'core:position', passed: true },
            { type: 'condition', condition: 'canMove', passed: true },
          ],
          allPassed: true,
          evaluationTime: 2.5,
        });

        // Stage 3: Target Resolution
        trace.captureActionData('target_resolution', actionId, {
          targetCount: 3,
          resolvedTargets: [
            { id: 'target1', type: 'entity' },
            { id: 'target2', type: 'location' },
          ],
          resolutionSuccess: true,
        });

        // Stage 4: Command Formatting
        trace.captureActionData('command_formatting', actionId, {
          template: 'go {{direction}}',
          formattedCommand: 'go north',
          formatSuccess: true,
        });

        discoverySpan.setStatus('success');
        trace.endSpan(discoverySpan);
        trace.success(`Discovery completed for ${actionId}`, 'pipeline');

        return {
          actionId,
          success: true,
          stages: [
            'component_filtering',
            'prerequisite_evaluation',
            'target_resolution',
            'command_formatting',
          ],
        };
      };

      // Run pipeline for multiple actions
      const goResult = await simulateActionPipeline(actionTrace, 'movement:go');
      const lookResult = await simulateActionPipeline(actionTrace, 'core:look');

      // Verify pipeline results
      expect(goResult.success).toBe(true);
      expect(lookResult.success).toBe(true);

      // Verify action tracing captured all stages
      const goTrace = actionTrace.getActionTrace('movement:go');
      const lookTrace = actionTrace.getActionTrace('core:look');

      expect(goTrace).toBeTruthy();
      expect(lookTrace).toBeTruthy();

      expect(Object.keys(goTrace.stages)).toEqual([
        'component_filtering',
        'prerequisite_evaluation',
        'target_resolution',
        'command_formatting',
      ]);

      expect(Object.keys(lookTrace.stages)).toEqual([
        'component_filtering',
        'prerequisite_evaluation',
        'target_resolution',
        'command_formatting',
      ]);

      // Verify detailed verbosity captured prerequisite details
      expect(
        goTrace.stages.prerequisite_evaluation.data.prerequisites
      ).toBeDefined();
      expect(
        goTrace.stages.prerequisite_evaluation.data.prerequisites.length
      ).toBe(2);

      // Verify summary data
      const summary = actionTrace.getTracingSummary();
      expect(summary.tracedActionCount).toBe(2);
      expect(summary.totalStagesTracked).toBe(8); // 4 stages × 2 actions
      expect(summary.averageStagesPerAction).toBe(4);

      // Verify span tracing also worked
      const performance = actionTrace.getPerformanceSummary();
      expect(performance.operationCount).toBe(2); // 2 action-discovery spans
    });

    it('should handle mixed traced and untraced actions in pipeline', async () => {
      const actionTrace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'], // Only trace 'go', not 'look' or 'wait'
        verbosity: 'standard',
      });

      const processAction = (trace, actionId, shouldBeTraced) => {
        trace.captureActionData('component_filtering', actionId, {
          passed: shouldBeTraced ? true : false,
          actionId,
        });

        return { actionId, processed: true };
      };

      // Process multiple actions
      processAction(actionTrace, 'movement:go', true);
      processAction(actionTrace, 'core:look', false);
      processAction(actionTrace, 'core:wait', false);

      // Only 'movement:go' should be traced
      expect(actionTrace.isActionTraced('movement:go')).toBe(true);
      expect(actionTrace.isActionTraced('core:look')).toBe(false);
      expect(actionTrace.isActionTraced('core:wait')).toBe(false);

      const summary = actionTrace.getTracingSummary();
      expect(summary.tracedActionCount).toBe(1);
      expect(summary.totalStagesTracked).toBe(1);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle high-volume action processing efficiently', async () => {
      const actionTrace = await testBed.createActionAwareTrace({
        tracedActions: ['*'], // Trace all actions
        verbosity: 'minimal', // Keep data size small
      });

      const startTime = performance.now();

      // Simulate high-volume processing
      for (let i = 0; i < 100; i++) {
        const actionId = `test:action${i % 10}`; // 10 different actions
        actionTrace.captureActionData('processing', actionId, {
          iteration: i,
          passed: i % 7 !== 0, // Fail every 7th iteration
          timestamp: Date.now(),
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should process 100 captures in reasonable time (< 100ms)
      expect(totalTime).toBeLessThan(100);

      // Should have consolidated data by unique action ID
      const summary = actionTrace.getTracingSummary();
      expect(summary.tracedActionCount).toBe(10); // 10 unique action IDs
      expect(summary.totalStagesTracked).toBe(10); // Each action has 1 stage

      // Memory should be reasonable
      const tracedActions = actionTrace.getTracedActions();
      expect(tracedActions.size).toBe(10);
    });

    it('should clean up properly when clearing data', async () => {
      const actionTrace = await testBed.createActionAwareTrace({
        tracedActions: ['*'],
        verbosity: 'verbose',
      });

      // Add significant data
      for (let i = 0; i < 50; i++) {
        actionTrace.captureActionData(`stage${i}`, 'test:action', {
          data: new Array(100).fill(`item${i}`),
          iteration: i,
        });
      }

      expect(actionTrace.getTracingSummary().totalStagesTracked).toBe(50);

      // Clear data
      actionTrace.clearActionData();

      // Should be completely clean
      expect(actionTrace.getTracingSummary().tracedActionCount).toBe(0);
      expect(actionTrace.getTracingSummary().totalStagesTracked).toBe(0);
      expect(actionTrace.getActionTrace('test:action')).toBeNull();
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should continue working after partial system failures', async () => {
      const actionFilter = new ActionTraceFilter({
        tracedActions: ['movement:go'],
        verbosityLevel: 'standard',
        logger: mockLogger,
      });

      const actionTrace = new ActionAwareStructuredTrace({
        actionTraceFilter: actionFilter,
        actorId: 'resilience-test-actor',
        logger: mockLogger,
      });

      // Normal operation
      actionTrace.captureActionData('stage1', 'movement:go', {
        normal: 'data',
      });
      expect(actionTrace.isActionTraced('movement:go')).toBe(true);

      // Introduce a problematic filter state
      actionFilter.getVerbosityLevel = jest.fn().mockImplementation(() => {
        throw new Error('Filter malfunction');
      });

      // Should handle the error gracefully
      actionTrace.captureActionData('stage2', 'movement:go', {
        after: 'error',
      });

      // Should have logged the error but continued working
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error capturing action data'),
        expect.any(Error)
      );

      // Fix the filter
      actionFilter.getVerbosityLevel = jest.fn().mockReturnValue('standard');

      // Should work normally again
      actionTrace.captureActionData('stage3', 'movement:go', {
        recovered: 'data',
      });

      const actionData = actionTrace.getActionTrace('movement:go');
      expect(actionData.stages.stage1).toBeDefined();
      expect(actionData.stages.stage3).toBeDefined();
    });

    it('should handle concurrent access patterns safely', async () => {
      const actionTrace = await testBed.createActionAwareTrace({
        tracedActions: ['*'],
        verbosity: 'standard',
      });

      // Simulate concurrent access
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          new Promise((resolve) => {
            setTimeout(() => {
              actionTrace.captureActionData(`stage${i}`, 'concurrent:action', {
                thread: i,
                timestamp: Date.now(),
              });
              resolve(i);
            }, Math.random() * 10);
          })
        );
      }

      await Promise.all(promises);

      // Should have captured all data safely
      const actionData = actionTrace.getActionTrace('concurrent:action');
      expect(actionData).toBeTruthy();
      expect(Object.keys(actionData.stages).length).toBe(20);
    });
  });

  describe('Configuration and Filtering Integration', () => {
    it('should support dynamic filter configuration changes', async () => {
      const actionFilter = new ActionTraceFilter({
        tracedActions: ['movement:go'],
        verbosityLevel: 'minimal',
        inclusionConfig: {
          componentData: false,
          prerequisites: false,
          targets: false,
        },
        logger: mockLogger,
      });

      const actionTrace = new ActionAwareStructuredTrace({
        actionTraceFilter: actionFilter,
        actorId: 'dynamic-config-actor',
        logger: mockLogger,
      });

      // Capture with minimal verbosity
      actionTrace.captureActionData('stage1', 'movement:go', {
        passed: true,
        actorComponents: ['core:position'],
        prerequisites: [{ test: 'data' }],
      });

      let capturedData =
        actionTrace.getActionTrace('movement:go').stages.stage1.data;
      expect(capturedData.passed).toBe(true);
      expect(capturedData.actorComponents).toBeUndefined();

      // Change to detailed verbosity with component data
      actionFilter.setVerbosityLevel('detailed');
      actionFilter.updateInclusionConfig({
        componentData: true,
        prerequisites: true,
      });

      // Capture with new settings
      actionTrace.captureActionData('stage2', 'movement:go', {
        passed: true,
        actorComponents: ['core:position'],
        prerequisites: [{ test: 'data' }],
      });

      capturedData =
        actionTrace.getActionTrace('movement:go').stages.stage2.data;
      expect(capturedData.passed).toBe(true);
      expect(capturedData.actorComponents).toEqual(['core:position']);
      expect(capturedData.prerequisites).toEqual([{ test: 'data' }]);
    });

    it('should respect action filtering patterns correctly', async () => {
      const actionFilter = new ActionTraceFilter({
        tracedActions: ['core:*', 'test:specific'], // Wildcard and specific
        excludedActions: ['core:debug'], // Exclude debug actions
        verbosityLevel: 'standard',
        logger: mockLogger,
      });

      const actionTrace = new ActionAwareStructuredTrace({
        actionTraceFilter: actionFilter,
        actorId: 'filtering-test-actor',
        logger: mockLogger,
      });

      // These should be traced
      actionTrace.captureActionData('test', 'core:look', { should: 'trace' });
      actionTrace.captureActionData('test', 'test:specific', {
        should: 'trace',
      });

      // These should not be traced
      actionTrace.captureActionData('test', 'movement:go', {
        should: 'not trace',
      });
      actionTrace.captureActionData('test', 'core:debug', {
        should: 'not trace',
      });
      actionTrace.captureActionData('test', 'other:action', {
        should: 'not trace',
      });

      expect(actionTrace.isActionTraced('core:look')).toBe(true);
      expect(actionTrace.isActionTraced('test:specific')).toBe(true);
      expect(actionTrace.isActionTraced('movement:go')).toBe(false);
      expect(actionTrace.isActionTraced('core:debug')).toBe(false);
      expect(actionTrace.isActionTraced('other:action')).toBe(false);

      const summary = actionTrace.getTracingSummary();
      expect(summary.tracedActionCount).toBe(2);
    });
  });
});
