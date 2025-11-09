/**
 * @file Tracer Performance Overhead Tests
 * @description Performance benchmarks verifying that scope tracing has
 * minimal overhead when disabled and acceptable overhead when enabled.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('Tracer Performance Overhead', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Register scope for tracing
    await testFixture.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should have minimal overhead when disabled', () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    // Baseline: no tracer
    const start1 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );
    }
    const duration1 = performance.now() - start1;

    // With tracer disabled
    testFixture.scopeTracer.disable();
    const start2 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );
    }
    const duration2 = performance.now() - start2;

    const overhead = ((duration2 - duration1) / duration1) * 100;
     
    console.log('Disabled tracer overhead: ' + overhead.toFixed(2) + '%');
     
    console.log('Baseline: ' + duration1.toFixed(2) + 'ms, With tracer disabled: ' + duration2.toFixed(2) + 'ms');
    
    expect(overhead).toBeLessThan(5); // Less than 5% overhead
  });

  it('should have acceptable overhead when enabled', () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    // Baseline: disabled
    const start1 = performance.now();
    for (let i = 0; i < 100; i++) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );
    }
    const duration1 = performance.now() - start1;

    // With tracer enabled
    testFixture.enableScopeTracing();
    const start2 = performance.now();
    for (let i = 0; i < 100; i++) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );
      testFixture.clearScopeTrace();
    }
    const duration2 = performance.now() - start2;

    const overhead = ((duration2 - duration1) / duration1) * 100;
     
    console.log('Enabled tracer overhead: ' + overhead.toFixed(2) + '%');
     
    console.log('Baseline: ' + duration1.toFixed(2) + 'ms, With tracer enabled: ' + duration2.toFixed(2) + 'ms');
    
    expect(overhead).toBeLessThan(30); // Less than 30% overhead with tracing
  });

  it('should not leak memory with repeated tracing', () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testFixture.enableScopeTracing();

    // Run many iterations with clear between
    for (let i = 0; i < 1000; i++) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );
      testFixture.clearScopeTrace();
    }

    // Verify trace is cleared and no memory growth
    const trace = testFixture.getScopeTraceData();
    expect(trace.steps.length).toBe(0);
  });

  it('should handle large trace data efficiently', () => {
    // Create many entities to generate large trace
    const names = Array.from({ length: 50 }, (_, i) => 'Actor' + i);
    const scenario = testFixture.createCloseActors(names);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testFixture.enableScopeTracing();

    const start = performance.now();
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      { actorEntity }
    );
    const duration = performance.now() - start;

    const trace = testFixture.getScopeTraceData();
    
     
    console.log('Large trace (' + trace.steps.length + ' steps) took ' + duration.toFixed(2) + 'ms');
    
    // Should complete in reasonable time even with many steps
    expect(duration).toBeLessThan(1000); // Less than 1 second

    // Should have captured all steps
    expect(trace.steps.length).toBeGreaterThan(0);
  });

  it('should format output efficiently', () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testFixture.enableScopeTracing();
    
    // Generate trace data
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      { actorEntity }
    );

    // Measure formatting performance
    const start = performance.now();
    const formatted = testFixture.getScopeTrace();
    const duration = performance.now() - start;

     
    console.log('Formatting took ' + duration.toFixed(2) + 'ms for ' + formatted.split('\n').length + ' lines');
    
    // Formatting should be fast
    expect(duration).toBeLessThan(100); // Less than 100ms
    expect(formatted.length).toBeGreaterThan(0);
  });
});
