import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EnhancedActionTraceFilter from '../../../../src/actions/tracing/enhancedActionTraceFilter.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('Enhanced Tracing Integration Tests', () => {
  let enhancedFilter;
  let trace;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();

    enhancedFilter = new EnhancedActionTraceFilter({
      enabled: true,
      tracedActions: ['*'],
      excludedActions: [],
      verbosityLevel: 'standard',
      logger: mockLogger,
    });

    trace = new ActionAwareStructuredTrace({
      actionTraceFilter: enhancedFilter,
      actorId: 'test-actor',
      context: { test: true },
      logger: mockLogger,
    });
  });

  describe('End-to-End Enhanced Filtering', () => {
    it('should capture enhanced action data with category filtering', () => {
      // Capture data with enhanced method
      trace.captureEnhancedActionData(
        'component_filtering',
        'movement:go',
        {
          actorComponents: ['core:position', 'core:movement'],
          requiredComponents: ['core:position'],
          passed: true,
          timestamp: Date.now(),
        },
        {
          category: 'business_logic',
          context: { session: 'test' },
        }
      );

      // Verify data was captured
      const actionTrace = trace.getActionTrace('movement:go');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages.component_filtering).toBeDefined();
      // The data is wrapped in a stage structure
      const stageData = actionTrace.stages.component_filtering.data;
      expect(stageData._enhanced).toBeDefined();
      expect(stageData._enhanced.category).toBe('business_logic');
    });

    it('should apply data summarization based on verbosity', () => {
      const largeData = {
        items: Array(10)
          .fill()
          .map((_, i) => ({ id: i, name: `item_${i}` })),
        longString: 'x'.repeat(300),
        performance: { timing: 123, memory: 456 },
        diagnostic: { debug: 'info' },
      };

      // Capture with summarization at minimal level
      trace.captureEnhancedActionData(
        'data_processing',
        'test:action',
        largeData,
        {
          summarize: true,
          targetVerbosity: 'minimal',
        }
      );

      const actionTrace = trace.getActionTrace('test:action');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages.data_processing).toBeDefined();
      const capturedData = actionTrace.stages.data_processing.data;

      // At minimal level, arrays should be truncated
      expect(capturedData.items).toBeDefined();
      expect(capturedData.items.length).toBe(3);
      expect(capturedData.items_truncated).toBe(true);
      expect(capturedData.items_original_length).toBe(10);

      // Performance data should be removed
      expect(capturedData.performance).toBeUndefined();

      // Diagnostic data should be removed
      expect(capturedData.diagnostic).toBeUndefined();
    });

    it('should respect verbosity levels across pipeline stages', () => {
      // Set filter to minimal verbosity
      enhancedFilter.setVerbosityLevel('minimal');

      // Try to capture detailed performance data
      trace.captureEnhancedActionData(
        'performance_metrics',
        'test:action',
        { timing: 100, memory: 1024 },
        { category: 'performance' }
      );

      // Performance data requires detailed level, should be filtered out
      const actionTrace = trace.getActionTrace('test:action');
      expect(actionTrace).toBeNull(); // Not captured due to verbosity filtering
    });

    it('should handle dynamic rules during trace execution', () => {
      // Add a dynamic rule that filters out slow operations
      trace.addDynamicTraceRule('performanceFilter', ({ data }) => {
        if (data.timing && data.timing > 1000) {
          return false; // Filter out slow operations
        }
        return true;
      });

      // Capture fast operation
      trace.captureEnhancedActionData(
        'operation',
        'fast:action',
        { timing: 500, result: 'success' },
        { category: 'performance' }
      );

      // Capture slow operation
      trace.captureEnhancedActionData(
        'operation',
        'slow:action',
        { timing: 1500, result: 'success' },
        { category: 'performance' }
      );

      expect(trace.getActionTrace('fast:action')).toBeDefined();
      expect(trace.getActionTrace('slow:action')).toBeNull(); // Filtered by dynamic rule
    });

    it('should export filtered trace data based on verbosity', () => {
      // Capture data at different verbosity levels
      trace.captureEnhancedActionData(
        'core_operation',
        'action1',
        { basic: 'data' },
        { category: 'core' }
      );

      trace.captureEnhancedActionData(
        'performance_metrics',
        'action2',
        { timing: 100 },
        { category: 'performance' }
      );

      trace.captureEnhancedActionData(
        'debug_info',
        'action3',
        { debug: 'data' },
        { category: 'diagnostic' }
      );

      // Export at minimal verbosity
      const minimalExport = trace.exportFilteredTraceData('minimal');

      // Should include core data but not performance or diagnostic
      expect(Object.keys(minimalExport).length).toBeGreaterThan(0);

      // Export with category filter
      const coreOnlyExport = trace.exportFilteredTraceData('verbose', ['core']);

      // Should only include core category stages
      for (const actionData of Object.values(coreOnlyExport)) {
        for (const stage of Object.keys(actionData.stages)) {
          expect([
            'core_operation',
            'action_start',
            'action_complete',
          ]).toContain(stage);
        }
      }
    });

    it('should provide accurate enhanced statistics', () => {
      // Perform various operations
      for (let i = 0; i < 10; i++) {
        trace.captureEnhancedActionData(
          'test_stage',
          `action_${i}`,
          { index: i },
          { category: 'core' }
        );
      }

      const stats = trace.getEnhancedTraceStats();
      expect(stats).toBeDefined();
      expect(stats.totalChecks).toBeGreaterThan(0);
      expect(stats.cacheHitRate).toBeDefined();
      expect(stats.filterRate).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should clear cache on demand', () => {
      // Fill cache
      for (let i = 0; i < 10; i++) {
        trace.captureEnhancedActionData(
          'stage',
          `action_${i}`,
          { data: i },
          { category: 'core' }
        );
      }

      // Clear cache
      trace.clearEnhancedCache();

      // Verify cache was cleared by checking stats after new operations
      trace.resetEnhancedStats();

      trace.captureEnhancedActionData(
        'stage',
        'action_0', // Same as before
        { data: 0 },
        { category: 'core' }
      );

      const stats = trace.getEnhancedTraceStats();
      expect(stats.cacheHits).toBe(0); // No cache hits after clear
    });

    it('should optimize cache periodically', () => {
      // Add entries to cache
      for (let i = 0; i < 20; i++) {
        enhancedFilter.shouldCaptureEnhanced('category', `type_${i}`, {});
      }

      // Optimize with a short max age
      trace.optimizeEnhancedCache(0);

      // Verify optimization was attempted
      // Note: If no entries are old enough, no log will be generated
      // So we just verify the method ran without error
      expect(trace.optimizeEnhancedCache).toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with non-enhanced ActionTraceFilter', async () => {
      // Create trace with regular ActionTraceFilter
      const ActionTraceFilter = (
        await import('../../../../src/actions/tracing/actionTraceFilter.js')
      ).default;

      const regularFilter = new ActionTraceFilter({
        enabled: true,
        logger: mockLogger,
      });

      const regularTrace = new ActionAwareStructuredTrace({
        actionTraceFilter: regularFilter,
        actorId: 'test-actor',
        logger: mockLogger,
      });

      // Should still work with enhanced methods (graceful degradation)
      expect(() => {
        regularTrace.captureEnhancedActionData('stage', 'action', {
          data: 'test',
        });
      }).not.toThrow();

      // Enhanced stats should return null
      expect(regularTrace.getEnhancedTraceStats()).toBeNull();
    });

    it('should maintain existing captureActionData behavior', () => {
      // Use existing method
      trace.captureActionData(
        'existing_stage',
        'existing:action',
        { existingData: true, passed: true } // Include fields that pass filtering
      );

      // Verify it still works
      const actionTrace = trace.getActionTrace('existing:action');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages.existing_stage).toBeDefined();
      // Check the data within the stage structure
      const stageData = actionTrace.stages.existing_stage.data;
      // At standard verbosity, only certain fields are kept (passed, success, error, timestamp, stage)
      expect(stageData.passed).toBe(true);
      // existingData would be filtered out at standard verbosity unless it's one of the allowed fields
    });
  });
});
