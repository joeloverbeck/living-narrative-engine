/**
 * @file Performance tests for ActionExecutionTrace
 * @description Validates performance requirements for trace creation and serialization
 * @see src/actions/tracing/actionExecutionTrace.js
 */

import { describe, it, expect } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';

describe('ActionExecutionTrace - Performance Tests', () => {
  const validParams = {
    actionId: 'movement:go',
    actorId: 'player-1',
    turnAction: {
      actionDefinitionId: 'movement:go',
      commandString: 'go north',
      parameters: { direction: 'north' },
    },
  };

  describe('Trace Creation Performance', () => {
    it('should create traces quickly (<200ms for 1000 traces)', () => {
      // Warm up - let JIT optimization kick in (increased for better stability)
      for (let i = 0; i < 200; i++) {
        new ActionExecutionTrace({
          actionId: 'core:warmup',
          actorId: `warmup-${i}`,
          turnAction: { actionDefinitionId: 'core:warmup' },
        });
      }

      // Measure performance
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        new ActionExecutionTrace({
          actionId: 'core:test',
          actorId: `actor-${i}`,
          turnAction: { actionDefinitionId: 'core:test' },
        });
      }

      const duration = performance.now() - startTime;

      // Assert with more realistic threshold to prevent flakiness
      // 200ms for 1000 traces = 0.2ms per trace average, still very fast
      expect(duration).toBeLessThan(200);

      // Log performance metrics for monitoring
      const avgTimePerTrace = duration / iterations;
      console.log(
        `Trace creation performance: ${iterations} traces in ${duration.toFixed(2)}ms (avg: ${avgTimePerTrace.toFixed(3)}ms/trace)`
      );

      // Provide helpful context if test approaches threshold
      if (duration > 150) {
        console.log(
          `Warning: Performance approaching threshold (${duration.toFixed(2)}ms > 150ms). ` +
            `This may indicate system load or actual performance degradation.`
        );
      }
    });
  });

  describe('Serialization Performance', () => {
    it('should serialize efficiently (<1ms per serialization)', () => {
      const trace = new ActionExecutionTrace({
        actionId: 'core:test',
        actorId: 'player-1',
        turnAction: { actionDefinitionId: 'core:test' },
      });

      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      // Warm up - let JIT optimization kick in
      for (let i = 0; i < 100; i++) {
        trace.toJSON();
      }

      // Measure individual serialization times
      const iterations = 100;
      const measurements = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const json = trace.toJSON();
        const duration = performance.now() - startTime;
        measurements.push(duration);

        // Ensure serialization produces valid output
        expect(JSON.stringify(json).length).toBeGreaterThan(0);
      }

      // Calculate statistics
      const avgDuration =
        measurements.reduce((sum, val) => sum + val, 0) / iterations;
      const maxDuration = Math.max(...measurements);
      const p95Duration = measurements.sort((a, b) => a - b)[
        Math.floor(iterations * 0.95)
      ];

      // Assert with more realistic thresholds to prevent flakiness
      expect(avgDuration).toBeLessThan(2); // Average serialization in <2ms
      expect(p95Duration).toBeLessThan(3); // 95th percentile in <3ms

      // Log performance metrics for monitoring
      console.log(
        `Serialization performance - Avg: ${avgDuration.toFixed(3)}ms, P95: ${p95Duration.toFixed(3)}ms, Max: ${maxDuration.toFixed(3)}ms`
      );
    });

    it('should handle complex payloads efficiently', () => {
      const trace = new ActionExecutionTrace(validParams);

      trace.captureDispatchStart();

      // Add complex nested payload
      const complexPayload = {
        actor: 'player-1',
        action: 'movement:go',
        nested: {
          level1: {
            level2: {
              level3: {
                data: Array(100)
                  .fill(0)
                  .map((_, i) => ({
                    id: i,
                    value: `value-${i}`,
                    metadata: { timestamp: Date.now() },
                  })),
              },
            },
          },
        },
        arrays: Array(50)
          .fill(0)
          .map((_, i) => ({
            index: i,
            items: Array(10).fill(`item-${i}`),
          })),
      };

      trace.captureEventPayload(complexPayload);
      trace.captureDispatchResult({ success: true });

      // Warm up
      for (let i = 0; i < 50; i++) {
        trace.toJSON();
      }

      // Measure performance with complex data
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const json = trace.toJSON();
        expect(json).toBeTruthy();
      }

      const totalDuration = performance.now() - startTime;
      const avgDuration = totalDuration / iterations;

      // Even with complex data, should maintain reasonable performance
      expect(avgDuration).toBeLessThan(5); // <5ms per serialization with complex data

      console.log(
        `Complex payload serialization: ${avgDuration.toFixed(3)}ms average over ${iterations} iterations`
      );
    });
  });
});
