/**
 * @file Tracer Performance Overhead Tests
 * @description Performance benchmarks verifying that scope tracing has
 * minimal overhead when disabled and acceptable overhead when enabled.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ScopeTracingTestBed } from '../../common/scopeDsl/scopeTracingTestBed.js';

describe('Tracer Performance Overhead', () => {
  let testBed;

  beforeEach(async () => {
    testBed = await ScopeTracingTestBed.create();

    // Register scope for tracing
    await testBed.registerCustomScope('personal-space', 'close_actors');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should have minimal overhead when disabled', () => {
    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    // Warmup both paths to stabilize JIT before measurement
    // Path 1: No tracer
    for (let i = 0; i < 500; i++) {
      testBed.resolveSyncNoTracer('personal-space:close_actors', actorEntity);
    }
    // Path 2: Disabled tracer (needs its own warmup for fair comparison)
    testBed.scopeTracer.disable();
    for (let i = 0; i < 500; i++) {
      testBed.testEnv.unifiedScopeResolver.resolveSync(
        'personal-space:close_actors',
        actorEntity
      );
    }

    // Baseline: no tracer injected
    const start1 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testBed.resolveSyncNoTracer('personal-space:close_actors', actorEntity);
    }
    const duration1 = performance.now() - start1;

    // With tracer injected but disabled (already disabled during warmup)
    const start2 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testBed.testEnv.unifiedScopeResolver.resolveSync(
        'personal-space:close_actors',
        actorEntity
      );
    }
    const duration2 = performance.now() - start2;

    const overheadMs = duration2 - duration1;
    const overhead = ((duration2 - duration1) / duration1) * 100;

    console.log(
      'Disabled tracer overhead: ' +
        overhead.toFixed(2) +
        '% (' +
        overheadMs.toFixed(2) +
        'ms)'
    );
    console.log(
      'Baseline: ' +
        duration1.toFixed(2) +
        'ms, With tracer disabled: ' +
        duration2.toFixed(2) +
        'ms'
    );

    // Performance variance handling:
    // For fast baselines (< 20ms), percentage overhead is noisy due to
    // scheduler variance, JIT, and GC pauses. Use absolute check instead.
    // 10ms overhead for 1000 calls = 10μs per call, acceptable for a disabled check.
    if (duration1 < 20) {
      expect(overheadMs).toBeLessThan(10);
    } else {
      // For slower baselines, percentage check is more stable.
      // 30% overhead threshold catches genuine regressions while allowing
      // normal scheduling variance. The actual overhead from a disabled tracer
      // is O(1) early-exit check; measured overhead comes from test infrastructure.
      expect(overhead).toBeLessThan(30);
    }
  });

  it('should have acceptable overhead when enabled', () => {
    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    // Baseline: disabled
    const start1 = performance.now();
    for (let i = 0; i < 100; i++) {
      testBed.testEnv.unifiedScopeResolver.resolveSync(
        'personal-space:close_actors',
        actorEntity
      );
    }
    const duration1 = performance.now() - start1;

    // With tracer enabled
    testBed.enableScopeTracing();
    const start2 = performance.now();
    for (let i = 0; i < 100; i++) {
      testBed.testEnv.unifiedScopeResolver.resolveSync(
        'personal-space:close_actors',
        actorEntity
      );
      testBed.clearScopeTrace();
    }
    const duration2 = performance.now() - start2;

    const overheadMs = duration2 - duration1;
    const overhead = (overheadMs / duration1) * 100;

    console.log('Enabled tracer overhead: ' + overhead.toFixed(2) + '%');
    console.log(
      'Enabled tracer overhead (ms): ' + overheadMs.toFixed(2) + 'ms'
    );

    console.log(
      'Baseline: ' +
        duration1.toFixed(2) +
        'ms, With tracer enabled: ' +
        duration2.toFixed(2) +
        'ms'
    );

    // Tracer work is dominated by serialization, metadata capture, and timestamp recording for
    // each resolver node. Those costs are roughly constant per resolution, so percent overhead
    // swings wildly when the baseline duration is tiny (±5ms of scheduler variance can mean ±100%).
    // Use an absolute ceiling for day-to-day noise, plus a generous percentage guardrail to catch
    // catastrophic regressions.
    expect(overheadMs).toBeLessThan(150); // Less than 150ms extra across 100 resolutions
    expect(overhead).toBeLessThan(1000); // Less than 10x slower overall
  });

  it('should handle large trace data efficiently', () => {
    // Create many entities to generate large trace
    const names = Array.from({ length: 50 }, (_, i) => 'Actor' + i);
    const scenario = testBed.createCloseActors(names);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testBed.enableScopeTracing();

    const start = performance.now();
    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'personal-space:close_actors',
      actorEntity
    );
    const duration = performance.now() - start;

    const trace = testBed.getScopeTraceData();

    console.log(
      'Large trace (' +
        trace.steps.length +
        ' steps) took ' +
        duration.toFixed(2) +
        'ms'
    );

    // Should complete in reasonable time even with many steps
    expect(duration).toBeLessThan(1000); // Less than 1 second

    // Should have captured all steps
    expect(trace.steps.length).toBeGreaterThan(0);
  });

  it('should format output efficiently', () => {
    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testBed.enableScopeTracing();

    // Generate trace data
    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'personal-space:close_actors',
      actorEntity
    );

    // Measure formatting performance
    const start = performance.now();
    const formatted = testBed.getScopeTrace();
    const duration = performance.now() - start;

    console.log(
      'Formatting took ' +
        duration.toFixed(2) +
        'ms for ' +
        formatted.split('\n').length +
        ' lines'
    );

    // Formatting should be fast
    expect(duration).toBeLessThan(100); // Less than 100ms
    expect(formatted.length).toBeGreaterThan(0);
  });
});
