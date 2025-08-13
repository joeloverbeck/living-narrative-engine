/**
 * @file Performance tests for action tracing integration with the complete discovery pipeline
 * @description Tests performance impact and overhead of tracing in integration scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionDiscoveryServiceTestBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';

describe('Pipeline Tracing Integration Performance', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionDiscoveryServiceTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Performance Impact', () => {
    it('should have minimal overhead when tracing is disabled', async () => {
      const discoveryService = testBed.createDiscoveryServiceWithTracing({
        actionTracingEnabled: false,
        tracedActions: [],
      });

      const actor = testBed.createMockActor('player-1');
      const context = testBed.createMockContext();

      const startTime = performance.now();
      const result = await discoveryService.getValidActions(actor, context, {
        trace: false,
      });
      const durationWithoutTracing = performance.now() - startTime;

      expect(result.actions).toBeDefined();
      expect(durationWithoutTracing).toBeLessThan(100); // < 100ms (adjusted for integration test)
    });

    it('should handle concurrent pipeline processing', async () => {
      const discoveryService = testBed.createDiscoveryServiceWithTracing({
        actionTracingEnabled: true,
        tracedActions: ['*'], // Trace all actions
        verbosity: 'standard',
      });

      const actors = [];
      const context = testBed.createMockContext();
      for (let i = 0; i < 5; i++) {
        actors.push(testBed.createMockActor(`player-${i}`));
      }

      const promises = actors.map((actor) =>
        discoveryService.getValidActions(actor, context, { trace: true })
      );

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      // Should handle 5 concurrent discoveries efficiently
      expect(duration).toBeLessThan(500); // < 500ms total (adjusted for integration test)

      // Verify all results have tracing data
      results.forEach((result, index) => {
        expect(result.actions).toBeDefined();
        expect(result.trace).toBeDefined();
      });
    });

    it('should not significantly impact performance with tracing enabled', async () => {
      // First, baseline without tracing
      const baselineService = testBed.createStandardDiscoveryService();
      const actor = testBed.createMockActor('perf-test');
      const context = testBed.createMockContext();

      const baselineStart = performance.now();
      await baselineService.getValidActions(actor, context);
      const baselineDuration = performance.now() - baselineStart;

      // Then test with tracing enabled
      const tracingService = testBed.createDiscoveryServiceWithTracing({
        actionTracingEnabled: true,
        tracedActions: ['*'],
        verbosity: 'standard',
      });

      const tracingStart = performance.now();
      await tracingService.getValidActions(actor, context, { trace: true });
      const tracingDuration = performance.now() - tracingStart;

      // Overhead should be reasonable (not more than 2.5x slower for this integration test)
      // In a mock environment, there may be some additional overhead
      const overhead = tracingDuration / baselineDuration;
      expect(overhead).toBeLessThan(2.5);
    });
  });
});
